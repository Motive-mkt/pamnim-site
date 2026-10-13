import { useCallback, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { DEFAULT_TAX_TYPES, TaxType, defaultItemTaxes, ItemTax } from './tax';

// Stored in hrmsSettings/documentSettings: that collection is already readable by
// signed-in users and writable by staff, so no Firestore rules change is needed.
const SETTINGS_PATH = ['hrmsSettings', 'documentSettings'] as const;

export const DEFAULT_QUOTE_TERMS: string[] = [
  'This quotation is an estimate valid for 30 days and is subject to final site inspection, scope adjustments, and material availability.',
  'All prices include spatial design planning, premium materials supply, and professional installation by Pamnim Interior Designers.'
];

export const DEFAULT_INVOICE_TERMS: string[] = [
  'Payment terms: 50% deposit upon contract signing, 40% upon interim milestone, 10% upon final handover.'
];

export interface DocumentSettings {
  taxTypes: TaxType[];
  ownKraPin: string;
  quoteTerms: string[]; // default numbered terms for new quotes
  invoiceTerms: string[]; // default numbered terms for new invoices (kept separate)
  quotePaymentDetails: string; // default payment block for new quotes ('' = fall back to site settings)
}

export const DEFAULT_DOCUMENT_SETTINGS: DocumentSettings = {
  taxTypes: DEFAULT_TAX_TYPES,
  ownKraPin: '',
  quoteTerms: DEFAULT_QUOTE_TERMS,
  invoiceTerms: DEFAULT_INVOICE_TERMS,
  quotePaymentDetails: ''
};

function cleanTerms(list: unknown, fallback: string[]): string[] {
  if (!Array.isArray(list)) return fallback;
  return list.filter((t): t is string => typeof t === 'string');
}

function mergeSettings(data: Record<string, any> | undefined): DocumentSettings {
  if (!data) return DEFAULT_DOCUMENT_SETTINGS;
  return {
    taxTypes: Array.isArray(data.taxTypes) && data.taxTypes.length > 0 ? data.taxTypes : DEFAULT_TAX_TYPES,
    ownKraPin: typeof data.ownKraPin === 'string' ? data.ownKraPin : '',
    // An empty saved list is a valid choice ("no default terms"), so only fall back when the field is missing.
    quoteTerms: cleanTerms(data.quoteTerms, DEFAULT_QUOTE_TERMS),
    invoiceTerms: cleanTerms(data.invoiceTerms, DEFAULT_INVOICE_TERMS),
    quotePaymentDetails: typeof data.quotePaymentDetails === 'string' ? data.quotePaymentDetails : ''
  };
}

export function useDocumentSettings() {
  const [settings, setSettings] = useState<DocumentSettings>(DEFAULT_DOCUMENT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, ...SETTINGS_PATH),
      (snap) => {
        setSettings(mergeSettings(snap.exists() ? snap.data() : undefined));
        setLoaded(true);
      },
      (err) => {
        console.warn('Could not load document settings, using defaults:', err);
        setLoaded(true);
      }
    );
    return () => unsub();
  }, []);

  const save = useCallback(async (patch: Partial<DocumentSettings>) => {
    await setDoc(
      doc(db, ...SETTINGS_PATH),
      { ...patch, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  }, []);

  const defaultTaxes: ItemTax[] = useMemo(() => defaultItemTaxes(settings.taxTypes), [settings.taxTypes]);

  return { settings, loaded, save, defaultTaxes };
}
