/**
 * Hopbag design tokens. Brand rules (see assets/brand/README.txt):
 * - Orange is for shapes and accents only, never text on light backgrounds (contrast 2.4:1).
 * - DM Sans for app text, Outfit 600 for the wordmark only.
 */

export const colors = {
  teal: '#0E3B43',
  orange: '#F28E2B',
  offWhite: '#F7F9F9',
  white: '#FFFFFF',

  /** Semantic roles. Use these in screens, not the raw brand values. */
  background: '#F7F9F9',
  surface: '#FFFFFF',
  text: '#0E3B43',
  textMuted: '#4A6268',
  textOnDark: '#F7F9F9',
  border: '#D5DEDF',
  accent: '#F28E2B',
  success: '#1E7A4C',
  danger: '#B3261E',
} as const;

/** Font family names, as registered by useFonts in src/app/_layout.tsx. */
export const fonts = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  bold: 'DMSans_700Bold',
  brand: 'Outfit_600SemiBold',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 22,
} as const;

/** Sizes stay large enough to read on low-end phones. */
export const typography = {
  title: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32 },
  heading: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
} as const;
