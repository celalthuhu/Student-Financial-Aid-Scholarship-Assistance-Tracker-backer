import { z } from 'zod';

export const slotSettingsSchema = z.object({
  max_slots: z.coerce.number({ invalid_type_error: 'Enter a number' }).int('Whole numbers only').min(0, 'Cannot be negative').max(100000),
  applications_open: z.boolean(),
  note: z.string().trim().max(500).nullish().transform((v) => v || null),
});
