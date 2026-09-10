import { InvoicePaymentItem } from '../components/InvoiceGenerator';
import { QuoteLineItem } from '../components/QuoteGenerator';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'cancelled';
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
export type InvoiceMode = 'walk_in' | 'pay_later';

export interface PaymentReceipt {
  id?: string;
  receiptNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  projectId?: string;
  projectName?: string;
  clientId?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  amount: number;
  paymentMethod: 'bank' | 'mpesa' | 'cash' | 'cheque' | string;
  referenceNumber?: string;
  reference?: string;
  balanceRemaining?: number;
  totalInvoiceAmount?: number;
  date: string;
  notes?: string;
  recordedBy?: string;
  createdAt: string;
}

export interface SavedInvoice {
  id?: string;
  docNumber: string;
  date: string;
  invoiceMode?: InvoiceMode;
  clientId?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  projectId?: string;
  projectName?: string;
  items: InvoicePaymentItem[];
  totalInvoiced: number;
  amountPaid: number;
  balanceDue: number;
  notes: string;
  status: InvoiceStatus;
  paymentMethod?: string;
  paymentReference?: string;
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
  clientAddress?: string;
  projectName?: string;
  items: QuoteLineItem[];
  subtotal: number;
  notes: string;
  status: QuoteStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface Lead {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  createdAt: string;
  createdBy?: string;
}

export interface Worker {
  id?: string;
  name: string;
  trade: string; // e.g. 'Carpenter', 'Joiner', 'Painter', 'Mason', 'Electrician', 'Plumber', 'Welder', 'Foreman'
  phone?: string;
  dailyRate?: number;
  status: 'active' | 'inactive';
  notes?: string;
  createdAt: string;
}

export interface WorkLog {
  id?: string;
  workerId: string;
  workerName: string;
  trade: string;
  projectId?: string;
  projectName?: string;
  date: string;
  hoursWorked: number;
  tasksCompleted: string;
  supervisorName?: string;
  createdAt: string;
}

export interface WorkerPayment {
  id?: string;
  workerId: string;
  workerName: string;
  trade: string;
  projectId?: string;
  projectName?: string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  date: string;
  notes?: string;
  recordedBy?: string;
  createdAt: string;
}

