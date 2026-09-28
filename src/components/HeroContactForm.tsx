import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCMS } from '../hooks/useCMS';
import { 
  CheckCircle2, ArrowRight, ArrowLeft, Calendar, 
  MapPin, AlertCircle, Phone, Mail, User, Check
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function HeroContactForm() {
  const { content } = useCMS();

  // Step 1 fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Step 2 ("I Have a Project") fields
  const [step, setStep] = useState<1 | 2>(1);
  const [hasActiveProject, setHasActiveProject] = useState<boolean>(true);
  const [siteVisitDate, setSiteVisitDate] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [locationAddress, setLocationAddress] = useState<string>('');
  const [projectDescription, setProjectDescription] = useState<string>('');
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedType, setSubmittedType] = useState<'project' | 'general'>('general');
  const [error, setError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  // Handler for "Send Request" (General inquiry from Step 1)
  const handleSendGeneralRequest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide your name.');
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError('Please provide your phone number or email so we can reach you.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        email: email.trim() || 'no-email@provided.local',
        phone: phone.trim() || '',
        leadTag: 'general',
        hasActiveProject: false,
        requestType: 'general_request',
        source: 'hero_general_request',
        status: 'new',
        priority: 'standard',
        message: `[GENERAL REQUEST]\nClient submitted contact request from homepage hero.\nName: ${name.trim()}\nPhone: ${phone.trim() || 'Not provided'}\nEmail: ${email.trim() || 'Not provided'}`,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'inquiries'), payload);
      setSubmittedType('general');
      setSubmitted(true);
    } catch (err: any) {
      console.error('Error submitting general request:', err);
      setError(err?.message || 'Could not send request. Please try again or reach out on WhatsApp.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handler to proceed to Step 2 ("I Have a Project")
  const handleProceedToProject = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter your name first.');
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setError('Please enter your phone number or email so our lead designers can reach you.');
      return;
    }

    setStep(2);
  };

  // Handler for submitting "I Have a Project" (Step 2)
  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide your name.');
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setError('Please provide a phone number or email.');
      return;
    }
    if (!siteVisitDate) {
      setError('Please select a date for your site visit.');
      return;
    }
    if (!locationAddress.trim()) {
      setError('Please enter your project location / address.');
      return;
    }
    if (!termsAccepted) {
      setError('Please accept the site visit terms to proceed.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        email: email.trim() || 'no-email@provided.local',
        phone: phone.trim() || '',
        leadTag: 'project',
        hasActiveProject: true,
        requestType: 'project_request',
        source: 'hero_project_request',
        siteVisitDate,
        startDate: startDate || siteVisitDate,
        location: locationAddress.trim(),
        description: projectDescription.trim(),
        scope: projectDescription.trim(),
        termsAccepted: true,
        siteVisitFeeNote: 'KES 5,000 within Nairobi. Site visits outside Nairobi are negotiable.',
        status: 'new',
        priority: 'high',
        message: `[I HAVE A PROJECT - SITE VISIT REQUEST]\nLive Project Confirmed: ${hasActiveProject ? 'Yes' : 'Pending'}\nSite Visit Date: ${siteVisitDate}\nDesired Project Start Date: ${startDate || 'To be aligned at site visit'}\nLocation/Address: ${locationAddress.trim()}\n\nProject Description:\n${projectDescription.trim() || 'None provided'}\n\nTerms Accepted: KES 5,000 site visit fee within Nairobi agreed.`,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'inquiries'), payload);
      setSubmittedType('project');
      setSubmitted(true);
    } catch (err: any) {
      console.error('Error submitting project request:', err);
      setError(err?.message || 'Could not submit your project request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenWhatsApp = () => {
    const rawNumber = content?.contact?.whatsapp || '254714984268';
    const cleanNumber = rawNumber.replace(/[^0-9]/g, '');
    let text = `Hello Pamnim Interior Designers! I just submitted a request on your website.\n\n*Name:* ${name || 'Client'}\n*Phone:* ${phone || '—'}`;
    if (submittedType === 'project') {
      text += `\n*Site Visit Date:* ${siteVisitDate}\n*Start Date:* ${startDate || 'To be aligned'}\n*Location:* ${locationAddress}`;
      if (projectDescription) text += `\n*Description:* ${projectDescription}`;
    }
    window.open(`https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  // SUCCESS STATE
  if (submitted) {
    return (
      <div className="bg-white/95 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-charcoal/10 shadow-2xl space-y-5 animate-fade-in text-center">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ochre/10 text-ochre text-xs font-bold uppercase tracking-wider">
            <Check className="w-3.5 h-3.5" />
            <span>{submittedType === 'project' ? 'Project & Site Visit Booked' : 'Request Received'}</span>
          </div>
          <h3 className="text-2xl font-bold text-charcoal">
            {submittedType === 'project' ? 'Thank You! We are ready for your project.' : 'Thank you for reaching out!'}
          </h3>
          <p className="text-xs sm:text-sm text-charcoal/70 max-w-sm mx-auto leading-relaxed">
            {submittedType === 'project'
              ? `We have scheduled your requested site visit for ${siteVisitDate}. Our lead designer will call you shortly to confirm the details.`
              : 'Our design team has received your details and will call or message you within 24 hours.'}
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md shadow-emerald-700/20"
          >
            <span>Chat Directly on WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setStep(1);
              setName('');
              setEmail('');
              setPhone('');
              setSiteVisitDate('');
              setStartDate('');
              setLocationAddress('');
              setProjectDescription('');
              setTermsAccepted(false);
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
      {/* Header */}
      <div className="mb-5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ochre/10 text-ochre text-[11px] font-bold uppercase tracking-widest mb-2">
          <span>{step === 1 ? 'Start Your Interior Journey' : 'Step 2: Project & Site Visit Details'}</span>
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-charcoal tracking-tight">
          {step === 1 ? 'Book your free consultation' : 'Tell us about your project'}
        </h3>
        <p className="text-xs text-charcoal/60 mt-1">
          {step === 1 
            ? 'Enter your details below to launch your project or send a general request.' 
            : 'Fill in your site visit preferences. Name and contact details carried over.'}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium animate-fade-in flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: SIMPLE FORM (NAME, EMAIL, PHONE) + 2 BUTTONS */}
      {step === 1 && (
        <form onSubmit={handleProceedToProject} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1.5 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-ochre" />
              <span>Full Name <span className="text-ochre">*</span></span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre text-charcoal shadow-xs transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1.5 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-ochre" />
              <span>Email Address</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre text-charcoal shadow-xs transition-colors"
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
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre text-charcoal shadow-xs transition-colors"
            />
          </div>

          {/* TWO SIDE-BY-SIDE BUTTONS */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            {/* Primary, bolder, more prominent button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:flex-1 py-3.5 px-4 rounded-xl bg-ochre hover:bg-ochre-dark text-white text-sm font-black tracking-wide shadow-lg shadow-ochre/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <span>I Have a Project</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>

            {/* Plain secondary style for people without a live project */}
            <button
              type="button"
              disabled={submitting}
              onClick={handleSendGeneralRequest}
              className="w-full sm:w-auto py-3 px-4 rounded-xl bg-charcoal/5 hover:bg-charcoal/10 text-charcoal/80 hover:text-charcoal border border-charcoal/15 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>{submitting ? 'Sending...' : 'Send Request'}</span>
            </button>
          </div>

          <p className="text-[11px] text-charcoal/50 text-center pt-1">
            "I Have a Project" fast-tracks your site inspection and space planning.
          </p>
        </form>
      )}

      {/* STEP 2: "I HAVE A PROJECT" DETAILED FLOW */}
      {step === 2 && (
        <form onSubmit={handleSubmitProject} className="space-y-4 animate-fade-in">
          {/* Editable Contact Summary */}
          <div className="p-3 bg-cream/70 rounded-xl border border-charcoal/10 text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-charcoal">{name}</span>
              <span className="text-charcoal/40">•</span>
              <span className="font-mono text-emerald-700 font-bold">{phone || email}</span>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-[11px] font-bold text-ochre hover:underline flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Edit Contact</span>
            </button>
          </div>

          {/* 1. Active Project confirmation (checkbox / toggle) */}
          <div className="p-3 bg-white rounded-xl border border-charcoal/15 flex items-center justify-between gap-3 shadow-2xs">
            <div className="min-w-0">
              <label htmlFor="active-proj-toggle" className="text-xs font-bold text-charcoal block cursor-pointer">
                Active Project Ready to Go Ahead
              </label>
              <span className="text-[11px] text-charcoal/50 block">
                Confirm you have an active residential or commercial space ready for execution.
              </span>
            </div>
            <input
              id="active-proj-toggle"
              type="checkbox"
              checked={hasActiveProject}
              onChange={(e) => setHasActiveProject(e.target.checked)}
              className="w-4 h-4 text-ochre accent-ochre rounded focus:ring-ochre cursor-pointer shrink-0"
            />
          </div>

          {/* 2. Book a Site Visit & Desired Project Start Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-ochre" />
                <span>Book Site Visit Date <span className="text-ochre">*</span></span>
              </label>
              <input
                type="date"
                required
                min={todayStr}
                value={siteVisitDate}
                onChange={(e) => {
                  setSiteVisitDate(e.target.value);
                  if (!startDate) setStartDate(e.target.value);
                }}
                className="w-full px-3 py-2 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre text-charcoal shadow-xs cursor-pointer"
              />
            </div>

            {/* When site visit date is picked, also ask for desired project start date */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-ochre" />
                <span>Desired Start Date</span>
              </label>
              <input
                type="date"
                min={siteVisitDate || todayStr}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre text-charcoal shadow-xs cursor-pointer"
              />
            </div>
          </div>

          {/* 3. Location and Address */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-ochre" />
              <span>Location and Address <span className="text-ochre">*</span></span>
            </label>
            <input
              type="text"
              required
              value={locationAddress}
              onChange={(e) => setLocationAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre text-charcoal shadow-xs"
            />
          </div>

          {/* 4. Project Description (textarea) */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1">
              Project Description
            </label>
            <textarea
              rows={3}
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre text-charcoal shadow-xs resize-none"
            />
          </div>

          {/* 5. Terms Checkbox (Required) */}
          <div className="p-3 bg-ochre/10 rounded-xl border border-ochre/25 space-y-1">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-ochre accent-ochre rounded focus:ring-ochre cursor-pointer shrink-0"
              />
              <span className="text-[11px] font-semibold text-charcoal leading-snug">
                I understand the site visit fee is KES 5,000 within Nairobi. Site visits outside Nairobi are negotiable. <span className="text-ochre font-bold">*</span>
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:flex-1 py-3.5 px-6 rounded-xl bg-ochre hover:bg-ochre-dark text-white text-sm font-bold shadow-lg shadow-ochre/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <span>{submitting ? 'Submitting...' : 'Confirm & Book Site Visit'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full sm:w-auto py-3 px-4 rounded-xl border border-charcoal/15 text-xs font-semibold text-charcoal/70 hover:bg-cream transition-colors cursor-pointer"
            >
              Back
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
