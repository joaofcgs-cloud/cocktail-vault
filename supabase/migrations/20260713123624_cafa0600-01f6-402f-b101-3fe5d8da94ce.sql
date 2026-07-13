
-- =========================================================
-- Imprensa Group Command Center — multi-company foundation
-- Fresh rebuild of the public schema
-- =========================================================

DROP TABLE IF EXISTS public.audit_logs, public.batch_ingredients, public.batch_recipes,
  public.cocktail_ingredients, public.cocktails, public.daily_sales, public.food_inventory,
  public.inventory, public.invoices, public.notifications, public.payroll_invoices,
  public.payroll_records, public.prep_ingredients, public.prep_recipes, public.profiles,
  public.sales_uploads, public.service_cost_payments, public.service_costs, public.staff,
  public.user_roles, public.vendor_categories CASCADE;

DROP TYPE IF EXISTS public.app_role CASCADE;
DROP TYPE IF EXISTS public.company_type CASCADE;
DROP TYPE IF EXISTS public.business_event_type CASCADE;

CREATE TYPE public.app_role AS ENUM ('owner','bar_manager','lab_manager','staff');
CREATE TYPE public.company_type AS ENUM ('holding','lab','bar','shared_service');
CREATE TYPE public.business_event_type AS ENUM (
  'PRICE_CHANGE','STOCK_ADJUSTED','INVOICE_UPLOADED','COCKTAIL_SOLD','WASTE_RECORDED',
  'SUPPLIER_CHANGED','NEW_PRODUCT_CREATED','MARGIN_DROP','TARGET_BREACH','STOCK_OUT',
  'EXPIRY_WARNING','PAYMENT_RECORDED','PREP_BATCH_STARTED','PREP_BATCH_COMPLETED',
  'PREP_BATCH_DISCARDED','VARIANCE_DETECTED','AI_INSIGHT_GENERATED','MEMORY_CREATED',
  'INTER_COMPANY_SALE','INTER_COMPANY_DELIVERY','COST_ALLOCATED'
);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  commercial_name text NOT NULL,
  nif text NOT NULL,
  address text,
  type public.company_type NOT NULL,
  parent_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  brand_color text NOT NULL DEFAULT '#4ecdc4',
  logo_url text,
  monthly_revenue_target numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  active boolean NOT NULL DEFAULT true,
  last_login timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'owner')
$$;

CREATE TABLE public.user_company_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_company_assignments TO authenticated;
GRANT ALL ON public.user_company_assignments TO service_role;
ALTER TABLE public.user_company_assignments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_exists boolean;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role='owner') INTO owner_exists;
  IF owner_exists THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  category text NOT NULL,
  subcategory text,
  unit_type text NOT NULL DEFAULT 'un',
  default_cost numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier text,
  unit_cost numeric NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_history TO authenticated;
GRANT ALL ON public.price_history TO service_role;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.cocktails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'classic',
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  price numeric,
  est_cost numeric NOT NULL DEFAULT 0,
  margin_percent numeric NOT NULL DEFAULT 0,
  abv_percent numeric NOT NULL DEFAULT 0,
  category text,
  total_volume_ml numeric NOT NULL DEFAULT 0,
  specs text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cocktails TO authenticated;
GRANT ALL ON public.cocktails TO service_role;
ALTER TABLE public.cocktails ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.calc_cocktail_margin()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.price > 0 THEN NEW.margin_percent := ((NEW.price - NEW.est_cost)/NEW.price)*100;
  ELSE NEW.margin_percent := 0; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_cocktail_margin BEFORE INSERT OR UPDATE ON public.cocktails
  FOR EACH ROW EXECUTE FUNCTION public.calc_cocktail_margin();
