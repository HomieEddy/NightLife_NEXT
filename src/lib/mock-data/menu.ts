import type {
  BottlePackage,
  HappyHourRule,
  MenuCategory,
  MenuItem,
  ModifierGroup,
  StockMovement,
} from "@/lib/types";

const presentationGroup: ModifierGroup = {
  id: "mod-presentation",
  name: "Presentation",
  kind: "presentation",
  required: false,
  maxSelections: 1,
  isActive: true,
  options: [
    { id: "pr-1", name: "Standard service", priceDelta: 0, maxQuantity: 1, isActive: true },
    { id: "pr-2", name: "Sparkler parade", priceDelta: 25, maxQuantity: 1, isActive: true },
    { id: "pr-3", name: "LED sign + parade", priceDelta: 60, maxQuantity: 1, isActive: true },
  ],
};

const mk = (id: string, name: string, priceDelta: number, maxQty: number, itemId: string) =>
  ({ id, name, priceDelta, maxQuantity: maxQty, inventoryItemId: itemId, isActive: true });

const washersRhum: ModifierGroup = {
  id: "mod-washers-rhum", name: "Washers", kind: "washer", required: true, maxSelections: 2, isActive: true,
  options: [
    mk("rh-wa-1", "Coca-Cola", 0, 6, "mi-coke"),
    mk("rh-wa-2", "Sprite", 0, 6, "mi-sprite"),
    mk("rh-wa-3", "Pineapple Juice", 0, 6, "mi-pineapple-juice"),
    mk("rh-wa-4", "Orange Juice", 0, 6, "mi-orange-juice"),
    mk("rh-wa-5", "Red Bull", 5, 6, "mi-redbull"),
    mk("rh-wa-6", "Red Bull 6-pack", 30, 3, "mi-redbull-6pack"),
  ],
};

const washersVodka: ModifierGroup = {
  id: "mod-washers-vodka", name: "Washers", kind: "washer", required: true, maxSelections: 2, isActive: true,
  options: [
    mk("vo-wa-1", "Cranberry Juice", 0, 6, "mi-cranberry-juice"),
    mk("vo-wa-2", "Sprite", 0, 6, "mi-sprite"),
    mk("vo-wa-3", "Tonic Water", 0, 6, "mi-tonic-water"),
    mk("vo-wa-4", "Ginger Ale", 0, 6, "mi-gingerale"),
    mk("vo-wa-5", "Red Bull", 5, 6, "mi-redbull"),
    mk("vo-wa-6", "Red Bull 6-pack", 30, 3, "mi-redbull-6pack"),
    mk("vo-wa-7", "Spring Water 12-pack", 20, 2, "mi-spring-water-12"),
  ],
};

const washersTequila: ModifierGroup = {
  id: "mod-washers-tequila", name: "Washers", kind: "washer", required: true, maxSelections: 2, isActive: true,
  options: [
    mk("te-wa-1", "Sprite", 0, 6, "mi-sprite"),
    mk("te-wa-2", "Pineapple Juice", 0, 6, "mi-pineapple-juice"),
    mk("te-wa-3", "Orange Juice", 0, 6, "mi-orange-juice"),
    mk("te-wa-4", "Red Bull", 5, 6, "mi-redbull"),
    mk("te-wa-5", "Red Bull 6-pack", 30, 3, "mi-redbull-6pack"),
    mk("te-wa-6", "Spring Water 12-pack", 20, 2, "mi-spring-water-12"),
  ],
};

const washersCognac: ModifierGroup = {
  id: "mod-washers-cognac", name: "Washers", kind: "washer", required: true, maxSelections: 2, isActive: true,
  options: [
    mk("co-wa-1", "Coca-Cola", 0, 6, "mi-coke"),
    mk("co-wa-2", "Ginger Ale", 0, 6, "mi-gingerale"),
    mk("co-wa-3", "Spring Water 12-pack", 20, 2, "mi-spring-water-12"),
    mk("co-wa-4", "Red Bull", 5, 6, "mi-redbull"),
  ],
};

