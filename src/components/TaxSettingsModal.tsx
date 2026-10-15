import React, { useEffect, useState } from 'react';
import ModalPortal from './ModalPortal';
import { X, Plus, Trash2, Percent, CheckCircle2 } from 'lucide-react';
import { DocumentSettings } from '../lib/documentSettings';
import { TaxType } from '../lib/tax';
import KraPinInput from './KraPinInput';
import { cn } from '../lib/utils';

interface TaxSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: DocumentSettings;
  onSave: (patch: Partial<DocumentSettings>) => Promise<void>;
}

// Rendered through a fixed overlay and made only of type="button" controls, so it is
// safe to open from inside the quote <form>.
export default function TaxSettingsModal({ isOpen, onClose, settings, onSave }: TaxSettingsModalProps) {
  const [types, setTypes] = useState<TaxType[]>(settings.taxTypes);
  const [ownPin, setOwnPin] = useState(settings.ownKraPin);
  const [newName, setNewName] = useState('');
  const [newRate, setNewRate] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start from the saved settings each time the window opens.
  useEffect(() => {
    if (isOpen) {
      setTypes(settings.taxTypes.map(t => ({ ...t })));
      setOwnPin(settings.ownKraPin);
      setNewName('');
      setNewRate('');
      setError(null);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const patchType = (id: string, patch: Partial<TaxType>) => {
    setTypes(prev => prev.map(t => {
      if (t.id !== id) return t;
      const next = { ...t, ...patch };
      // A hidden tax cannot be a default for new items.
      if (!next.enabled) next.isDefault = false;
      return next;
    }));
  };

  const handleAdd = () => {
    const name = newName.trim();
    const rate = Number(newRate);
    if (!name) {
      setError('Give the new tax a name, e.g. "Catering levy".');
      return;
    }
    if (newRate === '' || !isFinite(rate) || rate < 0 || rate > 100) {
      setError('Enter a rate between 0 and 100.');
      return;
    }
    setError(null);
    setTypes(prev => [
      ...prev,
      { id: `custom-${Date.now()}`, name, rate, enabled: true, isDefault: false, custom: true }
    ]);
    setNewName('');
    setNewRate('');
  };

  const handleSave = async () => {
    for (const t of types) {
      if (!t.name.trim()) {
        setError('Every tax needs a name.');
        return;
      }
      if (!isFinite(Number(t.rate)) || Number(t.rate) < 0 || Number(t.rate) > 100) {
        setError(`"${t.name}" needs a rate between 0 and 100.`);
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        taxTypes: types.map(t => ({ ...t, name: t.name.trim(), rate: Number(t.rate) })),
        ownKraPin: ownPin
      });
      onClose();
    } catch (err: any) {
      console.error('Could not save tax settings:', err);
      setError(err?.message || 'Could not save tax settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-charcoal/50 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-2xl p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto space-y-6">
        <div className="flex items-start justify-between border-b border-charcoal/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-ochre/10 text-ochre flex items-center justify-center">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-charcoal">Tax settings</h3>
              <p className="text-xs text-charcoal/65">
                Taxes switched on here can be added to any quote or invoice item. Defaults are added to every new item.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tax settings"
            className="p-1.5 rounded-xl text-charcoal/60 hover:text-charcoal hover:bg-cream transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Own KRA PIN */}
        <div className="p-4 bg-cream/40 rounded-2xl border border-charcoal/10">
          <KraPinInput label="Your KRA PIN" value={ownPin} onChange={setOwnPin} />
          <p className="mt-1.5 text-[11px] text-charcoal/60">Printed at the top of every quote and invoice.</p>
        </div>

        {/* Tax types */}
        <div className="space-y-2">
          <div className="hidden sm:grid grid-cols-[1fr_5.5rem_5rem_5.5rem_2rem] gap-2 px-1 text-[11px] font-bold uppercase tracking-wider text-charcoal/60">
            <span>Name</span>
            <span>Rate %</span>
            <span className="text-center">Show</span>
            <span className="text-center">On new items</span>
            <span />
          </div>

          {types.map(t => (
            <div
              key={t.id}
              className={cn(
                'grid grid-cols-2 sm:grid-cols-[1fr_5.5rem_5rem_5.5rem_2rem] gap-2 items-center p-2 rounded-xl border',
                t.enabled ? 'border-charcoal/10 bg-white' : 'border-charcoal/5 bg-cream/40'
              )}
            >
              <input
                type="text"
                value={t.name}
                onChange={(e) => patchType(t.id, { name: e.target.value })}
                aria-label="Tax name"
                className="col-span-2 sm:col-span-1 px-2.5 py-1.5 bg-white border border-charcoal/15 rounded-lg text-xs font-semibold focus:outline-none focus:border-ochre"
              />
              <input
                type="number"
                min="0"
                max="100"
                step="any"
                value={t.rate}
                onChange={(e) => patchType(t.id, { rate: e.target.value === '' ? 0 : Number(e.target.value) })}
                aria-label="Tax rate percent"
                className="px-2.5 py-1.5 bg-white border border-charcoal/15 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-ochre"
              />
              <label className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-charcoal/70 cursor-pointer">
                <input
                  type="checkbox"
                  checked={t.enabled}
                  onChange={(e) => patchType(t.id, { enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-charcoal/30 cursor-pointer"
                />
                <span className="sm:hidden">Show</span>
              </label>
              <label className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-charcoal/70 cursor-pointer">
                <input
                  type="checkbox"
                  checked={t.isDefault}
                  disabled={!t.enabled}
                  onChange={(e) => patchType(t.id, { isDefault: e.target.checked })}
                  className="w-4 h-4 rounded border-charcoal/30 cursor-pointer disabled:opacity-40"
                />
                <span className="sm:hidden">Default</span>
              </label>
              {t.custom ? (
                <button
                  type="button"
                  onClick={() => setTypes(prev => prev.filter(x => x.id !== t.id))}
                  title="Delete this tax"
                  aria-label={`Delete ${t.name}`}
                  className="justify-self-end p-1.5 text-charcoal/50 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
        </div>

        {/* Add a tax */}
        <div className="p-3.5 bg-cream/40 rounded-2xl border border-charcoal/10 space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal/70">Add another tax</span>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name, e.g. Catering levy"
              className="flex-1 px-3 py-2 bg-white border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre"
            />
            <input
              type="number"
              min="0"
              max="100"
              step="any"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Rate %"
              className="sm:w-28 px-3 py-2 bg-white border border-charcoal/15 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-ochre"
            />
            <button
              type="button"
              onClick={handleAdd}
              className="px-4 py-2 rounded-xl bg-charcoal text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-charcoal/85"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {error && (
          <p className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700">{error}</p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-charcoal/20 text-xs font-bold text-charcoal/70 hover:bg-cream cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-ochre hover:bg-ochre-dark text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save tax settings'}</span>
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
