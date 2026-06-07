import { useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface CMSContent {
  hero: {
    title: string;
    subheadline: string;
    highlightWord: string;
  };
  contact: {
    phone: string;
    whatsapp: string;
    email: string;
    address: string;
  };
  services: any[];
  portfolio: any[];
}

const DEFAULT_CONTENT: CMSContent = {
  hero: {
    title: "Spaces designed to feel like home.",
    subheadline: "Pamnim Interiors crafts clean, functional and beautifully styled residential interiors — from layout planning to final finishing.",
    highlightWord: "home."
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
      description: "Refined finishes — paint, lighting, textures — that elevate your space."
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
  portfolio: []
};

export function useCMS() {
  const [content, setContent] = useState<CMSContent>(DEFAULT_CONTENT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'siteContent', 'homepage'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setContent({
          hero: data.hero || DEFAULT_CONTENT.hero,
          contact: data.contact || DEFAULT_CONTENT.contact,
          services: data.services && data.services.length > 0 ? data.services : DEFAULT_CONTENT.services,
          portfolio: data.portfolio || DEFAULT_CONTENT.portfolio,
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
