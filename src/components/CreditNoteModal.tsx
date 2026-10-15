import React, { useMemo, useState } from 'react';
import ModalPortal from './ModalPortal';
import { X, FileMinus, AlertCircle, Loader2 } from 'lucide-react';
import { CreditNote, InvoiceLineItem, SavedInvoice } from '../types/documents';
import { creditableRemaining, issueCreditNote, previewCredit } from '../lib/creditNotes';
import { formatMoney } from '../utils/pdfGenerator';
import { cn } from '../lib/utils';

interface CreditNoteModalProps {
  invoice: SavedInvoice;
  createdBy?: string;
  onClose: () => void;
  onIssued: (creditNote: CreditNote) => void;
}

// Legacy lines may only carry an amount; make every line quantity x unit price.
function normalise(item: InvoiceLineItem, index: number): InvoiceLineItem {
  const qty = Number(item.quantity) || 1;
  const price = Number(item.unitPrice) || (Number(item.amount) ? Number(item.amount) / qty : 0);
  return {
    ...item,
    id: item.id || `line-${index}`,
    description: item.description || item.name || 'Item',
    quantity: qty,
    unitPrice: price
  };
}

export default function CreditNoteModal({ invoice, createdBy, onClose, onIssued }: CreditNoteModalProps) {
  const lines = useMemo(() => (invoice.items || []).map(normalise), [invoice]);
  const remaining = creditableRemaining(invoice);

  // quantity chosen per line id (0 = not credited)
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(
    () => previewCredit(invoice, lines.map(item => ({ item, quantity: qty[item.id] || 0 }))),
    [invoice, lines, qty]
  );
  const overLimit = preview.total > remaining + 0.005;

  const setLineQty = (item: InvoiceLineItem, value: number) => {
    const max = Number(item.quantity) || 1;
    setQty(prev => ({ ...prev, [item.id]: Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0)) }));
  };

  const toggle = (item: InvoiceLineItem, on: boolean) => setLineQty(item, on ? Number(item.quantity) || 1 : 0);

  const selectAll = () => {
    const all: Record<string, number> = {};
    lines.forEach(i => { all[i.id] = Number(i.quantity) || 1; });
    setQty(all);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!invoice.id) return;
    if (preview.total <= 0) {
      setError('Tick at least one line to credit.');
      return;
    }
    if (!reason.trim()) {
      setError('Please give a reason for the credit note.');
      return;
    }
    if (overLimit) {
      setError(`That is more than the KES ${formatMoney(remaining)} still available to credit.`);
      return;
    }
    setSubmitting(true);
    try {
      const cn = await issueCreditNote(invoice.id, preview, reason, date, createdBy);
      onIssued(cn);
    } catch (err: any) {
      console.error('Credit note failed:', err);
      setError(err?.message || 'Could not issue the credit note.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 animate-fade-in">
      <form
        onSubmit={handleSubmit}
        className="bg-white w-full max-w-2xl rounded-3xl border border-charcoal/15 shadow-2xl p-6 sm:p-8 space-y-5 animate-scale-up max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between border-b border-charcoal/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <FileMinus className="w-4 h-4 text-red-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-red-700">Issue credit note</span>
            </div>
            <h3 className="text-lg font-bold text-charcoal mt-0.5">Invoice {invoice.docNumber}</h3>
            <p className="text-xs text-charcoal/60">
              {invoice.clientName} · available to credit: <strong className="text-charcoal">KES {formatMoney(remaining)}</strong>
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-xl text-charcoal/60 hover:text-charcoal cursor-pointer" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-charcoal/70">Lines to credit</span>
            <button type="button" onClick={selectAll} className="text-xs font-bold text-ochre hover:text-ochre-dark cursor-pointer">
              Select all lines
            </button>
          </div>

          <div className="divide-y divide-charcoal/5 border border-charcoal/10 rounded-2xl overflow-hidden">
            {lines.map(item => {
              const chosen = (qty[item.id] || 0) > 0;
              return (
                <div key={item.id} className={cn('flex items-center gap-3 p-3', chosen && 'bg-red-50/40')}>
                  <input
                    type="checkbox"
                    checked={chosen}
                    onChange={(e) => toggle(item, e.target.checked)}
                    className="w-4 h-4 accent-ochre cursor-pointer shrink-0"
                    aria-label={`Credit ${item.description}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-charcoal truncate">{item.description}</p>
                    <p className="text-[11px] text-charcoal/60 font-mono">
                      {Number(item.quantity)} × KES {formatMoney(Number(item.unitPrice))}
                    </p>
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] text-charcoal/60 shrink-0">
                    Qty
                    <input
                      type="number"
                      min="0"
                      max={Number(item.quantity) || 1}
                      step="any"
                      value={qty[item.id] ?? ''}
                      placeholder="0"
                      onChange={(e) => setLineQty(item, e.target.value === '' ? 0 : Number(e.target.value))}
                      className="w-20 px-2 py-1.5 bg-white border border-charcoal/15 rounded-lg text-xs font-bold text-charcoal focus:outline-none focus:border-ochre"
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-1.5">
              Reason <span className="text-ochre">*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Item returned, wrong quantity billed, agreed discount"
              className="w-full px-3.5 py-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-semibold text-charcoal focus:outline-none focus:border-ochre"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-semibold text-charcoal focus:outline-none focus:border-ochre"
            />
          </div>
        </div>

        <div className="p-4 bg-charcoal text-white rounded-2xl space-y-1.5 text-xs">
          <div className="flex justify-between text-white/70">
            <span>Credited before tax</span>
            <span className="font-mono">KES {formatMoney(preview.subtotal)}</span>
          </div>
          {preview.discount > 0 && (
            <div className="flex justify-between text-emerald-400">
              <span>Invoice discount (same proportion)</span>
              <span className="font-mono">- KES {formatMoney(preview.discount)}</span>
            </div>
          )}
          {preview.taxLines.map(t => (
            <div key={t.key} className="flex justify-between text-amber-300">
              <span>{t.name} ({Number.isInteger(t.rate) ? t.rate : t.rate.toFixed(2)}%)</span>
              <span className="font-mono">KES {formatMoney(t.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 border-t border-white/10 text-sm font-bold">
            <span>Total credit</span>
            <span className={cn('font-mono', overLimit ? 'text-red-300' : 'text-ochre')}>KES {formatMoney(preview.total)}</span>
          </div>
        </div>

        <p className="text-[11px] text-charcoal/65 leading-relaxed">
          The original invoice stays as it is. The credit reduces what the client owes, and the VAT on the credited lines comes off your VAT report for the month of the credit note.
          If the client has already paid, the credit becomes money you owe back, which you settle outside this system.
        </p>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-charcoal/20 text-xs font-bold text-charcoal/70 hover:bg-cream cursor-pointer">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || preview.total <= 0}
            className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileMinus className="w-3.5 h-3.5" />}
            <span>{submitting ? 'Issuing...' : 'Issue credit note & download'}</span>
          </button>
        </div>
      </form>
    </div>
    </ModalPortal>
  );
}
