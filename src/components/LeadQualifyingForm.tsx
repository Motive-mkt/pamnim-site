import React, { useId, useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCMS } from '../hooks/useCMS';
import { CheckCircle2, MessageSquare, AlertCircle, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { createNotification } from '../services/notificationService';

export type LeadTag = 'high-value' | 'project' | 'incomplete' | 'general';

export const PROPERTY_STATUS_OPTIONS = [
  {
    value: 'I own/lease the space & have the keys',
    label: 'I own or lease the space and have the keys',
    priority: 'high' as const,
    leadTag: 'high-value' as const
  },
  {
    value: 'Under construction / Handover coming soon',
    label: 'Under construction, handover coming soon',
    priority: 'medium' as const,
    leadTag: 'project' as const
  },
  {
    value: 'Just inquiring / Collecting design ideas',
    label: 'Just exploring ideas for now',
    priority: 'low' as const,
    leadTag: 'general' as const
  }
];

export const PROJECT_SCOPE_OPTIONS = [
  'Full Home / Apartment Renovation',
  'Living Room & Gypsum Ceiling Focus',
  'Custom Kitchen & Premium Carpentry',
  'Flooring & Finishing Solutions',
  'Commercial / Office Space'
] as const;

export const DESIRED_TIMELINES = ['ASAP', 'Within 1 month', '1–3 months', '3–6 months', 'Just exploring'] as const;

export interface LeadQualifyingFormProps {
  source?: string;
  variant?: 'card' | 'modal' | 'inline' | 'hero';
  onClose?: () => void;
  title?: string;
  subtitle?: string;
  className?: string;
}

export default function LeadQualifyingForm({
  source = 'website',
  variant = 'card',
  onClose,
  title,
  subtitle,
  className
}: LeadQualifyingFormProps) {
  const { content } = useCMS();
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [propertyStatus, setPropertyStatus] = useState<string>(PROPERTY_STATUS_OPTIONS[0].value);
  const [projectScope, setProjectScope] = useState<string>('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rawNumber = content?.contact?.whatsapp || '254714984268';
  const cleanNumber = rawNumber.replace(/[^0-9]/g, '');
  const directWhatsAppUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(
    "Hi Pamnim Interiors, I'd like to discuss a project for my space."
  )}`;

  const resetForm = () => {
    setSubmitted(false);
    setName('');
    setPhone('');
    setEmail('');
    setLocationAddress('');
    setPropertyStatus(PROPERTY_STATUS_OPTIONS[0].value);
    setProjectScope('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!phone.trim()) {
      setError('Please provide your phone or WhatsApp number.');
      return;
    }
    if (!locationAddress.trim()) {
      setError('Please enter the property location or estate.');
      return;
    }
    if (!propertyStatus) {
      setError('Please select the status of your space.');
      return;
    }
    if (!projectScope) {
      setError('Please select what best describes your project.');
      return;
    }

    const statusObj = PROPERTY_STATUS_OPTIONS.find((o) => o.value === propertyStatus) || PROPERTY_STATUS_OPTIONS[0];
    const hasActiveProject = statusObj.priority !== 'low';

    setSubmitting(true);

    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || 'no-email@provided.local',
        location: locationAddress.trim(),
        address: locationAddress.trim(),
        propertyStatus,
        projectScope,
        selectedService: projectScope,
        projectType: projectScope,
        scope: projectScope,
        leadTag: statusObj.leadTag,
        priority: statusObj.priority,
        hasActiveProject,
        requestType: hasActiveProject ? 'project_request' : 'general_request',
        source,
        status: 'new',
        message: `[LEAD INTAKE REQUEST]\nProject Scope: ${projectScope}\nProperty Location / Estate: ${locationAddress.trim()}\nSpace Status: ${propertyStatus} (${statusObj.priority.toUpperCase()} PRIORITY)\nPhone / WhatsApp: ${phone.trim()}\nEmail: ${email.trim() || 'Not provided'}`,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'inquiries'), payload);

      // Notify the owner
      createNotification({
        userId: 'all_owners',
        role: 'owner',
        title: statusObj.priority === 'high' ? 'High-Priority Design Lead' : 'New Design Consultation Request',
        body: `${name.trim()} (${locationAddress.trim()}) — ${projectScope}`,
        link: '/admin?tab=inquiries',
        type: 'inquiry'
      }).catch(() => {});

      // Meta Pixel lead event
      if (typeof (window as any).fbq === 'function') {
        try {
          (window as any).fbq('track', 'Lead', {
            content_name: projectScope,
            lead_tag: statusObj.leadTag,
            status: propertyStatus,
            location: locationAddress.trim(),
            source
          });
        } catch {
          // tracking must never block the form
        }
      }

      setSubmitted(true);
    } catch (err: any) {
      console.error('Error submitting qualified lead:', err);
      setError(err?.message || 'We could not send your request. Please try again or message us on WhatsApp.');
    } finally {
      setSubmitting(false);
    }
  };

  const shell = cn(
    'w-full',
    variant === 'hero' && 'rounded-2xl bg-white p-6 shadow-2xl sm:p-8',
    variant === 'card' && 'rounded-2xl border border-charcoal/10 bg-white p-6 shadow-md sm:p-8 md:p-10',
    variant === 'modal' && 'bg-white',
    className
  );
  const pad = variant === 'modal' ? 'px-6 sm:px-8' : '';

  // Success
  if (submitted) {
    return (
      <div className={cn(shell, 'text-center', variant === 'modal' ? 'px-6 py-10 sm:px-10' : '')} role="status">
        <CheckCircle2 className="mx-auto h-11 w-11 text-ochre" aria-hidden="true" />
        <h3 className="mt-5 text-3xl">Thank you, {name.trim().split(' ')[0]}.</h3>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-charcoal/75">
          We have your details for <span className="font-semibold text-charcoal">{locationAddress}</span>. A senior designer will
          call you within 24 hours.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href={directWhatsAppUrl} target="_blank" rel="noopener noreferrer" className="btn btn-dark w-full sm:w-auto">
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            Message us on WhatsApp
          </a>
          {onClose ? (
            <button type="button" onClick={onClose} className="btn btn-outline w-full sm:w-auto">
              Close
            </button>
          ) : (
            <button type="button" onClick={resetForm} className="btn btn-outline w-full sm:w-auto">
              Send another request
            </button>
          )}
        </div>
      </div>
    );
  }

  const heading = title || (variant === 'hero' ? 'Speak with a senior designer' : 'Tell us about your space');
  const sub =
    subtitle ||
    (variant === 'hero'
      ? 'Tell us about your space and we will match you with the right specialist.'
      : 'Share a few details and we will prepare a consultation with no obligation.');

  return (
    <div className={shell}>
      {/* Header. In a modal it sticks to the top of the scrolling panel so the title is never cut off. */}
      <div
        className={cn(
          'flex items-start justify-between gap-4',
          variant === 'modal' ? 'sticky top-0 z-10 border-b border-charcoal/10 bg-white py-5 ' + pad : 'mb-6'
        )}
      >
        <div className="min-w-0">
          <h3 id={id('title')} className="text-[1.65rem] leading-tight sm:text-3xl">
            {heading}
          </h3>
          <p className="mt-1.5 text-sm text-charcoal/70">{sub}</p>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-charcoal/60 hover:bg-charcoal/5 hover:text-charcoal"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className={cn('space-y-4', variant === 'modal' && pad + ' py-6')} noValidate>
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={id('name')} className="field-label">
              Full name <span className="text-ochre" aria-hidden="true">*</span>
            </label>
            <input
              id={id('name')}
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field"
            />
          </div>
          <div>
            <label htmlFor={id('phone')} className="field-label">
              Phone or WhatsApp <span className="text-ochre" aria-hidden="true">*</span>
            </label>
            <input
              id={id('phone')}
              type="tel"
              required
              autoComplete="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="field"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={id('email')} className="field-label">
              Email <span className="font-normal text-charcoal/60">(optional)</span>
            </label>
            <input
              id={id('email')}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
            />
          </div>
          <div>
            <label htmlFor={id('location')} className="field-label">
              Property location <span className="text-ochre" aria-hidden="true">*</span>
            </label>
            <input
              id={id('location')}
              type="text"
              required
              placeholder="Kilimani, Runda, Karen…"
              value={locationAddress}
              onChange={(e) => setLocationAddress(e.target.value)}
              className="field"
            />
          </div>
        </div>

        <fieldset>
          <legend className="field-label">
            Where is your space at? <span className="text-ochre" aria-hidden="true">*</span>
          </legend>
          <div className="space-y-2">
            {PROPERTY_STATUS_OPTIONS.map((option) => {
              const isSelected = propertyStatus === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition-colors',
                    isSelected
                      ? 'border-ochre bg-ochre/[0.06] text-charcoal'
                      : 'border-charcoal/20 bg-white text-charcoal/80 hover:border-charcoal/40'
                  )}
                >
                  <input
                    type="radio"
                    name={`propertyStatus_${source}_${uid}`}
                    value={option.value}
                    checked={isSelected}
                    onChange={(e) => setPropertyStatus(e.target.value)}
                    className="h-4 w-4 shrink-0 accent-ochre"
                  />
                  <span className="leading-snug">{option.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor={id('scope')} className="field-label">
            What best describes your project? <span className="text-ochre" aria-hidden="true">*</span>
          </label>
          <select
            id={id('scope')}
            required
            value={projectScope}
            onChange={(e) => setProjectScope(e.target.value)}
            className="field"
          >
            <option value="" disabled>
              Select a project type
            </option>
            {PROJECT_SCOPE_OPTIONS.map((scopeOption) => (
              <option key={scopeOption} value={scopeOption}>
                {scopeOption}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3 pt-2">
          <button type="submit" disabled={submitting} className="btn btn-primary btn-lg w-full">
            {submitting ? 'Sending…' : 'Request a call from a designer'}
          </button>
          <p className="text-center text-[13px] text-charcoal/65">
            No commitment. We call within 24 hours to talk through your project.
          </p>
        </div>

        <div className="border-t border-charcoal/10 pt-4">
          <a href={directWhatsAppUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline w-full">
            <MessageSquare className="h-4 w-4 text-ochre" aria-hidden="true" />
            Prefer WhatsApp? Message us
          </a>
        </div>
      </form>
    </div>
  );
}
