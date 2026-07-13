-- Company relationships (transfer pricing markup between companies)
CREATE TABLE public.company_relationships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  to_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  markup_percent NUMERIC NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_company_id, to_company_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_relationships TO authenticated;
GRANT ALL ON public.company_relationships TO service_role;
ALTER TABLE public.company_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read relationships" ON public.company_relationships FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write relationships" ON public.company_relationships FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_company_relationships_updated BEFORE UPDATE ON public.company_relationships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Inter-company transfers (Lab -> Bar batch transfers & ingredient resale)
CREATE TABLE public.inter_company_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'batch',            -- 'batch' | 'resale'
  prep_recipe_id UUID REFERENCES public.prep_recipes(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  yield_amount NUMERIC NOT NULL DEFAULT 0,
  yield_unit TEXT NOT NULL DEFAULT 'ml',
  production_cost NUMERIC NOT NULL DEFAULT 0,
  markup_percent NUMERIC NOT NULL DEFAULT 30,
  transfer_price NUMERIC NOT NULL DEFAULT 0,
  delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'active',          -- 'active' | 'delivered'
  delivered_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inter_company_transfers TO authenticated;
GRANT ALL ON public.inter_company_transfers TO service_role;
ALTER TABLE public.inter_company_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read transfers" ON public.inter_company_transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write transfers" ON public.inter_company_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_transfers_updated BEFORE UPDATE ON public.inter_company_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Allocation of a transfer across receiving bars
CREATE TABLE public.transfer_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_id UUID NOT NULL REFERENCES public.inter_company_transfers(id) ON DELETE CASCADE,
  to_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transfer_allocations TO authenticated;
GRANT ALL ON public.transfer_allocations TO service_role;
ALTER TABLE public.transfer_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read alloc" ON public.transfer_allocations FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write alloc" ON public.transfer_allocations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Payments between companies (settling balances)
CREATE TABLE public.inter_company_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  to_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inter_company_payments TO authenticated;
GRANT ALL ON public.inter_company_payments TO service_role;
ALTER TABLE public.inter_company_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read icpay" ON public.inter_company_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write icpay" ON public.inter_company_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Holding cost allocations (split shared costs across companies)
CREATE TABLE public.cost_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_cost_id UUID REFERENCES public.service_costs(id) ON DELETE SET NULL,
  from_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  period_month INTEGER,
  period_year INTEGER,
  splits JSONB NOT NULL DEFAULT '[]'::jsonb,
  applied BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_allocations TO authenticated;
GRANT ALL ON public.cost_allocations TO service_role;
ALTER TABLE public.cost_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read costalloc" ON public.cost_allocations FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write costalloc" ON public.cost_allocations FOR ALL TO authenticated USING (true) WITH CHECK (true);