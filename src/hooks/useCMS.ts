import { useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface CMSContent {
  logoUrl?: string;
  hero: {
    title: string;
    subheadline: string;
    highlightWord: string;
    heroSlideshow?: string[];
  };
  contact: {
    phone: string;
    whatsapp: string;
    email: string;
    address: string;
    paymentDetails?: string;
    paymentDetailsByMethod?: {
      bank?: string;
      mpesa?: string;
      cash?: string;
      cheque?: string;
    };
  };
  services: any[];
  portfolio: any[];
  luxuryCategories?: any[];
}

const DEFAULT_HERO_SLIDES = [
  "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=80&w=2000",
  "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=2000",
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&q=80&w=2000",
  "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&q=80&w=2000"
];

const DEFAULT_LUXURY_CATEGORIES = [
  {
    id: "interior-architecture",
    title: "Space planning and layouts",
    subtitle: "Planning",
    outcome: "We plan layouts around how you actually live, so every square metre of your Nairobi home earns its place without losing its style.",
    bullets: ["Furniture and room layouts", "Kitchen and living-area planning", "Gypsum ceilings and feature walls"],
    items: ["Space planning", "Kitchen planning", "Gypsum ceilings"],
    iconName: "Compass",
    accent: "01",
    startingPrice: "From KES 50,000",
    timeline: "2 to 3 weeks",
    images: [
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&q=80&w=1200"
    ],
    whatsappText: "I'm interested in space planning and layouts"
  },
  {
    id: "bespoke-finishes",
    title: "Finishes and custom carpentry",
    subtitle: "Finishes",
    outcome: "Wall paneling, wardrobes and cabinetry made to measure, finished cleanly. The details are what make a home feel considered.",
    bullets: ["Wall paneling and wainscoting", "Fitted wardrobes and cabinetry", "Plaster skim and painting"],
    items: ["Wall paneling", "Cabinets and joinery", "Painting"],
    iconName: "Layers",
    accent: "02",
    isMostRequested: true,
    startingPrice: "From KES 250,000",
    timeline: "3 to 4 weeks",
    images: [
      "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&q=80&w=1200"
    ],
    whatsappText: "I'm interested in finishes and custom carpentry"
  },
  {
    id: "premium-flooring",
    title: "Flooring",
    subtitle: "Flooring",
    outcome: "The right floor anchors every room. We supply and install hardwood, engineered wood, vinyl and stone, and fit it properly so it lasts.",
    bullets: ["Ceramic and porcelain tiling", "Waterproof SPC and wood flooring", "Stain-resistant floor coatings"],
    items: ["Tiling", "SPC and wood floors", "Floor coatings"],
    iconName: "Grid",
    accent: "03",
    startingPrice: "From KES 180,000",
    timeline: "1 to 2 weeks",
    images: [
      "https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=1200"
    ],
    whatsappText: "I'm interested in flooring"
  },
  {
    id: "lighting-textures-styling",
    title: "Lighting, curtains and styling",
    subtitle: "Atmosphere",
    outcome: "Lighting changes everything. We plan ambient, accent and task lighting so your home feels warm at 7am and refined at 7pm.",
    bullets: ["Glare-free LED lighting", "Custom curtains and blinds", "3D previews before work starts"],
    items: ["LED lighting", "Curtains and blinds", "3D previews"],
    iconName: "Lightbulb",
    accent: "04",
    startingPrice: "From KES 120,000",
    timeline: "1 to 2 weeks",
    images: [
      "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&q=80&w=1200"
    ],
    whatsappText: "I'm interested in lighting, curtains and styling"
  }
];

const DEFAULT_CONTENT: CMSContent = {
  logoUrl: '',
  hero: {
    title: "Your Nairobi home, designed to live beautifully.",
    subheadline: "We handle everything from layout planning to final finishing, so you move into a home that feels exactly right. Based in Nairobi, working for homeowners across Kenya.",
    highlightWord: "beautifully.",
    heroSlideshow: DEFAULT_HERO_SLIDES
  },
  contact: {
    phone: "0714 984 268",
    whatsapp: "254714984268",
    email: "hinteriors01@gmail.com",
    address: "Nairobi, Kenya",
    paymentDetails: "Bank / M-Pesa Details: Pamnim Interior Designers, Paybill: 247247, Acc: 0714984268.",
    paymentDetailsByMethod: {
      bank: "Bank Transfer: Equity Bank Kenya\nAccount Name: Pamnim Interior Designers\nAccount No: 0123456789\nBranch: Nairobi Main",
      mpesa: "M-Pesa Paybill: 247247\nAccount Number: 0714984268\nAccount Name: Pamnim Interior Designers",
      cash: "Cash payments accepted directly at our Nairobi workshop upon official receipt issue.",
      cheque: "Cheques payable to: Pamnim Interior Designers (handed over at our Nairobi offices)."
    }
  },
  services: [
    {
      id: "1",
      iconName: "Home",
      title: "Residential Interior Design",
      description: "End-to-end design for homes that balance beauty and everyday function."
    },
    {
      id: "2",
      iconName: "Palette",
      title: "Space Styling & Decoration",
      description: "Curated styling that brings warmth, color and personality to every room."
    },
    {
      id: "3",
      iconName: "LayoutGrid",
      title: "Furniture & Layout Arrangement",
      description: "Smart layouts that maximize flow, comfort, and natural light."
    },
    {
      id: "4",
      iconName: "PaintBucket",
      title: "Interior Finishing & Aesthetic",
      description: "Refined finishes including paint, lighting, and textures that elevate your space."
    },
    {
      id: "5",
      iconName: "RefreshCcw",
      title: "Renovation & Design Upgrades",
      description: "Practical upgrades that modernize your home without the overhaul."
    },
    {
      id: "6",
      iconName: "MessageSquare",
      title: "Design Consultation",
      description: "One-on-one guidance to help you make confident design decisions."
    }
  ],
  portfolio: [],
  luxuryCategories: DEFAULT_LUXURY_CATEGORIES
};

/**
 * Tidies copy coming from the CMS: em dashes become commas, and stray spaces before
 * punctuation are removed. The old version replaced "—" with ", " without removing the space
 * in front of it, which produced text like "everything , from layout" on the live site.
 */
export function cleanText(input: string): string {
  return input
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s+–\s+/g, ', ')
    .replace(/[ \t]+([,.;:!?])/g, '$1')
    .replace(/,\s*,/g, ',')
    .replace(/ {2,}/g, ' ');
}

