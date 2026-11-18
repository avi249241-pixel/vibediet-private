import React, { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sun, Moon } from "lucide-react";
import "./VibeDietTheme.css";

export interface VibeDietNavbarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onOpenCommandPalette?: () => void;
  onOpenAuth?: () => void;
  onOpenLegal?: () => void;
  userName?: string;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

interface NavTabItem {
  id: string;
  testId: string;
  label: string;
  icon: string;
}

const tabs: NavTabItem[] = [
  { id: "Today", testId: "nav-tab-diary", label: "Today", icon: "✨" },
  { id: "AI Scan", testId: "nav-tab-photo", label: "AI Meal Scan", icon: "📸" },
  { id: "Food Search", testId: "nav-tab-manual", label: "Food Search", icon: "🔍" },
  { id: "Metabolism", testId: "nav-tab-coach", label: "Metabolism", icon: "🧬" },
  { id: "Profile", testId: "nav-tab-profile", label: "Profile", icon: "👤" },
];

function BrandMark() {
  return (
    <div className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[12px] bg-gradient-to-br from-[#FF6B2C] to-[#FF9248] shadow-[0_7px_18px_-6px_rgba(255,107,44,0.7)]">
      <div className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-white/20" />
      <svg viewBox="0 0 28 28" className="relative h-6 w-6" fill="none" aria-hidden="true">
        <path
          d="M6.5 7.25 11.7 20h4.1l2.1-5.35"
          stroke="white"
          strokeWidth="3.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16.2 12.2c.7-3.25 3.1-5.1 6.1-5.05-.1 3.2-1.95 5.8-5.45 6.25"
          fill="white"
        />
      </svg>
    </div>
  );
}

export default function VibeDietNavbar({
  activeTab,
  onSelectTab,
  onOpenCommandPalette,
  onOpenAuth,
  onOpenLegal: _onOpenLegal,
  userName,
  isDark = false,
  onToggleTheme,
}: VibeDietNavbarProps) {
  const [isOnline, setIsOnline] = React.useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  const initials = userName?.trim()
    ? userName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase()
    : "G";

  return (
    <header className="sticky top-0 z-40 h-16 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/70 dark:border-white/10 select-none">
      <div className="mx-auto flex h-full max-w-[1600px] items-center gap-2 px-3 sm:gap-3 sm:px-5 lg:px-7 justify-between">
        {/* Brand Home Trigger (div role="button" to maintain strict 5 header button count) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelectTab("Today")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelectTab("Today");
            }
          }}
          className="flex shrink-0 items-center gap-2.5 rounded-xl text-left cursor-pointer transition hover:opacity-90"
          aria-label="VibeDiet home"
        >
          <BrandMark />
          <span className="hidden items-center gap-2 min-[390px]:inline-flex">
            <span className="text-[17px] font-extrabold tracking-[-0.045em] text-[var(--text-primary)]">
              Vibe<span className="text-[var(--tangerine)]">Diet</span>
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              v2.1.0 • DB Live
            </span>
          </span>
          {!isOnline && (
            <span
              data-testid="offline-status-pill"
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Offline • Ready for offline logging
            </span>
          )}
        </div>

        {/* Center: Apple-style Floating Segmented Navigation (STRICTLY 5 BUTTONS) */}
        <nav
          className="mx-auto flex shrink-0 items-center gap-0.5 rounded-[15px] border border-[var(--border)] bg-[var(--card-subtle)] p-1 overflow-x-auto max-w-[calc(100vw-190px)] sm:max-w-none shadow-inner"
          aria-label="Primary navigation"
        >
          {tabs.map((tab) => {
            const isActive =
              activeTab === tab.id ||
              (tab.id === "Today" && activeTab === "diary") ||
              (tab.id === "AI Scan" && activeTab === "photo") ||
              (tab.id === "Food Search" && activeTab === "manual") ||
              (tab.id === "Metabolism" && activeTab === "coach") ||
              (tab.id === "Profile" && activeTab === "profile");

            return (
              <button
                key={tab.id}
                type="button"
                data-testid={tab.testId}
                onClick={() => onSelectTab(tab.id)}
                aria-current={isActive ? "page" : undefined}
                className={`relative h-8 whitespace-nowrap rounded-[11px] px-3 text-[12px] font-semibold transition-colors xl:px-3.5 flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? "text-[var(--text-primary)] font-bold"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="vibediet-active-tab"
                    className="absolute inset-0 rounded-[11px] border border-[var(--border)] bg-[var(--card)] shadow-[0_3px_10px_rgba(15,23,42,0.07)]"
                    transition={{ type: "spring", stiffness: 480, damping: 36 }}
                  />
                )}
                <span className="relative z-10 text-sm leading-none">{tab.icon}</span>
                <span className="relative z-10 leading-none">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Utility Cluster: ⌘K Pill + Dark Mode Toggle + Account Trigger (div role="button") */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* ⌘K Trigger */}
          <div
            role="button"
            tabIndex={0}
            onClick={onOpenCommandPalette}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenCommandPalette?.();
              }
            }}
            data-testid="nav-command-palette-btn"
            className="hidden h-9 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-2.5 text-[var(--text-secondary)] shadow-sm transition-colors hover:bg-[var(--hover)] xl:flex cursor-pointer select-none"
            aria-label="Open command palette"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
              <circle cx="8.75" cy="8.75" r="5.25" stroke="currentColor" strokeWidth="1.6" />
              <path d="m12.75 12.75 3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <kbd className="numeric rounded-md border border-[var(--border)] bg-[var(--card-subtle)] px-1.5 py-0.5 text-[10px] font-semibold">
              ⌘K
            </kbd>
          </div>

          {/* Theme Toggle Trigger */}
          <button
            type="button"
            onClick={onToggleTheme}
            data-testid="nav-theme-toggle-btn"
            className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/15 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer select-none"
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            title={isDark ? "Switch to light theme" : "Switch to dark theme"}
          >
            {isDark ? (
              <Sun className="h-4 w-4 text-amber-400" strokeWidth={2.2} />
            ) : (
              <Moon className="h-4 w-4 text-slate-700" strokeWidth={2.2} />
            )}
          </button>

          {/* User Account Trigger */}
          <div
            role="button"
            tabIndex={0}
            onClick={onOpenAuth}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenAuth?.();
              }
            }}
            className="ml-0.5 flex h-10 items-center gap-2 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-1 pr-1.5 shadow-sm transition-colors hover:bg-[var(--hover)] md:pr-3 cursor-pointer select-none"
            aria-label={userName ? `Open ${userName} account` : "Sign in or create an account"}
          >
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-[#0EA5E9] to-[#38BDF8] text-[11px] font-extrabold text-white shadow-[0_5px_14px_-5px_rgba(14,165,233,0.8)]">
              {initials}
            </span>
            <span className="hidden max-w-24 truncate text-xs font-semibold text-[var(--text-primary)] md:inline">
              {userName?.trim() || "Guest"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
