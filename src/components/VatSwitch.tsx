import React from 'react';
import { VatState } from '../lib/tax';
import { cn } from '../lib/utils';

interface VatSwitchProps {
  state: VatState;
  onChange: (on: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

// One switch for VAT on every item at once. Individual items can still be changed afterwards;
// the switch then shows "Mixed" and a click makes them all the same again.
export default function VatSwitch({ state, onChange, label = 'VAT on all items', disabled, className }: VatSwitchProps) {
  const on = state === 'on';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={state === 'mixed' ? 'mixed' : on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        'inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
        on ? 'border-ochre/40 bg-ochre/10 text-ochre-dark' : 'border-charcoal/15 bg-white text-charcoal/70 hover:bg-cream',
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
          on ? 'bg-ochre' : state === 'mixed' ? 'bg-ochre/50' : 'bg-charcoal/25'
        )}
      >
        <span
          className={cn(
            'absolute h-4 w-4 rounded-full bg-white shadow transition-all',
            on ? 'left-[1.1rem]' : state === 'mixed' ? 'left-[0.6rem]' : 'left-0.5'
          )}
        />
      </span>
      <span>{label}</span>
      <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
        {state === 'mixed' ? 'Mixed' : on ? 'On' : 'Off'}
      </span>
    </button>
  );
}
