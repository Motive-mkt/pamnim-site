import { doc, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import { CreditNote, InvoiceLineItem, SavedInvoice } from '../types/documents';
import { ItemTax, computeTotals, legacyTaxes, round2 } from './tax';
import { invoiceBalance, invoiceStatusFor } from './credit';
import { takeNextNumber } from './docNumbers';

export interface CreditLineInput {
  item: InvoiceLineItem;
  quantity: number; // how much of this line to credit (0 = not credited)
}

export interface CreditPreview {
  items: InvoiceLineItem[];
  subtotal: number;
  discount: number;
  taxLines: ReturnType<typeof computeTotals>['taxLines'];
  taxTotal: number;
  total: number;
}

export function itemTaxes(inv: SavedInvoice, item: InvoiceLineItem): ItemTax[] {
  return item.taxes ?? legacyTaxes(inv.taxRate);
}

// What is still available to credit on an invoice (the original total never changes).
export function creditableRemaining(inv: SavedInvoice): number {
  return Math.max(0, round2((Number(inv.totalInvoiced) || 0) - (Number(inv.creditedAmount) || 0)));
}

// Works out a credit note for the chosen lines. The invoice's own discount is applied in the same
// proportion, so crediting every line in full credits exactly the invoice total.
export function previewCredit(inv: SavedInvoice, lines: CreditLineInput[]): CreditPreview {
  const chosen = lines
    .filter(l => l.quantity > 0)
    .map(l => ({
      ...l.item,
      quantity: l.quantity,
      amount: round2(l.quantity * (Number(l.item.unitPrice) || 0)),
      taxes: itemTaxes(inv, l.item)
    }));

  const invSubtotal = Number(inv.subtotal) || 0;
  const ratio = invSubtotal > 0 ? Math.min(1, (Number(inv.discount) || 0) / invSubtotal) : 0;
  const rawSubtotal = round2(chosen.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0));
  const discount = round2(rawSubtotal * ratio);
  const t = computeTotals(chosen, [], discount);

  return {
    items: chosen,
    subtotal: t.subtotal,
    discount: t.discount,
    taxLines: t.taxLines,
    taxTotal: t.taxTotal,
    total: t.total
  };
}

// Writes the credit note onto the invoice in one transaction: re-reads the invoice (so two credit
// notes can never exceed the total), takes the next CN number, and updates the balance and status.
export async function issueCreditNote(
  invoiceId: string,
  preview: CreditPreview,
  reason: string,
  date: string,
  createdBy?: string
): Promise<CreditNote> {
  if (preview.total <= 0) throw new Error('Choose something to credit.');
  if (!reason.trim()) throw new Error('A reason is required on a credit note.');

  const invRef = doc(db, 'invoices', invoiceId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(invRef);
    if (!snap.exists()) throw new Error('Invoice not found.');
    const inv = { id: snap.id, ...snap.data() } as SavedInvoice;

    const remaining = creditableRemaining(inv);
    if (preview.total > remaining + 0.005) {
      throw new Error(`This credit (KES ${preview.total.toFixed(2)}) is more than what is left to credit on the invoice (KES ${remaining.toFixed(2)}).`);
    }

    const number = await takeNextNumber(tx, 'credit_note');
    const cn: CreditNote = {
      number,
      date,
      reason: reason.trim(),
      items: preview.items,
      subtotal: preview.subtotal,
      ...(preview.discount > 0 ? { discount: preview.discount } : {}),
      taxSummary: preview.taxLines,
      taxTotal: preview.taxTotal,
      total: preview.total,
      createdAt: new Date().toISOString(),
      ...(createdBy ? { createdBy } : {})
    };

    const credited = round2((Number(inv.creditedAmount) || 0) + cn.total);
    const paid = Number(inv.amountPaid) || 0;
    tx.update(invRef, {
      creditNotes: [...(inv.creditNotes || []), cn],
      creditedAmount: credited,
      balanceDue: invoiceBalance(inv.totalInvoiced, paid, credited),
      status: invoiceStatusFor(inv.totalInvoiced, paid, credited),
      isLocked: true, // the original invoice is now part of the audit trail
      updatedAt: new Date().toISOString()
    });
    return cn;
  });
}
