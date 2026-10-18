
-- Fix missing document requirement columns and review history table.
-- Safe to rerun; does not delete existing application records.

BEGIN;

-- 1. Add document requirement settings expected by the application.
ALTER TABLE public.document_requirements
  ADD COLUMN IF NOT EXISTS application_type text NOT NULL DEFAULT 'WORKING_SCHOLAR',
  ADD COLUMN IF NOT EXISTS accepted_mime_types text[] NOT NULL
    DEFAULT ARRAY[
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp'
    ]::text[],
  ADD COLUMN IF NOT EXISTS max_file_size_bytes bigint NOT NULL
    DEFAULT 10485760;

-- 2. Add the missing review history table.
CREATE TABLE IF NOT EXISTS public.application_document_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL
    REFERENCES public.application_documents(id) ON DELETE CASCADE,
  review_status text NOT NULL
    CHECK (review_status IN ('ACCEPTED', 'NEEDS_CORRECTION', 'REJECTED')),
  review_remarks text,
  reviewed_by uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_doc_reviews_doc_idx
  ON public.application_document_reviews (document_id, reviewed_at DESC);

-- 3. Enable row-level security for review history.
ALTER TABLE public.application_document_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS doc_reviews_select
  ON public.application_document_reviews;

CREATE POLICY doc_reviews_select
  ON public.application_document_reviews
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.application_documents d
      JOIN public.working_scholar_applications a
        ON a.id = d.application_id
      WHERE d.id = application_document_reviews.document_id
        AND (
          public.is_super_admin()
          OR (
            public.is_working_scholar_admin()
            AND a.application_type = 'WORKING_SCHOLAR'
          )
          OR (
            public.is_finance_admin()
            AND a.application_type = 'FINANCIAL_AID'
            AND a.assigned_office = 'Finance'
          )
          OR (
            public.is_student()
            AND a.student_user_id = auth.uid()
          )
        )
    )
  );

-- Reviews are written through the controlled review function,
-- not directly by authenticated clients.
REVOKE INSERT, UPDATE, DELETE
  ON public.application_document_reviews
  FROM anon, authenticated;

GRANT SELECT
  ON public.application_document_reviews
  TO authenticated;

-- 4. Keep the existing document review fields updated and
-- record each review in the history table.
CREATE OR REPLACE FUNCTION public.review_application_document(
  p_document_id uuid,
  p_review_status text,
  p_review_remarks text,
  p_reviewed_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application_type text;
  v_assigned_office text;
  v_history_id uuid;
  v_role text := public.current_admin_role();
BEGIN
  IF auth.uid() IS NULL
     OR p_reviewed_by IS NULL
     OR auth.uid() IS DISTINCT FROM p_reviewed_by
     OR v_role IS NULL
     OR v_role NOT IN (
       'WORKING_SCHOLAR_ADMIN',
       'FINANCE_ADMIN',
       'SUPER_ADMIN'
     )
  THEN
    RAISE EXCEPTION 'You are not authorized to review documents.'
      USING errcode = '42501';
  END IF;

  IF p_review_status IS NULL
     OR p_review_status NOT IN (
       'ACCEPTED',
       'NEEDS_CORRECTION',
       'REJECTED'
     )
  THEN
    RAISE EXCEPTION 'Invalid document review status.'
      USING errcode = '22023';
  END IF;

  IF p_review_status IN ('NEEDS_CORRECTION', 'REJECTED')
     AND nullif(btrim(p_review_remarks), '') IS NULL
  THEN
    RAISE EXCEPTION 'A correction or rejection remark is required.'
      USING errcode = '22023';
  END IF;

  SELECT a.application_type, a.assigned_office
    INTO v_application_type, v_assigned_office
  FROM public.application_documents d
  JOIN public.working_scholar_applications a
    ON a.id = d.application_id
  WHERE d.id = p_document_id
  FOR UPDATE OF d;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found.'
      USING errcode = 'P0002';
  END IF;

  IF NOT (
    v_role = 'SUPER_ADMIN'
    OR (
      v_role = 'WORKING_SCHOLAR_ADMIN'
      AND v_application_type = 'WORKING_SCHOLAR'
    )
    OR (
      v_role = 'FINANCE_ADMIN'
      AND v_application_type = 'FINANCIAL_AID'
      AND v_assigned_office = 'Finance'
    )
  ) THEN
    RAISE EXCEPTION 'You are not authorized to review this document.'
      USING errcode = '42501';
  END IF;

  INSERT INTO public.application_document_reviews (
    document_id,
    review_status,
    review_remarks,
    reviewed_by
  )
  VALUES (
    p_document_id,
    p_review_status,
    nullif(btrim(p_review_remarks), ''),
    p_reviewed_by
  )
  RETURNING id INTO v_history_id;

  UPDATE public.application_documents
  SET review_status = p_review_status,
      review_remarks = nullif(btrim(p_review_remarks), ''),
      reviewed_by = p_reviewed_by,
      reviewed_at = now()
  WHERE id = p_document_id;

  RETURN v_history_id;
END;
$$;

REVOKE ALL
  ON FUNCTION public.review_application_document(uuid, text, text, uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE
  ON FUNCTION public.review_application_document(uuid, text, text, uuid)
  TO authenticated;

COMMIT;

-- Refresh the Supabase/PostgREST schema cache.
NOTIFY pgrst, 'reload schema';
