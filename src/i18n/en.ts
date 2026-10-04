/**
 * All user-facing English strings. Add Hindi (hi.ts) and Telugu (te.ts) with the
 * same shape; TypeScript will flag any missing key.
 */
export const en = {
  common: {
    appName: 'Hopbag',
    close: 'Close',
    retry: 'Try again',
    networkError: 'Cannot reach the server. Check your internet and try again.',
  },
  signIn: {
    title: 'Welcome to Hopbag',
    subtitle: 'Enter your mobile number. We will send you a 6-digit code by SMS.',
    phoneLabel: 'Mobile number',
    phonePlaceholder: '98765 43210',
    phoneInvalid: 'Enter a 10-digit Indian mobile number.',
    sendCode: 'Send code',
    tooManyRequests: 'Too many attempts. Please wait a few minutes and try again.',
    sendFailed: 'Could not send the code. Please try again.',
  },
  verify: {
    title: 'Enter the code',
    subtitle: 'We sent a 6-digit code to {{phone}}.',
    codeLabel: '6-digit code',
    codeInvalid: 'The code has 6 digits.',
    submit: 'Verify',
    wrongCode: 'That code is wrong or has expired. Check the SMS or ask for a new code.',
    resend: 'Send a new code',
    resendIn: 'Send a new code in {{seconds}}s',
    resent: 'New code sent.',
    changeNumber: 'Change number',
  },
  onboarding: {
    title: 'Tell us about you',
    subtitle: 'People see your name, photo and home city when you request or carry items.',
    submit: 'Continue',
  },
  profile: {
    nameLabel: 'Full name',
    namePlaceholder: 'Your name',
    stateLabel: 'Home state',
    statePlaceholder: 'Choose your state',
    cityLabel: 'Home city or town',
    cityPlaceholder: 'For example, Hyderabad',
    addPhoto: 'Add a photo',
    changePhoto: 'Change photo',
    photoButton: 'Choose profile photo',
    saveFailed: 'Could not save your profile. Please try again.',
    errors: {
      nameShort: 'Enter your name (at least 2 letters).',
      nameLong: 'Name is too long (80 letters at most).',
      stateRequired: 'Choose your home state.',
      cityShort: 'Enter your city or town.',
      cityLong: 'City name is too long (60 letters at most).',
    },
  },
  home: {
    greeting: 'Hi, {{name}}',
    tagline: 'Get things from other states, carried by people already making the trip.',
    account: 'My account',
  },
  account: {
    title: 'My account',
    phone: 'Mobile number',
    home: 'Home',
    edit: 'Edit profile',
    signOut: 'Sign out',
    signOutConfirm: 'Sign out of Hopbag?',
    signOutYes: 'Yes, sign out',
    cancel: 'Cancel',
  },
  editProfile: {
    title: 'Edit profile',
    submit: 'Save',
  },
  notFound: {
    title: 'Not found',
    message: 'This screen does not exist.',
    goHome: 'Go to home',
  },
} as const;

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

export type Strings = Widen<typeof en>;
