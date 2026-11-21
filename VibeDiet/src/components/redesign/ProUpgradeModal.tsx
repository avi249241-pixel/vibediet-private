import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AUTHORITATIVE_PLANS, type PlanKey } from '../../worker/routes/billing.js';

export interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  token?: string;
  isLocalOrDev?: boolean;
}

export const ProUpgradeModal: React.FC<ProUpgradeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  token,
  isLocalOrDev = false,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('pro_annual');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Single Escape key listener to close modal cleanly
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

  const handlePay = async () => {
    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/v1/billing/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || 'uid:demo-user-uid'}`,
        },
        body: JSON.stringify({ plan: selectedPlan }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 503) {
          setStatusMessage('Payment gateway keys not configured on server. Use Dev Demo Activation below to test Pro.');
        } else {
          setStatusMessage(errData?.error || 'Failed to initiate order with Razorpay.');
        }
        setLoading(false);
        return;
      }

      const orderData = await res.json();

      // If Razorpay SDK is loaded on window, open standard checkout
      if (typeof window !== 'undefined' && (window as any).Razorpay) {
        const rzp = new (window as any).Razorpay({
          key: orderData.keyId,
          amount: orderData.amountPaise,
          currency: 'INR',
          name: 'VibeDiet Pro',
          description: selectedPlan === 'pro_annual' ? 'VibeDiet Pro Annual Plan' : 'VibeDiet Pro Monthly Plan',
          order_id: orderData.orderId,
          handler: async (response: any) => {
            const verifyRes = await fetch('/v1/billing/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token || 'uid:demo-user-uid'}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            if (verifyRes.ok) {
              setIsSuccess(true);
              setStatusMessage('Payment verified! Your VibeDiet Pro subscription is active.');
              if (onSuccess) onSuccess();
              setTimeout(() => onClose(), 1500);
            } else {
              setStatusMessage('Payment verification failed.');
            }
          },
        });
        rzp.open();
      } else {
        setStatusMessage(`Order created (${orderData.orderId}). Complete checkout with UPI/Card.`);
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDevActivate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/v1/billing/simulate-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || 'uid:demo-user-uid'}`,
        },
        body: JSON.stringify({ plan: selectedPlan === 'pro_annual' ? 'annual' : 'monthly', gateway: 'razorpay' }),
      });
      if (res.ok) {
        setIsSuccess(true);
        setStatusMessage('⚡ Pro Activated in Dev Mode! Unlimited AI scans unlocked.');
        if (onSuccess) onSuccess();
        setTimeout(() => onClose(), 1500);
      } else {
        setStatusMessage('Dev simulation rejected.');
      }
    } catch (err: any) {
      setStatusMessage(`Dev error: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 select-none"
      data-testid="pro-upgrade-modal-container"
    >
      {/* Backdrop with 1-click close */}
      <div
        className="fixed inset-0 z-0 bg-slate-950/70 backdrop-blur-md cursor-pointer"
        onClick={onClose}
        data-testid="pro-upgrade-backdrop"
      />

      {/* Modal Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.18 }}
        className="relative z-10 w-full max-w-lg rounded-[28px] border border-white/15 bg-white/95 dark:bg-[#121622]/95 backdrop-blur-xl p-6 sm:p-7 shadow-2xl text-[var(--text-primary)]"
        data-testid="pro-upgrade-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 dark:border-white/10 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#FF6B2C]/20 to-[#0EA5E9]/20 border border-[#FF6B2C]/30 text-[10px] font-extrabold uppercase tracking-wider text-[#FF6B2C]">
              <span>👑</span> VibeDiet Pro
            </div>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Unlock Unlimited Metabolic Intelligence
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Upgrade from Free (3 AI scans/day) to full unlimited vision recognition &amp; adaptive autopilot.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="close-pro-modal-btn"
            className="rounded-full p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" className="w-5 h-5 fill-currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Benefits List */}
        <div className="py-4 space-y-2 text-xs">
          {[
            { icon: '📸', title: 'Unlimited AI Meal Scans', desc: 'No daily caps—photograph plates, katoris & labels anytime.' },
            { icon: '🧈', title: 'Interactive Oil/Ghee Sheen Slider', desc: 'Precise fat adjustment for restaurant curries & home cooking.' },
            { icon: '🧬', title: 'Adaptive TDEE & Autopilot Coach', desc: 'EWMA weight smoothing with Mifflin-St Jeor metabolic drift detection.' },
            { icon: '🛡️', title: 'Zero Data-Selling Privacy Shield', desc: 'No tracking cookies, no medical disclaimers breached, export data anytime.' },
          ].map((b, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/5">
              <span className="text-base shrink-0">{b.icon}</span>
              <div>
                <p className="font-bold text-slate-800 dark:text-zinc-200">{b.title}</p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Plan Selector */}
        <div className="grid grid-cols-2 gap-3 pt-1 pb-4">
          {/* Annual Plan */}
          <div
            onClick={() => setSelectedPlan('pro_annual')}
            data-testid="plan-pro-annual"
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
              selectedPlan === 'pro_annual'
                ? 'border-[#FF6B2C] bg-[#FF6B2C]/10 ring-2 ring-[#FF6B2C]/20 shadow-md'
                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
            }`}
          >
            <div className="absolute -top-2 right-2 px-2 py-0.5 rounded-full bg-[#FF6B2C] text-white text-[9px] font-extrabold uppercase tracking-wider">
              Save 44%
            </div>
            <p className="text-xs font-bold text-slate-800 dark:text-zinc-200">Annual Pro</p>
            <p className="text-lg font-black text-[#FF6B2C] mt-0.5">₹999 <span className="text-[11px] font-normal text-slate-500 dark:text-zinc-400">/ yr</span></p>
            <p className="text-[10px] text-slate-500 dark:text-zinc-400">Just ₹83/month billed annually</p>
          </div>

          {/* Monthly Plan */}
          <div
            onClick={() => setSelectedPlan('pro_monthly')}
            data-testid="plan-pro-monthly"
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              selectedPlan === 'pro_monthly'
                ? 'border-[#FF6B2C] bg-[#FF6B2C]/10 ring-2 ring-[#FF6B2C]/20 shadow-md'
                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
            }`}
          >
            <p className="text-xs font-bold text-slate-800 dark:text-zinc-200">Monthly Pro</p>
            <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">₹149 <span className="text-[11px] font-normal text-slate-500 dark:text-zinc-400">/ mo</span></p>
            <p className="text-[10px] text-slate-500 dark:text-zinc-400">Cancel or pause anytime</p>
          </div>
        </div>

        {/* Action Button */}
        <div className="space-y-2 pt-2 border-t border-slate-200/80 dark:border-white/10">
          <button
            type="button"
            onClick={handlePay}
            disabled={loading || isSuccess}
            data-testid="pay-razorpay-btn"
            className="w-full py-3.5 rounded-[16px] bg-gradient-to-r from-[#FF6B2C] to-[#0EA5E9] hover:opacity-95 text-white font-extrabold text-sm transition shadow-lg cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>Processing...</span>
            ) : isSuccess ? (
              <span>✓ Pro Active</span>
            ) : (
              <span>Pay with Razorpay UPI / Card ({selectedPlan === 'pro_annual' ? '₹999' : '₹149'})</span>
            )}
          </button>

          {/* Dev Demo Button to maintain E2E and Journey 7 compliance */}
          {isLocalOrDev && (
            <button
              type="button"
              onClick={handleDevActivate}
              disabled={loading || isSuccess}
              data-testid="dev-simulate-pro-btn"
              className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.08] border border-[#10B981]/40 text-[#10B981] font-mono text-[11px] font-semibold transition cursor-pointer"
            >
              ⚡ Instant Pro Demo Activation (Dev Only)
            </button>
          )}

          {statusMessage && (
            <p
              className={`text-center text-xs p-2 rounded-lg ${
                isSuccess
                  ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20'
                  : 'text-amber-600 bg-amber-50 dark:bg-amber-950/20'
              }`}
            >
              {statusMessage}
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default ProUpgradeModal;
