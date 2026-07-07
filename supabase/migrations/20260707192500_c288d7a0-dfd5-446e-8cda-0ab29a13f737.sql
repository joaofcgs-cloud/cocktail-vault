ALTER TABLE public.cocktails
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Signature Cocktails';

UPDATE public.cocktails SET category = 'Signature Cocktails' WHERE category IS NULL OR category = '';