import React, { useState } from 'react';
import { Plus, Trash2, Save, RotateCcw, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface TermsEditorProps {
  terms: string[];
  onChange: (terms: string[]) => void;
  docLabel: 'quote' | 'invoice';
  savedDefault: string[]; // the currently saved default for this document type
  onSaveDefault: (terms: string[]) => Promise<void>;
  disabled?: boolean;
}

// Numbered terms & conditions, like Refrens: add a line, remove a line, edit any line.
// Every button is type="button" because this renders inside the quote <form>.
export default function TermsEditor({
  terms,
  onChange,
  docLabel,
  savedDefault,
  onSaveDefault,
  disabled
}: TermsEditorProps) {
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const plural = docLabel === 'quote' ? 'quotes' : 'invoices';
  const cleaned = (list: string[]) => list.map(t => t.trim()).filter(Boolean);
  const sameAsDefault = JSON.stringify(cleaned(terms)) === JSON.stringify(cleaned(savedDefault));

  const updateAt = (index: number, value: string) => {
    onChange(terms.map((t, i) => (i === index ? value : t)));
  };

  const handleSaveDefault = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSaveDefault(cleaned(terms));
      setSavedNote(`Saved as the default for new ${plural}.`);
      setTimeout(() => setSavedNote(null), 3500);
    } catch (err: any) {
      console.error('Could not save default terms:', err);
      setError(err?.message || 'Could not save the default terms.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {terms.length === 0 && (
        <p className="text-[11px] text-charcoal/60 italic">
          No terms on this {docLabel}. Add one below if you want them printed.
        </p>
      )}

      <ol className="space-y-2">
        {terms.map((term, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="mt-2 w-5 shrink-0 text-right text-xs font-bold text-charcoal/60">{index + 1}.</span>
            <textarea
              rows={2}
              disabled={disabled}
              value={term}
              onChange={(e) => updateAt(index, e.target.value)}
              placeholder="Type a term or condition"
              className="flex-1 p-2.5 bg-white border border-charcoal/15 rounded-xl text-xs text-charcoal/90 leading-relaxed focus:outline-none focus:border-ochre disabled:opacity-60"
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(terms.filter((_, i) => i !== index))}
                title="Remove this term"
                aria-label={`Remove term ${index + 1}`}
                className="mt-1.5 p-1.5 text-charcoal/50 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </li>
        ))}
      </ol>

      {!disabled && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => onChange([...terms, ''])}
            className="px-3 py-1.5 rounded-xl bg-ochre/10 hover:bg-ochre/20 text-ochre text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add a term</span>
          </button>

          <button
            type="button"
            onClick={handleSaveDefault}
            disabled={saving || sameAsDefault}
            title={`Use these terms for every new ${docLabel}`}
            className={cn(
              'px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer',
              sameAsDefault
                ? 'border-charcoal/10 text-charcoal/40'
                : 'border-charcoal/20 text-charcoal hover:bg-cream'
            )}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : `Save as default for ${plural}`}</span>
          </button>

          <button
            type="button"
            onClick={() => onChange([...savedDefault])}
            disabled={sameAsDefault}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-charcoal/70 hover:bg-cream flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to default</span>
          </button>
        </div>
      )}

      {savedNote && (
        <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {savedNote}
        </p>
      )}
      {error && <p className="text-[11px] font-bold text-red-600">{error}</p>}
    </div>
  );
}
