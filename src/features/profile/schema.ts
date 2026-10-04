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
  /** cities.id as a string (picker value); the database derives the state from it. */
  homeCityId: z.string().regex(/^\d+$/, msg('profile.errors.cityRequired')),
  /** Local file URI of a newly picked photo; null keeps the current one. */
  photoUri: z.string().nullable(),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
