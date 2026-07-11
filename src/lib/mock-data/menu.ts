import type {
  BottlePackage,
  HappyHourRule,
  MenuCategory,
  MenuItem,
  ModifierGroup,
  StockMovement,
} from "@/lib/types";

export const mockCategories: MenuCategory[] = [
  { id: "cat-champagne", venueId: "venue-1", name: "Champagne", description: "Cuvées prestige servies dans un seau scintillant", sortOrder: 1, isActive: true },
  { id: "cat-tequila", venueId: "venue-1", name: "Tequila", description: "Blanco, reposado et añejo — citrons et sel inclus", sortOrder: 2, isActive: true },
  { id: "cat-vodka", venueId: "venue-1", name: "Vodka", description: "Servie glacée à votre table avec vos washers préférés", sortOrder: 3, isActive: true },
  { id: "cat-cognac", venueId: "venue-1", name: "Cognac", description: "V.S.O.P et X.O pour la banquette du fond", sortOrder: 4, isActive: true },
  { id: "cat-rhum", venueId: "venue-1", name: "Rhum", description: "Rhums caribéens vieillis, sec ou long drink", sortOrder: 5, isActive: true },
  { id: "cat-whisky", venueId: "venue-1", name: "Whisky", description: "Single malts et assemblages rares", sortOrder: 6, isActive: true },
  { id: "cat-gin", venueId: "venue-1", name: "Gin", description: "Bouteilles botaniques avec toniques premium", sortOrder: 7, isActive: true },
  { id: "cat-washers", venueId: "venue-1", name: "Washers", description: "Jus, sodas, boissons énergisantes et eau pour votre set-up", sortOrder: 8, isActive: true },
];

const washersGroup: ModifierGroup = {
  id: "mod-washers",
  name: "Washers inclus",
  required: true,
  maxSelections: 2,
  options: [
    { id: "wa-1", name: "Carafe de jus de canneberge", priceDelta: 0 },
    { id: "wa-2", name: "Carafe de jus d'orange", priceDelta: 0 },
    { id: "wa-3", name: "Set soda & tonic", priceDelta: 0 },
    { id: "wa-4", name: "Red Bull 4-pack", priceDelta: 24 },
    { id: "wa-5", name: "Fever-Tree ginger beer set", priceDelta: 14 },
  ],
};

const presentationGroup: ModifierGroup = {
  id: "mod-presentation",
  name: "Présentation",
  required: false,
  maxSelections: 1,
  options: [
    { id: "pr-1", name: "Service standard", priceDelta: 0 },
    { id: "pr-2", name: "Défilé de sparklers", priceDelta: 25 },
    { id: "pr-3", name: "Enseigne LED + défilé", priceDelta: 60 },
  ],
};

const spirits = [washersGroup, presentationGroup];
const champagneMods = [presentationGroup];

