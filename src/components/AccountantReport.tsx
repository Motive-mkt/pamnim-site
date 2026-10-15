import React, { useEffect, useMemo, useState } from 'react';
import { collection, collectionGroup, getDocs } from 'firebase/firestore';
import { X, Download, FileSpreadsheet, RefreshCw, AlertCircle } from 'lucide-react';
import { db } from '../lib/firebase';
import { PaymentReceipt, SavedInvoice } from '../types/documents';
import {
  RangePreset,
  buildPaymentRows,
  buildSalesRows,
  paymentsCsv,
  presetRange,
  salesCsv,
  summariseVat,
  vatSummaryCsv
} from '../lib/vatReport';
import { formatMoney } from '../utils/pdfGenerator';
import { cn } from '../lib/utils';
import ModalPortal from './ModalPortal';

const PRESETS: { id: RangePreset; label: string }[] = [
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'this_quarter', label: 'This quarter' },
  { id: 'this_year', label: 'This year' },
  { id: 'last_year', label: 'Last year' }
];

function download(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AccountantReport({ onClose }: { onClose: () => void }) {
  const [invoices, setInvoices] = useState<SavedInvoice[]>([]);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<RangePreset | 'custom'>('this_month');
  const [range, setRange] = useState(() => presetRange('this_month'));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [invSnap, recSnap] = await Promise.all([
          getDocs(collection(db, 'invoices')),
          getDocs(collectionGroup(db, 'paymentReceipts'))
        ]);
        if (cancelled) return;
        setInvoices(invSnap.docs.map(d => ({ id: d.id, ...d.data() })) as SavedInvoice[]);
        setReceipts(recSnap.docs.map(d => ({ id: d.id, ...d.data() })) as PaymentReceipt[]);
      } catch (err: any) {
        console.error('Accountant report load failed:', err);
        if (!cancelled) setError(err?.message || 'Could not load invoices and payments.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => buildSalesRows(invoices, range.from, range.to), [invoices, range]);
  const summary = useMemo(() => summariseVat(rows), [rows]);
  const payments = useMemo(() => buildPaymentRows(receipts, range.from, range.to), [receipts, range]);
  const paymentsTotal = payments.reduce((s, p) => s + p.amount, 0);
  const stamp = `${range.from}_to_${range.to}`;
  const validRange = range.from && range.to && range.from <= range.to;

  const pickPreset = (p: RangePreset) => {
    setPreset(p);
    setRange(presetRange(p));
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 bg-charcoal/60 overflow-y-auto animate-fade-in">
        <div className="bg-white w-full max-w-5xl rounded-3xl border border-charcoal/15 shadow-2xl p-5 sm:p-8 space-y-6 my-auto">
          <div className="flex items-start justify-between gap-4 border-b border-charcoal/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-ochre" />
                <span className="text-xs font-bold uppercase tracking-wider text-ochre">Accountant report</span>
              </div>
              <h3 className="text-xl font-bold text-charcoal mt-0.5">VAT summary and export</h3>
              <p className="text-xs text-charcoal/60 mt-0.5">
                Output VAT from invoices, less credit notes, for the period you pick. Download the files and hand them to your accountant.
              </p>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-xl text-charcoal/60 hover:text-charcoal hover:bg-charcoal/5 cursor-pointer" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end gap-4">
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickPreset(p.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer',
                    preset === p.id ? 'bg-charcoal text-white border-charcoal' : 'border-charcoal/15 text-charcoal/70 hover:bg-cream'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-2 lg:ml-auto">
              <label className="text-[11px] font-bold uppercase tracking-wider text-charcoal/60">
                From
                <input
                  type="date"
                  value={range.from}
                  onChange={(e) => { setPreset('custom'); setRange(r => ({ ...r, from: e.target.value })); }}
                  className="block mt-1 px-3 py-1.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-semibold text-charcoal focus:outline-none focus:border-ochre"
                />
              </label>
              <label className="text-[11px] font-bold uppercase tracking-wider text-charcoal/60">
                To
                <input
                  type="date"
                  value={range.to}
                  onChange={(e) => { setPreset('custom'); setRange(r => ({ ...r, to: e.target.value })); }}
                  className="block mt-1 px-3 py-1.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-semibold text-charcoal focus:outline-none focus:border-ochre"
                />
              </label>
            </div>
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-xs text-charcoal/65">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-ochre" />
              Loading invoices and payments...
            </div>
          ) : !validRange ? (
            <p className="py-10 text-center text-xs text-charcoal/65">Pick a start date that is not after the end date.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Sales before VAT', value: summary.netSales },
                  { label: 'Output VAT (net of credits)', value: summary.vatTotal, strong: true },
                  { label: 'Total incl. VAT', value: summary.grossTotal },
                  { label: 'Payments received', value: paymentsTotal }
                ].map(c => (
                  <div key={c.label} className={cn('p-4 rounded-2xl border', c.strong ? 'bg-ochre/10 border-ochre/30' : 'bg-cream/40 border-charcoal/10')}>
                    <span className="text-[11px] uppercase font-bold tracking-wider text-charcoal/65 block">{c.label}</span>
                    <span className="text-lg font-bold text-charcoal font-mono">KES {formatMoney(c.value)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-charcoal/70">VAT by rate</h4>
                {summary.lines.length === 0 ? (
                  <p className="text-xs text-charcoal/60">No tax charged in this period.</p>
                ) : (
                  <div className="overflow-x-auto border border-charcoal/10 rounded-2xl">
                    <table className="w-full text-xs">
                      <thead className="bg-cream/50 text-[11px] uppercase tracking-wider text-charcoal/65">
                        <tr>
                          <th className="text-left p-3">Tax</th>
                          <th className="text-right p-3">Rate</th>
                          <th className="text-right p-3">Taxable amount</th>
                          <th className="text-right p-3">Tax</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-charcoal/5">
                        {summary.lines.map(l => (
                          <tr key={`${l.name}|${l.rate}`}>
                            <td className="p-3 font-semibold text-charcoal">{l.name}</td>
                            <td className="p-3 text-right font-mono">{l.rate}%</td>
                            <td className="p-3 text-right font-mono">{formatMoney(l.base)}</td>
                            <td className="p-3 text-right font-mono font-bold">{formatMoney(l.tax)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-charcoal/70">
                  Sales register ({summary.invoiceCount} invoices, {summary.creditNoteCount} credit notes)
                </h4>
                <div className="overflow-auto max-h-72 border border-charcoal/10 rounded-2xl">
                  <table className="w-full text-xs min-w-[640px]">
                    <thead className="bg-cream/50 text-[11px] uppercase tracking-wider text-charcoal/65 sticky top-0">
                      <tr>
                        <th className="text-left p-3">Number</th>
                        <th className="text-left p-3">Date</th>
                        <th className="text-left p-3">Client</th>
                        <th className="text-left p-3">KRA PIN</th>
                        <th className="text-right p-3">Net</th>
                        <th className="text-right p-3">VAT</th>
                        <th className="text-right p-3">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-charcoal/5">
                      {rows.length === 0 ? (
                        <tr><td colSpan={7} className="p-6 text-center text-charcoal/60">No invoices or credit notes in this period.</td></tr>
                      ) : rows.map(r => (
                        <tr key={`${r.type}-${r.number}`} className={r.type === 'Credit note' ? 'bg-red-50/40' : ''}>
                          <td className="p-3 font-mono font-semibold text-charcoal">
                            {r.number}
                            {r.againstInvoice && <span className="block text-[11px] font-normal text-charcoal/60">for {r.againstInvoice}</span>}
                          </td>
                          <td className="p-3 text-charcoal/70">{r.date}</td>
                          <td className="p-3 text-charcoal">{r.client}</td>
                          <td className="p-3 font-mono text-charcoal/70">{r.clientPin || '—'}</td>
                          <td className="p-3 text-right font-mono">{r.net < 0 ? '-' : ''}{formatMoney(Math.abs(r.net))}</td>
                          <td className="p-3 text-right font-mono">{r.vat < 0 ? '-' : ''}{formatMoney(Math.abs(r.vat))}</td>
                          <td className="p-3 text-right font-mono font-bold">{r.total < 0 ? '-' : ''}{formatMoney(Math.abs(r.total))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => download(`vat-summary_${stamp}.csv`, vatSummaryCsv(summary))}
                  className="px-4 py-2.5 rounded-xl bg-ochre hover:bg-ochre-dark text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer">
                  <Download className="w-3.5 h-3.5" /><span>VAT summary CSV</span>
                </button>
                <button type="button" onClick={() => download(`sales-register_${stamp}.csv`, salesCsv(rows))}
                  className="px-4 py-2.5 rounded-xl bg-charcoal hover:bg-charcoal/90 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer">
                  <Download className="w-3.5 h-3.5" /><span>Sales register CSV</span>
                </button>
                <button type="button" onClick={() => download(`payments-received_${stamp}.csv`, paymentsCsv(payments))}
                  className="px-4 py-2.5 rounded-xl border border-charcoal/20 text-charcoal hover:bg-cream text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                  <Download className="w-3.5 h-3.5" /><span>Payments CSV ({payments.length})</span>
                </button>
              </div>

              <p className="text-[11px] text-charcoal/65 leading-relaxed">
                This covers sales VAT only. It does not track VAT paid on purchases (input VAT), supplier bills, or payroll deductions, and it is not an eTIMS invoice or a KRA VAT return.
                Your accountant files the return; this gives them the figures to check against.
              </p>
            </>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
