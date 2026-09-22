export interface CatalogItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  purchasePrice: number; // Internal cost to Pamnim
  sellingPrice: number;  // Price charged to client
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_CATALOG_CATEGORIES = [
  'Product',
  'Service'
] as const;

export type CatalogCategory = (typeof DEFAULT_CATALOG_CATEGORIES)[number];

export const PRESET_CATALOG_ITEMS: Omit<CatalogItem, 'id' | 'createdAt'>[] = [
  {
    name: 'Smart Space Planning & 3D Photorealistic Previews',
    category: 'Service',
    unit: 'lump sum',
    purchasePrice: 20000,
    sellingPrice: 50000,
    description: 'Detailed spatial layouts, mood boards, and 3D architectural renders.'
  },
  {
    name: 'Bespoke Floor-to-Ceiling Wardrobes & Soft-Close Joinery',
    category: 'Product',
    unit: 'running meter',
    purchasePrice: 120000,
    sellingPrice: 220000,
    description: 'High-density moisture-resistant MDF, luxury veneer finish, and soft-close hardware.'
  },
  {
    name: 'Luxury Fluted Wall Paneling (Acoustic & Decorative)',
    category: 'Product',
    unit: 'sqm',
    purchasePrice: 25000,
    sellingPrice: 48000,
    description: 'Natural oak or walnut composite fluted paneling with concealed fastening.'
  },
  {
    name: 'Waterproof Rigid-Core SPC Flooring Supply & Installation',
    category: 'Product',
    unit: 'sqm',
    purchasePrice: 3200,
    sellingPrice: 5800,
    description: '5.5mm stone-plastic composite with integrated IXPE sound-dampening acoustic underlay.'
  },
  {
    name: 'Concealed Ambient LED Cove Lighting & Smart Dimmers',
    category: 'Product',
    unit: 'linear meter',
    purchasePrice: 1500,
    sellingPrice: 3200,
    description: 'High CRI 95+ anti-glare 3000K warm LED strips with driver and aluminum channel.'
  },
  {
    name: 'Suspended Gypsum False Ceiling with Shadowline Details',
    category: 'Service',
    unit: 'sqm',
    purchasePrice: 2200,
    sellingPrice: 4200,
    description: 'Galvanized framing, 9mm moisture-resistant gypsum boards, joint taping and skimming.'
  },
  {
    name: 'Silk-Touch Premium Interior Painting & Surface Prep',
    category: 'Service',
    unit: 'sqm',
    purchasePrice: 450,
    sellingPrice: 950,
    description: 'Three coats of scrub-resistant velvet emulsion with full skim sanding and primer.'
  }
];
