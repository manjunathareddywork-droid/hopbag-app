import { z } from 'zod';

import { kgToGrams } from '@/features/requests/weight';
import type { City, IdDocumentType, TravelMode } from '@/lib/database.types';
import { addDays, todayIst } from '@/lib/dates';

export const ID_TYPES: IdDocumentType[] = [
  'aadhaar',
  'pan',
  'driving_licence',
  'passport',
  'voter_id',
];
export const TRAVEL_MODES: TravelMode[] = ['train', 'bus', 'flight', 'car', 'other'];

export const verificationSchema = z.object({
  idType: z.enum(ID_TYPES, 'verifyId.idTypeRequired'),
  photoUri: z.string('verifyId.photoRequired').min(1, 'verifyId.photoRequired'),
});
export type VerificationFormValues = z.infer<typeof verificationSchema>;

/** Uppercase, no spaces: "45 2136 7890" -> "4521367890". */
export function normalizePnr(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

export const pnrSchema = z
  .string()
  .transform(normalizePnr)
  .refine((v) => /^[A-Z0-9]{5,12}$/.test(v), 'trips.errors.pnrInvalid');

export type TripLimits = { maxItems: number; maxGrams: number; maxDaysAhead: number };

/**
 * Mirrors trips_validate() in the database. Messages are i18n keys;
 * "overLimit" and "dateRange" are filled in with the limits by the form.
 */
export function makeTripSchema(cities: City[], limits: TripLimits, today = todayIst()) {
  const lastDate = addDays(today, limits.maxDaysAhead);
  return z
    .object({
      fromCityId: z.string().min(1, 'trips.errors.cityRequired'),
      toCityId: z.string().min(1, 'trips.errors.cityRequired'),
      travelDate: z
        .string()
        .min(1, 'trips.errors.dateRequired')
        .refine((d) => d >= today && d <= lastDate, 'trips.errors.dateRange'),
      mode: z.enum(TRAVEL_MODES, 'trips.errors.modeRequired'),
      capacityKg: z
        .string()
        .refine((v) => kgToGrams(v) !== null, 'trips.errors.capacityInvalid')
        .refine((v) => (kgToGrams(v) ?? 0) <= limits.maxGrams, 'trips.errors.overLimit'),
      maxItems: z
        .string()
        .refine((v) => /^\d{1,2}$/.test(v) && Number(v) >= 1, 'trips.errors.maxItemsInvalid')
        .refine((v) => Number(v) <= limits.maxItems, 'trips.errors.overLimit'),
      pnr: pnrSchema,
      ticketUri: z.string('trips.errors.ticketRequired').min(1, 'trips.errors.ticketRequired'),
    })
    .superRefine((values, ctx) => {
      if (values.fromCityId && values.fromCityId === values.toCityId) {
        ctx.addIssue({ code: 'custom', path: ['toCityId'], message: 'trips.errors.sameCity' });
        return;
      }
      const from = cities.find((c) => String(c.id) === values.fromCityId);
      const to = cities.find((c) => String(c.id) === values.toCityId);
      if (from && to && from.state_code === to.state_code) {
        ctx.addIssue({ code: 'custom', path: ['toCityId'], message: 'trips.errors.sameState' });
      }
    });
}

export type TripFormInput = z.input<ReturnType<typeof makeTripSchema>>;
export type TripFormValues = z.output<ReturnType<typeof makeTripSchema>>;

export function limitsFromSettings(settings: Record<string, number>): TripLimits {
  return {
    maxItems: settings.trip_max_items ?? 3,
    maxGrams: settings.trip_max_grams ?? 5000,
    maxDaysAhead: settings.trip_max_days_ahead ?? 60,
  };
}
