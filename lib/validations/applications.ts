import { z } from 'zod';
import { APPLICATION_STATUSES, DOCUMENT_REVIEW_STATUSES } from '@/lib/status';
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from '@/lib/constants';

const optionalText = (max: number) =>
  z.string().trim().max(max, `Use at most ${max} characters`).nullish().transform((v) => (v ? v : null));

export const applicationFieldsSchema = z.object({
  student_number: optionalText(50),
  student_name: z.string().trim().min(2, 'Student name is required').max(150),
  email: z
    .union([z.literal(''), z.string().trim().email('Enter a valid email address').max(200)])
    .nullish()
    .transform((v) => v || null),
  course: z.string().trim().min(1, 'Course is required').max(150),
  year_level: z.coerce.number({ invalid_type_error: 'Enter the year level' }).int().min(1, 'Year level must be 1-8').max(8, 'Year level must be 1-8'),
  assigned_office: optionalText(150),
});

export const applicationCreateSchema = applicationFieldsSchema.extend({
  application_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date').optional(),
});

export const applicationUpdateSchema = applicationFieldsSchema
  .partial()
  .extend({ review_remarks: optionalText(2000).optional() })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Nothing to update' });

export const statusChangeSchema = z
  .object({
    status: z.enum(APPLICATION_STATUSES),
    reason: z.string().trim().max(2000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.status === 'DENIED' && !v.reason) {
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'A denial reason is required' });
    }
    if (v.status === 'FOR_FOLLOW_UP' && !v.reason) {
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'A follow-up message is required' });
    }
  });

export const followUpCreateSchema = z.object({
  application_id: z.string().uuid(),
  message: z.string().trim().min(3, 'Write a message for the student').max(2000),
  requirement_id: z.string().uuid().nullish(),
  document_id: z.string().uuid().nullish(),
});

export const followUpResolveSchema = z.object({
  resolution_note: z.string().trim().max(1000).optional(),
});

export const documentCreateSchema = z.object({
  application_id: z.string().uuid(),
  requirement_id: z.string().uuid().nullable(),
  file_name: z.string().trim().max(200).nullable(),
});

export const documentReviewSchema = z
  .object({
    review_status: z.enum(DOCUMENT_REVIEW_STATUSES),
    review_remarks: optionalText(1000),
  })
  .superRefine((v, ctx) => {
    if ((v.review_status === 'REJECTED' || v.review_status === 'NEEDS_CORRECTION') && !v.review_remarks) {
      ctx.addIssue({ code: 'custom', path: ['review_remarks'], message: 'Add a remark explaining what is wrong' });
    }
  });

export const requirementCreateSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  description: optionalText(500),
  is_required: z.boolean().default(true),
  is_active: z.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).max(10000).default(0),
  accepted_mime_types: z.array(z.enum(ALLOWED_UPLOAD_TYPES)).min(1, 'Select at least one accepted file type').max(ALLOWED_UPLOAD_TYPES.length),
  max_file_size_bytes: z.coerce.number().int().min(1).max(MAX_UPLOAD_BYTES),
});

export const requirementUpdateSchema = requirementCreateSchema.partial().extend({ id: z.string().uuid() });

export const scholarRegisterSchema = z.object({
  application_id: z.string().uuid(),
  scholar_type: z.enum(['NEW', 'PREVIOUS']).default('NEW'),
});

export const scholarParticipationSchema = z.object({
  participation_status: z.enum(['ACTIVE', 'INACTIVE']),
});