function cleanDashes<T>(obj: T): T {
  if (typeof obj === 'string') {
    return cleanText(obj) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanDashes) as unknown as T;
  }
  if (obj && typeof obj === 'object') {
    const res: any = {};
    for (const k of Object.keys(obj)) {
      res[k] = cleanDashes((obj as any)[k]);
    }
    return res as T;
  }
  return obj;
}

export function useCMS() {
  const [content, setContent] = useState<CMSContent>(DEFAULT_CONTENT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'siteContent', 'homepage'), (doc) => {
      if (doc.exists()) {
        const rawData = doc.data();
        const data = cleanDashes(rawData);
        const heroData = data.hero || DEFAULT_CONTENT.hero;
        const heroSlideshow = (heroData.heroSlideshow && heroData.heroSlideshow.length > 0)
          ? heroData.heroSlideshow
          : DEFAULT_HERO_SLIDES;

        setContent({
          logoUrl: data.logoUrl || '',
          hero: {
            ...DEFAULT_CONTENT.hero,
            ...heroData,
            heroSlideshow
          },
          contact: {
            ...DEFAULT_CONTENT.contact,
            ...(data.contact || {}),
            paymentDetailsByMethod: {
              ...DEFAULT_CONTENT.contact.paymentDetailsByMethod,
              ...(data.contact?.paymentDetailsByMethod || {})
            }
          },
          services: data.services && data.services.length > 0 ? data.services : DEFAULT_CONTENT.services,
          portfolio: data.portfolio || DEFAULT_CONTENT.portfolio,
          luxuryCategories: data.luxuryCategories && data.luxuryCategories.length > 0 ? data.luxuryCategories : DEFAULT_CONTENT.luxuryCategories,
        });
      } else {
        setContent(DEFAULT_CONTENT);
      }
      setLoading(false);
    }, (err) => {
      // Fall back to the built-in content instead of showing loading placeholders forever
      console.error('Could not load site content:', err);
      setLoading(false);
    });

    return unsub;
  }, []);

  return { content, loading };
}
