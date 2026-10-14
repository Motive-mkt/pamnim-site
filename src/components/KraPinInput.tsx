import React from 'react';
import { cn } from '../lib/utils';
import { isValidKraPin, normalizeKraPin } from '../lib/tax';

interface KraPinInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
}

// Free-typed, auto-uppercased KRA PIN. A malformed PIN is flagged but never blocked,
// because the owner may be copying it from a document and fixing it later.
export default function KraPinInput({
  value,
  onChange,
  label = 'KRA PIN',
  disabled,
  className,
  inputClassName,
  labelClassName
}: KraPinInputProps) {
  const showWarning = !!value && !isValidKraPin(value);

  return (
    <div className={className}>
      <label className={cn('block text-[11px] font-bold uppercase tracking-wider text-charcoal/60 mb-1', labelClassName)}>
        {label} <span className="font-medium normal-case tracking-normal text-charcoal/50">(optional)</span>
      </label>
      <input
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        maxLength={11}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(normalizeKraPin(e.target.value))}
        placeholder="e.g. A123456789B"
        className={cn(
          'w-full px-3.5 py-2.5 bg-cream/30 border rounded-xl text-xs font-mono font-semibold text-charcoal focus:outline-none focus:border-ochre disabled:opacity-60',
          showWarning ? 'border-amber-400' : 'border-charcoal/15',
          inputClassName
        )}
      />
      {showWarning && (
        <p className="mt-1 text-[11px] text-amber-700">
          A KRA PIN is a letter, nine digits and a letter (e.g. A123456789B). Check it before sending.
        </p>
      )}
    </div>
  );
}