const washersWhisky: ModifierGroup = {
  id: "mod-washers-whisky", name: "Washers", kind: "washer", required: true, maxSelections: 2, isActive: true,
  options: [
    mk("wh-wa-1", "Coca-Cola", 0, 6, "mi-coke"),
    mk("wh-wa-2", "Ginger Ale", 0, 6, "mi-gingerale"),
    mk("wh-wa-3", "Spring Water 12-pack", 20, 2, "mi-spring-water-12"),
  ],
};

const washersGin: ModifierGroup = {
  id: "mod-washers-gin", name: "Washers", kind: "washer", required: true, maxSelections: 2, isActive: true,
  options: [
    mk("gi-wa-1", "Tonic Water", 0, 6, "mi-tonic-water"),
    mk("gi-wa-2", "Sprite", 0, 6, "mi-sprite"),
    mk("gi-wa-3", "Cranberry Juice", 0, 6, "mi-cranberry-juice"),
    mk("gi-wa-4", "Red Bull", 5, 6, "mi-redbull"),
    mk("gi-wa-5", "Red Bull 6-pack", 30, 3, "mi-redbull-6pack"),
  ],
};

const washersPackage: ModifierGroup = {
  id: "mod-washers-package", name: "Washers", kind: "washer", required: true, maxSelections: 2, isActive: true,
  options: [
    mk("pk-wa-1", "Coca-Cola", 0, 6, "mi-coke"),
    mk("pk-wa-2", "Sprite", 0, 6, "mi-sprite"),
    mk("pk-wa-3", "Cranberry Juice", 0, 6, "mi-cranberry-juice"),
    mk("pk-wa-4", "Pineapple Juice", 0, 6, "mi-pineapple-juice"),
    mk("pk-wa-5", "Orange Juice", 0, 6, "mi-orange-juice"),
    mk("pk-wa-6", "Tonic Water", 0, 6, "mi-tonic-water"),
    mk("pk-wa-7", "Ginger Ale", 0, 6, "mi-gingerale"),
    mk("pk-wa-8", "Red Bull", 5, 6, "mi-redbull"),
    mk("pk-wa-9", "Red Bull 6-pack", 30, 3, "mi-redbull-6pack"),
    mk("pk-wa-10", "Spring Water 12-pack", 20, 2, "mi-spring-water-12"),
  ],
};

const packageMods = [washersPackage, presentationGroup];
const champagneMods = [presentationGroup];
const withPresentation = (wg: ModifierGroup) => [wg, presentationGroup];

export const mockCategories: MenuCategory[] = [
  { id: "cat-champagne", venueId: "venue-1", name: "Champagne", description: "Cuvées prestige servies dans un seau scintillant", sortOrder: 1, isActive: true, modifierGroups: champagneMods },
  { id: "cat-tequila", venueId: "venue-1", name: "Tequila", description: "Blanco, reposado et anejo — citrons et sel inclus", sortOrder: 2, isActive: true, modifierGroups: withPresentation(washersTequila) },
  { id: "cat-vodka", venueId: "venue-1", name: "Vodka", description: "Servie glacee a votre table avec vos washers preferes", sortOrder: 3, isActive: true, modifierGroups: withPresentation(washersVodka) },
  { id: "cat-cognac", venueId: "venue-1", name: "Cognac", description: "V.S.O.P et X.O pour la banquette du fond", sortOrder: 4, isActive: true, modifierGroups: withPresentation(washersCognac) },
  { id: "cat-rhum", venueId: "venue-1", name: "Rhum", description: "Rhums caribeens vieillis, sec ou long drink", sortOrder: 5, isActive: true, modifierGroups: withPresentation(washersRhum) },
  { id: "cat-whisky", venueId: "venue-1", name: "Whisky", description: "Single malts et assemblages rares", sortOrder: 6, isActive: true, modifierGroups: withPresentation(washersWhisky) },
  { id: "cat-gin", venueId: "venue-1", name: "Gin", description: "Bouteilles botaniques avec toniques premium", sortOrder: 7, isActive: true, modifierGroups: withPresentation(washersGin) },
  { id: "cat-washers", venueId: "venue-1", name: "Washers", description: "Jus, sodas, boissons energisantes et eau pour votre set-up", sortOrder: 8, isActive: true, modifierGroups: [] },
];

