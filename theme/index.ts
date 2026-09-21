/**
 * Ceres — design system.
 * Dark-luxury language: near-black depths, brushed silver,
 * hairline borders — tuned for product scores.
 */

export const colors = {
  // Depths
  void: '#040405',
  base: '#08080A',
  elevated: '#101013',
  card: '#15151A',
  cardHi: '#1C1C22',

  // Silver / metallic
  silver: '#D6D9DF',
  silverBright: '#FFFFFF',
  silverMid: '#A7ABB4',
  silverDim: '#6E727B',
  steel: '#3A3D44',

  // Text
  textPrimary: '#F3F4F7',
  textSecondary: '#9CA0A9',
  textTertiary: '#5B5E67',

  // Lines & surfaces
  hairline: 'rgba(255,255,255,0.08)',
  hairlineStrong: 'rgba(255,255,255,0.16)',
  glass: 'rgba(18,18,22,0.6)',
  scrim: 'rgba(0,0,0,0.55)',

  // Functional / score ladder — mid intensity (vivid but not neon)
  elite: '#A8EBD4',
  eliteDim: 'rgba(168,235,212,0.14)',
  success: '#7BD4A8',
  successDim: 'rgba(123,212,168,0.14)',
  caution: '#D6B474',
  cautionDim: 'rgba(214,180,116,0.14)',
  danger: '#E08A92',
  dangerDim: 'rgba(224,138,146,0.14)',
  dangerDeep: '#D05A68',
  abysmal: '#C04756',
  abysmalDim: 'rgba(192,71,86,0.15)',
} as const;

export const silverGradient = ['#FFFFFF', '#C8CBD2', '#8B8F98', '#E6E8EC'] as const;
export const silverGradientSoft = ['#EFF0F2', '#C0C3CA', '#9A9EA7'] as const;
export const darkSheen = ['#1E1E24', '#121216', '#0A0A0C'] as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  pill: 999,
} as const;

export const font = {
  display: 'Orbitron_600SemiBold',
  displayBold: 'Orbitron_700Bold',
  displayMed: 'Orbitron_500Medium',
  body: 'Manrope_500Medium',
  bodyReg: 'Manrope_400Regular',
  bodySemi: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
} as const;

export const shadow = {
  glow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 16,
  },
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;
