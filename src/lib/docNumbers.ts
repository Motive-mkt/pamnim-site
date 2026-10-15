import { useEffect, useState } from 'react';
import {
  CollectionReference,
  DocumentData,
  Transaction,
  doc,
  onSnapshot,
  runTransaction
} from 'firebase/firestore';
import { db } from './firebase';

// Sequential, gap-free document numbers (QT-2026-0001, INV-2026-0001, ...).
// One counter per document type per calendar year, kept in hrmsSettings/documentCounters
// (readable by signed-in users, writable by staff, so no Firestore rules change is needed).
// The counter and the new document are written in ONE transaction, so a failed save never
// burns a number and two people saving at the same moment can never get the same number.

export type NumberedKind = 'quote' | 'invoice' | 'receipt' | 'credit_note';

const PREFIX: Record<NumberedKind, string> = {
  quote: 'QT',
  invoice: 'INV',
  receipt: 'REC',
  credit_note: 'CN'
};

const counterRef = () => doc(db, 'hrmsSettings', 'documentCounters');
const counterKey = (kind: NumberedKind, year: number) => `${kind}_${year}`;

export function formatDocNumber(kind: NumberedKind, year: number, n: number): string {
  return `${PREFIX[kind]}-${year}-${String(n).padStart(4, '0')}`;
}

// Used inside a caller's own transaction (credit notes update the invoice in the same transaction).
// All reads must happen before any writes in a Firestore transaction, so this reads and then sets.
export async function takeNextNumber(tx: Transaction, kind: NumberedKind, year = new Date().getFullYear()): Promise<string> {
  const ref = counterRef();
  const key = counterKey(kind, year);
  const snap = await tx.get(ref);
  const current = Number(snap.exists() ? snap.data()[key] : 0) || 0;
  const next = current + 1;
  tx.set(ref, { [key]: next, updatedAt: new Date().toISOString() }, { merge: true });
  return formatDocNumber(kind, year, next);
}

// Create a new document with the next number, atomically.
export async function createNumberedDoc(
  kind: NumberedKind,
  parent: CollectionReference<DocumentData>,
  build: (docNumber: string) => Record<string, any>
): Promise<{ id: string; docNumber: string }> {
  const newRef = doc(parent);
  const docNumber = await runTransaction(db, async (tx) => {
    const number = await takeNextNumber(tx, kind);
    tx.set(newRef, build(number));
    return number;
  });
  return { id: newRef.id, docNumber };
}

// Live preview of the number the next document of this type will get (display only: the real
// number is assigned inside the save transaction).
export function useNextDocNumber(kind: NumberedKind): string {
  const year = new Date().getFullYear();
  const [current, setCurrent] = useState<number | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      counterRef(),
      (snap) => setCurrent(Number(snap.exists() ? snap.data()[counterKey(kind, year)] : 0) || 0),
      () => setCurrent(null)
    );
    return () => unsub();
  }, [kind, year]);

  return current === null ? '' : formatDocNumber(kind, year, current + 1);
}