// Every item here is a spirit/champagne except "Washers" (sodas/juice/energy
// drinks) — isAlcoholic/allergens are derived once below rather than repeated
// on 22 literals (allergens are undeclared in the demo seed; abv is omitted).
const rawMenuItems: Omit<MenuItem, "isAlcoholic" | "allergens">[] = [
  // Champagne
  { id: "mi-moet", categoryId: "cat-champagne", name: "Moët & Chandon Impérial", description: "Le champagne classique de la maison, bien frais.", price: 160, icon: "champagne", tags: [], isAvailable: true, inventory: 24 },
  { id: "mi-dom", categoryId: "cat-champagne", name: "Dom Pérignon Vintage", description: "Cuvée de prestige iconique.", price: 320, icon: "champagne", tags: ["popular"], isAvailable: true, inventory: 12 },
  { id: "mi-ace", categoryId: "cat-champagne", name: "Ace of Spades Brut Gold", description: "Armand de Brignac — la pièce maîtresse.", price: 500, icon: "champagne", tags: ["premium", "popular"], isAvailable: true, inventory: 8 },
  { id: "mi-cristal", categoryId: "cat-champagne", name: "Louis Roederer Cristal", description: "Allocation rare — tant qu'il en reste.", price: 650, icon: "champagne", tags: ["limited"], isAvailable: true, inventory: 4 },

  // Tequila
  { id: "mi-patron", categoryId: "cat-tequila", name: "Patrón Silver", description: "Blanco smooth, citrons et sal de gusano inclus.", price: 220, icon: "tequila", tags: [], isAvailable: true, inventory: 15 },
  { id: "mi-don-julio", categoryId: "cat-tequila", name: "Don Julio 1942", description: "L'añejo qui n'a plus besoin de présentation.", price: 340, icon: "tequila", tags: ["popular"], isAvailable: true, inventory: 10 },
  { id: "mi-clase-azul", categoryId: "cat-tequila", name: "Clase Azul Reposado", description: "Bouteille en céramique peinte à la main.", price: 400, icon: "tequila", tags: ["premium"], isAvailable: true, inventory: 6 },

  // Vodka
  { id: "mi-titos", categoryId: "cat-vodka", name: "Tito's Handmade 1L", description: "Vodka craft qui plaît à tout le monde.", price: 180, icon: "vodka", tags: [], isAvailable: true, inventory: 18 },
  { id: "mi-greygoose", categoryId: "cat-vodka", name: "Grey Goose 1L", description: "Vodka française classique, servie glacée.", price: 220, icon: "vodka", tags: [], isAvailable: true, inventory: 14 },
  { id: "mi-belvedere", categoryId: "cat-vodka", name: "Belvedere Pure 1.75L", description: "Format magnum pour tout le booth.", price: 300, icon: "vodka", tags: ["popular"], isAvailable: true, inventory: 9 },

  // Cognac
  { id: "mi-hennessy", categoryId: "cat-cognac", name: "Hennessy V.S.O.P 1L", description: "Cognac smooth avec washers premium.", price: 260, icon: "cognac", tags: ["popular"], isAvailable: true, inventory: 11 },
  { id: "mi-dusse", categoryId: "cat-cognac", name: "D'Ussé V.S.O.P", description: "Cognac audacieux et moderne.", price: 280, icon: "cognac", tags: ["new"], isAvailable: true, inventory: 8 },
  { id: "mi-remy", categoryId: "cat-cognac", name: "Rémy Martin X.O", description: "X.O aux notes célébratoires.", price: 440, icon: "cognac", tags: ["premium"], isAvailable: true, inventory: 5 },

  // Rhum
  { id: "mi-diplomatico", categoryId: "cat-rhum", name: "Diplomático Reserva Exclusiva", description: "Rhum vénézuélien velouté.", price: 240, icon: "rum", tags: [], isAvailable: true, inventory: 7 },
  { id: "mi-zacapa", categoryId: "cat-rhum", name: "Ron Zacapa 23", description: "Rhum guatémaltèque vieilli en solera.", price: 270, icon: "rum", tags: ["new"], isAvailable: true, inventory: 6 },

  // Whisky
  { id: "mi-macallan", categoryId: "cat-whisky", name: "The Macallan 12", description: "Single malt vieilli en fût de sherry.", price: 320, icon: "whisky", tags: ["premium"], isAvailable: true, inventory: 6 },
  { id: "mi-jw-blue", categoryId: "cat-whisky", name: "Johnnie Walker Blue", description: "Le blend phare, réserve rare.", price: 430, icon: "whisky", tags: ["limited"], isAvailable: true, inventory: 4 },

  // Gin
  { id: "mi-hendricks", categoryId: "cat-gin", name: "Hendrick's 1L", description: "Frais au concombre, servi avec toniques premium.", price: 210, icon: "gin", tags: [], isAvailable: true, inventory: 10 },
  { id: "mi-monkey", categoryId: "cat-gin", name: "Monkey 47", description: "47 botaniques de la Forêt-Noire.", price: 250, icon: "gin", tags: ["new"], isAvailable: true, inventory: 5 },

  // Washers
  { id: "mi-coke", categoryId: "cat-washers", name: "Coca-Cola", description: "Canette 355ml.", price: 4, icon: "washer", tags: [], isAvailable: true, inventory: 80 },
  { id: "mi-sprite", categoryId: "cat-washers", name: "Sprite", description: "Canette 355ml.", price: 4, icon: "washer", tags: [], isAvailable: true, inventory: 80 },
  { id: "mi-cranberry-juice", categoryId: "cat-washers", name: "Cranberry Juice", description: "Jus de canneberge.", price: 5, icon: "washer", tags: [], isAvailable: true, inventory: 40 },
  { id: "mi-apple-juice", categoryId: "cat-washers", name: "Apple Juice", description: "Jus de pomme.", price: 5, icon: "washer", tags: [], isAvailable: true, inventory: 40 },
  { id: "mi-pineapple-juice", categoryId: "cat-washers", name: "Pineapple Juice", description: "Jus d'ananas.", price: 5, icon: "washer", tags: [], isAvailable: true, inventory: 40 },
  { id: "mi-orange-juice", categoryId: "cat-washers", name: "Orange Juice", description: "Jus d'orange.", price: 5, icon: "washer", tags: [], isAvailable: true, inventory: 40 },
  { id: "mi-tonic-water", categoryId: "cat-washers", name: "Tonic Water", description: "Fever-Tree 200ml.", price: 4, icon: "washer", tags: [], isAvailable: true, inventory: 60 },
  { id: "mi-gingerale", categoryId: "cat-washers", name: "Ginger Ale", description: "Canada Dry 355ml.", price: 4, icon: "washer", tags: [], isAvailable: true, inventory: 60 },
  { id: "mi-spring-water-12", categoryId: "cat-washers", name: "Spring Water 12-pack", description: "Pack de 12 bouteilles.", price: 20, icon: "washer", tags: [], isAvailable: true, inventory: 30 },
  { id: "mi-redbull", categoryId: "cat-washers", name: "Red Bull", description: "Canette 250ml.", price: 5, icon: "washer", tags: ["popular"], isAvailable: true, inventory: 120 },
  { id: "mi-redbull-6pack", categoryId: "cat-washers", name: "Red Bull 6-pack", description: "Pack de 6 canettes.", price: 30, icon: "washer", tags: [], isAvailable: true, inventory: 40 },
];

