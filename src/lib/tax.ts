// Tax maths and KRA PIN helpers shared by quotes, invoices and the PDF generator.
// Prices are tax-exclusive: tax is added on top of each line's net amount.

export interface TaxType {
  id: string;
  name: string;
  rate: number; // percent, e.g. 16
  enabled: boolean; // shown in the per-item picker ("hidden" when false)
  isDefault: boolean; // applied automatically to every new item
  custom?: boolean; // added by the owner (can be deleted)
}

// Snapshot of a tax as it was when the document was written, so later
// changes to tax settings never alter an existing quote or invoice.
export interface ItemTax {
  id: string;
  name: string;
  rate: number;
}

export interface TaxableLine {
  quantity: number | '' | undefined;
  unitPrice: number | '' | undefined;
  taxes?: ItemTax[]; // undefined = "use the current defaults" (resolved by resolveTaxes)
}

export interface TaxLineTotal {
  key: string;
  name: string;
  rate: number;
  base: number; // taxable amount this tax was charged on
  amount: number;
}

export interface DocTotals {
  subtotal: number; // sum of line nets, before discount and tax
  discount: number;
  taxLines: TaxLineTotal[];
  taxTotal: number;
  total: number;
}

export const DEFAULT_TAX_TYPES: TaxType[] = [
  { id: 'vat-16', name: 'VAT', rate: 16, enabled: true, isDefault: true },
  { id: 'vat-8', name: 'VAT (reduced)', rate: 8, enabled: false, isDefault: false },
  { id: 'zero-rated', name: 'Zero-rated', rate: 0, enabled: false, isDefault: false }
];

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function toItemTax(t: TaxType | ItemTax): ItemTax {
  return { id: t.id, name: t.name, rate: Number(t.rate) || 0 };
}

export function defaultItemTaxes(types: TaxType[]): ItemTax[] {
  return types.filter(t => t.enabled && t.isDefault).map(toItemTax);
}

// An item whose taxes were never touched follows the current defaults.
export function resolveTaxes(line: { taxes?: ItemTax[] }, defaults: ItemTax[]): ItemTax[] {
  return line.taxes ?? defaults;
}

export function taxLabel(t: ItemTax): string {
  return `${t.name} ${Number.isInteger(t.rate) ? t.rate : t.rate.toFixed(2)}%`;
}

export function lineNet(line: TaxableLine): number {
  return round2((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0));
}

// Discount is spread proportionally across lines so the tax base shrinks with it.
export function computeTotals(
  lines: TaxableLine[],
  defaults: ItemTax[],
  discount = 0
): DocTotals {
  const subtotal = round2(lines.reduce((s, l) => s + lineNet(l), 0));
  const disc = round2(Math.min(subtotal, Math.max(0, Number(discount) || 0)));
  const ratio = subtotal > 0 ? disc / subtotal : 0;

  const groups = new Map<string, TaxLineTotal>();
  for (const line of lines) {
    const taxableNet = lineNet(line) * (1 - ratio);
    if (taxableNet <= 0) continue;
    for (const t of resolveTaxes(line, defaults)) {
      const rate = Number(t.rate) || 0;
      const key = `${t.name}|${rate}`;
      const g = groups.get(key) || { key, name: t.name, rate, base: 0, amount: 0 };
      g.base += taxableNet;
      g.amount += (taxableNet * rate) / 100;
      groups.set(key, g);
    }
  }

  const taxLines = Array.from(groups.values()).map(g => ({
    ...g,
    base: round2(g.base),
    amount: round2(g.amount)
  }));
  const taxTotal = round2(taxLines.reduce((s, g) => s + g.amount, 0));
  const total = round2(subtotal - disc + taxTotal);

  return { subtotal, discount: disc, taxLines, taxTotal, total };
}

// Tax charged on one line after the document discount has been applied.
export function lineTaxAmount(
  line: TaxableLine,
  defaults: ItemTax[],
  discountRatio = 0
): number {
  const taxableNet = lineNet(line) * (1 - discountRatio);
  const rate = resolveTaxes(line, defaults).reduce((s, t) => s + (Number(t.rate) || 0), 0);
  return round2((taxableNet * rate) / 100);
}

// Older documents stored a single document-level rate; map it onto the lines.
export function legacyTaxes(taxRate?: number): ItemTax[] {
  const rate = Number(taxRate) || 0;
  return rate > 0 ? [{ id: 'legacy-vat', name: 'VAT', rate }] : [];
}

// ---- KRA PIN ----------------------------------------------------------

export function normalizeKraPin(value: string): string {
  return (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
}

// Format: one letter, nine digits, one letter (e.g. A123456789B).
export function isValidKraPin(value: string): boolean {
  return /^[A-Z]\d{9}[A-Z]$/.test(value || '');
}

// ---- Global VAT switch ------------------------------------------------

// The taxes the one-click "VAT on all items" switch controls: the default taxes, or if the owner
// removed every default, the first tax type that is switched on.
export function vatSwitchTaxes(types: TaxType[], defaults: ItemTax[]): ItemTax[] {
  if (defaults.length > 0) return defaults;
  const first = types.find(t => t.enabled);
  return first ? [toItemTax(first)] : [];
}

export type VatState = 'on' | 'off' | 'mixed';

export function vatState(lines: { taxes?: ItemTax[] }[], defaults: ItemTax[], vat: ItemTax[]): VatState {
  if (lines.length === 0 || vat.length === 0) return 'off';
  const withVat = lines.filter(l => {
    const taxes = resolveTaxes(l, defaults);
    return vat.every(v => taxes.some(t => t.id === v.id));
  }).length;
  if (withVat === lines.length) return 'on';
  return withVat === 0 ? 'off' : 'mixed';
}

// Turn the VAT taxes on or off for one line, leaving any other tax it carries untouched.
export function withVat(taxes: ItemTax[], vat: ItemTax[], on: boolean): ItemTax[] {
  const rest = taxes.filter(t => !vat.some(v => v.id === t.id));
  return on ? [...vat, ...rest] : rest;
}

// A saved document counts as "VAT on" if any of its lines carries a tax named VAT.
export function savedDocHasVat(lines: { taxes?: ItemTax[] }[]): boolean {
  return lines.length === 0 || lines.some(l => (l.taxes || []).some(t => /vat/i.test(t.name) && Number(t.rate) > 0));
}
