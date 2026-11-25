export const CATALOG_IDS = ["jalebi", "ladoo", "lassi", "lantern", "marigold"] as const;
export type CatalogItemId = (typeof CATALOG_IDS)[number];

export interface CatalogItem {
  id: CatalogItemId;
  name: string;
  price: number;
  description: string;
}

export const CATALOG_ITEMS: Record<CatalogItemId, CatalogItem> = {
  jalebi: {
    id: "jalebi",
    name: "Warm Jalebi",
    price: 15,
    description: "Crisp saffron-syrup spirals from the mithai counter.",
  },
  ladoo: {
    id: "ladoo",
    name: "Motichoor Ladoo",
    price: 20,
    description: "Festive cardamom and pearl-gram sweet box.",
  },
  lassi: {
    id: "lassi",
    name: "Mango Lassi",
    price: 12,
    description: "Chilled clay-cup mango yogurt drink.",
  },
  lantern: {
    id: "lantern",
    name: "Paper Lantern",
    price: 25,
    description: "Painted Wood souvenir lantern for your stroll.",
  },
  marigold: {
    id: "marigold",
    name: "Marigold Garland",
    price: 10,
    description: "Bright festive marigold keepsake.",
  },
};
