import React, { useState } from 'react';
import {
  Cloud,
  Database,
  ExternalLink,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Server,
  Shield,
  ShieldCheck,
  User,
  X,
  AlertCircle,
  CheckCircle2,
  UploadCloud,
  DownloadCloud,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { supabaseService } from '../services/supabaseService';
import {
  authenticateLocalUser,
  registerLocalUser,
  setActiveLocalSession,
  VaultUser,
} from '../utils/cryptoVault';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onUserChange: (user: any) => void;
  onSyncPush?: () => Promise<void>;
  onSyncPull?: () => Promise<void>;
  hasLocalData?: boolean;
}

export function AuthModal({
  isOpen,
  onClose,
  currentUser,
  onUserChange,
  onSyncPush,
  onSyncPull,
}: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'setup'>(
    currentUser ? 'signin' : 'signin'
  );

  // Form states
  const [identifier, setIdentifier] = useState('');
  const [signUpUsername, setSignUpUsername] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  if (!isOpen) return null;

  const isConfigured = isSupabaseConfigured();

  // Helper to extract a displayable name/handle
  const getUserHandle = (user: any): string => {
    if (!user) return 'User';
    return (
      user.user_metadata?.username ||
      user.username ||
      user.user_metadata?.display_name ||
      user.displayName ||
      user.email?.split('@')[0] ||
      'User'
    );
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanId = identifier.trim();
    if (!cleanId || !password) {
      setErrorMsg('Please enter your username/email and password.');
      setLoading(false);
      return;
    }

    try {
      let loggedInUser: any = null;

      // 1. If Supabase is configured, try Supabase cloud authentication first
      if (isConfigured && supabase) {
        let emailToTry = cleanId;

        // If identifier is not an email, resolve username to email via Supabase RPC / metadata
        if (!cleanId.includes('@')) {
          const resolvedEmail = await supabaseService.resolveEmailFromUsername(cleanId);
          if (resolvedEmail) {
            emailToTry = resolvedEmail;
          } else {
            // Fallback synthetic domain if user signed up with just username
            emailToTry = `${cleanId.toLowerCase()}@pounds-paisa.app`;
          }
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailToTry,
          password,
        });

        if (!error && data?.user) {
          loggedInUser = data.user;
          // Store active local session mirror
          setActiveLocalSession({
            id: data.user.id,
            username: data.user.user_metadata?.username || cleanId,
            email: data.user.email || emailToTry,
            displayName: data.user.user_metadata?.display_name || cleanId,
            passwordHash: '',
            salt: '',
            createdAt: data.user.created_at,
          });
        }
      }

      // 2. If Supabase didn't authenticate or is offline, try Local Encrypted Vault
      if (!loggedInUser) {
        try {
          const localUser = await authenticateLocalUser(cleanId, password);
          loggedInUser = {
            id: localUser.id,
            email: localUser.email,
            username: localUser.username,
            user_metadata: {
              username: localUser.username,
              display_name: localUser.displayName,
            },
          };
        } catch (localErr: any) {
          // If neither worked, show error
          if (!isConfigured) {
            throw localErr;
          } else {
            throw new Error(
              'Invalid login credentials. Please check your username/email and password.'
            );
          }
        }
      }

      if (loggedInUser) {
        onUserChange(loggedInUser);
        setSuccessMsg(`Welcome back, ${getUserHandle(loggedInUser)}! Vault decrypted.`);
        setTimeout(() => onClose(), 800);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanUsername = signUpUsername.trim();
    if (!cleanUsername) {
      setErrorMsg('Please enter a username.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      setLoading(false);
      return;
    }

    const effectiveEmail =
      signUpEmail.trim() || `${cleanUsername.toLowerCase()}@pounds-paisa.local`;

    try {
      let createdUser: any = null;

      // 1. If Supabase is configured, create cloud user
      if (isConfigured && supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: effectiveEmail,
          password,
          options: {
            data: {
              username: cleanUsername,
              display_name: cleanUsername,
            },
          },
        });

        if (error) throw error;
        if (data?.user) {
          createdUser = data.user;
        }
      }

      // 2. Also register in local encrypted vault directory so data is always accessible
      const localUser = await registerLocalUser(cleanUsername, effectiveEmail, password);
      if (!createdUser) {
        createdUser = {
          id: localUser.id,
          email: localUser.email,
          username: localUser.username,
          user_metadata: {
            username: localUser.username,
            display_name: localUser.displayName,
          },
        };
      }

      onUserChange(createdUser);
      setSuccessMsg(`Account created successfully for @${cleanUsername}!`);
      setTimeout(() => onClose(), 900);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      if (supabase && isConfigured) {
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore
        }
      }
      setActiveLocalSession(null);
      onUserChange(null);
      setSuccessMsg('Vault locked and signed out securely.');
      setTimeout(() => onClose(), 800);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to sign out.');
    } finally {
      setLoading(false);
    }
  };

  const currentHandle = getUserHandle(currentUser);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-[#0F2936] border border-teal-500/30 text-white rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-7">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-teal-500/20 text-[#0C232D]">
            <Shield className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              User Vault &amp; Auth
              {currentUser ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Unlocked
                </span>
              ) : isConfigured ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Cloud + Local
                </span>
              ) : (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Encrypted Local
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-300">
              {currentUser
                ? `Logged in as @${currentHandle}`
                : 'Isolated accounts with AES-256 client-side vault encryption'}
            </p>
          </div>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* If user is already logged in */}
        {currentUser ? (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-wider font-semibold">
                <span>Active Account</span>
                <span className="text-[10px] text-emerald-400 font-mono">AES-256 GCM</span>
              </div>
              <div className="flex items-center gap-2.5 text-base font-bold text-white">
                <User className="w-5 h-5 text-teal-400" />
                <span>@{currentHandle}</span>
              </div>
              {currentUser.email && (
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">{currentUser.email}</span>
                </div>
              )}
              <div className="text-xs text-slate-400 flex items-center gap-2 pt-1 border-t border-white/5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Zero data leakage: all expenses and archives locked to this user.</span>
              </div>
            </div>

            {/* Sync Controls (if Supabase is configured) */}
            {isConfigured && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">Cloud Synchronization</div>
                <div className="grid grid-cols-2 gap-2">
                  {onSyncPush && (
                    <button
                      type="button"
                      onClick={async () => {
                        setSyncLoading(true);
                        setErrorMsg(null);
                        try {
                          await onSyncPush();
                          setSuccessMsg('Encrypted vault synced to Supabase cloud!');
                        } catch (err: any) {
                          setErrorMsg(err?.message || 'Sync failed.');
                        } finally {
                          setSyncLoading(false);
                        }
                      }}
                      disabled={syncLoading}
                      className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-teal-600/30 hover:bg-teal-600/50 border border-teal-500/40 text-teal-200 text-xs font-semibold transition"
                    >
                      <UploadCloud className="w-4 h-4" />
                      <span>Upload Cloud</span>
                    </button>
                  )}
                  {onSyncPull && (
                    <button
                      type="button"
                      onClick={async () => {
                        setSyncLoading(true);
                        setErrorMsg(null);
                        try {
                          await onSyncPull();
                          setSuccessMsg('Cloud data loaded into vault!');
                        } catch (err: any) {
                          setErrorMsg(err?.message || 'Pull failed.');
                        } finally {
                          setSyncLoading(false);
                        }
                      }}
                      disabled={syncLoading}
                      className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 text-xs font-semibold transition"
                    >
                      <DownloadCloud className="w-4 h-4" />
                      <span>Pull Cloud</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-sm font-semibold transition"
            >
              <LogOut className="w-4 h-4" />
              <span>{loading ? 'Locking...' : 'Sign Out & Lock Vault'}</span>
            </button>
          </div>
        ) : (
          <div>
            {/* Mode Tabs */}
            <div className="flex border-b border-white/10 mb-5 text-sm">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className={`flex-1 pb-2.5 font-medium border-b-2 text-center transition ${
                  mode === 'signin'
                    ? 'border-teal-400 text-teal-300 font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`flex-1 pb-2.5 font-medium border-b-2 text-center transition ${
                  mode === 'signup'
                    ? 'border-teal-400 text-teal-300 font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => setMode('setup')}
                className={`flex-1 pb-2.5 font-medium border-b-2 text-center transition ${
                  mode === 'setup'
                    ? 'border-teal-400 text-teal-300 font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Setup Info
              </button>
            </div>

            {/* Mode Content */}
            {mode === 'setup' ? (
              <div className="space-y-4 text-xs text-slate-300">
                <div className="p-3.5 rounded-xl bg-teal-950/40 border border-teal-500/30 space-y-2">
                  <div className="font-semibold text-teal-200 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-teal-400" />
                    How user accounts &amp; encryption work:
                  </div>
                  <ul className="list-disc pl-4 space-y-1.5 text-slate-300 leading-relaxed">
                    <li>
                      <strong>Username or Email:</strong> Log in with your email (e.g. <code>adi@example.com</code>) or your username (e.g. <code>koushal</code>).
                    </li>
                    <li>
                      <strong>AES-256 Encryption:</strong> Your expenses, limits, and archives are encrypted using AES-GCM 256-bit keys before touching browser storage.
                    </li>
                    <li>
                      <strong>Account Isolation:</strong> When you switch accounts or log out, your private financial data is wiped from active memory immediately.
                    </li>
                    <li>
                      <strong>Cloud Backend (Optional):</strong> Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to enable cross-device cloud sync.
                    </li>
                  </ul>
                </div>
              </div>
            ) : mode === 'signin' ? (
              <form onSubmit={handleSignIn} className="space-y-4" autoComplete="off">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Email or Username
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-teal-400 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-teal-400 transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 font-bold text-[#0C232D] text-sm shadow-lg shadow-teal-500/20 transition disabled:opacity-50"
                >
                  {loading ? 'Authenticating & Decrypting...' : 'Sign In'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignUp} className="space-y-4" autoComplete="off">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Username
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={signUpUsername}
                      onChange={(e) => setSignUpUsername(e.target.value)}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-teal-400 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Email Address</span>
                    <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="email"
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-teal-400 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-teal-400 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-teal-400 transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 font-bold text-[#0C232D] text-sm shadow-lg shadow-teal-500/20 transition disabled:opacity-50"
                >
                  {loading ? 'Creating Encrypted Vault...' : 'Create Account'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Security & Encryption Footer Card */}
        <div className="mt-6 pt-4 border-t border-white/10 flex flex-col gap-2 text-[11px] text-slate-400">
          <div className="flex items-center justify-between font-semibold text-slate-300">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Security Architecture
            </span>
            <span className="px-1.5 py-0.5 rounded bg-white/10 text-teal-300 font-mono text-[10px]">
              AES-GCM-256 + PBKDF2
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
            <div className="p-2 rounded-lg bg-black/30 border border-white/5 space-y-0.5">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Vault Storage</span>
              <span className="text-white font-medium flex items-center gap-1">
                Client-Side Encrypted
              </span>
            </div>
            <div className="p-2 rounded-lg bg-black/30 border border-white/5 space-y-0.5">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Data Isolation</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                Zero Cross-User Leak
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
