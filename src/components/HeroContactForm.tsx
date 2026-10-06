import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCMS } from '../hooks/useCMS';
import { 
  CheckCircle2, ArrowRight, MapPin, AlertCircle, 
  Phone, Mail, User, Check, Layers, Home, MessageSquare
} from 'lucide-react';
import { cn } from '../lib/utils';
import { createNotification } from '../services/notificationService';

export const PROPERTY_STATUS_OPTIONS = [
  {
    value: 'I own/lease the space & have the keys',
    label: 'I own/lease the space & have the keys',
    priority: 'high' as const,
    leadTag: 'high-value' as const,
  },
  {
    value: 'Under construction / Handover coming soon',
    label: 'Under construction / Handover coming soon',
    priority: 'medium' as const,
    leadTag: 'project' as const,
  },
  {
    value: 'Just inquiring / Collecting design ideas',
    label: 'Just inquiring / Collecting design ideas',
    priority: 'low' as const,
    leadTag: 'general' as const,
  }
];

export const PROJECT_SCOPE_OPTIONS = [
  'Full Home / Apartment Renovation',
  'Living Room & Gypsum Ceiling Focus',
  'Custom Kitchen & Premium Carpentry',
  'Flooring & Finishing Solutions',
  'Commercial / Office Space'
] as const;

