import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { isSupabaseConfigured, signInWithGoogle } from '../services/supabaseClient.js';
import { useAuth } from '../context/AuthContext.js';
import { COLOR_TOKENS, SPRING_PRESETS } from '../client/design-system/tokens.js';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, signInWithGoogleDemo, switchToGuest } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const hasCloud = isSupabaseConfigured();

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await signInWithGoogle();
      if (!res.success) {
        setErrorMsg(res.error || 'Authentication failed. Please try again.');
        return;
      }

      // If in local fallback mode, sync local context user
      if (res.mode === 'local_fallback') {
        signInWithGoogleDemo();
      }

      // If redirect URL provided by Supabase OAuth, redirect browser
      if (res.data?.url && typeof window !== 'undefined') {
        window.location.href = res.data.url;
        return;
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unexpected login error');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = () => {
    switchToGuest();
    onSuccess?.();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-md"
          onClick={onClose}
          data-testid="auth-modal-backdrop"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={SPRING_PRESETS.snappy}
            onClick={(e) => e.stopPropagation()}
            data-testid="auth-modal"
            className="w-full max-w-md rounded-3xl border border-slate-200/80 dark:border-white/[0.12] overflow-hidden shadow-2xl p-6 space-y-6 relative select-none bg-white/95 dark:bg-[#121622]/95 backdrop-blur-2xl text-slate-900 dark:text-white"
          >
            {/* Ambient Background Glow */}
            <div
              className="absolute -top-20 -right-20 w-44 h-44 rounded-full pointer-events-none blur-3xl opacity-20"
              style={{
                background: `radial-gradient(circle, ${COLOR_TOKENS.lightBlue}, ${COLOR_TOKENS.lightOrange})`,
              }}
            />

            {/* Header with Close Button */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0EA5E9]/20 to-[#FF6B2C]/20 border border-slate-200/80 dark:border-white/[0.1] flex items-center justify-center text-lg">
                  🥗
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A] dark:text-white tracking-tight">VibeDiet ID</h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">Private &amp; Adaptive Metabolic Intelligence</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                data-testid="close-auth-modal-btn"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Real-Time Sync Status Badge */}
            <div className="flex items-center justify-between bg-slate-50 dark:bg-black/40 border border-slate-200/70 dark:border-white/[0.06] rounded-2xl p-3.5 text-xs">
              <span className="text-slate-600 dark:text-zinc-400 font-medium">Session Sync Engine</span>
              {hasCloud ? (
                <span
                  data-testid="sync-badge-cloud"
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 flex items-center gap-1.5"
                >
                  <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                  Supabase Cloud Sync
                </span>
              ) : (
                <span
                  data-testid="sync-badge-local"
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#0EA5E9]/15 text-[#0EA5E9] dark:text-[#38BDF8] border border-[#0EA5E9]/30 dark:border-[#38BDF8]/30 flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9] dark:bg-[#38BDF8]" />
                  Local Encrypted Mode
                </span>
              )}
            </div>

            {/* Active User Card (if signed in) */}
            {user && (
              <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/[0.06] rounded-2xl p-3.5 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-[#0F172A] dark:text-white truncate max-w-[200px]">{user.displayName}</p>
                  <p className="text-slate-500 dark:text-zinc-400 text-[11px]">{user.email}</p>
                </div>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-orange-50 dark:bg-[#FF6B2C]/20 text-[#FF6B2C] border border-orange-200 dark:border-[#FF6B2C]/40"
                >
                  {user.isGuest ? 'GUEST' : 'ACTIVE'}
                </span>
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-medium">
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Auth Actions */}
            <div className="space-y-3">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={handleGoogleSignIn}
                disabled={loading}
                data-testid="google-signin-btn"
                className="w-full py-3 px-4 rounded-2xl bg-[#0F172A] hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-slate-950 font-bold text-xs tracking-wide transition flex items-center justify-center gap-2.5 shadow-lg cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{loading ? 'Authenticating with Google...' : 'Continue with Google'}</span>
              </motion.button>

              <button
                type="button"
                onClick={handleGuestMode}
                data-testid="guest-signin-btn"
                className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-zinc-300 dark:hover:text-white border border-slate-200 dark:border-white/[0.08] text-xs font-semibold transition cursor-pointer"
              >
                🕶️ Continue in Local Encrypted Sandbox
              </button>
            </div>

            {/* Privacy & Zero-Knowledge Shield Note */}
            <p className="text-[10px] text-slate-500 dark:text-zinc-500 text-center leading-relaxed">
              VibeDiet implements client-side zero-knowledge encryption. Meal photos are processed ephemerally in RAM and purged upon confirmation.
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
