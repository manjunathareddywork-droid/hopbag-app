/**
 * All user-facing English strings. Add Hindi (hi.ts) and Telugu (te.ts) with the
 * same shape; TypeScript will flag any missing key.
 */
export const en = {
  common: {
    appName: 'Hopbag',
  },
  home: {
    tagline: 'Get things from other states, carried by people already making the trip.',
    serverChecking: 'Connecting…',
    serverOk: 'Connected',
    serverError: 'Cannot reach the server. Check your internet.',
  },
  notFound: {
    title: 'Not found',
    message: 'This screen does not exist.',
    goHome: 'Go to home',
  },
} as const;

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

export type Strings = Widen<typeof en>;
