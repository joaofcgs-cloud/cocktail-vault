// Invoice spending taxonomy. Categories → subcategories.
// Used to organise invoices and to guide automatic categorisation.

export const CATEGORY_TREE: Record<string, string[]> = {
  Alcohol: ["Beer", "Wine", "Spirits", "Liqueurs", "Cider", "RTDs / Premixed"],
  "Non-Alcoholic Drinks": [
    "Soft Drinks",
    "Juice",
    "Mixers",
    "Water",
    "Coffee",
    "Tea",
    "Syrups",
  ],
  Food: [
    "Fresh Produce",
    "Dry Goods",
    "Frozen",
    "Dairy",
    "Meat",
    "Snacks",
    "Garnishes",
  ],
  "Bar Supplies": [
    "Ice",
    "Straws",
    "Napkins",
    "Cocktail Picks",
    "Takeaway Packaging",
    "Cleaning Supplies",
  ],
  "Glassware & Utensils": [
    "Glasses",
    "Shakers",
    "Jiggers",
    "Bar Spoons",
    "Pourers",
    "Knives",
  ],
  Equipment: [
    "Refrigeration",
    "Ice Machine",
    "Coffee Machine",
    "POS Hardware",
    "Furniture",
  ],
  Services: [
    "Equipment Repair",
    "Cleaning Service",
    "Pest Control",
    "Waste Collection",
  ],
  Utilities: ["Electricity", "Gas", "Water", "Internet"],
  Administration: [
    "Office Supplies",
    "Software",
    "Banking Fees",
    "Professional Fees",
    "Insurance",
    "Licences & Permits",
  ],
  Logistics: ["Freight", "Delivery Charges"],
  Tax: ["VAT", "Other Taxes"],
};

export const CATEGORIES = Object.keys(CATEGORY_TREE);

export function subcategoriesFor(category: string | null | undefined): string[] {
  if (!category) return [];
  return CATEGORY_TREE[category] ?? [];
}

/** Normalise a vendor name into a stable key for learned mappings. */
export function vendorKey(vendor: string): string {
  return vendor
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Validate an AI/learned category, returning null when unknown. */
export function normalizeCategory(cat: string | null | undefined): string | null {
  if (!cat) return null;
  const found = CATEGORIES.find((c) => c.toLowerCase() === cat.toLowerCase().trim());
  return found ?? null;
}

export function normalizeSubcategory(
  category: string | null | undefined,
  sub: string | null | undefined,
): string | null {
  if (!category || !sub) return null;
  const subs = subcategoriesFor(category);
  const found = subs.find((s) => s.toLowerCase() === sub.toLowerCase().trim());
  return found ?? null;
}
