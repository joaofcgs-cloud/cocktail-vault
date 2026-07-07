
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('owner', 'staff');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_owner(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'owner')
$$;

-- New user handler: create profile + assign role (first user = owner, rest = staff)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  owner_exists BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'owner') INTO owner_exists;
  IF owner_exists THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Inventory
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  current_stock NUMERIC NOT NULL DEFAULT 0,
  par_level INTEGER NOT NULL DEFAULT 1,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'OUT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory TO authenticated;
GRANT ALL ON public.inventory TO service_role;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Inventory viewable by authenticated" ON public.inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners insert inventory" ON public.inventory FOR INSERT TO authenticated WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owners update inventory" ON public.inventory FOR UPDATE TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owners delete inventory" ON public.inventory FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

CREATE OR REPLACE FUNCTION public.calc_inventory_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  ratio NUMERIC;
BEGIN
  IF NEW.current_stock <= 0 THEN
    NEW.status := 'OUT';
  ELSE
    ratio := NEW.current_stock / NULLIF(NEW.par_level, 0);
    IF ratio IS NULL THEN
      NEW.status := 'GOOD';
    ELSIF ratio < 0.5 THEN
      NEW.status := 'LOW';
    ELSIF ratio < 1 THEN
      NEW.status := 'OK';
    ELSE
      NEW.status := 'GOOD';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_inventory_status BEFORE INSERT OR UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.calc_inventory_status();

-- Cocktails
CREATE TABLE public.cocktails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  specs TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  est_cost NUMERIC NOT NULL DEFAULT 0,
  margin_percent NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cocktails TO authenticated;
GRANT ALL ON public.cocktails TO service_role;
ALTER TABLE public.cocktails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cocktails viewable by authenticated" ON public.cocktails FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners manage cocktails" ON public.cocktails FOR ALL TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));

CREATE OR REPLACE FUNCTION public.calc_cocktail_margin()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.price > 0 THEN
    NEW.margin_percent := ((NEW.price - NEW.est_cost) / NEW.price) * 100;
  ELSE
    NEW.margin_percent := 0;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_cocktail_margin BEFORE INSERT OR UPDATE ON public.cocktails FOR EACH ROW EXECUTE FUNCTION public.calc_cocktail_margin();

-- Invoices
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor TEXT NOT NULL,
  date DATE,
  total NUMERIC NOT NULL DEFAULT 0,
  items TEXT,
  receipt_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Invoices viewable by authenticated" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owners update invoices" ON public.invoices FOR UPDATE TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owners delete invoices" ON public.invoices FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

-- Sales uploads
CREATE TABLE public.sales_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_date DATE DEFAULT CURRENT_DATE,
  file_name TEXT,
  parsed_data JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_uploads TO authenticated;
GRANT ALL ON public.sales_uploads TO service_role;
ALTER TABLE public.sales_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales viewable by authenticated" ON public.sales_uploads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners manage sales" ON public.sales_uploads FOR ALL TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
