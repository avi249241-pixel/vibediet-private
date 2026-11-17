import React, { useState, useEffect } from 'react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState<'liability' | 'privacy' | 'medical'>('liability');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      data-testid="legal-modal"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 rounded-3xl max-w-xl w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A] dark:text-white">
              ⚖️ VibeDiet Zero-Liability Legal & Privacy Shield
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Strict $0.00 Aggregate Liability Cap · Ephemeral Photo Privacy · Non-Medical Scope
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="close-legal-modal-btn"
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer transition"
          >
            Close
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setTab('liability')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition ${
              tab === 'liability' ? 'bg-[#FF6B2C] text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            $0.00 Liability Cap
          </button>
          <button
            type="button"
            onClick={() => setTab('privacy')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition ${
              tab === 'privacy' ? 'bg-[#10B981] text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            Ephemeral Photo Privacy
          </button>
          <button
            type="button"
            onClick={() => setTab('medical')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition ${
              tab === 'medical' ? 'bg-[#0EA5E9] text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            Non-Medical Disclaimer
          </button>
        </div>

        <div className="text-xs text-slate-700 dark:text-slate-300 space-y-3 leading-relaxed bg-slate-50 dark:bg-slate-950/70 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          {tab === 'liability' && (
            <>
              <p className="font-semibold text-[#FF6B2C] dark:text-amber-300">
                1. Strict $0.00 USD Aggregate Liability Cap
              </p>
              <p>
                To the maximum extent permitted by applicable law, VibeDiet and its creators provide
                this software strictly &ldquo;AS-IS&rdquo; without warranty of any kind. Total
                aggregate liability for any claim arising from the use of VibeDiet is strictly
                capped at <strong>$0.00 USD</strong>.
              </p>
              <p>
                Visual nutrition estimation carries an inherent variance of <strong>10% to 25%</strong> due
                to unobservable cooking oils, restaurant emulsifiers, and natural produce variance.
              </p>
            </>
          )}
          {tab === 'privacy' && (
            <>
              <p className="font-semibold text-[#10B981] dark:text-emerald-300">
                2. Client-Side 1024px Downscaling & Immediate RAM Purge
              </p>
              <p>
                Raw camera images are downscaled in your browser to a maximum dimension of 1024px
                (JPEG 80% quality) before recognition and are permanently purged immediately upon
                draft confirmation or rejection.
              </p>
              <p>
                Only optional 320px micro-thumbnails are kept in your isolated account scope, and
                you can trigger 100% instant data erasure from Profile Settings at any time.
              </p>
            </>
          )}
          {tab === 'medical' && (
            <>
              <p className="font-semibold text-[#0EA5E9] dark:text-sky-300">
                3. Informational Wellness Tool — Not a Medical Device
              </p>
              <p>
                VibeDiet does not diagnose, treat, cure, or prevent any medical condition (including
                diabetes, renal disease, hypertension, or eating disorders). Consult a licensed
                physician or registered dietitian before changing caloric intake.
              </p>
              <p>
                Hard calorie safety floors (1,200 kcal/day female, 1,500 kcal/day male) are strictly
                enforced.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
