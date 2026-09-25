import { QuoteLineItem } from '../components/QuoteGenerator';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'cancelled';
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
export type InvoiceMode = 'itemized' | 'freeform' | 'walk_in' | 'pay_later';
export type RecipientType = 'client' | 'lead' | 'walk_in';

export interface InvoiceLineItem {
  id: string;
  description: string;
  category?: string;
  unit?: string;
  quantity: number | '';
  unitPrice: number | '';
  amount?: number;
  name?: string;
  paymentType?: 'Partial' | 'Full';
  refCode?: string;
  date?: string;
}

export type InvoicePaymentItem = InvoiceLineItem;

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
  referenceNumber: string; // Required for invoice payments
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
  dueDate?: string;
  invoiceMode?: InvoiceMode;
  recipientType?: RecipientType;
  clientId?: string;
  leadId?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  projectId?: string;
  projectName?: string;
  items: InvoiceLineItem[];
  subtotal?: number;
  discount?: number;
  discountType?: 'amount' | 'percentage';
  discountValue?: number;
  taxRate?: number;
  taxAmount?: number;
  totalInvoiced: number;
  amountPaid: number;
  balanceDue: number;
  notes: string;
  status: InvoiceStatus;
  selectedPaymentMethod?: 'bank' | 'mpesa' | 'cash' | 'cheque' | 'all' | string;
  paymentMethod?: string;
  paymentReference?: string;
  isLocked?: boolean;
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

