import { Clock, RotateCw } from 'lucide-react';
import { useOfferCountdown } from '../../hooks/useOfferCountdown';
import { cn } from '../../lib/utils';

/**
 * Slim urgency line shown above the hero form. It only changes the message the visitor sees: the form
 * underneath is never disabled or hidden, whether the clock is running or has run out.
 */
export default function OfferCountdown({ className }: { className?: string }) {
  const { expired, label, reset } = useOfferCountdown();

  return (
    <div className={cn('mb-5', className)}>
      {/* Announces the change once at expiry, instead of every second */}
      <p className="sr-only" aria-live="polite">
        {expired ? 'Your free call offer has expired. You can still send the form, or refresh to claim a new offer.' : ''}
      </p>

      {expired ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-charcoal/5 px-3 py-2 text-[13px] text-charcoal/80">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0 text-charcoal/50" aria-hidden="true" />
            Your free call offer has expired.
          </span>
          <button
            type="button"
            onClick={reset}
            className="-my-1.5 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 font-semibold text-ochre-dark underline-offset-4 hover:underline"
          >
            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
            Refresh to claim a new one
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg bg-ochre/10 px-3 py-2 text-[13px] text-charcoal" role="timer">
          <Clock className="h-4 w-4 shrink-0 text-ochre" aria-hidden="true" />
          <p>
            Free call offer ends in <span className="font-semibold tabular-nums">{label}</span>
          </p>
        </div>
      )}
    </div>
  );
}
