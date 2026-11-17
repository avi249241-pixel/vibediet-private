import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FoodItemEntry } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { VERIFIED_BARCODE_FOODS } from '../data/mockData.js';

export interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (food: FoodItemEntry) => void;
  token?: string;
}

/**
 * Validates whether a barcode string matches standard formats
 * (EAN-13, EAN-8, UPC-A, UPC-E - numeric string of 8 to 14 digits).
 */
export function isValidBarcodeFormat(code: string): boolean {
  if (!code) return false;
  const clean = cleanBarcode(code);
  return /^\d{8,14}$/.test(clean);
}

/**
 * Strips whitespace and dashes from barcode raw values.
 */
export function cleanBarcode(code: string): string {
  if (!code) return '';
  return code.replace(/[\s-]/g, '').trim();
}

/**
 * Checks whether the native BarcodeDetector API is available in the current environment.
 */
export function isBarcodeDetectorSupported(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

/**
 * Cleanly stops all tracks on a MediaStream to ensure zero lingering webcam/camera access.
 */
export function stopMediaStream(stream: MediaStream | null): void {
  if (!stream) return;
  try {
    const tracks = stream.getTracks();
    for (const track of tracks) {
      track.stop();
    }
  } catch (err) {
    console.warn('[BarcodeScanner] Error stopping media stream tracks:', err);
  }
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onDetected,
  token,
}) => {
  let contextAuthToken = '';
  try {
    // Safe lookup if rendered inside AuthProvider
    const auth = useAuth();
    contextAuthToken = auth.token;
  } catch {
    contextAuthToken = 'uid:guest-local-uid';
  }

  const effectiveToken = token || contextAuthToken || 'uid:guest-local-uid';

  const [barcodeInput, setBarcodeInput] = useState('8901058000290');
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'detected' | 'error'>('idle');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const scanIntervalRef = useRef<any>(null);
  const isDetectedRef = useRef<boolean>(false);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      stopMediaStream(streamRef.current);
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  // Global Escape keydown listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopCamera();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, stopCamera]);

  // Fetch food item by barcode
  const lookupBarcode = useCallback(
    async (code: string) => {
      const clean = cleanBarcode(code);
      if (!clean) {
        setLookupError('Please enter a valid barcode.');
        setIsProcessing(false);
        return;
      }

      setIsProcessing(true);
      setLookupError(null);

      try {
        const res = await fetch(`/v1/foods/barcode/${encodeURIComponent(clean)}`, {
          headers: {
            Authorization: `Bearer ${effectiveToken}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (data?.item) {
            onDetected(data.item);
            onClose();
            return;
          }
        }
      } catch (err) {
        // Backend or network unreachable, fall back to pre-seeded catalog
        console.warn('[BarcodeScanner] Server lookup failed, checking local catalog:', err);
      }

      // Offline / Pre-verified local fallback check
      const localItem = VERIFIED_BARCODE_FOODS[clean];
      if (localItem) {
        onDetected(localItem);
        onClose();
        return;
      }

      setLookupError(`Barcode "${clean}" not found in Open Food Facts registry.`);
      setScanStatus('error');
      setIsProcessing(false);
      isDetectedRef.current = false;
    },
    [effectiveToken, onDetected, onClose]
  );

  // Initialize camera and scanning loop
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      isDetectedRef.current = false;
      setScanStatus('idle');
      return;
    }

    isDetectedRef.current = false;
    setScanStatus('scanning');
    setCameraError(null);
    setLookupError(null);

    let isSubscribed = true;

    async function initCamera() {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        if (isSubscribed) {
          setCameraError('Camera API is not supported in this browser environment.');
          setScanStatus('error');
        }
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (!isSubscribed) {
          stopMediaStream(stream);
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch {
            // Video play might be interrupted
          }
        }
        setCameraActive(true);

        // Initialize Native BarcodeDetector if available
        if (isBarcodeDetectorSupported()) {
          try {
            detectorRef.current = new (window as any).BarcodeDetector({
              formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'],
            });
          } catch (e) {
            console.warn('[BarcodeScanner] Native BarcodeDetector init failed:', e);
          }
        }

        // Active detection polling loop
        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || isDetectedRef.current || !detectorRef.current) return;
          if (videoRef.current.readyState < 2) return; // HAVE_CURRENT_DATA or higher

          try {
            const detected = await detectorRef.current.detect(videoRef.current);
            if (detected && detected.length > 0 && detected[0]?.rawValue) {
              const rawCode = detected[0].rawValue;
              const cleanCode = cleanBarcode(rawCode);

              if (isValidBarcodeFormat(cleanCode)) {
                isDetectedRef.current = true;
                setScanStatus('detected');

                // Vibrate on capture if supported
                if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                  navigator.vibrate(50);
                }

                // IMMEDIATELY stop camera media tracks (zero lingering camera access)
                stopCamera();

                // Lookup food product
                await lookupBarcode(cleanCode);
              }
            }
          } catch {
            // Ignored frame processing error
          }
        }, 220);
      } catch (err: any) {
        if (isSubscribed) {
          setCameraError(
            err?.name === 'NotAllowedError'
              ? 'Camera permission denied. Use manual barcode input below.'
              : 'Unable to start camera. Please enter barcode number below.'
          );
          setScanStatus('error');
        }
      }
    }

    initCamera();

    return () => {
      isSubscribed = false;
      stopCamera();
    };
  }, [isOpen, stopCamera, lookupBarcode]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    isDetectedRef.current = true;
    stopCamera();
    await lookupBarcode(barcodeInput);
  };

  const handleQuickSelect = async (code: string) => {
    setBarcodeInput(code);
    isDetectedRef.current = true;
    stopCamera();
    await lookupBarcode(code);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="barcode-scanner-title"
        data-testid="barcode-scanner-modal"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-[#090B10]/85 backdrop-blur-xl animate-in fade-in duration-200"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="relative w-full max-w-md bg-white dark:bg-[#0D111A] border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#0EA5E9]/15 border border-[#0EA5E9]/30 flex items-center justify-center text-[#0EA5E9] dark:text-[#38BDF8] text-sm font-bold">
                📷
              </div>
              <div>
                <h2
                  id="barcode-scanner-title"
                  className="text-base font-bold text-[#0F172A] dark:text-white tracking-tight flex items-center gap-2"
                >
                  <span>Hardware Barcode Scanner</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-orange-50 dark:bg-[#FB923C]/20 text-[#FF6B2C] dark:text-[#FB923C] border border-orange-200 dark:border-[#FB923C]/30 font-semibold">
                    Tier 2
                  </span>
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Open Food Facts · USDA Barcode Engine
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              data-testid="barcode-close-btn"
              aria-label="Close barcode scanner"
              className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Camera Viewfinder Area */}
          <div className="relative w-full aspect-[4/3] bg-black overflow-hidden flex items-center justify-center">
            {/* Live Video Feed */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              data-testid="barcode-video-feed"
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                cameraActive ? 'opacity-100' : 'opacity-0'
              }`}
            />

            {/* Fallback Banner when camera not active */}
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900/95 dark:bg-[#090B10]/95 z-10">
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center text-xl mb-3">
                  🏷️
                </div>
                <p className="text-sm font-semibold text-slate-200">
                  {cameraError ? cameraError : 'Initializing camera stream...'}
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Position product barcode in front of camera or enter the number below.
                </p>
              </div>
            )}

            {/* Viewfinder Reticle & Laser Overlay */}
            {cameraActive && (
              <div
                data-testid="barcode-viewfinder"
                className="absolute inset-0 pointer-events-none flex items-center justify-center"
              >
                {/* Dimmed surrounding mask */}
                <div className="absolute inset-0 bg-black/35" />

                {/* Target Frame (250px x 160px) */}
                <div className="relative w-64 h-40 z-20">
                  {/* Apple Light Orange (#FB923C) Lock-on Frame Corners */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-[#FF6B2C] dark:border-[#FB923C] rounded-tl-lg shadow-[0_0_12px_rgba(255,107,44,0.5)]" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-[#FF6B2C] dark:border-[#FB923C] rounded-tr-lg shadow-[0_0_12px_rgba(255,107,44,0.5)]" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-[#FF6B2C] dark:border-[#FB923C] rounded-bl-lg shadow-[0_0_12px_rgba(255,107,44,0.5)]" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-[#FF6B2C] dark:border-[#FB923C] rounded-br-lg shadow-[0_0_12px_rgba(255,107,44,0.5)]" />

                  {/* Apple Light Blue (#38BDF8) Laser Scan Line */}
                  <div
                    data-testid="barcode-laser"
                    className="absolute left-1 right-1 h-[2px] bg-[#0EA5E9] dark:bg-[#38BDF8] shadow-[0_0_16px_#0EA5E9,0_0_30px_#0EA5E9] animate-[bounce_2s_infinite]"
                    style={{
                      animation: 'scanSweep 2s ease-in-out infinite alternate',
                    }}
                  />

                  {/* Centered Reticle Crosshair */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-30">
                    <div className="w-8 h-[1px] bg-white" />
                    <div className="h-8 w-[1px] bg-white absolute" />
                  </div>
                </div>

                {/* Floating Telemetry Badge */}
                <div className="absolute bottom-3 px-3 py-1 rounded-full bg-slate-900/80 dark:bg-[#090B10]/80 border border-[#0EA5E9]/40 backdrop-blur-md flex items-center gap-2 z-20">
                  <span className="w-2 h-2 rounded-full bg-[#0EA5E9] dark:bg-[#38BDF8] animate-pulse" />
                  <span className="text-[11px] font-mono text-[#0EA5E9] dark:text-[#38BDF8] font-semibold tracking-wider">
                    SCANNING EAN / UPC
                  </span>
                </div>
              </div>
            )}

            {/* Laser Keyframe Style */}
            <style>{`
              @keyframes scanSweep {
                0% { top: 8%; opacity: 0.85; }
                50% { top: 50%; opacity: 1; }
                100% { top: 92%; opacity: 0.85; }
              }
            `}</style>
          </div>

          {/* Feedback Alerts */}
          {lookupError && (
            <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>{lookupError}</span>
            </div>
          )}

          {/* Manual Input Fallback & Presets */}
          <div className="p-5 space-y-4 overflow-y-auto">
            <form onSubmit={handleManualSubmit} className="space-y-2">
              <label
                htmlFor="manual-barcode-input"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between"
              >
                <span>Manual Barcode Number</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">EAN-13 / UPC</span>
              </label>

              <div className="flex gap-2">
                <input
                  id="manual-barcode-input"
                  data-testid="manual-barcode-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="e.g. 8901058000290"
                  className="flex-1 bg-slate-50 dark:bg-[#121622] border border-slate-200 dark:border-white/10 focus:border-[#0EA5E9] dark:focus:border-[#38BDF8] rounded-xl px-3.5 py-2.5 text-sm font-mono text-[#0F172A] dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition shadow-inner"
                />

                <button
                  type="submit"
                  disabled={isProcessing}
                  data-testid="manual-barcode-submit"
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FF6B2C] to-[#FF9248] text-white hover:opacity-95 disabled:opacity-50 text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-[#FF6B2C]/20 cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Checking...</span>
                    </>
                  ) : (
                    <span>Lookup</span>
                  )}
                </button>
              </div>
            </form>

            {/* Quick-Test Barcode Presets */}
            <div className="pt-1">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-2">
                Quick Verified Barcodes:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickSelect('8901058000290')}
                  className="text-left px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/70 dark:border-white/5 hover:border-[#0EA5E9]/40 transition group"
                >
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-[#0EA5E9] dark:group-hover:text-[#38BDF8] truncate">
                    🥣 Epigamia Greek Yogurt
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">8901058000290</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickSelect('8901262010023')}
                  className="text-left px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/70 dark:border-white/5 hover:border-[#0EA5E9]/40 transition group"
                >
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-[#0EA5E9] dark:group-hover:text-[#38BDF8] truncate">
                    🧈 Amul Pasteurized Butter
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">8901262010023</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickSelect('8906001020304')}
                  className="text-left px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/70 dark:border-white/5 hover:border-[#0EA5E9]/40 transition group"
                >
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-[#0EA5E9] dark:group-hover:text-[#38BDF8] truncate">
                    🥜 Pintola All-Natural PB
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">8906001020304</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickSelect('0041383090624')}
                  className="text-left px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/70 dark:border-white/5 hover:border-[#0EA5E9]/40 transition group"
                >
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-[#0EA5E9] dark:group-hover:text-[#38BDF8] truncate">
                    🥛 ON Gold Standard Whey
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">0041383090624</div>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
