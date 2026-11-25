import React, { useState } from 'react';
import {
  Cloud,
  Database,
  ExternalLink,
  Key,
  Lock,
  LogOut,
  Mail,
  ShieldCheck,
  UploadCloud,
  DownloadCloud,
  User,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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
  hasLocalData = false,
}: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'setup'>(
    currentUser ? 'signin' : isSupabaseConfigured() ? 'signin' : 'setup'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  if (!isOpen) return null;

  const isConfigured = isSupabaseConfigured();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;
      if (data.user) {
        onUserChange(data.user);
        setSuccessMsg('Signed in successfully!');
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
    if (!supabase) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim() || undefined,
          },
        },
      });

      if (error) throw error;

      if (data.session?.user) {
        onUserChange(data.session.user);
        setSuccessMsg('Account created and signed in!');
        setTimeout(() => onClose(), 900);
      } else {
        setSuccessMsg('Account created! Please check your email to verify.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      await supabase.auth.signOut();
      onUserChange(null);
      setSuccessMsg('Signed out successfully.');
      setTimeout(() => onClose(), 800);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to sign out.');
    } finally {
      setLoading(false);
    }
  };

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
            <Cloud className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Cloud & Supabase
              {currentUser ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Connected
                </span>
              ) : isConfigured ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Ready
                </span>
              ) : (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Local Mode
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-300">
              {currentUser
                ? `Logged in as ${currentUser.email}`
                : isConfigured
                ? 'Sign in to sync your budget & receipts across devices'
                : 'Connect Supabase PostgreSQL backend for cloud sync'}
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
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                Account Details
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <Mail className="w-4 h-4 text-teal-400" />
                <span className="truncate">{currentUser.email}</span>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-2 pt-1">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Encrypted & Protected by Supabase Row-Level Security</span>
              </div>
            </div>

            {/* Sync Controls */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-300">Data Synchronization</div>
              <div className="grid grid-cols-2 gap-2">
                {onSyncPush && (
                  <button
                    type="button"
                    onClick={async () => {
                      setSyncLoading(true);
                      setErrorMsg(null);
                      try {
                        await onSyncPush();
                        setSuccessMsg('Local data uploaded to Supabase!');
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
                    <span>Upload Local</span>
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
                        setSuccessMsg('Cloud data loaded!');
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

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-sm font-semibold transition"
            >
              <LogOut className="w-4 h-4" />
              <span>{loading ? 'Signing out...' : 'Sign Out'}</span>
            </button>
          </div>
        ) : (
          <div>
            {/* Mode Tabs */}
            <div className="flex border-b border-white/10 mb-5 text-sm">
              <button
                type="button"
                onClick={() => setMode('signin')}
                disabled={!isConfigured}
                className={`flex-1 pb-2.5 font-medium border-b-2 text-center transition ${
                  mode === 'signin'
                    ? 'border-teal-400 text-teal-300 font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                } ${!isConfigured ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                disabled={!isConfigured}
                className={`flex-1 pb-2.5 font-medium border-b-2 text-center transition ${
                  mode === 'signup'
                    ? 'border-teal-400 text-teal-300 font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                } ${!isConfigured ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                Setup Guide
              </button>
            </div>

            {/* Mode Content */}
            {mode === 'setup' ? (
              <div className="space-y-4 text-xs text-slate-300">
                <div className="p-3.5 rounded-xl bg-teal-950/40 border border-teal-500/30 space-y-2">
                  <div className="font-semibold text-teal-200 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-teal-400" />
                    How to connect your Supabase project:
                  </div>
                  <ol className="list-decimal pl-4 space-y-1.5 text-slate-300 leading-relaxed">
                    <li>
                      Create a project on{' '}
                      <a
                        href="https://supabase.com"
                        target="_blank"
                        rel="noreferrer"
                        className="text-teal-400 underline inline-flex items-center gap-0.5"
                      >
                        supabase.com <ExternalLink className="w-3 h-3 inline" />
                      </a>
                    </li>
                    <li>
                      Go to <strong>Project Settings → API</strong> and copy your <code>Project URL</code> and <code>anon public key</code>.
                    </li>
                    <li>
                      Add them to your <code>.env</code> file (or Vercel Environment Variables):
                      <div className="mt-1 p-2 rounded bg-black/40 font-mono text-[11px] text-teal-300 select-all">
                        VITE_SUPABASE_URL=https://xyz.supabase.co<br />
                        VITE_SUPABASE_ANON_KEY=eyJhbGci...
                      </div>
                    </li>
                    <li>
                      Run the schema SQL script from <code>supabase/schema.sql</code> in the Supabase SQL Editor.
                    </li>
                  </ol>
                </div>
                <p className="text-[11px] text-slate-400 italic">
                  Note: If Supabase is not connected yet, Pounds & Paisa continues to work 100% locally with full offline storage!
                </p>
              </div>
            ) : (
              <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
                {mode === 'signup' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Your Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g. Rahul Sharma"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-400 transition"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@university.ac.uk"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-400 transition"
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
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-400 transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 font-bold text-[#0C232D] text-sm shadow-lg shadow-teal-500/20 transition disabled:opacity-50"
                >
                  {loading
                    ? 'Processing...'
                    : mode === 'signin'
                    ? 'Sign In to Pounds & Paisa'
                    : 'Create Account & Enable Cloud Sync'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
