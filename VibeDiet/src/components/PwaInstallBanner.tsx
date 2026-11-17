import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  getOfflineQueueCount,
  subscribeToQueueChanges,
  setupOnlineAutoSync,
} from '../services/offlineSyncQueue.js';

export interface PwaInstallBannerProps {
  className?: string;
  onInstalled?: () => void;
  onDismiss?: () => void;
}

/**
 * Formats the exact display text for the offline status indicator pill
 */
export function formatOfflinePillText(count: number): string {
  if (count > 0) {
    return `Offline • ${count} log${count === 1 ? '' : 's'} queued for auto-sync`;
  }
  return 'Offline • Ready for offline logging';
}

/**
 * Detects whether the current session is running inside an installed standalone PWA
 */
export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const matchMediaMatches =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(display-mode: standalone)').matches
      : false;
  const navStandalone =
    typeof navigator !== 'undefined' ? (navigator as any).standalone === true : false;
  const referrerApp =
    typeof document !== 'undefined' && typeof document.referrer === 'string'
      ? document.referrer.includes('android-app://')
      : false;

  return matchMediaMatches || navStandalone || referrerApp;
}

/**
 * Detects if the current device is Apple iOS Safari
 */
export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIos =
    /iPad|iPhone|iPod/.test(ua) &&
    !(typeof window !== 'undefined' && (window as any).MSStream);
  const isWebKit = /WebKit/i.test(ua);
  return isIos && isWebKit && !isRunningStandalone();
}

export const PwaInstallBanner: React.FC<PwaInstallBannerProps> = ({
  className = 'fixed bottom-24 left-1/2 -translate-x-1/2 z-40',
  onInstalled,
  onDismiss,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  const [queuedCount, setQueuedCount] = useState<number>(() => {
    return getOfflineQueueCount();
  });

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.sessionStorage?.getItem('vibediet_pwa_banner_dismissed') === 'true';
    }
    return false;
  });
  const [showIosInstructions, setShowIosInstructions] = useState<boolean>(false);
  const [justSynchronized, setJustSynchronized] = useState<boolean>(false);

  // Monitor network connectivity and auto-flush
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setJustSynchronized(true);
      const timer = setTimeout(() => setJustSynchronized(false), 3800);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setJustSynchronized(false);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    // Auto-sync listener
    const teardownSync = setupOnlineAutoSync();
    // Queue change listener
    const teardownQueue = subscribeToQueueChanges((newCount) => {
      setQueuedCount(newCount);
    });

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
      teardownSync();
      teardownQueue();
    };
  }, []);

  // Listen for native PWA beforeinstallprompt
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // If iOS Safari, make installable so instructions can be opened
    if (isIosSafari()) {
      setIsInstallable(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice?.outcome === 'accepted') {
          setIsInstallable(false);
          setDeferredPrompt(null);
          onInstalled?.();
        }
      } catch (err) {
        console.warn('[PWA] Prompt invocation failed:', err);
      }
    } else if (isIosSafari()) {
      setShowIosInstructions((prev) => !prev);
    }
  }, [deferredPrompt, onInstalled]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage?.setItem('vibediet_pwa_banner_dismissed', 'true');
      } catch {}
    }
    onDismiss?.();
  }, [onDismiss]);

  const standalone = isRunningStandalone();
  const showInstall = !standalone && !isDismissed && isInstallable;
  const showSyncSuccessPill = isOnline && justSynchronized;

  if (!showInstall && !showSyncSuccessPill) {
    return null;
  }

  return (
    <div
      data-testid="pwa-banner-container"
      className={`w-[calc(100%-2rem)] max-w-md pointer-events-none flex flex-col gap-2 items-center ${className}`}
    >
      <AnimatePresence>
        {/* Back Online Synchronized Pill */}
        {showSyncSuccessPill && (
          <motion.div
            key="online-pill"
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            data-testid="online-sync-pill"
            className="pointer-events-auto px-4 py-2 rounded-full bg-[#090B10]/95 backdrop-blur-xl border border-[#34D399]/50 shadow-lg shadow-[#34D399]/10 flex items-center gap-2.5"
          >
            <span className="w-2 h-2 rounded-full bg-[#34D399]" />
            <span className="text-xs font-semibold text-[#34D399] tracking-tight">
              Back Online • Queued logs synchronized
            </span>
          </motion.div>
        )}

        {/* PWA 1-Click Install Banner */}
        {showInstall && (
          <motion.div
            key="install-banner"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            data-testid="pwa-install-banner"
            className="pointer-events-auto w-full bg-[#090B10]/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-3.5 shadow-2xl shadow-black/80 flex flex-col gap-2.5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#38BDF8]/15 border border-[#38BDF8]/30 flex items-center justify-center shrink-0">
                  <span className="text-lg">⚡</span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white tracking-tight truncate flex items-center gap-1.5">
                    <span>Install VibeDiet App</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30">
                      PWA
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 truncate">
                    Fast 1-tap launch & offline macro logging
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleInstallClick}
                  data-testid="pwa-install-btn"
                  className="px-3.5 py-1.5 rounded-xl bg-[#38BDF8] hover:bg-[#0EA5E9] text-slate-950 text-xs font-bold transition shadow-md shadow-[#38BDF8]/25 active:scale-95"
                >
                  Install
                </button>

                <button
                  type="button"
                  onClick={handleDismiss}
                  data-testid="pwa-dismiss-btn"
                  aria-label="Dismiss install banner"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* iOS Safari Share instructions popover */}
            {showIosInstructions && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-2 border-t border-white/10 text-[11px] text-slate-300 flex items-start gap-2"
              >
                <span className="text-sm text-[#38BDF8]">ℹ️</span>
                <p>
                  To install on iOS: Tap the <span className="font-semibold text-white">Share</span> button (⎋ / ⤉) in Safari, then select <span className="font-semibold text-white">Add to Home Screen</span> (+).
                </p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
