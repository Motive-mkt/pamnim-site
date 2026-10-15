import { PaymentReceipt, SavedInvoice } from '../types/documents';
import { TaxLineTotal, legacyTaxes, round2 } from './tax';

// Pure report logic for the accountant export: no Firestore, no React, so it is easy to test.
// Invoices count on their invoice date, credit notes on the credit note date (negative amounts),
// which is how output VAT is declared: a credit in March reduces March's VAT, not January's.

export interface SalesRow {
  type: 'Invoice' | 'Credit note';
  number: string;
  date: string; // yyyy-mm-dd
  client: string;
  clientPin: string;
  againstInvoice: string; // credit notes: the invoice they credit
  net: number; // before VAT, after discount
  vat: number;
  total: number;
  taxLines: TaxLineTotal[]; // signed like the row (negative on credit notes)
}

export interface PaymentRow {
  date: string;
  receiptNumber: string;
  invoiceNumber: string;
  client: string;
  method: string;
  reference: string;
  amount: number;
}

export interface VatSummaryLine {
  name: string;
  rate: number;
  base: number;
  tax: number;
}

export interface VatSummary {
  lines: VatSummaryLine[];
  netSales: number;
  vatTotal: number;
  grossTotal: number;
  invoiceCount: number;
  creditNoteCount: number;
}

const inRange = (date: string | undefined, from: string, to: string) =>
  !!date && date.slice(0, 10) >= from && date.slice(0, 10) <= to;

function invoiceTaxLines(inv: SavedInvoice): TaxLineTotal[] {
  if (inv.taxSummary && inv.taxSummary.length > 0) return inv.taxSummary;
  // Older invoices: one document-level rate.
  const amount = Number(inv.taxAmount) || 0;
  if (amount <= 0) return [];
  const legacy = legacyTaxes(inv.taxRate)[0];
  const base = round2(Math.max(0, (Number(inv.subtotal) || 0) - (Number(inv.discount) || 0)));
  return [{ key: `VAT|${legacy?.rate ?? 0}`, name: 'VAT', rate: legacy?.rate ?? 0, base, amount }];
}

export function buildSalesRows(invoices: SavedInvoice[], from: string, to: string): SalesRow[] {
  const rows: SalesRow[] = [];

  for (const inv of invoices) {
    const total = Number(inv.totalInvoiced) || 0;
    if (inRange(inv.date, from, to)) {
      const taxLines = invoiceTaxLines(inv);
      const vat = round2(taxLines.reduce((s, t) => s + (Number(t.amount) || 0), 0));
      rows.push({
        type: 'Invoice',
        number: inv.docNumber,
        date: inv.date.slice(0, 10),
        client: inv.clientName || '',
        clientPin: inv.clientKraPin || '',
        againstInvoice: '',
        net: round2(total - vat),
        vat,
        total,
        taxLines
      });
    }

    for (const cn of inv.creditNotes || []) {
      if (!inRange(cn.date, from, to)) continue;
      rows.push({
        type: 'Credit note',
        number: cn.number,
        date: cn.date.slice(0, 10),
        client: inv.clientName || '',
        clientPin: inv.clientKraPin || '',
        againstInvoice: inv.docNumber,
        net: -round2(cn.total - cn.taxTotal),
        vat: -round2(cn.taxTotal),
        total: -round2(cn.total),
        taxLines: (cn.taxSummary || []).map(t => ({ ...t, base: -t.base, amount: -t.amount }))
      });
    }
  }

  return rows.sort((a, b) => (a.date === b.date ? a.number.localeCompare(b.number) : a.date.localeCompare(b.date)));
}

export function summariseVat(rows: SalesRow[]): VatSummary {
  const groups = new Map<string, VatSummaryLine>();
  for (const row of rows) {
    for (const t of row.taxLines) {
      const key = `${t.name}|${t.rate}`;
      const g = groups.get(key) || { name: t.name, rate: Number(t.rate) || 0, base: 0, tax: 0 };
      g.base += Number(t.base) || 0;
      g.tax += Number(t.amount) || 0;
      groups.set(key, g);
    }
  }
  const lines = Array.from(groups.values())
    .map(g => ({ ...g, base: round2(g.base), tax: round2(g.tax) }))
    .sort((a, b) => b.rate - a.rate);

  return {
    lines,
    netSales: round2(rows.reduce((s, r) => s + r.net, 0)),
    vatTotal: round2(rows.reduce((s, r) => s + r.vat, 0)),
    grossTotal: round2(rows.reduce((s, r) => s + r.total, 0)),
    invoiceCount: rows.filter(r => r.type === 'Invoice').length,
    creditNoteCount: rows.filter(r => r.type === 'Credit note').length
  };
}

export function buildPaymentRows(receipts: PaymentReceipt[], from: string, to: string): PaymentRow[] {
  return receipts
    .filter(r => inRange(r.date, from, to))
    .map(r => ({
      date: r.date.slice(0, 10),
      receiptNumber: r.receiptNumber,
      invoiceNumber: r.invoiceNumber,
      client: r.clientName || '',
      method: String(r.paymentMethod || ''),
      reference: r.referenceNumber || '',
      amount: round2(Number(r.amount) || 0)
    }))
    .sort((a, b) => (a.date === b.date ? a.receiptNumber.localeCompare(b.receiptNumber) : a.date.localeCompare(b.date)));
}

// ---- CSV ---------------------------------------------------------------

function cell(v: string | number): string {
  const text = typeof v === 'number' ? v.toFixed(2) : String(v ?? '');
  // Guard against spreadsheet formula injection from client-supplied text.
  const safe = /^[=+\-@\t\r]/.test(text) && typeof v === 'string' ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  // BOM so Excel opens UTF-8 (client names with accents) correctly.
  return '﻿' + [headers, ...rows].map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

export function salesCsv(rows: SalesRow[]): string {
  return toCsv(
    ['Type', 'Number', 'Date', 'Client', 'Client KRA PIN', 'Against invoice', 'Net (excl. VAT)', 'VAT', 'Total'],
    rows.map(r => [r.type, r.number, r.date, r.client, r.clientPin, r.againstInvoice, r.net, r.vat, r.total])
  );
}

export function vatSummaryCsv(summary: VatSummary): string {
  return toCsv(
    ['Tax', 'Rate %', 'Taxable amount', 'Tax'],
    [
      ...summary.lines.map(l => [l.name, l.rate, l.base, l.tax]),
      ['TOTAL', '', summary.netSales, summary.vatTotal]
    ]
  );
}

export function paymentsCsv(rows: PaymentRow[]): string {
  return toCsv(
    ['Date', 'Receipt', 'Invoice', 'Client', 'Method', 'Reference', 'Amount'],
    rows.map(r => [r.date, r.receiptNumber, r.invoiceNumber, r.client, r.method, r.reference, r.amount])
  );
}

// ---- Date presets ------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export type RangePreset = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'last_year';

export function presetRange(preset: RangePreset, now = new Date()): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'this_month':
      return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) };
    case 'last_month':
      return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
    case 'this_quarter': {
      const q = Math.floor(m / 3) * 3;
      return { from: ymd(new Date(y, q, 1)), to: ymd(new Date(y, q + 3, 0)) };
    }
    case 'this_year':
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'last_year':
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
  }
}
