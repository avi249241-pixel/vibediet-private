export const COLOR_TOKENS = {
  canvas: '#090B10',
  surfaceCard: 'rgba(18, 22, 34, 0.82)',
  borderCard: 'rgba(255, 255, 255, 0.08)',
  rimHighlight: 'rgba(255, 255, 255, 0.08)',

  // Brand Accents
  lightBlue: '#38BDF8',
  lightBlueDeep: '#0EA5E9',
  lightOrange: '#FB923C',
  lightOrangeDeep: '#F97316',

  // Semantic
  mintVerified: '#34D399',
  roseFat: '#FB7185',
  amberCarbs: '#F59E0B',
} as const;

export const SPRING_PRESETS = {
  snappy: { type: 'spring', stiffness: 450, damping: 30 },
  gentle: { type: 'spring', stiffness: 280, damping: 25 },
  tabPill: { type: 'spring', stiffness: 500, damping: 35 },
} as const;
