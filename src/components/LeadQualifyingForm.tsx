import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCMS } from '../hooks/useCMS';
import { 
  CheckCircle2, Send, MessageSquare, Clock, DollarSign, 
  HelpCircle, ArrowRight, ShieldCheck, Phone, Mail, User, X, Layers
} from 'lucide-react';
import { cn } from '../lib/utils';

export type LeadTag = 'high-value' | 'incomplete' | 'general';

export const DESIRED_TIMELINES = [
  'ASAP',
  'Within 1 month',
  '1–3 months',
  '3–6 months',
  'Just exploring'
] as const;

export interface LeadQualifyingFormProps {
  source?: string;
  variant?: 'card' | 'modal' | 'inline';
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

  // CMS-managed services list
  const servicesList = (content?.services && Array.isArray(content.services) && content.services.length > 0)
    ? content.services
    : [];

  // Gating Question: Yes or No (default null or 'yes' for instant clarity)
  const [hasActiveProject, setHasActiveProject] = useState<boolean | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [budget, setBudget] = useState('');
  const [timeline, setTimeline] = useState<string>(DESIRED_TIMELINES[1]);
  const [scope, setScope] = useState('');
  const [generalInquiry, setGeneralInquiry] = useState('');

  // UI States
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedTag, setSubmittedTag] = useState<LeadTag | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Partial / Abandoned Lead Tracking
  const partialDocIdRef = useRef<string | null>(null);
  const isFinalSubmittedRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<any>(null);

  // Helper to build formatted message for Firestore
  const buildMessageContent = useCallback((isProject: boolean, isPartial = false): string => {
    const serviceInfo = selectedService ? `\nService Needed: ${selectedService}` : '';
    if (isPartial) {
      return `[INCOMPLETE PROJECT LEAD]\nUser started project inquiry but abandoned before submission.${serviceInfo}\nScope draft: ${scope.trim() || '—'}\nBudget: ${budget.trim() || 'Not specified'}\nTimeline: ${timeline}`;
    }
    if (isProject) {
      return `[HIGH-VALUE PROJECT INQUIRY]${serviceInfo}\nBudget: ${budget.trim() || 'Not specified'}\nTimeline: ${timeline}\n\nProject Scope & Objectives:\n${scope.trim() || 'Not specified'}`;
    }
    return `${selectedService ? `Service of Interest: ${selectedService}\n\n` : ''}${generalInquiry.trim() || 'General inquiry submitted from website.'}`;
  }, [selectedService, budget, timeline, scope, generalInquiry]);

  // Clean payload helper (stripping undefined values for Firestore safety)
  const buildPayload = useCallback((tag: LeadTag, isPartial = false) => {
    const isProject = hasActiveProject === true;
    const msg = buildMessageContent(isProject, isPartial);

    const payload: Record<string, any> = {
      name: name.trim() || (isPartial ? 'Interested Visitor (Abandoned)' : 'Client'),
      email: email.trim() || (isPartial ? 'abandoned-lead@pamnim.temp' : 'no-email@provided.local'),
      status: 'new',
      leadTag: tag,
      hasActiveProject: isProject,
      source,
      message: msg,
      createdAt: new Date().toISOString(),
      priority: tag === 'high-value' ? 'high' : (tag === 'incomplete' ? 'follow-up' : 'standard')
    };

    if (phone.trim()) payload.phone = phone.trim();
    if (selectedService.trim()) {
      payload.selectedService = selectedService.trim();
      payload.projectType = selectedService.trim();
    }
    if (isProject) {
      if (budget.trim()) payload.budget = budget.trim();
      if (timeline) payload.timeline = timeline;
      if (scope.trim()) payload.scope = scope.trim();
    } else {
      if (generalInquiry.trim()) payload.generalInquiry = generalInquiry.trim();
    }

    return payload;
  }, [hasActiveProject, name, email, phone, selectedService, budget, timeline, scope, generalInquiry, source, buildMessageContent]);

  // Background capture for Abandoned / Incomplete Leads
  const captureIncompleteLead = useCallback(async () => {
    if (isFinalSubmittedRef.current) return;
    if (hasActiveProject !== true) return;
    // Only capture if user entered at least some identifiable information
    const hasIdentifiers = name.trim().length > 1 || email.trim().length > 3 || phone.trim().length > 4 || scope.trim().length > 10;
    if (!hasIdentifiers) return;

    try {
      const payload = buildPayload('incomplete', true);

      if (partialDocIdRef.current) {
        await updateDoc(doc(db, 'inquiries', partialDocIdRef.current), {
          ...payload,
          updatedAt: new Date().toISOString()
        });
      } else {
        const docRef = await addDoc(collection(db, 'inquiries'), payload);
        partialDocIdRef.current = docRef.id;
      }
    } catch (err) {
      console.warn('Silent incomplete lead capture notice:', err);
    }
  }, [hasActiveProject, name, email, phone, scope, buildPayload]);

  // Trigger debounced capture on field blur or text entry when hasActiveProject is Yes
  useEffect(() => {
    if (hasActiveProject !== true || isFinalSubmittedRef.current) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      captureIncompleteLead();
    }, 2800);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [hasActiveProject, name, email, phone, scope, budget, timeline, captureIncompleteLead]);

  // Also capture when user switches tabs or navigates away (visibilitychange)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && !isFinalSubmittedRef.current && hasActiveProject === true) {
        captureIncompleteLead();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [hasActiveProject, captureIncompleteLead]);

  // Final Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (hasActiveProject === null) {
      setError('Please let us know if you have an active project ready to launch.');
      return;
    }

    if (!name.trim()) {
      setError('Please provide your name.');
      return;
    }

    if (!email.trim() && !phone.trim()) {
      setError('Please provide either an email or phone number so we can reach you.');
      return;
    }

    if (hasActiveProject && !scope.trim()) {
      setError('Please briefly describe your project scope or space requirements.');
      return;
    }

    if (!hasActiveProject && !generalInquiry.trim()) {
      setError('Please enter your inquiry or question.');
      return;
    }

    setSubmitting(true);
    isFinalSubmittedRef.current = true;

    try {
      const finalTag: LeadTag = hasActiveProject ? 'high-value' : 'general';
      const payload = buildPayload(finalTag, false);

      if (partialDocIdRef.current) {
        // Upgrade the existing partial lead document
        await updateDoc(doc(db, 'inquiries', partialDocIdRef.current), {
          ...payload,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'inquiries'), payload);
      }

      // Meta Pixel Lead tracking if configured
      if (typeof (window as any).fbq === 'function') {
        try {
          (window as any).fbq('track', 'Lead', {
            content_name: hasActiveProject ? 'High-Value Project Lead' : 'General Inquiry',
            lead_tag: finalTag,
            source
          });
        } catch (e) {
          // ignore tracking error
        }
      }

      setSubmittedTag(finalTag);
      setSubmitted(true);
    } catch (err: any) {
      console.error('Error submitting qualified lead:', err);
      setError(err?.message || 'Could not send your message. Please try again or reach out on WhatsApp.');
      isFinalSubmittedRef.current = false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenWhatsApp = () => {
    const rawNumber = content?.contact?.whatsapp || '254714984268';
    const cleanNumber = rawNumber.replace(/[^0-9]/g, '');
    let text = `Hello Pamnim Interior Designers! I'd like to discuss a project.\n\n*Name:* ${name || 'Client'}\n*Phone:* ${phone || '—'}`;
    if (hasActiveProject) {
      text += `\n*Budget:* ${budget}\n*Timeline:* ${timeline}\n*Scope:* ${scope}`;
    } else {
      text += `\n*Inquiry:* ${generalInquiry || 'General Inquiry'}`;
    }
    window.open(`https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  // Success view
  if (submitted) {
    return (
      <div className={cn(
        "p-6 sm:p-10 text-center space-y-5 animate-fade-in",
        variant === 'card' && "bg-white rounded-3xl border border-charcoal/10 shadow-xl",
        variant === 'modal' && "bg-white",
        className
      )}>
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
          <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ochre/10 text-ochre text-xs font-bold uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{submittedTag === 'high-value' ? 'High-Priority Project Received' : 'Message Received'}</span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-charcoal">
            {submittedTag === 'high-value' ? 'Thank you! Your project is fast-tracked.' : 'Thank you for reaching out!'}
          </h3>
          <p className="text-sm sm:text-base text-charcoal/70 max-w-md mx-auto leading-relaxed">
            {submittedTag === 'high-value'
              ? `Our senior interior design team has received your ${budget ? `${budget} ` : ''}project brief. We will review your scope and get in touch within a few hours to arrange a discovery session.`
              : 'We have received your note and will get back to you within 24 business hours.'}
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md shadow-emerald-700/20"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat Directly on WhatsApp</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-3 rounded-xl border border-charcoal/15 text-xs font-bold text-charcoal/70 hover:bg-cream transition-colors cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "w-full transition-all duration-300",
      variant === 'card' && "bg-white/95 backdrop-blur-xl p-6 sm:p-8 md:p-10 rounded-3xl border border-charcoal/10 shadow-xl",
      variant === 'modal' && "bg-white p-6 sm:p-8",
      className
    )}>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ochre/10 text-ochre text-[11px] font-bold uppercase tracking-widest mb-2">
            <span>Consultation & Project Launch</span>
          </div>
          <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-charcoal tracking-tight">
            {title || 'Tell us about your space'}
          </h3>
          <p className="text-xs sm:text-sm text-charcoal/60 mt-1">
            {subtitle || 'Get a bespoke interior consultation and spatial plan with no obligations.'}
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-charcoal/40 hover:text-charcoal hover:bg-cream transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {error && (
        <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium animate-fade-in flex items-center gap-2">
          <HelpCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* GATING QUESTION */}
        <div className="p-4 sm:p-5 bg-cream/70 rounded-2xl border border-charcoal/10 space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/80">
            Do you have an active project ready to launch? <span className="text-ochre">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setHasActiveProject(true);
                setError(null);
              }}
              className={cn(
                "p-3 rounded-xl border text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer",
                hasActiveProject === true
                  ? "bg-ochre text-white border-ochre shadow-md shadow-ochre/25 ring-2 ring-ochre/30"
                  : "bg-white text-charcoal/80 border-charcoal/15 hover:border-ochre/50 hover:bg-white"
              )}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Yes, Ready to Launch</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setHasActiveProject(false);
                setError(null);
              }}
              className={cn(
                "p-3 rounded-xl border text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer",
                hasActiveProject === false
                  ? "bg-charcoal text-white border-charcoal shadow-md shadow-charcoal/20"
                  : "bg-white text-charcoal/80 border-charcoal/15 hover:border-charcoal/50 hover:bg-white"
              )}
            >
              <MessageSquare className="w-4 h-4" />
              <span>No, Just Inquiring</span>
            </button>
          </div>
          <p className="text-[11px] text-charcoal/50">
            {hasActiveProject === true 
              ? 'High-Priority Routing: Your brief will be routed directly to our lead designers.'
              : hasActiveProject === false
              ? 'General Inquiry: Ask us anything about our materials, process, or availability.'
              : 'Please select an option to continue.'}
          </p>
        </div>

        {/* YES: PROJECT SCOPE & QUALIFICATION EXPANSION */}
        {hasActiveProject === true && (
          <div className="space-y-4 p-4 sm:p-5 bg-ochre/5 rounded-2xl border border-ochre/20 animate-fade-in">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ochre">
              <CheckCircle2 className="w-4 h-4" />
              <span>Project Details (High-Value Lead)</span>
            </div>

            {/* Service Needed Dropdown (from CMS services) */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1.5 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-ochre" />
                <span>Service Needed</span>
              </label>
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre text-charcoal cursor-pointer shadow-xs"
              >
                <option value="">-- Select service needed (optional) --</option>
                {servicesList.map((srv: any, idx: number) => {
                  const title = srv.title || srv.name || `Service ${idx + 1}`;
                  return (
                    <option key={srv.id || idx} value={title}>
                      {title}
                    </option>
                  );
                })}
                <option value="General Interior Consultation">General Interior Consultation</option>
                <option value="Other Custom Project">Other Custom Project</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Estimated Budget: Text Input (Typed by user) */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1.5 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-ochre" />
                  <span>Estimated Budget <span className="text-ochre">*</span></span>
                </label>
                <input
                  type="text"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. KES 500,000 or 1.5M"
                  className="w-full px-3.5 py-2.5 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre text-charcoal shadow-xs"
                />
              </div>

              {/* Desired Timeline Dropdown */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-ochre" />
                  <span>Desired Timeline <span className="text-ochre">*</span></span>
                </label>
                <select
                  value={timeline}
                  onChange={(e) => setTimeline(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre text-charcoal cursor-pointer shadow-xs"
                >
                  {DESIRED_TIMELINES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Project Scope Textarea */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1.5">
                Project Scope & Key Spaces <span className="text-ochre">*</span>
              </label>
              <textarea
                rows={3}
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder="e.g. 4-bedroom villa in Kilimani — living room gypsum ceilings, custom master walk-in closet, fluted oak wall paneling, and kitchen renovation..."
                className="w-full p-3.5 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre text-charcoal placeholder:text-charcoal/30 shadow-xs"
              />
            </div>
          </div>
        )}

        {/* NO: SIMPLE INQUIRY */}
        {hasActiveProject === false && (
          <div className="space-y-4 p-4 sm:p-5 bg-charcoal/5 rounded-2xl border border-charcoal/10 animate-fade-in">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-charcoal/70">
              <MessageSquare className="w-4 h-4 text-charcoal/60" />
              <span>General Inquiry</span>
            </div>

            {/* Service Needed Dropdown in No Path */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1.5 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-ochre" />
                <span>Service of Interest</span>
              </label>
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre text-charcoal cursor-pointer shadow-xs"
              >
                <option value="">-- Select service of interest (optional) --</option>
                {servicesList.map((srv: any, idx: number) => {
                  const title = srv.title || srv.name || `Service ${idx + 1}`;
                  return (
                    <option key={srv.id || idx} value={title}>
                      {title}
                    </option>
                  );
                })}
                <option value="General Interior Consultation">General Interior Consultation</option>
                <option value="General Question / Workshop Visit">General Question / Workshop Visit</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1.5">
                How can we assist you? <span className="text-ochre">*</span>
              </label>
              <textarea
                rows={3}
                value={generalInquiry}
                onChange={(e) => setGeneralInquiry(e.target.value)}
                placeholder="Ask about design consultation rates, material options, past projects, or workshop visiting hours..."
                className="w-full p-3.5 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre text-charcoal placeholder:text-charcoal/30 shadow-xs"
              />
            </div>
          </div>
        )}

        {/* COMMON CONTACT FIELDS (Always visible once choice made or previewed) */}
        {hasActiveProject !== null && (
          <div className="space-y-4 pt-1 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-charcoal/50" />
                  <span>Your Full Name <span className="text-ochre">*</span></span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Christine Mutua"
                  className="w-full px-3.5 py-2.5 bg-cream/50 border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre focus:bg-white text-charcoal shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-charcoal/50" />
                  <span>Phone / WhatsApp <span className="text-ochre">*</span></span>
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07XX XXX XXX"
                  className="w-full px-3.5 py-2.5 bg-cream/50 border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre focus:bg-white text-charcoal shadow-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-charcoal/50" />
                <span>Email Address {hasActiveProject ? <span className="text-ochre">*</span> : <span className="text-charcoal/40 text-[10px]">(optional)</span>}</span>
              </label>
              <input
                type="email"
                required={hasActiveProject === true}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="christine@example.com"
                className="w-full px-3.5 py-2.5 bg-cream/50 border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre focus:bg-white text-charcoal shadow-xs"
              />
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-[11px] text-charcoal/50">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Your information is strictly private and never shared.</span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-ochre hover:bg-ochre-dark text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-ochre/25 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {submitting 
                      ? 'Submitting...' 
                      : hasActiveProject 
                      ? 'Submit Project Brief' 
                      : 'Send Inquiry'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
