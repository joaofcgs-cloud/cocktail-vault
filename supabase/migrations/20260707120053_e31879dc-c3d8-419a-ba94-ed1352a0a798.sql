
DROP POLICY "Authenticated insert ingredients" ON public.cocktail_ingredients;
CREATE POLICY "Authenticated insert ingredients" ON public.cocktail_ingredients FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY "Authenticated insert sales" ON public.daily_sales;
CREATE POLICY "Authenticated insert sales" ON public.daily_sales FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY "Authenticated insert batches" ON public.batch_recipes;
CREATE POLICY "Authenticated insert batches" ON public.batch_recipes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY "Authenticated update batches" ON public.batch_recipes;
CREATE POLICY "Authenticated update batches" ON public.batch_recipes FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY "Authenticated insert batch ingredients" ON public.batch_ingredients;
CREATE POLICY "Authenticated insert batch ingredients" ON public.batch_ingredients FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY "Authenticated update batch ingredients" ON public.batch_ingredients;
CREATE POLICY "Authenticated update batch ingredients" ON public.batch_ingredients FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY "Authenticated delete batch ingredients" ON public.batch_ingredients;
CREATE POLICY "Authenticated delete batch ingredients" ON public.batch_ingredients FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