export const mockMenuItems: MenuItem[] = [
  // Champagne
  { id: "mi-moet", categoryId: "cat-champagne", name: "Moët & Chandon Impérial", description: "Le champagne classique de la maison, bien frais.", price: 160, icon: "champagne", tags: [], isAvailable: true, inventory: 24, modifierGroups: champagneMods },
  { id: "mi-dom", categoryId: "cat-champagne", name: "Dom Pérignon Vintage", description: "Cuvée de prestige iconique.", price: 320, icon: "champagne", tags: ["popular"], isAvailable: true, inventory: 12, modifierGroups: champagneMods },
  { id: "mi-ace", categoryId: "cat-champagne", name: "Ace of Spades Brut Gold", description: "Armand de Brignac — la pièce maîtresse.", price: 500, icon: "champagne", tags: ["premium", "popular"], isAvailable: true, inventory: 8, modifierGroups: champagneMods },
  { id: "mi-cristal", categoryId: "cat-champagne", name: "Louis Roederer Cristal", description: "Allocation rare — tant qu'il en reste.", price: 650, icon: "champagne", tags: ["limited"], isAvailable: true, inventory: 4, modifierGroups: champagneMods },

  // Tequila
  { id: "mi-patron", categoryId: "cat-tequila", name: "Patrón Silver", description: "Blanco smooth, citrons et sal de gusano inclus.", price: 220, icon: "tequila", tags: [], isAvailable: true, inventory: 15, modifierGroups: spirits },
  { id: "mi-don-julio", categoryId: "cat-tequila", name: "Don Julio 1942", description: "L'añejo qui n'a plus besoin de présentation.", price: 340, icon: "tequila", tags: ["popular"], isAvailable: true, inventory: 10, modifierGroups: spirits },
  { id: "mi-clase-azul", categoryId: "cat-tequila", name: "Clase Azul Reposado", description: "Bouteille en céramique peinte à la main.", price: 400, icon: "tequila", tags: ["premium"], isAvailable: true, inventory: 6, modifierGroups: spirits },

  // Vodka
  { id: "mi-titos", categoryId: "cat-vodka", name: "Tito's Handmade 1L", description: "Vodka craft qui plaît à tout le monde.", price: 180, icon: "vodka", tags: [], isAvailable: true, inventory: 18, modifierGroups: spirits },
  { id: "mi-greygoose", categoryId: "cat-vodka", name: "Grey Goose 1L", description: "Vodka française classique, servie glacée.", price: 220, icon: "vodka", tags: [], isAvailable: true, inventory: 14, modifierGroups: spirits },
  { id: "mi-belvedere", categoryId: "cat-vodka", name: "Belvedere Pure 1.75L", description: "Format magnum pour tout le booth.", price: 300, icon: "vodka", tags: ["popular"], isAvailable: true, inventory: 9, modifierGroups: spirits },

  // Cognac
  { id: "mi-hennessy", categoryId: "cat-cognac", name: "Hennessy V.S.O.P 1L", description: "Cognac smooth avec washers premium.", price: 260, icon: "cognac", tags: ["popular"], isAvailable: true, inventory: 11, modifierGroups: spirits },
  { id: "mi-dusse", categoryId: "cat-cognac", name: "D'Ussé V.S.O.P", description: "Cognac audacieux et moderne.", price: 280, icon: "cognac", tags: ["new"], isAvailable: true, inventory: 8, modifierGroups: spirits },
  { id: "mi-remy", categoryId: "cat-cognac", name: "Rémy Martin X.O", description: "X.O aux notes célébratoires.", price: 440, icon: "cognac", tags: ["premium"], isAvailable: true, inventory: 5, modifierGroups: spirits },

  // Rhum
  { id: "mi-diplomatico", categoryId: "cat-rhum", name: "Diplomático Reserva Exclusiva", description: "Rhum vénézuélien velouté.", price: 240, icon: "rum", tags: [], isAvailable: true, inventory: 7, modifierGroups: spirits },
  { id: "mi-zacapa", categoryId: "cat-rhum", name: "Ron Zacapa 23", description: "Rhum guatémaltèque vieilli en solera.", price: 270, icon: "rum", tags: ["new"], isAvailable: true, inventory: 6, modifierGroups: spirits },

  // Whisky
  { id: "mi-macallan", categoryId: "cat-whisky", name: "The Macallan 12", description: "Single malt vieilli en fût de sherry.", price: 320, icon: "whisky", tags: ["premium"], isAvailable: true, inventory: 6, modifierGroups: spirits },
  { id: "mi-jw-blue", categoryId: "cat-whisky", name: "Johnnie Walker Blue", description: "Le blend phare, réserve rare.", price: 430, icon: "whisky", tags: ["limited"], isAvailable: true, inventory: 4, modifierGroups: spirits },

  // Gin
  { id: "mi-hendricks", categoryId: "cat-gin", name: "Hendrick's 1L", description: "Frais au concombre, servi avec toniques premium.", price: 210, icon: "gin", tags: [], isAvailable: true, inventory: 10, modifierGroups: spirits },
  { id: "mi-monkey", categoryId: "cat-gin", name: "Monkey 47", description: "47 botaniques de la Forêt-Noire.", price: 250, icon: "gin", tags: ["new"], isAvailable: true, inventory: 5, modifierGroups: spirits },

  // Washers
  { id: "mi-redbull", categoryId: "cat-washers", name: "Red Bull 4-pack", description: "Original, sans sucre ou tropical.", price: 24, icon: "washer", tags: [], isAvailable: true, inventory: 60, modifierGroups: [] },
  { id: "mi-juice-carafe", categoryId: "cat-washers", name: "Carafe de jus frais", description: "Canneberge, orange ou ananas.", price: 14, icon: "washer", tags: [], isAvailable: true, inventory: 40, modifierGroups: [] },
  { id: "mi-soda-set", categoryId: "cat-washers", name: "Set de sodas premium", description: "Tonic, ginger beer et club soda.", price: 12, icon: "washer", tags: [], isAvailable: true, inventory: 50, modifierGroups: [] },
  { id: "mi-evian", categoryId: "cat-washers", name: "Evian 75cl", description: "Eau minérale plate.", price: 8, icon: "washer", tags: [], isAvailable: true, inventory: 80, modifierGroups: [] },
];

