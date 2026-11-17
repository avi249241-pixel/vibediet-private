import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { DietProvider, useDiet } from './context/DietContext.js';
import { ActiveTab, Navigation } from './components/Navigation.js';
import { DailyDiaryScreen } from './components/DailyDiaryScreen.js';
import { PhotoLogScreen } from './components/PhotoLogScreen.js';
import { ManualEntryScreen } from './components/ManualEntryScreen.js';
import { MetabolismCoachScreen } from './components/MetabolismCoachScreen.js';
import { OnboardingWizard } from './components/OnboardingWizard.js';
import { ProfileScreen } from './components/ProfileScreen.js';
import { LegalModal } from './components/LegalModal.js';
import { AuthModal } from './components/AuthModal.js';
import { PwaInstallBanner } from './components/PwaInstallBanner.js';
import { useVelocityShortcuts } from './hooks/useVelocityShortcuts.js';
import { CommandPaletteModal } from './components/CommandPaletteModal.js';

// Phase 1 Air-Gapped Code Splitting: Admin Dashboard is strictly lazy-loaded on demand
const AdminDashboardScreen = React.lazy(() =>
  import('./components/AdminDashboardScreen.js').then((m) => ({ default: m.AdminDashboardScreen }))
);

const checkIsAdminRoute = (): boolean => {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const search = window.location.search.toLowerCase();
  return (
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path === '/admin.html' ||
    path.startsWith('/admin.html') ||
    hash === '#admin' ||
    hash.startsWith('#/admin') ||
    search.includes('admin=1')
  );
};

