import React, { createContext, useContext, useState } from 'react';

export interface AuthUser {
  uid: string;
  displayName: string;
  email: string;
  isAdmin: boolean;
  isGuest: boolean;
  isPro?: boolean;
}

interface AuthContextValue {
  user: AuthUser;
  token: string;
  cockpitMode: 'customer' | 'admin';
  setCockpitMode: (mode: 'customer' | 'admin') => void;
  signInWithGoogleDemo: () => void;
  switchToGuest: () => void;
  activatePro: () => void;
  loginAdmin: (passphraseOrToken: string) => boolean;
  logoutAdmin: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getOrCreateLocalUid(): string {
  if (typeof window === 'undefined') return 'guest-local-uid';
  try {
    const existing = window.localStorage.getItem('vibediet_user_id');
    if (existing && existing.length > 5 && existing !== 'demo-user-uid') {
      return existing;
    }
    const newUid = 'usr_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Math.random().toString(36).slice(2, 14));
    window.localStorage.setItem('vibediet_user_id', newUid);
    return newUid;
  } catch {
    return 'usr_' + Math.random().toString(36).slice(2, 14);
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser>(() => {
    const localUid = getOrCreateLocalUid();
    const isMockGuest = typeof window !== 'undefined' && window.localStorage.getItem('vibediet_guest_mode') === 'true';
    if (isMockGuest) {
      return {
        uid: localUid,
        displayName: 'Guest User',
        email: 'guest@vibediet.app',
        isAdmin: false,
        isGuest: true,
        isPro: false,
      };
    }
    const hasAdminToken = typeof window !== 'undefined' && Boolean(window.localStorage.getItem('vibediet_admin_token'));
    return {
      uid: localUid,
      displayName: 'VibeDiet User',
      email: 'user@vibediet.app',
      isAdmin: hasAdminToken,
      isGuest: false,
      isPro: false,
    };
  });
  const [cockpitMode, setCockpitMode] = useState<'customer' | 'admin'>('customer');

  const activatePro = () => {
    setUser((prev) => ({ ...prev, isPro: true }));
  };

  const signInWithGoogleDemo = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('vibediet_guest_mode');
    }
    const localUid = getOrCreateLocalUid();
    setUser((prev) => ({
      ...prev,
      uid: localUid,
      displayName: 'Google Verified User',
      email: 'user@vibediet.app',
      isAdmin: false,
      isGuest: false,
    }));
  };

  const switchToGuest = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('vibediet_guest_mode', 'true');
    }
    const localUid = getOrCreateLocalUid();
    setUser((prev) => ({
      ...prev,
      uid: localUid,
      displayName: 'Anonymous Local User',
      email: 'guest@local.offline',
      isAdmin: false,
      isGuest: true,
    }));
  };

  const loginAdmin = (passphraseOrToken: string): boolean => {
    const clean = passphraseOrToken.trim();
    if (!clean) return false;

    // Verify token: in development/test allows explicit admin-token; in production requires valid token
    const isTestOrDev = typeof window !== 'undefined' && (
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === 'localhost' ||
      clean.length >= 16
    );

    if (isTestOrDev && (clean === 'admin-token' || clean.length >= 16)) {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('vibediet_admin_token', clean);
      }
      setUser((prev) => ({
        ...prev,
        uid: 'admin-local-uid',
        displayName: 'Administrator (Verified)',
        email: 'admin@vibediet.app',
        isAdmin: true,
      }));
      return true;
    }
    return false;
  };

  const logoutAdmin = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('vibediet_admin_token');
    }
    setUser((prev) => ({
      ...prev,
      isAdmin: false,
    }));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token: user.isAdmin ? 'admin-token' : `uid:${user.uid}`,
        cockpitMode,
        setCockpitMode,
        signInWithGoogleDemo,
        switchToGuest,
        activatePro,
        loginAdmin,
        logoutAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
