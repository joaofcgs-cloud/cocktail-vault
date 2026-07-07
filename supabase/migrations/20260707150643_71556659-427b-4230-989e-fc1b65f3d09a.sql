CREATE TABLE public.payroll_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  month int NOT NULL,
  year int NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  net_amount numeric NOT NULL DEFAULT 0,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_invoices TO authenticated;
GRANT ALL ON public.payroll_invoices TO service_role;

ALTER TABLE public.payroll_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage payroll invoices"
  ON public.payroll_invoices FOR ALL
  TO authenticated
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));