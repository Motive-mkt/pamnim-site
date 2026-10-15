import { InvoiceStatus } from '../types/documents';
import { round2 } from './tax';

// Credit notes never change the original invoice total; they reduce what is still owed.
export function invoiceBalance(total: number, paid: number, credited = 0): number {
  return Math.max(0, round2((Number(total) || 0) - (Number(credited) || 0) - (Number(paid) || 0)));
}

export function invoiceStatusFor(total: number, paid: number, credited = 0): InvoiceStatus {
  const t = Number(total) || 0;
  const p = Number(paid) || 0;
  const c = Number(credited) || 0;
  const net = round2(t - c);
  if (c > 0 && net <= 0 && p <= 0) return 'cancelled'; // fully credited, nothing was ever paid
  if (t > 0 && p >= net) return 'paid';
  if (p > 0) return 'partial';
  return 'sent';
}
