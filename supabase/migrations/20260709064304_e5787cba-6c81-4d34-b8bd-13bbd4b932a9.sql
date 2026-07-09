ALTER TABLE public.prep_recipes
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'food';

ALTER TABLE public.prep_recipes
  DROP CONSTRAINT IF EXISTS prep_recipes_category_check;

ALTER TABLE public.prep_recipes
  ADD CONSTRAINT prep_recipes_category_check
  CHECK (category IN ('food', 'cocktail', 'cocktail_batch', 'glass_of_wine'));