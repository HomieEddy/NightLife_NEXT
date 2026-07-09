import type {
  BottlePackage,
  HappyHourRule,
  MenuCategory,
  MenuItem,
  ModifierGroup,
  StockMovement,
} from "@/lib/types";

export const mockCategories: MenuCategory[] = [
  { id: "cat-champagne", venueId: "venue-1", name: "Champagne", description: "Cuvées and prestige bottles, served in a glowing ice bucket", sortOrder: 1, isActive: true },
  { id: "cat-tequila", venueId: "venue-1", name: "Tequila", description: "Blanco, reposado and añejo — limes and salt included", sortOrder: 2, isActive: true },
  { id: "cat-vodka", venueId: "venue-1", name: "Vodka", description: "Chilled table-side with your choice of washers", sortOrder: 3, isActive: true },
  { id: "cat-cognac", venueId: "venue-1", name: "Cognac", description: "V.S.O.P and X.O pours for the back booth", sortOrder: 4, isActive: true },
  { id: "cat-rhum", venueId: "venue-1", name: "Rhum", description: "Aged Caribbean rhums, served neat or long", sortOrder: 5, isActive: true },
  { id: "cat-whisky", venueId: "venue-1", name: "Whisky", description: "Single malts and rare blends", sortOrder: 6, isActive: true },
  { id: "cat-gin", venueId: "venue-1", name: "Gin", description: "Botanical bottles with premium tonics", sortOrder: 7, isActive: true },
  { id: "cat-washers", venueId: "venue-1", name: "Washers", description: "Juices, sodas, energy drinks and water for your setup", sortOrder: 8, isActive: true },
];

const washersGroup: ModifierGroup = {
  id: "mod-washers",
  name: "Included washers",
  required: true,
  maxSelections: 2,
  options: [
    { id: "wa-1", name: "Cranberry juice carafe", priceDelta: 0 },
    { id: "wa-2", name: "Orange juice carafe", priceDelta: 0 },
    { id: "wa-3", name: "Soda & tonic set", priceDelta: 0 },
    { id: "wa-4", name: "Red Bull 4-pack", priceDelta: 24 },
    { id: "wa-5", name: "Fever-Tree ginger beer set", priceDelta: 14 },
  ],
};

const presentationGroup: ModifierGroup = {
  id: "mod-presentation",
  name: "Presentation",
  required: false,
  maxSelections: 1,
  options: [
    { id: "pr-1", name: "Standard service", priceDelta: 0 },
    { id: "pr-2", name: "Sparkler parade", priceDelta: 25 },
    { id: "pr-3", name: "LED sign + parade", priceDelta: 60 },
  ],
};

const spirits = [washersGroup, presentationGroup];
const champagneMods = [presentationGroup];