CREATE TRIGGER trg_cocktails_updated BEFORE UPDATE ON public.cocktails
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cocktail_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cocktail_id uuid NOT NULL REFERENCES public.cocktails(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  prep_recipe_id uuid,
  ingredient_name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  amount_unit text NOT NULL DEFAULT 'ml',
  cost numeric NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cocktail_specs TO authenticated;
GRANT ALL ON public.cocktail_specs TO service_role;
ALTER TABLE public.cocktail_specs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.prep_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'food',
  yield_amount numeric NOT NULL DEFAULT 0,
  yield_unit text NOT NULL DEFAULT 'ml',
  shelf_life_days int,
  instructions text,
  total_cost numeric NOT NULL DEFAULT 0,
  cost_per_ml numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prep_recipes TO authenticated;
GRANT ALL ON public.prep_recipes TO service_role;
ALTER TABLE public.prep_recipes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_prep_recipes_updated BEFORE UPDATE ON public.prep_recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.prep_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prep_recipe_id uuid NOT NULL REFERENCES public.prep_recipes(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ingredient_name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  amount_unit text NOT NULL DEFAULT 'g',
  cost numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prep_ingredients TO authenticated;
GRANT ALL ON public.prep_ingredients TO service_role;
ALTER TABLE public.prep_ingredients ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.cost_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  metric text NOT NULL,
  target_percent numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_targets TO authenticated;
GRANT ALL ON public.cost_targets TO service_role;
ALTER TABLE public.cost_targets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.daily_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  cocktail_id uuid REFERENCES public.cocktails(id) ON DELETE SET NULL,
  quantity_sold numeric NOT NULL DEFAULT 0,
  revenue numeric NOT NULL DEFAULT 0,
  cost numeric NOT NULL DEFAULT 0,
  profit numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_sales TO authenticated;
GRANT ALL ON public.daily_sales TO service_role;
ALTER TABLE public.daily_sales ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.calc_sales_profit()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.profit := NEW.revenue - NEW.cost; RETURN NEW; END; $$;
CREATE TRIGGER trg_sales_profit BEFORE INSERT OR UPDATE ON public.daily_sales
  FOR EACH ROW EXECUTE FUNCTION public.calc_sales_profit();

CREATE TABLE public.variance_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  period_start date,
  period_end date,
  metric text NOT NULL,
  expected numeric NOT NULL DEFAULT 0,
  actual numeric NOT NULL DEFAULT 0,
  variance numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.variance_reports TO authenticated;
GRANT ALL ON public.variance_reports TO service_role;
ALTER TABLE public.variance_reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  name text NOT NULL,
  nif text,
  role text NOT NULL DEFAULT 'staff',
  base_salary numeric NOT NULL DEFAULT 0,
  hourly_rate numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO authenticated;
GRANT ALL ON public.staff TO service_role;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.payroll_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
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

CREATE TABLE public.service_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
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

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  severity text NOT NULL DEFAULT 'info',
  read boolean NOT NULL DEFAULT false,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.business_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type public.business_event_type NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type text,
  entity_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_events TO authenticated;
GRANT ALL ON public.business_events TO service_role;
ALTER TABLE public.business_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read companies" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage companies" ON public.companies FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage products" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth read price_history" ON public.price_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage price_history" ON public.price_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth read cocktails" ON public.cocktails FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage cocktails" ON public.cocktails FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth read cocktail_specs" ON public.cocktail_specs FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage cocktail_specs" ON public.cocktail_specs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth read prep_recipes" ON public.prep_recipes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage prep_recipes" ON public.prep_recipes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth read prep_ingredients" ON public.prep_ingredients FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage prep_ingredients" ON public.prep_ingredients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth read cost_targets" ON public.cost_targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage cost_targets" ON public.cost_targets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth read daily_sales" ON public.daily_sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage daily_sales" ON public.daily_sales FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth read variance_reports" ON public.variance_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage variance_reports" ON public.variance_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth read staff" ON public.staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage staff" ON public.staff FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth read payroll_records" ON public.payroll_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage payroll_records" ON public.payroll_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth read service_costs" ON public.service_costs FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage service_costs" ON public.service_costs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth read service_cost_payments" ON public.service_cost_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage service_cost_payments" ON public.service_cost_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth read business_events" ON public.business_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage business_events" ON public.business_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "read own or owner profiles" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_owner(auth.uid()));
CREATE POLICY "update own or owner profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_owner(auth.uid()));
CREATE POLICY "owner insert profiles" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "owner delete profiles" ON public.profiles FOR DELETE TO authenticated
  USING (public.is_owner(auth.uid()));

CREATE POLICY "read own or owner roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_owner(auth.uid()));

CREATE POLICY "read own or owner assignments" ON public.user_company_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_owner(auth.uid()));
CREATE POLICY "owner manage assignments" ON public.user_company_assignments FOR ALL TO authenticated
  USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));

CREATE POLICY "read notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "manage notifications" ON public.notifications FOR ALL TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL) WITH CHECK (true);

