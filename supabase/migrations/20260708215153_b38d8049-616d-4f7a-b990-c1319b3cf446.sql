
-- ============ food_inventory ============
CREATE TABLE public.food_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other',
  unit_type TEXT NOT NULL DEFAULT 'Un',
  current_stock NUMERIC NOT NULL DEFAULT 0,
  par_level NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  supplier_id UUID,
  last_invoice_id UUID,
  last_purchase_date DATE,
  shelf_life_days INTEGER,
  expiry_date DATE,
  cost_per_gram NUMERIC NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'GOOD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_inventory TO authenticated;
GRANT ALL ON public.food_inventory TO service_role;
ALTER TABLE public.food_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Food inventory viewable by authenticated" ON public.food_inventory
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners insert food inventory" ON public.food_inventory
  FOR INSERT TO authenticated WITH CHECK (is_owner(auth.uid()));
CREATE POLICY "Owners update food inventory" ON public.food_inventory
  FOR UPDATE TO authenticated USING (is_owner(auth.uid())) WITH CHECK (is_owner(auth.uid()));
CREATE POLICY "Owners delete food inventory" ON public.food_inventory
  FOR DELETE TO authenticated USING (is_owner(auth.uid()));

-- Auto-calc food status, expiry, and per-unit costs
CREATE OR REPLACE FUNCTION public.calc_food_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE ratio NUMERIC;
BEGIN
  -- expiry date from purchase + shelf life if not set explicitly
  IF NEW.expiry_date IS NULL AND NEW.last_purchase_date IS NOT NULL AND NEW.shelf_life_days IS NOT NULL THEN
    NEW.expiry_date := NEW.last_purchase_date + (NEW.shelf_life_days || ' days')::interval;
  END IF;

  -- per-unit costs
  NEW.cost_per_unit := NEW.unit_cost;
  IF lower(NEW.unit_type) = 'kg' THEN
    NEW.cost_per_gram := NEW.unit_cost / 1000.0;
  ELSE
    NEW.cost_per_gram := 0;
  END IF;

  -- status
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

CREATE TRIGGER food_inventory_calc BEFORE INSERT OR UPDATE ON public.food_inventory
  FOR EACH ROW EXECUTE FUNCTION public.calc_food_status();
CREATE TRIGGER food_inventory_updated_at BEFORE UPDATE ON public.food_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ prep_recipes ============
CREATE TABLE public.prep_recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  yield_amount NUMERIC NOT NULL DEFAULT 0,
  yield_unit TEXT NOT NULL DEFAULT 'ml',
  shelf_life_days INTEGER,
  instructions TEXT,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  cost_per_ml NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prep_recipes TO authenticated;
GRANT ALL ON public.prep_recipes TO service_role;
ALTER TABLE public.prep_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prep recipes viewable by authenticated" ON public.prep_recipes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners insert prep recipes" ON public.prep_recipes
  FOR INSERT TO authenticated WITH CHECK (is_owner(auth.uid()));
CREATE POLICY "Owners update prep recipes" ON public.prep_recipes
  FOR UPDATE TO authenticated USING (is_owner(auth.uid())) WITH CHECK (is_owner(auth.uid()));
CREATE POLICY "Owners delete prep recipes" ON public.prep_recipes
  FOR DELETE TO authenticated USING (is_owner(auth.uid()));

CREATE TRIGGER prep_recipes_updated_at BEFORE UPDATE ON public.prep_recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ prep_ingredients ============
CREATE TABLE public.prep_ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prep_recipe_id UUID NOT NULL REFERENCES public.prep_recipes(id) ON DELETE CASCADE,
  food_inventory_id UUID REFERENCES public.food_inventory(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  amount_unit TEXT NOT NULL DEFAULT 'gram',
  cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prep_ingredients TO authenticated;
GRANT ALL ON public.prep_ingredients TO service_role;
ALTER TABLE public.prep_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prep ingredients viewable by authenticated" ON public.prep_ingredients
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners insert prep ingredients" ON public.prep_ingredients
  FOR INSERT TO authenticated WITH CHECK (is_owner(auth.uid()));
CREATE POLICY "Owners update prep ingredients" ON public.prep_ingredients
  FOR UPDATE TO authenticated USING (is_owner(auth.uid())) WITH CHECK (is_owner(auth.uid()));
CREATE POLICY "Owners delete prep ingredients" ON public.prep_ingredients
  FOR DELETE TO authenticated USING (is_owner(auth.uid()));

-- Recompute prep recipe totals when ingredients change
CREATE OR REPLACE FUNCTION public.recalc_prep_recipe()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE rid UUID; total NUMERIC; yld NUMERIC;
BEGIN
  rid := COALESCE(NEW.prep_recipe_id, OLD.prep_recipe_id);
  SELECT COALESCE(SUM(cost), 0) INTO total FROM public.prep_ingredients WHERE prep_recipe_id = rid;
  SELECT yield_amount INTO yld FROM public.prep_recipes WHERE id = rid;
  UPDATE public.prep_recipes
    SET total_cost = total,
        cost_per_ml = CASE WHEN yld > 0 THEN total / yld ELSE 0 END
    WHERE id = rid;
  RETURN NULL;
END;
$$;

CREATE TRIGGER prep_ingredients_recalc AFTER INSERT OR UPDATE OR DELETE ON public.prep_ingredients
  FOR EACH ROW EXECUTE FUNCTION public.recalc_prep_recipe();
