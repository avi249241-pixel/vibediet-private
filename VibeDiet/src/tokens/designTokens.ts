/**
 * VibeDiet Unified Figma & Canva Design Tokens
 * Harmonizes design tokens across the React application, Tailwind CSS, and Figma/Canva brand kits.
 */

export const DESIGN_TOKENS = {
  colors: {
    // Brand Core
    primary: '#10b981', // Emerald 500
    primaryLight: '#34d399',
    primaryGlow: 'rgba(16, 185, 129, 0.28)',
    accentLime: '#c8ff00', // Acid Lime Accent
    accentCyan: '#00f0ff', // Cyber Cyan Accent

    // Surfaces & Obsidian Palette
    voidBg: '#040508', // Root background
    surface950: '#06080c', // Deep card background
    surface900: '#0f141c', // Card surface
    surface800: '#1a2230', // Elevated interactive surface
    surface700: '#2d3748',

    // Titanium & Glass Borders
    titaniumBorder: 'rgba(255, 255, 255, 0.10)',
    titaniumBorderHover: 'rgba(200, 255, 0, 0.25)',
    glassBackdrop: 'rgba(15, 20, 28, 0.85)',

    // 4-Tier Nutrition Evidence Hierarchy (Figma & Canva Brand Colors)
    tier1Verified: {
      badgeBg: 'rgba(16, 185, 129, 0.18)',
      badgeText: '#34d399',
      badgeBorder: 'rgba(16, 185, 129, 0.35)',
      hex: '#10b981',
      label: 'T1 Verified USDA',
    },
    tier2Barcode: {
      badgeBg: 'rgba(56, 189, 248, 0.18)',
      badgeText: '#38bdf8',
      badgeBorder: 'rgba(56, 189, 248, 0.35)',
      hex: '#38bdf8',
      label: 'T2 Barcode Verified',
    },
    tier3AiVision: {
      badgeBg: 'rgba(168, 85, 247, 0.18)',
      badgeText: '#c084fc',
      badgeBorder: 'rgba(168, 85, 247, 0.35)',
      hex: '#a855f7',
      label: 'T3 Gemini AI Vision',
    },
    tier4UserEstimate: {
      badgeBg: 'rgba(100, 116, 139, 0.25)',
      badgeText: '#94a3b8',
      badgeBorder: 'rgba(100, 116, 139, 0.35)',
      hex: '#64748b',
      label: 'T4 User Estimate',
    },

    // Macronutrient Palettes
    macros: {
      protein: '#f43f5e', // Rose 500
      carbs: '#38bdf8', // Sky 400
      fat: '#fbbf24', // Amber 400
      fiber: '#34d399', // Emerald 400
      water: '#0ea5e9', // Ocean Blue
    },

    // Status & Feedback
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
  },

  typography: {
    fontBody: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    fontDisplay: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
    fontMono: "'JetBrains Mono', monospace",
  },

  shadows: {
    card: '0 20px 40px -15px rgba(0, 0, 0, 0.8)',
    glowEmerald: '0 0 24px rgba(16, 185, 129, 0.25)',
    glowLime: '0 0 24px rgba(200, 255, 0, 0.28)',
    insetHighlight: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.12)',
  },

  radii: {
    card: '1.25rem', // 20px
    pill: '9999px',
    control: '0.75rem', // 12px
  },
} as const;

export type DesignTokens = typeof DESIGN_TOKENS;
