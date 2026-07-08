ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS subcategory TEXT;

CREATE TABLE IF NOT EXISTS public.vendor_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_key TEXT NOT NULL UNIQUE,
  vendor TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  hits INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_categories TO authenticated;
GRANT ALL ON public.vendor_categories TO service_role;

ALTER TABLE public.vendor_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view vendor categories"
  ON public.vendor_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert vendor categories"
  ON public.vendor_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update vendor categories"
  ON public.vendor_categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete vendor categories"
  ON public.vendor_categories FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_vendor_categories_updated_at
  BEFORE UPDATE ON public.vendor_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();