import { SavedInvoice, SavedQuote } from '../types/documents';
import { PDFDocumentData, PDFLineItem } from './pdfGenerator';
import { ItemTax, TaxLineTotal, computeTotals, legacyTaxes } from '../lib/tax';

// One place that turns a saved quote/invoice into PDF input, so a fresh download,
// the archive download, the share button and the transactions list all print the same thing.

export interface CompanyContact {
  address?: string;
  phone?: string;
  email?: string;
}

function companyInfo(contact?: CompanyContact) {
  return {
    name: 'Pamnim Interior Designers',
    address: contact?.address || 'Nairobi, Kenya',
    phone: contact?.phone || '0714 984 268',
    email: contact?.email || 'hinteriors01@gmail.com',
    tagline: 'Shinning outside, beautiful inside'
  };
}

function lineTaxes(line: { taxes?: ItemTax[] }, docTaxRate?: number): ItemTax[] {
  // Documents written before per-item tax have no `taxes`: fall back to their single rate (or none).
  return line.taxes ?? legacyTaxes(docTaxRate);
}

function toPdfItems(
  items: Array<{
    id?: string;
    description?: string;
    name?: string;
    unit?: string;
    quantity?: number | '';
    unitPrice?: number | '';
    amount?: number;
    taxes?: ItemTax[];
    paymentType?: string;
    refCode?: string;
    date?: string;
  }>,
  docTaxRate: number | undefined,
  fallbackDate?: string
): PDFLineItem[] {
  return items.map((i) => {
    const qty = Number(i.quantity) || 1;
    const price = Number(i.unitPrice) || (Number(i.amount) ? Number(i.amount) / qty : 0);
    return {
      id: i.id || Math.random().toString(),
      description: i.description || i.name || 'Item',
      unit: i.unit && i.unit !== 'lump sum' ? i.unit : undefined,
      quantity: qty,
      unitPrice: price,
      amount: Math.round(qty * price * 100) / 100,
      taxes: lineTaxes(i, docTaxRate).map(t => ({ name: t.name, rate: t.rate })),
      paymentType: i.paymentType,
      refCode: i.refCode,
      date: i.date || fallbackDate
    };
  });
}

function summarise(taxLines: TaxLineTotal[] | undefined): PDFDocumentData['taxLines'] {
  return (taxLines || []).map(t => ({ name: t.name, rate: t.rate, base: t.base, amount: t.amount }));
}

export function quoteToPDFData(qt: SavedQuote, contact?: CompanyContact): PDFDocumentData {
  const items = toPdfItems(qt.items || [], undefined);
  const totals = computeTotals(
    (qt.items || []).map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, taxes: i.taxes ?? [] })),
    []
  );
  // Prefer what was saved with the quote; recompute only for older records.
  const taxLines = qt.taxSummary ?? totals.taxLines;
  const subtotal = typeof qt.subtotal === 'number' ? qt.subtotal : totals.subtotal;
  const total = typeof qt.total === 'number' ? qt.total : subtotal + (qt.taxTotal ?? totals.taxTotal);

  return {
    docNumber: qt.docNumber,
    date: qt.date,
    validUntil: qt.validUntil,
    clientName: qt.clientName || 'Valued Client',
    clientEmail: qt.clientEmail,
    clientPhone: qt.clientPhone,
    clientAddress: qt.clientAddress,
    clientKraPin: qt.clientKraPin,
    ownKraPin: qt.ownKraPin,
    projectName: qt.projectName,
    items: items.length > 0 ? items : [{
      id: '1',
      description: 'Design Services Scope',
      quantity: 1,
      unitPrice: subtotal,
      amount: subtotal
    }],
    subtotal,
    taxLines: summarise(taxLines),
    taxAmount: qt.taxTotal ?? totals.taxTotal,
    totalInvoiced: total,
    terms: qt.terms,
    paymentDetails: qt.paymentDetails,
    notes: qt.notes,
    currencySymbol: 'KES',
    companyInfo: companyInfo(contact)
  };
}

export function invoiceToPDFData(inv: SavedInvoice, contact?: CompanyContact): PDFDocumentData {
  const items = toPdfItems(inv.items || [], inv.taxRate, inv.date);
  const paid = Number(inv.amountPaid) || 0;
  const balance = typeof inv.balanceDue === 'number'
    ? inv.balanceDue
    : Math.max(0, (Number(inv.totalInvoiced) || 0) - paid);

  // Older invoices only carry a single rate/amount; show it as one tax line.
  const taxLines = inv.taxSummary
    ? summarise(inv.taxSummary)
    : (inv.taxAmount && inv.taxAmount > 0
        ? [{ name: 'VAT', rate: inv.taxRate || 0, base: Math.max(0, (inv.subtotal || 0) - (inv.discount || 0)), amount: inv.taxAmount }]
        : []);

  return {
    docNumber: inv.docNumber,
    date: inv.date,
    dueDate: inv.dueDate,
    // Only invoices built from payment rows (older walk-in receipts) use the payment-column layout.
    invoiceMode: inv.invoiceMode === 'walk_in' && (inv.items || []).some(i => i.paymentType || i.refCode)
      ? 'walk_in'
      : 'pay_later',
    clientName: inv.clientName || 'Valued Client',
    clientEmail: inv.clientEmail,
    clientPhone: inv.clientPhone,
    clientAddress: inv.clientAddress,
    clientKraPin: inv.clientKraPin,
    ownKraPin: inv.ownKraPin,
    projectName: inv.projectName,
    items: items.length > 0 ? items : [{
      id: '1',
      description: 'Interior Design & Spatial Services',
      quantity: 1,
      unitPrice: inv.totalInvoiced || 0,
      amount: inv.totalInvoiced || 0
    }],
    subtotal: inv.subtotal,
    discount: inv.discount,
    taxRate: inv.taxRate,
    taxAmount: inv.taxAmount,
    taxLines,
    totalInvoiced: inv.totalInvoiced,
    amountPaid: paid,
    balanceDue: balance,
    terms: inv.terms,
    paymentDetails: inv.paymentDetails,
    notes: inv.notes,
    currencySymbol: 'KES',
    companyInfo: companyInfo(contact)
  };
}
