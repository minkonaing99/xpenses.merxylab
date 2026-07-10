// Source: root /DESIGN.md (Apple.com token set) + docs/DESIGN.md app-native mapping.
// Winning bake-off direction: Variant B "Quiet Card System" (VARIANCE 5 / MOTION 3 / DENSITY 3).

export const colors = {
  primary: '#0066cc',
  focus: '#0071e3',
  ink: '#1d1d1f',
  canvas: '#f5f5f7',
  surface: '#ffffff',
  muted: '#7a7a7a',
  mutedStrong: '#333333',
  hairline: '#f0f0f0',
  hairlineStrong: '#e0e0e0',
  success: '#1d8a3e',
  warning: '#d9822b',
  error: '#d70015',
  info: '#0066cc',
} as const

export const spacing = {
  xxs: '4px',
  xs: '8px',
  sm: '12px',
  md: '17px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
} as const

export const radii = {
  sm: '8px',
  md: '14px',
  lg: '18px',
  pill: '999px',
} as const

export const typography = {
  screenTitle: { fontSize: '34px', fontWeight: 600, lineHeight: 1.15 },
  sectionHeader: { fontSize: '21px', fontWeight: 600, lineHeight: 1.25 },
  amountLg: { fontSize: '32px', fontWeight: 700 },
  body: { fontSize: '17px', fontWeight: 400 },
  bodyStrong: { fontSize: '17px', fontWeight: 600 },
  caption: { fontSize: '14px', fontWeight: 400 },
  captionStrong: { fontSize: '14px', fontWeight: 600 },
} as const

export const motion = {
  fast: '150ms ease-out',
  base: '200ms ease-out',
  pressScale: 'scale(0.95)',
} as const

export const touchTarget = {
  min: '44px',
} as const