CREATE POLICY "owner read audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_owner(auth.uid()));
CREATE POLICY "auth insert audit" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- SEED DATA
INSERT INTO public.companies (legal_name, commercial_name, nif, address, type, brand_color, monthly_revenue_target)
VALUES ('Plataforma Boemia, Lda.','Plataforma Boemia (Holding)','518650561','Rua de Sao Domingos de Benfica, No 45A, 1500-556 Lisboa','holding','#a29bfe',0);

INSERT INTO public.companies (legal_name, commercial_name, nif, address, type, brand_color, parent_company_id, monthly_revenue_target)
SELECT 'Plataforma Boemia, Lda.','Cocktail Lab','518650561','Rua de Sao Domingos de Benfica, No 45A, 1500-556 Lisboa','lab','#fd79a8', c.id, 0
FROM public.companies c WHERE c.type='holding';

INSERT INTO public.companies (legal_name, commercial_name, nif, address, type, brand_color, monthly_revenue_target)
VALUES
('Oasis and Jungles, Lda.','Imprensa Principe Real','515775312','Rua da Imprensa Nacional, No 46 Loja, 1250-127 Lisboa','bar','#4ecdc4',45000),
('Razao Inedita, Lda.','Imprensa Baixa','516168355','Rua de Sao Nicolau, No 24, 1100-549 Lisboa','bar','#ffa502',45000);

INSERT INTO public.cost_targets (metric, target_percent) VALUES
('Food Cost',28),('Beverage Cost',20),('Prime Cost',55),('Labour Cost',25);

