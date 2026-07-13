CREATE TABLE public.company_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('spirit','food','prep')),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  prep_recipe_id UUID REFERENCES public.prep_recipes(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  current_stock NUMERIC NOT NULL DEFAULT 0,
  par_level NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'L',
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'GOOD',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_inventory TO authenticated;
GRANT ALL ON public.company_inventory TO service_role;

ALTER TABLE public.company_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read company_inventory" ON public.company_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage company_inventory" ON public.company_inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.calc_company_inventory_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE ratio NUMERIC;
BEGIN
  IF NEW.current_stock <= 0 THEN
    NEW.status := 'OUT';
  ELSIF NEW.expiry_date IS NOT NULL AND NEW.expiry_date <= (CURRENT_DATE + 2) THEN
    NEW.status := 'EXPIRING';
  ELSE
    ratio := NEW.current_stock / NULLIF(NEW.par_level, 0);
    IF ratio IS NULL THEN NEW.status := 'GOOD';
    ELSIF ratio < 0.5 THEN NEW.status := 'LOW';
    ELSIF ratio < 1 THEN NEW.status := 'OK';
    ELSE NEW.status := 'GOOD';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_company_inventory_status
BEFORE INSERT OR UPDATE ON public.company_inventory
FOR EACH ROW EXECUTE FUNCTION public.calc_company_inventory_status();

CREATE TRIGGER trg_company_inventory_updated_at
BEFORE UPDATE ON public.company_inventory
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_company_inventory_company ON public.company_inventory(company_id);
CREATE INDEX idx_company_inventory_kind ON public.company_inventory(kind);