
-- STAFF
CREATE TABLE public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  nif text,
  role text NOT NULL DEFAULT 'EMPREGADO DE MESA',
  base_salary numeric NOT NULL DEFAULT 0,
  hourly_rate numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO authenticated;
GRANT ALL ON public.staff TO service_role;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage staff" ON public.staff FOR ALL TO authenticated
  USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));

-- PAYROLL RECORDS
CREATE TABLE public.payroll_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE,
  month int NOT NULL,
  year int NOT NULL,
  base_pay numeric NOT NULL DEFAULT 0,
  meal_subsidy numeric NOT NULL DEFAULT 0,
  tips numeric NOT NULL DEFAULT 0,
  gross_pay numeric NOT NULL DEFAULT 0,
  irs numeric NOT NULL DEFAULT 0,
  social_security numeric NOT NULL DEFAULT 0,
  net_pay numeric NOT NULL DEFAULT 0,
  days_worked numeric NOT NULL DEFAULT 0,
  hours_worked numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_records TO authenticated;
GRANT ALL ON public.payroll_records TO service_role;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage payroll" ON public.payroll_records FOR ALL TO authenticated
  USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));

-- SERVICE COSTS
CREATE TABLE public.service_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Operations',
  amount numeric NOT NULL DEFAULT 0,
  frequency text NOT NULL DEFAULT 'monthly',
  due_day int NOT NULL DEFAULT 1,
  vendor text,
  auto_renew boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_costs TO authenticated;
GRANT ALL ON public.service_costs TO service_role;
ALTER TABLE public.service_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage service costs" ON public.service_costs FOR ALL TO authenticated
  USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));

-- SERVICE COST PAYMENTS
CREATE TABLE public.service_cost_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_cost_id uuid REFERENCES public.service_costs(id) ON DELETE CASCADE,
  month int NOT NULL,
  year int NOT NULL,
  amount_paid numeric NOT NULL DEFAULT 0,
  payment_date date,
  status text NOT NULL DEFAULT 'pending',
  receipt_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_cost_payments TO authenticated;
GRANT ALL ON public.service_cost_payments TO service_role;
ALTER TABLE public.service_cost_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage cost payments" ON public.service_cost_payments FOR ALL TO authenticated
  USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