INSERT INTO public.products (name, category) VALUES
('Tanqueray','spirit'),('Hendricks','spirit'),('Botanist','spirit'),('Nikka Coffey Gin','spirit'),
('Roku','spirit'),('Foxtale','spirit'),('Beluga','spirit'),('Khor','spirit'),('Titos','spirit'),
('Abuelo 7','spirit'),('Abuelo Anejo','spirit'),('Plantation OFTD','spirit'),('Santissima Trinidade','spirit'),
('St Trin Amendoim','spirit'),('1800 Blanco','spirit'),('Espolon Reposado','spirit'),('Cazadores','spirit'),
('Maguey Vida','spirit'),('San Cosme','spirit'),('Bulleit Bourbon','spirit'),('Bulleit Rye','spirit'),
('Dewars White Label','spirit'),('Dalmore 12','spirit'),('Four Roses','spirit'),('Laphroaig','spirit'),
('Woodford Reserve','spirit'),('Irish Whisky','spirit'),('Remy Martin 1738','spirit'),('CRF','spirit'),
('Porto Dry','spirit'),('Moscatel','spirit'),('Sherry Wine','spirit'),('Amaro Averna','spirit'),
('Amaro Montenegro','spirit'),('Aperol','spirit'),('Campari','spirit'),('Carpano Classico','spirit'),
('Cocchi Americano','spirit'),('Cointreau','spirit'),('Disaronno','spirit'),('Dry Curacau','spirit'),
('Giffard Baunilha','spirit'),('Giffard Creme de Cassis','spirit'),('Italicus','spirit'),
('Luxardo Maraschino','spirit'),('St Germain','spirit'),('Fernet Branca','spirit'),('Fernet','spirit'),
('Creme de Violet','spirit'),('Orgeat','spirit'),('Grenadine','spirit'),('Drambuie','spirit'),
('DOM Benedictine','spirit'),('Lillet Blanc','spirit'),('Passoa','spirit'),('Vanilla liqueur','spirit'),
('Fallernum Liqueur','spirit'),('Cinnamom Syrup','spirit'),('Peychauds bitter','spirit'),
('Angostura bitter','spirit'),('Orange bitter','spirit'),('Tabasco','spirit'),('Bitter Truth Falernum','spirit'),
('Borgetti','spirit'),('Amarguinha','spirit'),('Absinto La Fee','spirit'),('Yellow Chartreuse','spirit'),
('Green Chartreuse','spirit'),('Cognac','spirit'),('Calvados','spirit'),('Pisco','spirit'),
('Scotch Whiskey','spirit'),('Rye','spirit'),('White Rum','spirit'),('Dark Rum','spirit'),
('Overproof Rum','spirit'),('Cachaca','spirit'),('Sparkling Wine','spirit'),('Espumante','spirit'),
('Vinho Branco','spirit'),('Vinho Tinto','spirit'),('Pacto Unoaked','spirit'),('Coca Cola','spirit'),
('Soda','spirit'),('Tonica','spirit'),('Green Apple Tonic','spirit'),
('Manjericao','food'),('Cebolinho','food'),('Hortela','food'),('Salsa','food'),('Tomilho','food'),
('Alecrim','food'),('Aneto (Dill)','food'),('Erva principe','food'),('Coentros','food'),('Limao','food'),
('Lima','food'),('Laranja de Sumo','food'),('Toranja','food'),('Laranja','food'),('Banana','food'),
('Framboesa','food'),('Mirtilo','food'),('Pera Rocha','food'),('Abacaxi','food'),('Abacaxi Queimado','food'),
('Maracuja','food'),('Manga','food'),('Maca','food'),('Maca Vermelha','food'),('Granny Smith','food'),
('Morango','food'),('Ameixa','food'),('Amora','food'),('Pessego','food'),('Pera','food'),('Gengibre','food'),
('Cebola Roxa','food'),('Cebolote','food'),('Tomate Cherry','food'),('Tomate Cherry Amarelo','food'),
('Alho Seco','food'),('Pepino','food'),('Chalota Banana','food'),('Rabanete','food'),('Aipo','food'),
('Beterraba','food'),('Pimento','food'),('Tomate (lata)','food'),('Malagueta Jalapeno','food'),
('Malagueta Vermelha','food'),('Piri-piri liquido','food'),('Cominhos','food'),('Canela','food'),
('Cravinho','food'),('Noz moscada','food'),('Wasabi em po','food'),('Cardamomo verde','food'),
('Pandan','food'),('Matcha','food'),('Horseradish Ralado','food'),('Pasta de Horseradish','food'),
('Pasta de rabano','food'),('Lapsang','food'),('Cha Flor de Cerejeira','food'),('Cha Saudades de Kobe','food'),
('Especiarias Dun Lu Cha Dan Liao','food'),('Green Habanero Salsa','food'),('Worcestershire','food'),
('Soja','food'),('Sal','food'),('MSG','food'),('Clara de Ovo','food'),('Leite','food'),('Leite gordo','food'),
('Natas','food'),('Queijo creme','food'),('Iogurte','food'),('Iogurte de bolacha','food'),
('Manteiga s/ sal','food'),('Leite Condensado','food'),('Amendoim','food'),('Amendoim torrado','food'),
('Oleo de amendoim','food'),('Oleo coco','food'),('Azeite','food'),('Acido Citrico','food'),
('Acido Malico','food'),('Acido Tartarico','food'),('Acido Ascorbico','food'),('Acucar Branco','food'),
('Acucar','food'),('Acucar granulado','food'),('Agave','food'),('Mel','food'),('Demerara Syrup','food'),
('Xarope de Acucar 1:1','food'),('Xarope de Acucar 2:1','food'),('Sugs 2:1','food'),('Sugs granulated','food'),
('Compal Maca Verde','food'),('Compal Maracuja','food'),('Compal de tomate','food'),('Sumo de maca','food'),
('Sumo de ananas','food'),('Sumo de lima','food'),('Sumo de limao','food'),('Sumo de laranja','food'),
('Sumo de toranja','food'),('Sumo aipo','food'),('Agua de Coco 100%','food'),('Agua Lisa','food'),
('Cafe grao','food'),('Cafe em grao','food'),('Cafe moido a Medio Grao','food'),('Cafe espresso','food'),
('Brioche Bun','food'),('Bolacha','food'),('Cheesecake','food'),('Xantham Gum','food'),('Goma xantana','food'),
('Gelatina neutra','food'),('Agar','food'),('N2O','food'),('Oysters (Fresh)','food'),('Shrimp','food'),
('Azeitona','food'),('Pepino descascado','food'),('Folha de morango','food'),('Cascas de manga','food'),
('Zest de lima','food'),('Zest de laranja','food')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.cocktails (name, kind, company_id, price) VALUES
('Didot','signature',(SELECT id FROM public.companies WHERE commercial_name='Imprensa Principe Real'),11),
('Didot','signature',(SELECT id FROM public.companies WHERE commercial_name='Imprensa Baixa'),12),
('Impact','signature',(SELECT id FROM public.companies WHERE commercial_name='Imprensa Principe Real'),11),
('Impact','signature',(SELECT id FROM public.companies WHERE commercial_name='Imprensa Baixa'),12),
('Georgia','signature',(SELECT id FROM public.companies WHERE commercial_name='Imprensa Principe Real'),13),
('Georgia','signature',(SELECT id FROM public.companies WHERE commercial_name='Imprensa Baixa'),13),
('Chentenario','signature',(SELECT id FROM public.companies WHERE commercial_name='Imprensa Principe Real'),12),
('Chentenario','signature',(SELECT id FROM public.companies WHERE commercial_name='Imprensa Baixa'),12),
('Oxygen','signature',(SELECT id FROM public.companies WHERE commercial_name='Imprensa Principe Real'),13),
('Tahoma','signature',(SELECT id FROM public.companies WHERE commercial_name='Imprensa Principe Real'),12),
('Allura','signature',(SELECT id FROM public.companies WHERE commercial_name='Imprensa Principe Real'),11),
('Cursive','signature',(SELECT id FROM public.companies WHERE commercial_name='Imprensa Principe Real'),13),
('Oswald','signature',(SELECT id FROM public.companies WHERE commercial_name='Imprensa Principe Real'),12),
('Calibri','signature',(SELECT id FROM public.companies WHERE commercial_name='Imprensa Principe Real'),11),
('Serif','signature',(SELECT id FROM public.companies WHERE commercial_name='Imprensa Principe Real'),13),
('Bariol','signature',(SELECT id FROM public.companies WHERE commercial_name='Imprensa Principe Real'),11),
('Bodoni','signature',(SELECT id FROM public.companies WHERE commercial_name='Imprensa Principe Real'),12),
('Gotham','signature',(SELECT id FROM public.companies WHERE commercial_name='Imprensa Principe Real'),12),
('Old Fashioned (PR)','signature',(SELECT id FROM public.companies WHERE commercial_name='Imprensa Principe Real'),12),
('Zudoni','signature',(SELECT id FROM public.companies WHERE commercial_name='Imprensa Baixa'),13),
('Cagliostro','signature',(SELECT id FROM public.companies WHERE commercial_name='Imprensa Baixa'),11),
('Celtica','signature',(SELECT id FROM public.companies WHERE commercial_name='Imprensa Baixa'),12),
('Garamond','signature',(SELECT id FROM public.companies WHERE commercial_name='Imprensa Baixa'),11),
('Zephyr','signature',(SELECT id FROM public.companies WHERE commercial_name='Imprensa Baixa'),11),
('Rondure','signature',(SELECT id FROM public.companies WHERE commercial_name='Imprensa Baixa'),12),
('Montserrat','signature',(SELECT id FROM public.companies WHERE commercial_name='Imprensa Baixa'),11),
('Amaretto Sour','classic',NULL,NULL),('Americano','classic',NULL,NULL),('Aperol Spritz','classic',NULL,NULL),
('Army and Navy','classic',NULL,NULL),('Aviation','classic',NULL,NULL),('Bamboo','classic',NULL,NULL),
('Bees Knees','classic',NULL,NULL),('Between the Sheets','classic',NULL,NULL),('Bicicleta','classic',NULL,NULL),
('Bijou','classic',NULL,NULL),('Black Russian','classic',NULL,NULL),('White Russian','classic',NULL,NULL),
('Bloody Mary','classic',NULL,NULL),('Red Snapper','classic',NULL,NULL),('Bramble','classic',NULL,NULL),
('Cardinale','classic',NULL,NULL),('Casino','classic',NULL,NULL),('Classic Champagne Cocktail','classic',NULL,NULL),
('Corpse Reviver #1','classic',NULL,NULL),('Corpse Reviver #2','classic',NULL,NULL),('Cuba Libre','classic',NULL,NULL),
('Daiquiri','classic',NULL,NULL),('Dark n Stormy','classic',NULL,NULL),('Dry Martini','classic',NULL,NULL),
('Wet Martini','classic',NULL,NULL),('Reserve Martini','classic',NULL,NULL),('Dirty Martini','classic',NULL,NULL),
('Eastside','classic',NULL,NULL),('El Diablo','classic',NULL,NULL),('El Presidente','classic',NULL,NULL),
('Expresso Martini','classic',NULL,NULL),('Fitzgerald','classic',NULL,NULL),('French 75','classic',NULL,NULL),
('Garibaldi','classic',NULL,NULL),('Gimlet','classic',NULL,NULL),('Gin Basil Smash','classic',NULL,NULL),
('Gin Fizz','classic',NULL,NULL),('Hanky Panky','classic',NULL,NULL),('Hemingway Daiquiri','classic',NULL,NULL),
('Hugo Spritz','classic',NULL,NULL),('Junglebird','classic',NULL,NULL),('Kir Royal','classic',NULL,NULL),
('Last Word','classic',NULL,NULL),('Long Island Ice Tea','classic',NULL,NULL),('Mai Tai','classic',NULL,NULL),
('Manhattan','classic',NULL,NULL),('Rob Roy','classic',NULL,NULL),('Margarita','classic',NULL,NULL),
('Martinez','classic',NULL,NULL),('Mary Pickford','classic',NULL,NULL),('Mezcalita','classic',NULL,NULL),
('Mimosa','classic',NULL,NULL),('Mint Julep','classic',NULL,NULL),('Mojito','classic',NULL,NULL),
('Moscow Mule','classic',NULL,NULL),('Naked and Famous','classic',NULL,NULL),('Negroni','classic',NULL,NULL),
('Boulevardier','classic',NULL,NULL),('Negroni Sbagliato','classic',NULL,NULL),('New York Sour','classic',NULL,NULL),
('Old Cuban','classic',NULL,NULL),('Old Fashioned','classic',NULL,NULL),('Old Pal','classic',NULL,NULL),
('Painkiller','classic',NULL,NULL),('Paloma','classic',NULL,NULL),('Paper Plane','classic',NULL,NULL),
('Penicillin','classic',NULL,NULL),('Pisco Sour','classic',NULL,NULL),('Pornstar Martini','classic',NULL,NULL),
('Rusty Nail','classic',NULL,NULL),('Sazerac','classic',NULL,NULL),('Sidebell','classic',NULL,NULL),
('Sidecar','classic',NULL,NULL),('Siesta','classic',NULL,NULL),('Southside','classic',NULL,NULL),
('Tom Collins','classic',NULL,NULL),('Tommys Margarita','classic',NULL,NULL),('Trinidad Sour','classic',NULL,NULL),
('Tuxedo','classic',NULL,NULL),('Vesper Martini','classic',NULL,NULL),('Vieux Carre','classic',NULL,NULL),
('Whiskey Smash','classic',NULL,NULL),('Whiskey Sour','classic',NULL,NULL),('White Lady','classic',NULL,NULL),
('Zombie','classic',NULL,NULL);

