import { NextResponse } from 'next/server';
import type { ZodType, ZodTypeDef } from 'zod';
import { fieldErrorsOf } from '@/lib/utils';

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

type Parsed<T> = { data: T; error?: undefined } | { data?: undefined; error: NextResponse };

export function parseWith<T>(raw: unknown, schema: ZodType<T, ZodTypeDef, unknown>): Parsed<T> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: jsonError(parsed.error.issues[0]?.message ?? 'Invalid input.', 422, {
        fieldErrors: fieldErrorsOf(parsed.error),
      }),
    };
  }
  return { data: parsed.data };
}

export async function parseJson<T>(request: Request, schema: ZodType<T, ZodTypeDef, unknown>): Promise<Parsed<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { error: jsonError('Invalid JSON body.', 400) };
  }
  return parseWith(raw, schema);
}

// Maps Postgres/PostgREST errors to safe HTTP responses. Messages raised by our own
// SQL functions (P0001) are written for end users; everything else stays generic.
export function dbError(error: { code?: string; message: string }) {
  switch (error.code) {
    case '42P01':
    case '42883':
    case '42703':
    case 'PGRST200':
    case 'PGRST202':
    case 'PGRST204':
    case 'PGRST205':
      console.error('Required database schema is missing:', error.code, error.message);
      return jsonError('Scholarship database setup is incomplete. Apply supabase/schema.sql and supabase/role-expansion.sql, then refresh the Supabase API schema cache.', 503);
    case 'PGRST301':
    case 'PGRST302':
      return jsonError('Your sign-in session is no longer valid. Please sign in again.', 401);
    case '42501':
      return jsonError('You do not have permission to perform this action.', 403);
    case 'P0002':
      return jsonError(error.message, 404);
    case 'P0001':
      return jsonError(error.message, 422);
    case '23505':
      return jsonError('A matching record already exists.', 409);
    case '23503':
      return jsonError('A related record could not be found.', 422);
    case '23514':
    case '22P02':
      return jsonError('Some of the submitted values are not valid.', 422);
    default:
      console.error('Database error:', error.code, error.message);
      return jsonError('A database error occurred. Please try again.', 500);
  }
}
