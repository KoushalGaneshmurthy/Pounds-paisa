import React, { useState } from 'react';
import {
  Lock,
  LogOut,
  Mail,
  Shield,
  ShieldCheck,
  User,
  X,
  AlertCircle,
  CheckCircle2,
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
}

export function AuthModal({
  isOpen,
  onClose,
  currentUser,
  onUserChange,
}: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  // Form states
  const [identifier, setIdentifier] = useState('');
  const [signUpUsername, setSignUpUsername] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
      signUpEmail.trim() || `${cleanUsername.toLowerCase()}@pounds-paisa.app`;

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
              User Account
              {currentUser ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Active
                </span>
              ) : isConfigured ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Cloud Ready
                </span>
              ) : (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 border border-slate-500/30">
                  Local
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-300">
              {currentUser
                ? `Logged in as @${currentHandle}`
                : 'Multi-user accounts with private isolated storage'}
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
                <span>Account Info</span>
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
                <span>Private and isolated to this account.</span>
              </div>
            </div>

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
            </div>

            {/* Mode Content */}
            {mode === 'signin' ? (
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
                  {loading ? 'Creating account...' : 'Create Account'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
