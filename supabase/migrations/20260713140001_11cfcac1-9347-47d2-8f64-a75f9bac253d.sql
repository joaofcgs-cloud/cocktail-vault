
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  vendor TEXT NOT NULL,
  supplier TEXT,
  invoice_date DATE,
  total NUMERIC NOT NULL DEFAULT 0,
  delivery_address TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending_routing',
  routing_confidence NUMERIC NOT NULL DEFAULT 0,
  routing_reason TEXT,
  is_split BOOLEAN NOT NULL DEFAULT false,
  is_inter_company BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view invoices" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete invoices" ON public.invoices FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.invoice_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  percentage NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_allocations TO authenticated;
GRANT ALL ON public.invoice_allocations TO service_role;
ALTER TABLE public.invoice_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view allocations" ON public.invoice_allocations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert allocations" ON public.invoice_allocations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update allocations" ON public.invoice_allocations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete allocations" ON public.invoice_allocations FOR DELETE TO authenticated USING (true);
