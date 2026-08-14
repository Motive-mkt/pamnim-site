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

const DEFAULT_CONTENT: CMSContent = {
  logoUrl: '',
  hero: {
    title: "Your Nairobi home, designed to live beautifully.",
    subheadline: "We handle everything from layout planning to final finishing so you move into a home that feels exactly right. Based in Nairobi. Trusted by homeowners across Kenya.",
    highlightWord: "beautifully.",
    heroSlideshow: DEFAULT_HERO_SLIDES
  },
  contact: {
    phone: "0714 984 268",
    whatsapp: "254714984268",
    email: "hinteriors01@gmail.com",
    address: "Nairobi, Kenya"
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
  luxuryCategories: [
    {
      id: "interior-architecture",
      title: "Smart Space Planning & Custom Layouts",
      subtitle: "The Structural Masterplan",
      outcome: "We design spaces that work the way your life does, maximising every square metre of your Nairobi home without compromising on style.",
      bullets: [
        "Smart Spatial & Furniture Layouts",
        "Ergonomic Kitchen & Living Zones",
        "Sculptural Gypsum Works & Ceilings"
      ],
      items: ["Smart Spatial Layouts", "Ergonomic Kitchen Zones", "Sculptural Gypsum Works"],
      iconName: "Compass",
      accent: "01",
      startingPrice: "From KES 50,000",
      timeline: "2 - 3 Weeks",
      images: [
        "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=1200",
        "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&q=80&w=1200",
        "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&q=80&w=1200"
      ],
      whatsappText: "I'm interested in Space Planning & Custom Layouts"
    },
    {
      id: "bespoke-finishes",
      title: "Bespoke Finishes & Premium Carpentry",
      subtitle: "Texture, Tactility & Custom Joinery",
      outcome: "Every surface, fitting, and finish is selected to feel intentional, because the details are what make a home feel expensive, not just designed.",
      bullets: [
        "Custom Wainscoting & Wall Paneling",
        "Floor-to-ceiling Wardrobes & Cabinetry",
        "Dustless Skimming & Flawless Painting"
      ],
      items: ["Premium Wainscoting", "Bespoke Cabinets & Joinery", "Dustless Skimming & Painting"],
      iconName: "Layers",
      accent: "02",
      isMostRequested: true,
      startingPrice: "From KES 250,000",
      timeline: "3 - 4 Weeks",
      images: [
        "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&q=80&w=1200",
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=1200",
        "https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&q=80&w=1200"
      ],
      whatsappText: "I'm interested in Bespoke Finishes & Premium Carpentry"
    },
    {
      id: "premium-flooring",
      title: "Premium Flooring Solutions",
      subtitle: "Flawless Ground Foundations",
      outcome: "The right floor anchors every room. We source and install premium options including hardwood, engineered, vinyl, and stone, fitted to last and built to impress.",
      bullets: [
        "Laser-Aligned Ceramic & Porcelain Tiling",
        "100% Waterproof SPC & Wood Flooring",
        "Impact & Stain-Resistant Surface Coatings"
      ],
      items: ["Porcelain & Ceramic Tiling", "Waterproof SPC Wood Floors", "Stain-Resistant Coatings"],
      iconName: "Grid",
      accent: "03",
      startingPrice: "From KES 180,000",
      timeline: "1 - 2 Weeks",
      images: [
        "https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?auto=format&fit=crop&q=80&w=1200",
        "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&q=80&w=1200",
        "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=1200"
      ],
      whatsappText: "I'm interested in Premium Flooring Solutions"
    },
    {
      id: "lighting-textures-styling",
      title: "Luxury Lighting, Drapery & Styling",
      subtitle: "Atmosphere & Spatial Aesthetics",
      outcome: "Lighting changes everything. We design ambient, accent, and task lighting schemes that make your home feel warm at 7am and elegant at 7pm.",
      bullets: [
        "Atmospheric Anti-Glare LED Solutions",
        "Elegant Custom Drapery & Window Blinds",
        "Immersive Photorealistic 3D Previews"
      ],
      items: ["Atmospheric LED Lighting", "Custom Drapery & Blinds", "Immersive 3D Previews First"],
      iconName: "Sparkles",
      accent: "04",
      startingPrice: "From KES 120,000",
      timeline: "1 - 2 Weeks",
      images: [
        "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=1200",
        "https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&q=80&w=1200",
        "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&q=80&w=1200"
      ],
      whatsappText: "I'm interested in Luxury Lighting, Drapery & Styling"
    }
  ]
};

function cleanDashes<T>(obj: T): T {
  if (typeof obj === 'string') {
    return obj
      .replace(/—/g, ', ')
      .replace(/–/g, '-')
      .replace(/  +/g, ' ')
      .replace(/, ,/g, ',') as unknown as T;
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
          contact: data.contact || DEFAULT_CONTENT.contact,
          services: data.services && data.services.length > 0 ? data.services : DEFAULT_CONTENT.services,
          portfolio: data.portfolio || DEFAULT_CONTENT.portfolio,
          luxuryCategories: data.luxuryCategories && data.luxuryCategories.length > 0 ? data.luxuryCategories : DEFAULT_CONTENT.luxuryCategories,
        });
      } else {
        setContent(DEFAULT_CONTENT);
      }
      setLoading(false);
    });

    return unsub;
  }, []);

  return { content, loading };
}