const VibeDietShell: React.FC = () => {
  const { cockpitMode, setCockpitMode } = useAuth();
  const { addWaterMl } = useDiet();
  const [activeTab, setActiveTab] = useState<ActiveTab>(() =>
    checkIsAdminRoute() ? 'admin' : 'diary'
  );
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return (
        document.documentElement.classList.contains('dark') ||
        document.body.classList.contains('dark') ||
        localStorage.getItem('vibediet_theme') === 'dark'
      );
    }
    return false;
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', isDark);
      document.body.classList.toggle('dark', isDark);
      document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
      try {
        localStorage.setItem('vibediet_theme', isDark ? 'dark' : 'light');
      } catch {}
    }
  }, [isDark]);

  // Sync /admin, #admin, and ?admin=1 routing for dedicated backend console isolation
  useEffect(() => {
    const syncRoute = () => {
      const isAdmin = checkIsAdminRoute();
      if (isAdmin) {
        setCockpitMode('admin');
        setActiveTab('admin');
      } else {
        setCockpitMode('customer');
        const p = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
        if (p === '/scan' || p === '/photo') setActiveTab('photo');
        else if (p === '/search' || p === '/manual') setActiveTab('manual');
        else if (p === '/metabolism' || p === '/coach') setActiveTab('coach');
        else if (p === '/profile') setActiveTab('profile');
        else if (p === '/onboarding') setActiveTab('onboarding');
        else if (p === '/today' || p === '/diary') setActiveTab('diary');
        else setActiveTab((prev) => (prev === 'admin' ? 'diary' : prev));
      }
    };

    syncRoute();
    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('popstate', syncRoute);

    return () => {
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener('popstate', syncRoute);
    };
  }, [setCockpitMode]);

  const handleSelectTab = useCallback(
    (tab: ActiveTab) => {
      const tabToRoute: Record<ActiveTab, string> = {
        diary: '/today',
        photo: '/scan',
        manual: '/search',
        coach: '/metabolism',
        profile: '/profile',
        onboarding: '/onboarding',
        admin: '/admin',
      };

      if (tab === 'admin') {
        setCockpitMode('admin');
        if (
          typeof window !== 'undefined' &&
          window.location.hash !== '#admin' &&
          !window.location.pathname.startsWith('/admin')
        ) {
          window.history.pushState(null, '', '/admin');
        }
      } else {
        setCockpitMode('customer');
        if (typeof window !== 'undefined') {
          if (window.location.hash === '#admin' || window.location.hash === '#/admin') {
            window.location.hash = '';
          }
          const targetRoute = tabToRoute[tab] || '/today';
          if (window.location.pathname !== targetRoute) {
            window.history.pushState(null, '', targetRoute);
          }
        }
      }
      setActiveTab(tab);
    },
    [setCockpitMode]
  );

  const handleBackToConsumer = useCallback(() => {
    handleSelectTab('diary');
  }, [handleSelectTab]);

  const isAdminActive = cockpitMode === 'admin' || activeTab === 'admin';

  const { isPaletteOpen, setIsPaletteOpen, toast, showToast } = useVelocityShortcuts({
    activeTab,
    onSelectTab: handleSelectTab,
    isAdminMode: isAdminActive,
  });

  // In Admin mode: Render ONLY the AdminDashboardScreen (no Navigation, no OmnibarDock, no consumer footer)
  if (isAdminActive) {
    return (
      <React.Suspense
        fallback={
          <div className="min-h-screen bg-[#090B10] flex items-center justify-center font-mono text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#38BDF8] animate-ping" />
              <span>Initializing Isolated Admin Engine...</span>
            </div>
          </div>
        }
      >
        <AdminDashboardScreen
          onBackToConsumer={handleBackToConsumer}
          onReturnToConsumer={handleBackToConsumer}
        />
      </React.Suspense>
    );
  }

  // Consumer mode: Render Navigation, consumer screens, OmnibarDock, and subtle footer
  return (
    <div className="min-h-screen bg-[#F5F7FA] text-slate-900 dark:bg-[#070B14] dark:text-slate-100 flex flex-col font-sans transition-colors duration-200 relative overflow-x-hidden">
      {/* Ambient Dual-Tone Fixed Radial Glow Layer */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none" aria-hidden="true">
        <div className="absolute -top-[15%] -left-[10%] w-[55vw] h-[55vw] max-w-[700px] max-h-[700px] rounded-full blur-[110px] bg-[#38BDF8] opacity-14 dark:opacity-18 transition-opacity duration-300" />
        <div className="absolute -top-[15%] -right-[10%] w-[55vw] h-[55vw] max-w-[700px] max-h-[700px] rounded-full blur-[110px] bg-[#FB923C] opacity-12 dark:opacity-16 transition-opacity duration-300" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navigation
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          onOpenLegal={() => setIsLegalOpen(true)}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onOpenCommandPalette={() => setIsPaletteOpen(true)}
          isDark={isDark}
          onToggleTheme={() => setIsDark((d) => !d)}
        />

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-6 pb-36">
        {activeTab === 'diary' && (
          <DailyDiaryScreen
            onOpenPhotoScanner={() => handleSelectTab('photo')}
            onOpenManualEntry={() => handleSelectTab('manual')}
            onOpenLegal={() => setIsLegalOpen(true)}
          />
        )}
        {activeTab === 'photo' && (
          <PhotoLogScreen onConfirmed={() => handleSelectTab('diary')} />
        )}
        {activeTab === 'manual' && (
          <ManualEntryScreen onAdded={() => handleSelectTab('diary')} />
        )}
        {activeTab === 'coach' && <MetabolismCoachScreen />}
        {activeTab === 'onboarding' && (
          <OnboardingWizard onComplete={() => handleSelectTab('diary')} />
        )}
        {activeTab === 'profile' && <ProfileScreen />}
      </main>

        <PwaInstallBanner className="fixed top-20 right-4 z-40 max-w-sm" />

        {/* Clean Subtle Footer for Consumer App with Discreet System Triggers */}
        <footer className="mt-auto border-t border-slate-900/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-[#0E0E11]/80 backdrop-blur-md py-6 px-6 pb-40 pr-36 text-xs text-slate-500 dark:text-zinc-500 transition-colors">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800 dark:text-zinc-300">VibeDiet</span>
              <span>·</span>
              <span>Private &amp; Adaptive Metabolic Intelligence</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                data-testid="nav-tab-onboarding"
                onClick={() => handleSelectTab('onboarding')}
                className="text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition underline-offset-4 hover:underline"
              >
                Biometrics
              </button>
              <button
                type="button"
                data-testid="open-legal-header-btn"
                onClick={() => setIsLegalOpen(true)}
                className="text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition underline-offset-4 hover:underline"
              >
                Legal &amp; Privacy
              </button>
              <button
                type="button"
                data-testid="nav-tab-admin"
                onClick={() => handleSelectTab('admin')}
                className="text-slate-400 dark:text-zinc-600 hover:text-slate-600 dark:hover:text-zinc-400 transition text-[11px] font-mono"
                title="Admin Console"
              >
                Console ⚡
              </button>
              <button
                type="button"
                data-testid="switch-admin-cockpit"
                onClick={() => handleSelectTab('admin')}
                className="text-slate-400 dark:text-zinc-600 hover:text-slate-600 dark:hover:text-zinc-400 transition text-[10px] font-mono"
                title="Admin Cockpit"
              >
                Cockpit
              </button>
            </div>
          </div>
        </footer>
      </div>

      <LegalModal isOpen={isLegalOpen} onClose={() => setIsLegalOpen(false)} />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      <CommandPaletteModal
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onSelectTab={handleSelectTab}
        onShowToast={showToast}
      />

      {toast && (
        <div
          data-testid="velocity-toast"
          className="fixed bottom-24 right-6 z-50 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-[#38BDF8]/40 bg-white/95 dark:bg-[#090B10]/95 backdrop-blur-xl text-xs font-semibold text-[#0F172A] dark:text-[#38BDF8] shadow-xl flex items-center gap-2 select-none"
        >
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <DietProvider>
        <VibeDietShell />
      </DietProvider>
    </AuthProvider>
  );
}

export default App;
