import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import VibeDietNavbar from './redesign/VibeDietNavbar.js';

export type ActiveTab =
  | 'diary'
  | 'photo'
  | 'manual'
  | 'coach'
  | 'admin'
  | 'onboarding'
  | 'profile';

interface NavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenLegal: () => void;
  onOpenAuth?: () => void;
  onOpenCommandPalette?: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  onOpenLegal,
  onOpenAuth,
  onOpenCommandPalette,
  isDark: propIsDark,
  onToggleTheme,
}) => {
  const { user, setCockpitMode } = useAuth();
  const [localDark, setLocalDark] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return (
        document.documentElement.classList.contains('dark') ||
        document.documentElement.dataset.theme === 'dark'
      );
    }
    return false;
  });

  const isDark = propIsDark !== undefined ? propIsDark : localDark;

  const handleToggleTheme = () => {
    if (onToggleTheme) {
      onToggleTheme();
    } else {
      const next = !localDark;
      setLocalDark(next);
      if (typeof document !== 'undefined') {
        const themeVal = next ? 'dark' : 'light';
        document.documentElement.dataset.theme = themeVal;
        try {
          localStorage.setItem('vibediet_theme', themeVal);
        } catch {}
        if (next) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    }
  };

  const handleSelectTab = (tabStr: string) => {
    let tab: ActiveTab;
    if (tabStr === 'Today' || tabStr === 'diary') tab = 'diary';
    else if (tabStr === 'AI Scan' || tabStr === 'photo') tab = 'photo';
    else if (tabStr === 'Food Search' || tabStr === 'manual') tab = 'manual';
    else if (tabStr === 'Metabolism' || tabStr === 'coach') tab = 'coach';
    else if (tabStr === 'Profile' || tabStr === 'profile') tab = 'profile';
    else tab = tabStr as ActiveTab;

    if (tab === 'admin') {
      setCockpitMode('admin');
      if (typeof window !== 'undefined' && window.location.hash !== '#admin') {
        window.location.hash = '#admin';
      }
    } else {
      setCockpitMode('customer');
      if (typeof window !== 'undefined' && window.location.hash === '#admin') {
        window.history.pushState(null, '', '/');
      }
    }
    onSelectTab(tab);
  };

  return (
    <VibeDietNavbar
      activeTab={activeTab}
      onSelectTab={handleSelectTab}
      onOpenCommandPalette={onOpenCommandPalette}
      onOpenAuth={onOpenAuth}
      onOpenLegal={onOpenLegal}
      userName={user?.email ? user.email.split('@')[0] : 'Guest'}
      isDark={isDark}
      onToggleTheme={handleToggleTheme}
    />
  );
};
