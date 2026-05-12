import { useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface CMSContent {
  hero: {
    title: string;
    subheadline: string;
    highlightWord: string;
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
  services: [],
  portfolio: []
};

export function useCMS() {
  const [content, setContent] = useState<CMSContent>(DEFAULT_CONTENT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'siteContent', 'homepage'), (doc) => {
      if (doc.exists()) {
        setContent(doc.data() as CMSContent);
      }
      setLoading(false);
    });

    return unsub;
  }, []);

  return { content, loading };
}