export default function HeroContactForm() {
  const { content } = useCMS();

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [propertyStatus, setPropertyStatus] = useState<string>(PROPERTY_STATUS_OPTIONS[0].value);
  const [projectScope, setProjectScope] = useState<string>('');

  // Submission & UI feedback states
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rawNumber = content?.contact?.whatsapp || '254714984268';
  const cleanNumber = rawNumber.replace(/[^0-9]/g, '');
  const directWhatsAppUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(
    "Hi Pamnim Interiors, I'd like to discuss a project for my space."
  )}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!phone.trim()) {
      setError('Please provide your Phone or WhatsApp number.');
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

    const statusObj = PROPERTY_STATUS_OPTIONS.find(o => o.value === propertyStatus) || PROPERTY_STATUS_OPTIONS[0];
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
        source: 'hero_lead_form',
        status: 'new',
        message: `[LEAD INTAKE REQUEST]\nProject Scope: ${projectScope}\nProperty Location / Estate: ${locationAddress.trim()}\nSpace Status: ${propertyStatus} (${statusObj.priority.toUpperCase()} PRIORITY)\nPhone / WhatsApp: ${phone.trim()}\nEmail: ${email.trim() || 'Not provided'}`,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'inquiries'), payload);

      // Trigger owner notification
      createNotification({
        userId: 'all_owners',
        role: 'owner',
        title: statusObj.priority === 'high' ? 'High-Priority Design Lead' : 'New Design Consultation Request',
        body: `${name.trim()} (${locationAddress.trim()}) — ${projectScope}`,
        link: '/admin?tab=inquiries',
        type: 'inquiry'
      }).catch(() => {});

      // Meta Pixel Lead tracking if configured
      if (typeof (window as any).fbq === 'function') {
        try {
          (window as any).fbq('track', 'Lead', {
            content_name: projectScope,
            lead_tag: statusObj.leadTag,
            status: propertyStatus,
            location: locationAddress.trim()
          });
        } catch {
          // ignore tracking error
        }
      }

      setSubmitted(true);
    } catch (err: any) {
      console.error('Error submitting lead form:', err);
      setError(err?.message || 'Could not submit your request. Please try again or chat with us on WhatsApp.');
    } finally {
      setSubmitting(false);
    }
  };

  // SUCCESS STATE
  if (submitted) {
    return (
      <div className="bg-white/95 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-charcoal/10 shadow-2xl space-y-5 animate-fade-in text-center">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-ochre flex items-center justify-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            <span>Consultation Request Received</span>
          </p>
          <h3 className="text-2xl font-bold text-charcoal">
            Thank you, {name.split(' ')[0]}!
          </h3>
          <p className="text-xs sm:text-sm text-charcoal/70 max-w-sm mx-auto leading-relaxed">
            Our senior designer has received your project details for <span className="font-semibold text-charcoal">{locationAddress}</span> and will call you within 24 hours.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={directWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md shadow-emerald-700/20"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Or Chat Directly on WhatsApp</span>
          </a>
          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setName('');
              setPhone('');
              setEmail('');
              setLocationAddress('');
              setPropertyStatus(PROPERTY_STATUS_OPTIONS[0].value);
              setProjectScope('');
            }}
            className="w-full sm:w-auto px-5 py-3 rounded-xl border border-charcoal/15 text-xs font-bold text-charcoal/70 hover:bg-cream transition-colors cursor-pointer"
          >
            <span>Submit Another</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/95 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-charcoal/10 shadow-2xl transition-all duration-300">
      <div className="mb-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-ochre mb-1.5">
          Start Your Interior Journey
        </p>
        <h3 className="text-xl sm:text-2xl font-bold text-charcoal tracking-tight">
          Speak with a Senior Designer
        </h3>
        <p className="text-xs text-charcoal/60 mt-1">
          Tell us about your space so we can match you with the right specialist.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium animate-fade-in flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 1. Full Name & 2. Phone / WhatsApp */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1.5 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-ochre" />
              <span>Full Name <span className="text-ochre">*</span></span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre text-charcoal placeholder:text-charcoal/35 shadow-xs transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1.5 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-ochre" />
              <span>Phone / WhatsApp <span className="text-ochre">*</span></span>
            </label>
            <input
              type="tel"
              required
              placeholder="e.g., 0712 345 678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre text-charcoal placeholder:text-charcoal/35 shadow-xs transition-colors"
            />
          </div>
        </div>

        {/* 3. Email Address (Optional) & 4. Property Location / Estate (Required) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1.5 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-ochre" />
              <span>Email Address <span className="text-charcoal/40 font-normal lowercase">(optional)</span></span>
            </label>
            <input
              type="email"
              placeholder="e.g., jane@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre text-charcoal placeholder:text-charcoal/35 shadow-xs transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1.5 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-ochre" />
              <span>Property Location / Estate <span className="text-ochre">*</span></span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Kilimani, Runda, Karen"
              value={locationAddress}
              onChange={(e) => setLocationAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre text-charcoal placeholder:text-charcoal/35 shadow-xs transition-colors"
            />
            <p className="text-[10px] text-charcoal/50 mt-1">
              e.g., Kilimani, Runda, Westlands, Karen, Syokimau
            </p>
          </div>
        </div>

        {/* 5. Property Readiness / Status (Required - Lead Intent Filter) */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1.5 flex items-center gap-1">
            <Home className="w-3.5 h-3.5 text-ochre" />
            <span>What is the status of your space? <span className="text-ochre">*</span></span>
          </label>
          <div className="space-y-1.5">
            {PROPERTY_STATUS_OPTIONS.map((option) => {
              const isSelected = propertyStatus === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all",
                    isSelected
                      ? "bg-ochre/10 border-ochre text-charcoal shadow-2xs"
                      : "bg-white border-charcoal/15 text-charcoal/75 hover:border-charcoal/30"
                  )}
                >
                  <input
                    type="radio"
                    name="propertyStatus"
                    value={option.value}
                    checked={isSelected}
                    onChange={(e) => setPropertyStatus(e.target.value)}
                    className="w-3.5 h-3.5 text-ochre accent-ochre focus:ring-ochre cursor-pointer shrink-0"
                  />
                  <span className="leading-snug">{option.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* 6. Project Scope (Required) */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1.5 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-ochre" />
            <span>What best describes your project? <span className="text-ochre">*</span></span>
          </label>
          <select
            required
            value={projectScope}
            onChange={(e) => setProjectScope(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre text-charcoal shadow-xs transition-colors cursor-pointer"
          >
            <option value="" disabled>Select project scope...</option>
            {PROJECT_SCOPE_OPTIONS.map((scopeOption) => (
              <option key={scopeOption} value={scopeOption}>
                {scopeOption}
              </option>
            ))}
          </select>
        </div>

        {/* Primary Button CTA & Microcopy */}
        <div className="pt-2 space-y-2.5">
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-6 rounded-xl bg-ochre hover:bg-ochre-dark text-white text-sm font-bold tracking-wide shadow-lg shadow-ochre/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
          >
            <span>{submitting ? 'Submitting Request...' : 'Request Call with Designer →'}</span>
          </button>

          <p className="text-[11px] text-charcoal/60 text-center italic leading-relaxed px-2">
            No commitment. We will call you within 24 hours to discuss your project vision and details.
          </p>
        </div>

        {/* Secondary WhatsApp Direct Route */}
        <div className="pt-2 border-t border-charcoal/10">
          <a
            href={directWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-4 rounded-xl border border-charcoal/15 hover:border-emerald-600/40 bg-cream/40 hover:bg-emerald-50/50 text-charcoal/80 hover:text-emerald-800 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Or Chat Directly on WhatsApp</span>
          </a>
        </div>
      </form>
    </div>
  );
}