export const mockMenuItems: MenuItem[] = rawMenuItems.map((item) => ({
  ...item,
  isAlcoholic: item.categoryId !== "cat-washers",
  allergens: [],
}));

export const mockPackages: BottlePackage[] = [
  {
    id: "pkg-mr-ace",
    venueId: "venue-1",
    name: "Mr Ace",
    description: "The statement order: five gold bottles paraded to your booth with LED.",
    price: 2400,
    components: [
      { menuItemId: "mi-ace", quantity: 5 },
    ],
    modifierGroups: packageMods,
    isActive: true,
  },
  {
    id: "pkg-presidential",
    venueId: "venue-1",
    name: "The Presidential",
    description: "Cristal and Cognac X.O for a table that knows what it wants.",
    price: 1600,
    components: [
      { menuItemId: "mi-cristal", quantity: 2 },
      { menuItemId: "mi-remy", quantity: 1 },
    ],
    modifierGroups: packageMods,
    isActive: true,
  },
  {
    id: "pkg-agave-royale",
    venueId: "venue-1",
    name: "Agave Royale",
    description: "Clase Azul meets 1942 — the tequila celebration set.",
    price: 700,
    components: [
      { menuItemId: "mi-clase-azul", quantity: 1 },
      { menuItemId: "mi-don-julio", quantity: 1 },
    ],
    modifierGroups: packageMods,
    isActive: true,
  },
  {
    id: "pkg-table-starter",
    venueId: "venue-1",
    name: "Table Starter",
    description: "One bubbly, one vodka — the easy opener.",
    price: 380,
    components: [
      { menuItemId: "mi-moet", quantity: 1 },
      { menuItemId: "mi-greygoose", quantity: 1 },
    ],
    modifierGroups: packageMods,
    isActive: true,
  },
  {
    id: "pkg-the-vault",
    venueId: "venue-1",
    name: "Sovereign",
    description: "Five Cristal, three Blue, three Dom — the booth build-out for a table that means business.",
    price: 4800,
    components: [
      { menuItemId: "mi-cristal", quantity: 5 },
      { menuItemId: "mi-jw-blue", quantity: 3 },
      { menuItemId: "mi-dom", quantity: 3 },
    ],
    modifierGroups: packageMods,
    isActive: true,
  },
  {
    id: "pkg-empire",
    venueId: "venue-1",
    name: "Dynasty",
    description: "Ten Ace of Spades, eight Cristal — a parade of gold and platinum. The room turns.",
    price: 9800,
    components: [
      { menuItemId: "mi-ace", quantity: 10 },
      { menuItemId: "mi-cristal", quantity: 8 },
    ],
    modifierGroups: packageMods,
    isActive: true,
  },
  {
    id: "pkg-nightfall",
    venueId: "venue-1",
    name: "Legacy",
    description: "Twenty-five Ace, twenty Cristal — shut it down. This is the one they'll talk about.",
    price: 24000,
    components: [
      { menuItemId: "mi-ace", quantity: 25 },
      { menuItemId: "mi-cristal", quantity: 20 },
    ],
    modifierGroups: packageMods,
    isActive: true,
  },
];

