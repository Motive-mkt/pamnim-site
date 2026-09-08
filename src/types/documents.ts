import { InvoicePaymentItem } from '../components/InvoiceGenerator';
import { QuoteLineItem } from '../components/QuoteGenerator';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'cancelled';
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';

export interface SavedInvoice {
  id?: string;
  docNumber: string;
  date: string;
  clientId?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  projectId?: string;
  projectName?: string;
  items: InvoicePaymentItem[];
  totalInvoiced: number;
  amountPaid: number;
  balanceDue: number;
  notes: string;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface SavedQuote {
  id?: string;
  docNumber: string;
  date: string;
  validUntil: string;
  clientId?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  projectName?: string;
  items: QuoteLineItem[];
  subtotal: number;
  notes: string;
  status: QuoteStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}