export const mockMenuItems: MenuItem[] = [
  // Champagne
  { id: "mi-moet", categoryId: "cat-champagne", name: "Moët & Chandon Impérial", description: "The classic house champagne, ice cold.", price: 260, icon: "champagne", tags: [], isAvailable: true, inventory: 24, modifierGroups: champagneMods },
  { id: "mi-dom", categoryId: "cat-champagne", name: "Dom Pérignon Vintage", description: "Iconic prestige cuvée.", price: 480, icon: "champagne", tags: ["popular"], isAvailable: true, inventory: 12, modifierGroups: champagneMods },
  { id: "mi-ace", categoryId: "cat-champagne", name: "Ace of Spades Brut Gold", description: "Armand de Brignac — the showstopper.", price: 750, icon: "champagne", tags: ["premium", "popular"], isAvailable: true, inventory: 8, modifierGroups: champagneMods },
  { id: "mi-cristal", categoryId: "cat-champagne", name: "Louis Roederer Cristal", description: "Rare allocation — while it lasts.", price: 900, icon: "champagne", tags: ["limited"], isAvailable: true, inventory: 4, modifierGroups: champagneMods },

  // Tequila
  { id: "mi-patron", categoryId: "cat-tequila", name: "Patrón Silver", description: "Smooth blanco, limes and sal de gusano included.", price: 320, icon: "tequila", tags: [], isAvailable: true, inventory: 15, modifierGroups: spirits },
  { id: "mi-don-julio", categoryId: "cat-tequila", name: "Don Julio 1942", description: "The añejo that needs no introduction.", price: 480, icon: "tequila", tags: ["popular"], isAvailable: true, inventory: 10, modifierGroups: spirits },
  { id: "mi-clase-azul", categoryId: "cat-tequila", name: "Clase Azul Reposado", description: "Hand-painted ceramic bottle, artisanal reposado.", price: 550, icon: "tequila", tags: ["premium"], isAvailable: true, inventory: 6, modifierGroups: spirits },

  // Vodka
  { id: "mi-titos", categoryId: "cat-vodka", name: "Tito's Handmade 1L", description: "Crowd-pleasing craft vodka.", price: 260, icon: "vodka", tags: [], isAvailable: true, inventory: 18, modifierGroups: spirits },
  { id: "mi-greygoose", categoryId: "cat-vodka", name: "Grey Goose 1L", description: "Classic French vodka, chilled table-side.", price: 320, icon: "vodka", tags: [], isAvailable: true, inventory: 14, modifierGroups: spirits },
  { id: "mi-belvedere", categoryId: "cat-vodka", name: "Belvedere Pure 1.75L", description: "Magnum pour for the full booth.", price: 420, icon: "vodka", tags: ["popular"], isAvailable: true, inventory: 9, modifierGroups: spirits },

  // Cognac
  { id: "mi-hennessy", categoryId: "cat-cognac", name: "Hennessy V.S.O.P 1L", description: "Smooth cognac with premium washers.", price: 380, icon: "cognac", tags: ["popular"], isAvailable: true, inventory: 11, modifierGroups: spirits },
  { id: "mi-dusse", categoryId: "cat-cognac", name: "D'Ussé V.S.O.P", description: "Bold, modern cognac.", price: 400, icon: "cognac", tags: ["new"], isAvailable: true, inventory: 8, modifierGroups: spirits },
  { id: "mi-remy", categoryId: "cat-cognac", name: "Rémy Martin X.O", description: "Layered, celebratory X.O.", price: 620, icon: "cognac", tags: ["premium"], isAvailable: true, inventory: 5, modifierGroups: spirits },

  // Rhum
  { id: "mi-diplomatico", categoryId: "cat-rhum", name: "Diplomático Reserva Exclusiva", description: "Velvety Venezuelan rhum.", price: 340, icon: "rum", tags: [], isAvailable: true, inventory: 7, modifierGroups: spirits },
  { id: "mi-zacapa", categoryId: "cat-rhum", name: "Ron Zacapa 23", description: "Solera-aged Guatemalan rhum.", price: 380, icon: "rum", tags: ["new"], isAvailable: true, inventory: 6, modifierGroups: spirits },

  // Whisky
  { id: "mi-macallan", categoryId: "cat-whisky", name: "The Macallan 12", description: "Sherry-cask single malt.", price: 450, icon: "whisky", tags: ["premium"], isAvailable: true, inventory: 6, modifierGroups: spirits },
  { id: "mi-jw-blue", categoryId: "cat-whisky", name: "Johnnie Walker Blue", description: "The flagship blend, rare reserve.", price: 600, icon: "whisky", tags: ["limited"], isAvailable: true, inventory: 4, modifierGroups: spirits },

  // Gin
  { id: "mi-hendricks", categoryId: "cat-gin", name: "Hendrick's 1L", description: "Cucumber-cool, served with premium tonics.", price: 300, icon: "gin", tags: [], isAvailable: true, inventory: 10, modifierGroups: spirits },
  { id: "mi-monkey", categoryId: "cat-gin", name: "Monkey 47", description: "47 botanicals from the Black Forest.", price: 360, icon: "gin", tags: ["new"], isAvailable: true, inventory: 5, modifierGroups: spirits },

  // Washers
  { id: "mi-redbull", categoryId: "cat-washers", name: "Red Bull 4-pack", description: "Original, sugar-free or tropical.", price: 32, icon: "washer", tags: [], isAvailable: true, inventory: 60, modifierGroups: [] },
  { id: "mi-juice-carafe", categoryId: "cat-washers", name: "Fresh juice carafe", description: "Cranberry, orange or pineapple.", price: 18, icon: "washer", tags: [], isAvailable: true, inventory: 40, modifierGroups: [] },
  { id: "mi-soda-set", categoryId: "cat-washers", name: "Premium soda set", description: "Tonic, ginger beer and club soda.", price: 16, icon: "washer", tags: [], isAvailable: true, inventory: 50, modifierGroups: [] },
  { id: "mi-evian", categoryId: "cat-washers", name: "Evian 75cl", description: "Still mineral water.", price: 10, icon: "washer", tags: [], isAvailable: true, inventory: 80, modifierGroups: [] },
];

export const mockPackages: BottlePackage[] = [
  {
    id: "pkg-mr-ace",
    venueId: "venue-1",
    name: "Mr Ace",
    description: "The statement order: five gold bottles paraded to your booth with full LED treatment.",
    price: 3400,
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
    description: "Cristal and X.O cognac for a table that means business.",
    price: 2250,
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
    description: "Clase Azul meets 1942 — the tequila celebration set.",
    price: 950,
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
    description: "One bubbly, one vodka, washers included — the easy opener.",
    price: 560,
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
  { id: "mv-1", menuItemId: "mi-ace", itemName: "Ace of Spades Brut Gold", type: "restock", delta: 6, note: "Weekly delivery — Maison Prestige", createdAt: minsAgo(360) },
  { id: "mv-2", menuItemId: "mi-dom", itemName: "Dom Pérignon Vintage", type: "restock", delta: 12, note: "Weekly delivery — Maison Prestige", createdAt: minsAgo(360) },
  { id: "mv-3", menuItemId: "mi-redbull", itemName: "Red Bull 4-pack", type: "restock", delta: 40, note: "Cash & carry run", createdAt: minsAgo(300) },
  { id: "mv-4", menuItemId: "mi-cristal", itemName: "Louis Roederer Cristal", type: "adjustment", delta: -1, note: "Bottle broken during setup", createdAt: minsAgo(120) },
  { id: "mv-5", menuItemId: "mi-dom", itemName: "Dom Pérignon Vintage", type: "sale", delta: -1, note: "Order A-038", createdAt: minsAgo(3) },
];

export const mockHappyHourRules: HappyHourRule[] = [
  {
    id: "hh-early",
    venueId: "venue-1",
    name: "Early Bird Bottles",
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
    name: "Champagne Thursdays",
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
    name: "Industry Night",
    daysOfWeek: [0],
    startTime: "23:00",
    endTime: "02:00",
    discountPct: 25,
    appliesToCategoryIds: ["cat-whisky", "cat-cognac"],
    isActive: false,
  },
];
