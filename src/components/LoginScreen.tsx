import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Cloud,
  Database,
  Lock,
  Mail,
  Shield,
  User,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { supabaseService } from '../services/supabaseService';
import {
  authenticateLocalUser,
  registerLocalUser,
  setActiveLocalSession,
} from '../utils/cryptoVault';
import { CloudSetupModal } from './CloudSetupModal';

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

  const [isConfigured, setIsConfigured] = useState(() => isSupabaseConfigured());
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);

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

      // 1. If Supabase is configured, authenticate with Supabase Cloud
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

        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes('email not confirmed')) {
            throw new Error(
              'Email not confirmed in Supabase. Please turn OFF "Confirm email" in Supabase Auth Settings (Auth → Providers → Email) so users can sign in immediately.'
            );
          }
          if (msg.includes('invalid login credentials')) {
            throw new Error(
              'Invalid credentials. Please verify your username/email and password, or create an account.'
            );
          }
          throw new Error(error.message || 'Failed to sign in.');
        }

        if (data?.user) {
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

      // 2. Fallback to Local Encrypted Vault (only if cloud is not connected)
      if (!loggedInUser) {
        if (!isConfigured) {
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
            throw localErr;
          }
        }
      }

      if (loggedInUser) {
        setSuccessMsg('Signed in successfully.');
        setTimeout(() => {
          onLoginSuccess(loggedInUser);
        }, 300);
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
      signUpEmail.trim() || `${cleanUsername.toLowerCase()}@pounds-paisa.app`;

    try {
      let createdUser: any = null;

      // 1. If Supabase is configured, create Supabase cloud account
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

        if (error) {
          throw new Error(error.message || 'Failed to create Supabase account.');
        }

        if (data?.user) {
          createdUser = data.user;
          // Store session mirror if session established immediately
          setActiveLocalSession({
            id: data.user.id,
            username: cleanUsername,
            email: data.user.email || effectiveEmail,
            displayName: cleanUsername,
            passwordHash: '',
            salt: '',
            createdAt: data.user.created_at,
          });
        }
      } else {
        // 2. Register local encrypted vault account (offline mode only)
        const localUser = await registerLocalUser(cleanUsername, effectiveEmail, password);
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
      }, 400);
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
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-[#0C232D] shadow-xl shadow-teal-500/25 mb-3.5">
            <Shield className="w-8 h-8 stroke-[2.5]" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1.5 font-display">
            Pounds &amp; Paisa
          </h1>
          <p className="text-sm text-slate-300">
            Sign in to access your budget
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-[#0F2936]/90 border border-teal-500/30 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl">
          {/* Cloud vs Local Status Indicator */}
          {isConfigured ? (
            <div className="flex items-center justify-between mb-4 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs">
              <span className="flex items-center gap-2 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Cloud Database Connected (Multi-device worldwide)
              </span>
              <button
                type="button"
                onClick={() => setIsCloudModalOpen(true)}
                className="text-[11px] text-teal-300 hover:text-white underline font-semibold"
              >
                Settings
              </button>
            </div>
          ) : (
            <div className="mb-4 p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5 text-amber-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                  Offline Local Mode (This Device Only)
                </span>
                <button
                  type="button"
                  onClick={() => setIsCloudModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold text-[11px] border border-amber-500/30 transition flex items-center gap-1"
                >
                  <Database className="w-3 h-3" />
                  <span>Connect Cloud</span>
                </button>
              </div>
              <p className="text-[11px] text-amber-200/90 leading-tight">
                Accounts created here will only exist on this browser. Connect Supabase Cloud to access your account across devices or in India.
              </p>
            </div>
          )}

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
                <span>{loading ? 'Signing in...' : 'Sign In'}</span>
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
                <span>{loading ? 'Creating account...' : 'Create Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>

      <CloudSetupModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        onConnected={() => setIsConfigured(isSupabaseConfigured())}
      />
    </div>
  );
}
