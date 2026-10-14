import React from 'react';
import { X } from 'lucide-react';
import { ItemTax, TaxType, taxLabel, toItemTax } from '../lib/tax';

interface ItemTaxPickerProps {
  taxes: ItemTax[]; // taxes currently on this item (already resolved against the defaults)
  available: TaxType[]; // tax types that are switched on in tax settings
  onChange: (taxes: ItemTax[]) => void;
  disabled?: boolean;
}

// Per-item tax chips: remove any, add another from the switched-on tax types.
export default function ItemTaxPicker({ taxes, available, onChange, disabled }: ItemTaxPickerProps) {
  const addable = available.filter(t => !taxes.some(x => x.id === t.id));

  return (
    <div className="flex flex-wrap items-center gap-1">
      {taxes.length === 0 && (
        <span className="text-[11px] font-semibold text-charcoal/50">No tax</span>
      )}

      {taxes.map(t => (
        <span
          key={t.id}
          className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-ochre/10 text-ochre-dark text-[11px] font-bold border border-ochre/20"
        >
          {taxLabel(t)}
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(taxes.filter(x => x.id !== t.id))}
              title={`Remove ${t.name}`}
              aria-label={`Remove ${taxLabel(t)}`}
              className="p-0.5 rounded-full hover:bg-ochre/20 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </span>
      ))}

      {!disabled && addable.length > 0 && (
        <select
          value=""
          aria-label="Add a tax to this item"
          onChange={(e) => {
            const picked = addable.find(t => t.id === e.target.value);
            if (picked) onChange([...taxes, toItemTax(picked)]);
          }}
          className="text-[11px] font-bold text-charcoal/70 bg-white border border-charcoal/15 rounded-full px-2 py-0.5 cursor-pointer focus:outline-none focus:border-ochre"
        >
          <option value="">+ Tax</option>
          {addable.map(t => (
            <option key={t.id} value={t.id}>{taxLabel(toItemTax(t))}</option>
          ))}
        </select>
      )}
    </div>
  );
}
