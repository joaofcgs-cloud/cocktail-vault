
-- Inventory new columns
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS bottle_size_ml INTEGER NOT NULL DEFAULT 700,
  ADD COLUMN IF NOT EXISTS abv NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_per_ml NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pours_per_bottle NUMERIC NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.calc_inventory_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE ratio NUMERIC;
BEGIN
  IF NEW.current_stock <= 0 THEN NEW.status := 'OUT';
  ELSE
    ratio := NEW.current_stock / NULLIF(NEW.par_level, 0);
    IF ratio IS NULL THEN NEW.status := 'GOOD';
    ELSIF ratio < 0.5 THEN NEW.status := 'LOW';
    ELSIF ratio < 1 THEN NEW.status := 'OK';
    ELSE NEW.status := 'GOOD';
    END IF;
  END IF;
  IF NEW.bottle_size_ml > 0 THEN
    NEW.cost_per_ml := NEW.unit_cost / NEW.bottle_size_ml;
    NEW.pours_per_bottle := NEW.bottle_size_ml / 25.0;
  ELSE
    NEW.cost_per_ml := 0;
    NEW.pours_per_bottle := 0;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.calc_inventory_status() FROM public, anon, authenticated;

-- Cocktails new columns
ALTER TABLE public.cocktails
  ADD COLUMN IF NOT EXISTS abv_percent NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS total_volume_ml NUMERIC NOT NULL DEFAULT 0;

-- Cocktail ingredients
CREATE TABLE public.cocktail_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cocktail_id UUID NOT NULL REFERENCES public.cocktails(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
  amount_ml NUMERIC NOT NULL DEFAULT 0,
  cost_per_ingredient NUMERIC NOT NULL DEFAULT 0,
  is_prep BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cocktail_ingredients TO authenticated;
GRANT ALL ON public.cocktail_ingredients TO service_role;
ALTER TABLE public.cocktail_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ingredients viewable by authenticated" ON public.cocktail_ingredients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert ingredients" ON public.cocktail_ingredients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Owners update ingredients" ON public.cocktail_ingredients FOR UPDATE TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owners delete ingredients" ON public.cocktail_ingredients FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

-- Daily sales
CREATE TABLE public.daily_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  cocktail_id UUID REFERENCES public.cocktails(id) ON DELETE SET NULL,
  quantity_sold INTEGER NOT NULL DEFAULT 0,
  revenue NUMERIC NOT NULL DEFAULT 0,
  cost NUMERIC NOT NULL DEFAULT 0,
  profit NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_sales TO authenticated;
GRANT ALL ON public.daily_sales TO service_role;
ALTER TABLE public.daily_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales viewable by authenticated" ON public.daily_sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert sales" ON public.daily_sales FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Owners manage sales rows" ON public.daily_sales FOR UPDATE TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owners delete sales rows" ON public.daily_sales FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

CREATE OR REPLACE FUNCTION public.calc_sales_profit()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.profit := NEW.revenue - NEW.cost;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.calc_sales_profit() FROM public, anon, authenticated;
CREATE TRIGGER trg_sales_profit BEFORE INSERT OR UPDATE ON public.daily_sales FOR EACH ROW EXECUTE FUNCTION public.calc_sales_profit();

-- Batch recipes
CREATE TABLE public.batch_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  total_servings INTEGER NOT NULL DEFAULT 1,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  cost_per_serving NUMERIC NOT NULL DEFAULT 0,
  instructions TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_recipes TO authenticated;
GRANT ALL ON public.batch_recipes TO service_role;
ALTER TABLE public.batch_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Batches viewable by authenticated" ON public.batch_recipes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert batches" ON public.batch_recipes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update batches" ON public.batch_recipes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Owners delete batches" ON public.batch_recipes FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

-- Batch ingredients
CREATE TABLE public.batch_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.batch_recipes(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
  amount_ml NUMERIC NOT NULL DEFAULT 0,
  checked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_ingredients TO authenticated;
GRANT ALL ON public.batch_ingredients TO service_role;
ALTER TABLE public.batch_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Batch ingredients viewable by authenticated" ON public.batch_ingredients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert batch ingredients" ON public.batch_ingredients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update batch ingredients" ON public.batch_ingredients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete batch ingredients" ON public.batch_ingredients FOR DELETE TO authenticated USING (true);

-- Recompute derived inventory columns for existing rows
UPDATE public.inventory SET current_stock = current_stock;
