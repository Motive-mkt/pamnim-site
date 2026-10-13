import React, { useState } from 'react';
import { CreditCard, Bookmark, ListFilter, Save, CheckCircle2 } from 'lucide-react';
import SavedPaymentDetailsModal from './SavedPaymentDetailsModal';
import { SavedPaymentDetail } from '../services/paymentDetailsService';
import { cn } from '../lib/utils';

interface PaymentDetailsSectionProps {
  title: string;
  description: string;
  textareaLabel: string;
  value: string;
  onChange: (value: string) => void;
  savedEntries: SavedPaymentDetail[];
  methodPills?: React.ReactNode; // optional "All / Bank / M-Pesa..." selector (invoices)
  onSaveAsDefault?: (value: string) => Promise<void>; // quotes: remember this text for new quotes
  defaultLabel?: string;
  disabled?: boolean;
}

// One payment-details block shared by quotes and invoices: saved presets, "preserve",
// "manage", and a free textarea. All controls are type="button" (it sits inside the quote form).
export default function PaymentDetailsSection({
  title,
  description,
  textareaLabel,
  value,
  onChange,
  savedEntries,
  methodPills,
  onSaveAsDefault,
  defaultLabel = 'Use as default for new documents',
  disabled
}: PaymentDetailsSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'preserve' | 'manage'>('preserve');
  const [savingDefault, setSavingDefault] = useState(false);
  const [defaultNote, setDefaultNote] = useState<string | null>(null);

  const openModal = (mode: 'preserve' | 'manage') => {
    setModalMode(mode);
    setModalOpen(true);
  };

  const handleSaveDefault = async () => {
    if (!onSaveAsDefault) return;
    setSavingDefault(true);
    try {
      await onSaveAsDefault(value.trim());
      setDefaultNote('Saved. New quotes will start with these payment details.');
      setTimeout(() => setDefaultNote(null), 3500);
    } catch (err: any) {
      alert('Could not save the default: ' + (err?.message || 'unknown error'));
    } finally {
      setSavingDefault(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-charcoal/10 pb-4">
        <div>
          <h4 className="text-base font-bold text-charcoal flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-ochre" />
            <span>{title}</span>
          </h4>
          <p className="text-xs text-charcoal/65">{description}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => openModal('preserve')}
            className="px-3.5 py-1.5 rounded-xl bg-ochre hover:bg-ochre-dark text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            title="Save the current text as a reusable preset"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Preserve Payment Details</span>
          </button>
          <button
            type="button"
            onClick={() => openModal('manage')}
            className="px-3 py-1.5 rounded-xl border border-charcoal/15 bg-cream/50 hover:bg-cream text-charcoal text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Manage saved payment details"
          >
            <ListFilter className="w-3.5 h-3.5 text-charcoal/60" />
            <span>Manage Saved ({savedEntries.length})</span>
          </button>
        </div>
      </div>

      {savedEntries.length > 0 && (
        <div className="space-y-1.5">
          <span className="font-bold uppercase tracking-wider text-[11px] text-charcoal/60">
            Quick fill from saved presets (click one):
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {savedEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                disabled={disabled}
                onClick={() => onChange(entry.details)}
                title={entry.details}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-charcoal/10 bg-cream/30 hover:bg-ochre/10 hover:border-ochre/40 hover:text-ochre transition-all flex items-center gap-1.5 cursor-pointer text-charcoal disabled:opacity-50"
              >
                <span
                  className={cn(
                    'w-2 h-2 rounded-full',
                    entry.method === 'bank' ? 'bg-blue-500' :
                    entry.method === 'mpesa' ? 'bg-emerald-500' :
                    entry.method === 'cash' ? 'bg-amber-500' : 'bg-purple-500'
                  )}
                />
                <span className="font-bold text-[11px]">{entry.title}</span>
                <span className="text-[11px] text-charcoal/60 uppercase">({entry.method})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60">
            {textareaLabel}
          </label>
          {methodPills}
        </div>

        <textarea
          rows={4}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Bank account details, M-Pesa paybill, or how to pay..."
          className="w-full p-3.5 bg-cream/30 border border-charcoal/15 rounded-2xl text-xs font-mono text-charcoal focus:outline-none focus:border-ochre leading-relaxed disabled:opacity-60"
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-charcoal/65 gap-2">
          <span>Edit freely for this document only, or preserve it as a preset.</span>
          <div className="flex items-center gap-3 flex-wrap">
            {value.trim() && (
              <button
                type="button"
                onClick={() => openModal('preserve')}
                className="text-ochre hover:text-ochre-dark font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
              >
                <Bookmark className="w-3 h-3" />
                <span>Preserve this text</span>
              </button>
            )}
            {onSaveAsDefault && value.trim() && (
              <button
                type="button"
                onClick={handleSaveDefault}
                disabled={savingDefault}
                className="text-charcoal/80 hover:text-charcoal font-bold text-xs inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3 h-3" />
                <span>{savingDefault ? 'Saving...' : defaultLabel}</span>
              </button>
            )}
          </div>
        </div>

        {defaultNote && (
          <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {defaultNote}
          </p>
        )}
      </div>

      <SavedPaymentDetailsModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        savedEntries={savedEntries}
        currentInvoiceNotes={value}
        onApplyDetails={(text) => {
          onChange(text);
          setModalOpen(false);
        }}
        initialMode={modalMode}
      />
    </div>
  );
}
