import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Lock,
  Mail,
  Shield,
  ShieldCheck,
  User,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { supabaseService } from '../services/supabaseService';
import {
  authenticateLocalUser,
  registerLocalUser,
  setActiveLocalSession,
} from '../utils/cryptoVault';

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');

  // Form states
  const [identifier, setIdentifier] = useState('');
  const [signUpUsername, setSignUpUsername] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isConfigured = isSupabaseConfigured();

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

        if (!cleanId.includes('@')) {
          const resolvedEmail = await supabaseService.resolveEmailFromUsername(cleanId);
          if (resolvedEmail) {
            emailToTry = resolvedEmail;
          } else {
            emailToTry = `${cleanId.toLowerCase()}@pounds-paisa.app`;
          }
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailToTry,
          password,
        });

        if (!error && data?.user) {
          loggedInUser = data.user;
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

      // 2. Fallback to Local Encrypted Vault
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
        setSuccessMsg('Vault decrypted successfully.');
        setTimeout(() => {
          onLoginSuccess(loggedInUser);
        }, 400);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to sign in. Please try again.');
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

      // 1. If Supabase is configured, create Supabase account
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

      // 2. Register local encrypted vault account
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

      setSuccessMsg(`Account created for @${cleanUsername}.`);
      setTimeout(() => {
        onLoginSuccess(createdUser);
      }, 500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0C232D] text-white flex flex-col justify-center items-center px-4 py-8 sm:px-6 relative overflow-hidden">
      {/* Radial atmospheric background */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(24,84,104,0.65)_0%,_rgba(12,35,45,0.95)_55%,_rgba(8,24,32,1)_100%)]"
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-[#0C232D] shadow-xl shadow-teal-500/25 mb-4">
            <Shield className="w-8 h-8 stroke-[2.5]" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2 font-display">
            Pounds &amp; Paisa
          </h1>
          <p className="text-sm text-slate-300">
            Sign in to access your budget &amp; expense vault
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-[#0F2936]/90 border border-teal-500/30 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl">
          {/* Tab Switcher */}
          <div className="flex border-b border-white/10 mb-6 text-sm">
            <button
              type="button"
              onClick={() => {
                setTab('signin');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 pb-3 font-semibold text-center border-b-2 transition ${
                tab === 'signin'
                  ? 'border-teal-400 text-teal-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('signup');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 pb-3 font-semibold text-center border-b-2 transition ${
                tab === 'signup'
                  ? 'border-teal-400 text-teal-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {tab === 'signin' ? (
            <form onSubmit={handleSignIn} className="space-y-4" autoComplete="off">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Email or Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-teal-400 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-teal-400 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 font-bold text-[#0C232D] text-sm shadow-lg shadow-teal-500/25 transition flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                <span>{loading ? 'Decrypting Vault...' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-4" autoComplete="off">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={signUpUsername}
                    onChange={(e) => setSignUpUsername(e.target.value)}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-teal-400 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Email Address</span>
                  <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="email"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-teal-400 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-teal-400 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-teal-400 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 font-bold text-[#0C232D] text-sm shadow-lg shadow-teal-500/25 transition flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                <span>{loading ? 'Creating Encrypted Vault...' : 'Create Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Encryption status */}
          <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4" />
              AES-GCM-256 Encrypted
            </span>
            <span className="px-2 py-0.5 rounded bg-white/10 text-slate-300 font-mono text-[10px]">
              Zero Data Leakage
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
