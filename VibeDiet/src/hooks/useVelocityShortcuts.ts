import { useEffect, useState, useCallback, useRef } from 'react';
import { useDiet } from '../context/DietContext.js';
import { ActiveTab } from '../components/Navigation.js';

interface UseVelocityShortcutsOptions {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  isAdminMode?: boolean;
}

export interface VelocityToast {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'water';
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toUpperCase();
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName)) return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useVelocityShortcuts({
  activeTab,
  onSelectTab,
  isAdminMode = false,
}: UseVelocityShortcutsOptions) {
  const { addWaterMl, startPhotoDraft } = useDiet();
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [toast, setToast] = useState<VelocityToast | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, type: VelocityToast['type'] = 'info') => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    const id = `toast-${Date.now()}`;
    setToast({ id, message, type });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast((cur) => (cur?.id === id ? null : cur));
    }, 2800);
  }, []);

  const clearToast = useCallback(() => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToast(null);
  }, []);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Command / Control + K: Toggle Command Palette (allowed anywhere, even from inputs)
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
        return;
      }

      // If Command Palette is open, Escape closes it
      if (isPaletteOpen && e.key === 'Escape') {
        e.preventDefault();
        setIsPaletteOpen(false);
        return;
      }

      // If user is currently typing in an input, textarea, select, or contentEditable element,
      // or if modifier keys (Ctrl/Meta/Alt) are held, ignore single-key shortcuts
      if (
        isEditableElement(document.activeElement) ||
        isEditableElement(e.target) ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }

      // Do not run consumer single-key shortcuts when in isolated Admin console
      if (isAdminMode) {
        return;
      }

      const key = e.key.toLowerCase();

      // 2. 'n' / 'N': Switch to logging view and focus voice/text meal input
      if (key === 'n') {
        e.preventDefault();
        onSelectTab('photo');
        showToast('🎙️ Dictate / Describe Meal', 'info');
        window.setTimeout(() => {
          const inputEl = document.querySelector<HTMLInputElement>(
            '[data-testid="dictate-meal-input"]'
          );
          if (inputEl) {
            inputEl.focus();
            inputEl.select();
          }
        }, 80);
        return;
      }

      // 3. 's' / 'S': Switch to AI Scan tab for instant camera / upload access
      if (key === 's') {
        e.preventDefault();
        onSelectTab('photo');
        showToast('📸 Switched to AI Meal Scan', 'info');
        return;
      }

      // 4. 'w' / 'W': Immediately log +250ml hydration and trigger glass toast
      if (key === 'w') {
        e.preventDefault();
        addWaterMl(250);
        showToast('+250ml Water Logged (Hydration Saved)', 'water');
        return;
      }

      // 5. '1' – '5': Switch cleanly across the 5 consumer tabs
      if (key === '1') {
        e.preventDefault();
        onSelectTab('diary');
        return;
      }
      if (key === '2') {
        e.preventDefault();
        onSelectTab('photo');
        return;
      }
      if (key === '3') {
        e.preventDefault();
        onSelectTab('manual');
        return;
      }
      if (key === '4') {
        e.preventDefault();
        onSelectTab('coach');
        return;
      }
      if (key === '5') {
        e.preventDefault();
        onSelectTab('profile');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaletteOpen, isAdminMode, onSelectTab, addWaterMl, showToast]);

  // Global paste event listener for clipboard image pasting
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Ignore if user is currently pasting text inside an editable element
      if (isEditableElement(document.activeElement) || isEditableElement(e.target)) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items || items.length === 0) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (!file) continue;

          e.preventDefault();
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = String(reader.result || '');
            if (dataUrl) {
              onSelectTab('photo');
              startPhotoDraft('dinner', dataUrl);
              showToast('📋 Clipboard Image Pasted into AI Scan', 'success');
            }
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onSelectTab, startPhotoDraft, showToast]);

  return {
    isPaletteOpen,
    setIsPaletteOpen,
    toast,
    clearToast,
    showToast,
  };
}
