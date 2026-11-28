import React, { useState } from 'react';
import {
  Cloud,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  KeyRound,
  Globe,
  X,
  Database,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import {
  clearRuntimeSupabaseConfig,
  getSupabaseConfig,
  saveRuntimeSupabaseConfig,
  testSupabaseConnection,
} from '../lib/supabase';

interface CloudSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: () => void;
}

export function CloudSetupModal({ isOpen, onClose, onConnected }: CloudSetupModalProps) {
  const currentConfig = getSupabaseConfig();
  const [url, setUrl] = useState(currentConfig.url || '');
  const [anonKey, setAnonKey] = useState(currentConfig.anonKey || '');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isConnected = currentConfig.source !== 'none';

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanUrl = url.trim();
    const cleanKey = anonKey.trim();

    if (!cleanUrl.startsWith('https://')) {
      setErrorMsg('Project URL must start with https:// (e.g. https://your-project.supabase.co)');
      setLoading(false);
      return;
    }

    if (!cleanKey || cleanKey.length < 20) {
      setErrorMsg('Please enter a valid Supabase anon public key.');
      setLoading(false);
      return;
    }

    const test = await testSupabaseConnection(cleanUrl, cleanKey);
    if (!test.success) {
      setErrorMsg(`Connection failed: ${test.message}. Please check your URL and anon key.`);
      setLoading(false);
      return;
    }

    saveRuntimeSupabaseConfig(cleanUrl, cleanKey);
    setSuccessMsg('Successfully connected to Supabase Cloud! Accounts and data will now sync globally.');
    setLoading(false);

    if (onConnected) {
      onConnected();
    }

    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleDisconnect = () => {
    if (window.confirm('Disconnect cloud database on this browser? It will return to offline Local Mode.')) {
      clearRuntimeSupabaseConfig();
      setUrl('');
      setAnonKey('');
      setSuccessMsg('Cloud disconnected. Running in Local Mode.');
      if (onConnected) onConnected();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#0E2734] border border-teal-500/30 text-white rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-7">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-[#0C232D] shadow-lg shadow-teal-500/20">
            <Database className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Cloud Database Setup
              {isConnected ? (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Connected ({currentConfig.source === 'env' ? 'Vercel Env' : 'Live'})
                </span>
              ) : (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Offline Local Mode
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-300">
              Sync your accounts & budget across all devices worldwide (India, UK, mobile)
            </p>
          </div>
        </div>

        {/* Why this is required explanation */}
        <div className="mb-5 p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 leading-relaxed space-y-1.5">
          <p className="font-semibold text-teal-300 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" />
            Why accounts fail on other devices in Local Mode:
          </p>
          <p>
            When no cloud database is connected, accounts and expenses are stored solely in this specific browser&apos;s memory (<code className="text-teal-200">localStorage</code>). Other devices or users in India cannot see them.
          </p>
          <p>
            Connecting your Supabase project enables real-time cloud sync so you and your friends can log in from any phone, laptop, or country.
          </p>
        </div>

        {/* Status Alerts */}
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

        {/* Form */}
        <form onSubmit={handleTestAndSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Supabase Project URL
            </label>
            <div className="relative">
              <Cloud className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://xyzcompany.supabase.co"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-teal-400 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Supabase Anon Public Key
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                required
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-teal-400 transition"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 font-bold text-[#0C232D] text-xs shadow-lg shadow-teal-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Testing Connection...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Connect & Enable Global Sync</span>
                </>
              )}
            </button>

            {isConnected && currentConfig.source === 'runtime' && (
              <button
                type="button"
                onClick={handleDisconnect}
                className="py-2.5 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-xs font-medium transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            )}
          </div>
        </form>

        {/* Global deployment note */}
        <div className="mt-5 pt-4 border-t border-white/10 text-[11px] text-slate-400 space-y-1.5">
          <p className="font-semibold text-slate-300">
            💡 For permanent global connection on Vercel:
          </p>
          <ol className="list-decimal pl-4 space-y-1">
            <li>
              Open your <strong>Vercel Project Dashboard → Settings → Environment Variables</strong>.
            </li>
            <li>
              Add <code className="text-teal-300">VITE_SUPABASE_URL</code> and{' '}
              <code className="text-teal-300">VITE_SUPABASE_ANON_KEY</code>.
            </li>
            <li>
              Redeploy your Vercel project so all devices automatically connect to Supabase.
            </li>
            <li>
              Run <code className="text-teal-300">supabase/schema.sql</code> in your Supabase SQL Editor.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
