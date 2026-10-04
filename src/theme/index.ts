/**
 * Hopbag design tokens, matched to the app screen designs (Hopbag App Screens.pdf).
 * Brand rules (assets/brand/README.txt):
 * - Orange is for shapes and accents only, never text on light backgrounds (contrast 2.4:1).
 *   Teal text on an orange fill is fine (buttons, badges).
 * - Outfit for the wordmark and screen headings; DM Sans for everything else.
 */

export const colors = {
  teal: '#0E3B43',
  orange: '#F28E2B',
  offWhite: '#F7F9F9',
  white: '#FFFFFF',

  /** Semantic roles. Use these in screens, not the raw brand values. */
  background: '#EFF4F5',
  surface: '#FFFFFF',
  surfaceMuted: '#F2F6F7',
  text: '#0E3B43',
  textMuted: '#4B6469',
  textSubtle: '#6B7F84',
  textOnDark: '#F7F9F9',
  textOnDarkMuted: '#C7D6D8',
  border: '#D3E0E2',
  borderStrong: '#0E3B43',
  accent: '#F28E2B',
  success: '#1E7044',
  danger: '#B53A1D',

  /** Tints for badges, icon tiles, avatars and info boxes. */
  tealTint: '#D3E4E6',
  peachTint: '#F8D9B4',
  peachText: '#6B3A0B',
  greenTint: '#E3F2E8',
  blueTint: '#DCEAF9',
  blueText: '#1F3F70',
  dangerTint: '#FAE6E0',
  warningTint: '#FBEBD8',
  greyTint: '#E2EAEB',

  // Kept for older components.
  chip: '#E2EAEB',
  chipMuted: '#ECEFF0',
  dangerSoft: '#FAE6E0',
} as const;

/** Font family names, as registered by useFonts in src/app/_layout.tsx. */
export const fonts = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  bold: 'DMSans_700Bold',
  brand: 'Outfit_600SemiBold',
  heading: 'Outfit_700Bold',
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
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

/** Sizes stay large enough to read on low-end phones. */
export const typography = {
  /** Big page titles: "What's your number?" */
  display: { fontFamily: fonts.heading, fontSize: 34, lineHeight: 40, letterSpacing: -0.5 },
  /** Tab page titles: "My requests", "What are you missing?" */
  title: { fontFamily: fonts.heading, fontSize: 30, lineHeight: 36, letterSpacing: -0.4 },
  /** Titles next to a back button: "Request details" */
  screenTitle: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 30, letterSpacing: -0.2 },
  heading: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 25 },
  bodyStrong: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 25 },
  label: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  small: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 17 },
} as const;
