import { z } from 'zod';

import type { BlockedTerm, Category, City } from '@/lib/database.types';
import { addDays, todayIst } from '@/lib/dates';
import { rupeesToPaise } from '@/lib/money';

import { findBlockedTerm } from './blocked';
import { kgToGrams } from './weight';

/**
 * Form rules mirror the database triggers so people see problems before posting.
 * Messages are i18n keys; two carry a value after a colon:
 *   "blocked:<reason_code>" and "tooHeavy:<max grams>".
 */
export type RequestRulesContext = {
  categories: Category[];
  cities: City[];
  blockedTerms: BlockedTerm[];
  today?: string;
};

export const MIN_BUDGET_PAISE = 5000;
export const MAX_BUDGET_PAISE = 1000000;
/** Keep in step with item_requests_validate() in the database. */
export const MIN_ITEM_PRICE_PAISE = 100;
export const MAX_ITEM_PRICE_PAISE = 1000000;
export const MAX_DEADLINE_DAYS = 20;

export function makeRequestSchema({
  categories,
  cities,
  blockedTerms,
  today,
}: RequestRulesContext) {
  const day0 = today ?? todayIst();
  const minDeadline = addDays(day0, 1);
  const maxDeadline = addDays(day0, MAX_DEADLINE_DAYS);

  return z
    .object({
      categoryId: z.string().min(1, 'requests.errors.categoryRequired'),
      itemName: z
        .string()
        .trim()
        .min(2, 'requests.errors.itemNameShort')
        .max(80, 'requests.errors.itemNameLong'),
      details: z.string().trim().max(500, 'requests.errors.detailsLong'),
      weightKg: z.string().refine((v) => kgToGrams(v) !== null, 'requests.errors.weightInvalid'),
      fromCityId: z.string().min(1, 'requests.errors.cityRequired'),
      toCityId: z.string().min(1, 'requests.errors.cityRequired'),
      deadline: z
        .string()
        .min(1, 'requests.errors.deadlineRequired')
        .refine((d) => d >= minDeadline && d <= maxDeadline, 'requests.errors.deadlineRange'),
      budgetRupees: z
        .string()
        .refine((v) => rupeesToPaise(v) !== null, 'requests.errors.budgetInvalid')
        .refine((v) => {
          const paise = rupeesToPaise(v);
          return paise === null || (paise >= MIN_BUDGET_PAISE && paise <= MAX_BUDGET_PAISE);
        }, 'requests.errors.budgetRange'),
      itemPriceRupees: z
        .string()
        .refine((v) => rupeesToPaise(v) !== null, 'requests.errors.itemPriceInvalid')
        .refine((v) => {
          const paise = rupeesToPaise(v);
          return paise === null || (paise >= MIN_ITEM_PRICE_PAISE && paise <= MAX_ITEM_PRICE_PAISE);
        }, 'requests.errors.itemPriceRange'),
      photoUri: z.string().nullable(),
    })
    .superRefine((values, ctx) => {
      const blocked = findBlockedTerm(`${values.itemName} ${values.details}`, blockedTerms);
      if (blocked) {
        ctx.addIssue({
          code: 'custom',
          path: ['itemName'],
          message: `blocked:${blocked.reason_code}`,
        });
      }

      const category = categories.find((c) => c.id === values.categoryId);
      const grams = kgToGrams(values.weightKg);
      if (category && grams !== null && grams > category.max_weight_grams) {
        ctx.addIssue({
          code: 'custom',
          path: ['weightKg'],
          message: `tooHeavy:${category.max_weight_grams}`,
        });
      }

      if (values.fromCityId && values.fromCityId === values.toCityId) {
        ctx.addIssue({ code: 'custom', path: ['toCityId'], message: 'requests.errors.sameCity' });
        return;
      }
      const from = cities.find((c) => String(c.id) === values.fromCityId);
      const to = cities.find((c) => String(c.id) === values.toCityId);
      if (from && to && from.state_code === to.state_code) {
        ctx.addIssue({ code: 'custom', path: ['toCityId'], message: 'requests.errors.sameState' });
      }
    });
}

export type RequestFormValues = z.infer<ReturnType<typeof makeRequestSchema>>;

export const emptyRequestForm: RequestFormValues = {
  categoryId: '',
  itemName: '',
  details: '',
  weightKg: '',
  fromCityId: '',
  toCityId: '',
  deadline: '',
  budgetRupees: '',
  itemPriceRupees: '',
  photoUri: null,
};
