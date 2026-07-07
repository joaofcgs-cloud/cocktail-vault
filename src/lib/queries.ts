import { useQuery } from "@tanstack/react-query";
import {
  db,
  type InventoryItem,
  type Cocktail,
  type DailySale,
  type BatchRecipe,
} from "@/lib/db";

export function useInventory() {
  return useQuery({
    queryKey: ["inventory"],
    queryFn: async (): Promise<InventoryItem[]> => {
      const { data, error } = await db.from("inventory").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCocktails() {
  return useQuery({
    queryKey: ["cocktails"],
    queryFn: async (): Promise<Cocktail[]> => {
      const { data, error } = await db.from("cocktails").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useSales() {
  return useQuery({
    queryKey: ["daily_sales"],
    queryFn: async (): Promise<DailySale[]> => {
      const { data, error } = await db
        .from("daily_sales")
        .select("*")
        .order("date");
      if (error) throw error;
      return data;
    },
  });
}

export function useBatches() {
  return useQuery({
    queryKey: ["batch_recipes"],
    queryFn: async (): Promise<BatchRecipe[]> => {
      const { data, error } = await db
        .from("batch_recipes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
