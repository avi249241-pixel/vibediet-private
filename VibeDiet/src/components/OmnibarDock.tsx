import React from 'react';
import { motion } from 'motion/react';
import { ActiveTab } from './Navigation.js';

interface OmnibarDockProps {
  onSelectTab: (tab: ActiveTab) => void;
  onQuickWater: () => void;
}

export const OmnibarDock: React.FC<OmnibarDockProps> = ({ onSelectTab, onQuickWater }) => {
  return (
    <div
      data-testid="omnibar-dock"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-full bg-slate-900/90 dark:bg-slate-800/85 backdrop-blur-2xl text-white border border-white/15 shadow-2xl px-3 py-2 flex items-center gap-2 select-none"
    >
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={() => onSelectTab('photo')}
        className="px-4 py-2 min-h-[40px] rounded-full bg-gradient-to-r from-[#FB923C] to-[#F97316] text-white font-extrabold text-xs shadow-[0_0_16px_rgba(251,146,60,0.45)] hover:brightness-110 flex items-center gap-1.5 cursor-pointer transition-all"
      >
        <span>📸</span> <span>Snap Meal</span>
      </motion.button>
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={() => onSelectTab('manual')}
        className="px-4 py-2 min-h-[40px] rounded-full bg-white/10 text-white font-semibold text-xs hover:bg-white/15 border border-white/15 flex items-center gap-1.5 cursor-pointer transition-all"
      >
        <span>🔍</span> <span>USDA Search</span>
      </motion.button>
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={onQuickWater}
        className="px-3.5 py-2 min-h-[40px] rounded-full bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/40 font-bold text-xs hover:bg-[#38BDF8]/30 flex items-center gap-1.5 tabular-nums cursor-pointer transition-all"
      >
        <span>💧</span> <span>+250ml</span>
      </motion.button>
    </div>
  );
};
