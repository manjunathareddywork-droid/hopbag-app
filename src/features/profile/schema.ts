import { z } from 'zod';

import type { StringKey } from '@/i18n';

/** Error messages are i18n keys; screens translate them with t(). */
const msg = (key: StringKey) => key;

/** Mirrors the checks on public.profiles so users see errors before the server does. */
export const profileFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, msg('profile.errors.nameShort'))
    .max(80, msg('profile.errors.nameLong')),
  homeState: z.string().regex(/^[A-Z]{2}$/, msg('profile.errors.stateRequired')),
  homeCity: z
    .string()
    .trim()
    .min(2, msg('profile.errors.cityShort'))
    .max(60, msg('profile.errors.cityLong')),
  /** Local file URI of a newly picked photo; null keeps the current one. */
  photoUri: z.string().nullable(),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
