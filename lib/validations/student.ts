import { z } from 'zod';

export const studentProfileSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name').max(120, 'Use at most 120 characters'),
});

export const studentApplicationSchema = z.object({
  program_id: z.string().uuid('Choose a scholarship program'),
  course: z.string().trim().min(2, 'Enter your course or program').max(120, 'Use at most 120 characters'),
  year_level: z.number().int().min(1, 'Year level must be from 1 to 8').max(8, 'Year level must be from 1 to 8'),
  gwa: z.number().min(0).max(100).optional(),
  lowest_grade: z.number().min(0).max(100).optional(),
});