export const mockPackages: BottlePackage[] = [
  {
    id: "pkg-mr-ace",
    venueId: "venue-1",
    name: "Mr Ace",
    description: "La commande statement : cinq bouteilles dorées paradées à votre booth avec LED.",
    price: 2400,
    components: [
      { menuItemId: "mi-ace", quantity: 5 },
      { menuItemId: "mi-redbull", quantity: 2 },
      { menuItemId: "mi-evian", quantity: 4 },
    ],
    isActive: true,
  },
  {
    id: "pkg-presidential",
    venueId: "venue-1",
    name: "The Presidential",
    description: "Cristal et cognac X.O pour une table qui sait ce qu'elle veut.",
    price: 1600,
    components: [
      { menuItemId: "mi-cristal", quantity: 2 },
      { menuItemId: "mi-remy", quantity: 1 },
      { menuItemId: "mi-juice-carafe", quantity: 2 },
    ],
    isActive: true,
  },
  {
    id: "pkg-agave-royale",
    venueId: "venue-1",
    name: "Agave Royale",
    description: "Clase Azul rencontre 1942 — le set de célébration tequila.",
    price: 700,
    components: [
      { menuItemId: "mi-clase-azul", quantity: 1 },
      { menuItemId: "mi-don-julio", quantity: 1 },
      { menuItemId: "mi-juice-carafe", quantity: 1 },
      { menuItemId: "mi-soda-set", quantity: 1 },
    ],
    isActive: true,
  },
  {
    id: "pkg-table-starter",
    venueId: "venue-1",
    name: "Table Starter",
    description: "Un mousseux, une vodka, washers inclus — l'ouverture facile.",
    price: 380,
    components: [
      { menuItemId: "mi-moet", quantity: 1 },
      { menuItemId: "mi-greygoose", quantity: 1 },
      { menuItemId: "mi-redbull", quantity: 1 },
      { menuItemId: "mi-evian", quantity: 2 },
    ],
    isActive: true,
  },
];

const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

export const mockStockMovements: StockMovement[] = [
  { id: "mv-1", menuItemId: "mi-ace", itemName: "Ace of Spades Brut Gold", type: "restock", delta: 6, note: "Livraison hebdo — Maison Prestige", createdAt: minsAgo(360) },
  { id: "mv-2", menuItemId: "mi-dom", itemName: "Dom Pérignon Vintage", type: "restock", delta: 12, note: "Livraison hebdo — Maison Prestige", createdAt: minsAgo(360) },
  { id: "mv-3", menuItemId: "mi-redbull", itemName: "Red Bull 4-pack", type: "restock", delta: 40, note: "Course au dépanneur", createdAt: minsAgo(300) },
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