const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

export const mockStockMovements: StockMovement[] = [
  { id: "mv-1", menuItemId: "mi-ace", itemName: "Ace of Spades Brut Gold", type: "restock", delta: 6, note: "Livraison hebdo — Maison Prestige", createdAt: minsAgo(360) },
  { id: "mv-2", menuItemId: "mi-dom", itemName: "Dom Pérignon Vintage", type: "restock", delta: 12, note: "Livraison hebdo — Maison Prestige", createdAt: minsAgo(360) },
  { id: "mv-3", menuItemId: "mi-redbull", itemName: "Red Bull", type: "restock", delta: 80, note: "Course au depanneur", createdAt: minsAgo(300) },
  { id: "mv-4", menuItemId: "mi-cristal", itemName: "Louis Roederer Cristal", type: "adjustment", delta: -1, note: "Bouteille cassée pendant le set-up", createdAt: minsAgo(120) },
  { id: "mv-5", menuItemId: "mi-dom", itemName: "Dom Pérignon Vintage", type: "sale", delta: -1, note: "Commande A-038", createdAt: minsAgo(3) },
];

export const mockHappyHourRules: HappyHourRule[] = [
  {
    id: "hh-early",
    venueId: "venue-1",
    name: "5 à 7 Bouteilles",
    daysOfWeek: [4, 5, 6],
    startTime: "22:00",
    endTime: "23:30",
    discountPct: 15,
    appliesToCategoryIds: ["cat-vodka", "cat-gin"],
    isActive: true,
  },
  {
    id: "hh-champagne",
    venueId: "venue-1",
    name: "Jeudis Champagne",
    daysOfWeek: [4],
    startTime: "22:00",
    endTime: "00:00",
    discountPct: 20,
    appliesToCategoryIds: ["cat-champagne"],
    isActive: true,
  },
  {
    id: "hh-industry",
    venueId: "venue-1",
    name: "Soirée Industrie",
    daysOfWeek: [0],
    startTime: "23:00",
    endTime: "02:00",
    discountPct: 25,
    appliesToCategoryIds: ["cat-whisky", "cat-cognac"],
    isActive: false,
  },
];