INSERT INTO public.prep_recipes (name, company_id)
SELECT p.name, (SELECT id FROM public.companies WHERE commercial_name='Cocktail Lab')
FROM (VALUES
('Acid Water'),('Cordial Abacaxi Queimado'),('Agave Chilli'),('Negroni Classico'),('Negroni M. Ervas'),
('Mezcal Horseradish'),('Xarope de Matcha'),('Cheesecake Milkpunch'),('Fake Lime'),('Celtica Prep'),
('Rum St Trin Amendoim'),('Pacoca de Alecrim'),('Soda Maca Verde'),('CRF Spices'),('X. Waste Tinto'),
('Porto Cha Verde'),('Licor Cafe Coco'),('Cordial Pandan'),('Leche de Tigre'),('Cordial Maracuja'),
('Xarope de Gengibre'),('Xarope de Maca Vermelha'),('Xarope de Caramelo'),('Cachaca Dill + Malagueta'),
('Licor de Ananas'),('Tequila Coco'),('Xarope de Erva Principe'),('Whisky Pistaccio'),('Vermouth Amora'),
('Leite de Pistaccio'),('Vodka Cardamomo'),('Vodka Wasabi'),('Cordial Ameixa'),('Milkpunch'),
('Espuma de Matcha'),('Tequila Amendoim'),('Licor de Beterraba'),('X. Lapsang'),('Gin Cominhos'),
('Vermouth Pepino'),('Cordial Aipo'),('Bloody Mix'),('Rum Cafe'),('Coldbrew Spices'),('Gin Azeitona')
) AS p(name);

INSERT INTO public.service_costs (company_id, name, category, amount)
SELECT c.id, s.name, s.category, s.amount
FROM public.companies c
CROSS JOIN (VALUES
('Rent','rent',2500),('Electricity','utilities',450),('Water','utilities',80),('Internet','utilities',45),
('POS Software','software',89),('Insurance','insurance',120),('Music License','licensing',35),
('Waste Collection','utilities',65),('Cleaning Supplies','supplies',120),('Gas','utilities',40),
('Security System','security',55),('Accounting','professional',200),('Fire Safety','safety',45)
) AS s(name, category, amount)
WHERE c.commercial_name IN ('Imprensa Principe Real','Imprensa Baixa');
