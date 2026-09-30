import { 
  collection, getDocs, addDoc, deleteDoc, updateDoc, doc, onSnapshot, query, orderBy 
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export type PaymentMethodType = 'bank' | 'mpesa' | 'cash' | 'cheque';

export interface SavedPaymentDetail {
  id: string;
  method: PaymentMethodType;
  title: string;
  details: string;
  createdAt?: string;
  isDefault?: boolean;
}

export const DEFAULT_PAYMENT_ENTRIES: Omit<SavedPaymentDetail, 'id'>[] = [
  {
    method: 'bank',
    title: 'Equity Bank Kenya (Main)',
    details: 'Bank Transfer: Equity Bank Kenya\nAccount Name: Pamnim Interior Designers\nAccount Number: 0123456789\nBranch: Nairobi Main',
    isDefault: true
  },
  {
    method: 'mpesa',
    title: 'M-Pesa Paybill 247247',
    details: 'M-Pesa Paybill: 247247\nAccount No: 0714984268\nAccount Name: Pamnim Interior Designers',
    isDefault: true
  },
  {
    method: 'cash',
    title: 'Cash at Nairobi Workshop',
    details: 'Cash payments accepted directly at our Nairobi workshop upon official receipt issue.',
    isDefault: true
  },
  {
    method: 'cheque',
    title: 'Cheque to Pamnim Interior Designers',
    details: 'Cheques payable to: Pamnim Interior Designers (handed over at our Nairobi offices).',
    isDefault: true
  }
];

/**
 * Subscribes to saved payment details in real time.
 * If empty, seeds initial defaults so the owner has ready-to-use entries.
 */
export function subscribeToSavedPaymentDetails(
  callback: (entries: SavedPaymentDetail[]) => void
): () => void {
  const colRef = collection(db, 'savedPaymentDetails');
  const q = query(colRef, orderBy('createdAt', 'desc'));

  const unsubscribe = onSnapshot(q, async (snap) => {
    if (snap.empty) {
      // Seed default entries
      const seeded: SavedPaymentDetail[] = [];
      try {
        for (const entry of DEFAULT_PAYMENT_ENTRIES) {
          const docRef = await addDoc(colRef, {
            ...entry,
            createdAt: new Date().toISOString()
          });
          seeded.push({ id: docRef.id, ...entry });
        }
        callback(seeded);
      } catch (seedErr) {
        console.warn('Could not seed default payment entries:', seedErr);
        // Fallback to in-memory defaults
        callback(DEFAULT_PAYMENT_ENTRIES.map((e, idx) => ({ id: `default_${idx}`, ...e })));
      }
      return;
    }

    const list = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    })) as SavedPaymentDetail[];

    callback(list);
  }, (err) => {
    console.error('Error listening to saved payment details:', err);
    // Fallback to defaults
    callback(DEFAULT_PAYMENT_ENTRIES.map((e, idx) => ({ id: `default_${idx}`, ...e })));
  });

  return unsubscribe;
}

/**
 * Saves a new reusable payment detail entry.
 */
export async function savePaymentDetailEntry(entry: {
  method: PaymentMethodType;
  title: string;
  details: string;
}): Promise<string> {
  const colRef = collection(db, 'savedPaymentDetails');
  const docRef = await addDoc(colRef, {
    method: entry.method,
    title: entry.title.trim(),
    details: entry.details.trim(),
    createdAt: new Date().toISOString()
  });
  return docRef.id;
}

/**
 * Removes a saved payment detail entry.
 */
export async function deletePaymentDetailEntry(id: string): Promise<void> {
  if (id.startsWith('default_')) return;
  await deleteDoc(doc(db, 'savedPaymentDetails', id));
}

/**
 * Updates a saved payment detail entry.
 */
export async function updatePaymentDetailEntry(
  id: string, 
  data: Partial<Omit<SavedPaymentDetail, 'id'>>
): Promise<void> {
  if (id.startsWith('default_')) return;
  await updateDoc(doc(db, 'savedPaymentDetails', id), {
    ...data,
    updatedAt: new Date().toISOString()
  });
}
