import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCMS } from '../hooks/useCMS';
import { 
  CheckCircle2, ArrowRight, Calendar, 
  MapPin, AlertCircle, Phone, Mail, User, Check, X, Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { createNotification } from '../services/notificationService';

export default function HeroContactForm() {
  const { content } = useCMS();

  // Basic hero contact fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // "I Have a Project" Modal State & Fields
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [modalName, setModalName] = useState('');
  const [modalEmail, setModalEmail] = useState('');
  const [modalPhone, setModalPhone] = useState('');
  const [hasActiveProject, setHasActiveProject] = useState<boolean>(true);
  const [siteVisitDate, setSiteVisitDate] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [locationAddress, setLocationAddress] = useState<string>('');
  const [projectDescription, setProjectDescription] = useState<string>('');
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);

  // Geolocation state (Client-side)
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);

  // Submission & UI feedback states
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedType, setSubmittedType] = useState<'project' | 'general'>('general');
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  // Open the "I Have a Project" modal and carry over current input values
  const handleOpenProjectModal = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setModalError(null);

    // Carry over values from initial form
    setModalName(name.trim());
    setModalEmail(email.trim());
    setModalPhone(phone.trim());

    setIsProjectModalOpen(true);
  };

  // Handler for "Send Request" (General inquiry from initial hero form)
  const handleSendGeneralRequest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide your name.');
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError('Please provide your phone number or email so our designers can reach you.');
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
        message: `[GENERAL REQUEST]\nClient submitted general inquiry from homepage hero.\nName: ${name.trim()}\nPhone: ${phone.trim() || 'Not provided'}\nEmail: ${email.trim() || 'Not provided'}`,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'inquiries'), payload);

      // Trigger owner notification
      createNotification({
        userId: 'all_owners',
        role: 'owner',
        title: 'New Contact Request',
        body: `General inquiry from ${name.trim()} (${phone.trim() || email.trim()})`,
        link: '/admin?tab=inquiries',
        type: 'inquiry'
      }).catch(() => {});

      setSubmittedType('general');
      setSubmitted(true);
    } catch (err: any) {
      console.error('Error submitting general request:', err);
      setError(err?.message || 'Could not send request. Please try again or reach out on WhatsApp.');
    } finally {
      setSubmitting(false);
    }
  };

  // Geolocation reverse-geocoding helper for Client ("Use My Current Location")
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationNotice('Geolocation is not supported by your browser. Please enter manually.');
      return;
    }

    setDetectingLocation(true);
    setLocationNotice(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.display_name || `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`;
            setLocationAddress(addr);
            setLocationNotice('Location detected! You can still edit the details above.');
          } else {
            setLocationAddress(`Nairobi (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
            setLocationNotice('Coordinates captured. You can refine your street or apartment name.');
          }
        } catch {
          setLocationAddress(`Nairobi (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
          setLocationNotice('Coordinates captured. You can add your street or landmark.');
        } finally {
          setDetectingLocation(false);
        }
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setLocationNotice('Could not retrieve GPS location. Please type your address manually.');
        setDetectingLocation(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Handler for submitting "I Have a Project" from the Modal
  const handleSubmitProjectModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const clientName = modalName.trim() || name.trim();
    const clientPhone = modalPhone.trim() || phone.trim();
    const clientEmail = modalEmail.trim() || email.trim();

    if (!clientName) {
      setModalError('Please enter your full name.');
      return;
    }
    if (!clientPhone && !clientEmail) {
      setModalError('Please provide a phone number or email so we can contact you.');
      return;
    }
    if (!siteVisitDate) {
      setModalError('Please select a date for your site visit.');
      return;
    }
    if (!locationAddress.trim()) {
      setModalError('Please enter your project address or use your current location.');
      return;
    }
    if (!termsAccepted) {
      setModalError('Please accept the site visit terms (KES 5,000 within Nairobi) to proceed.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        name: clientName,
        email: clientEmail || 'no-email@provided.local',
        phone: clientPhone || '',
        leadTag: 'project',
        hasActiveProject: true,
        requestType: 'project_request',
        source: 'hero_project_modal',
        siteVisitDate,
        startDate: startDate || siteVisitDate,
        location: locationAddress.trim(),
        address: locationAddress.trim(),
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

      // Trigger owner notification
      createNotification({
        userId: 'all_owners',
        role: 'owner',
        title: 'New Project & Site Visit Request',
        body: `${clientName} booked a site visit for ${siteVisitDate}. Location: ${locationAddress.trim()}`,
        link: '/admin?tab=inquiries',
        type: 'inquiry'
      }).catch(() => {});
      
      // Update local hero fields to match submitted
      setName(clientName);
      setEmail(clientEmail);
      setPhone(clientPhone);

      setIsProjectModalOpen(false);
      setSubmittedType('project');
      setSubmitted(true);
    } catch (err: any) {
      console.error('Error submitting project intake request:', err);
      setModalError(err?.message || 'Could not submit your project request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenWhatsApp = () => {
    const rawNumber = content?.contact?.whatsapp || '254714984268';
    const cleanNumber = rawNumber.replace(/[^0-9]/g, '');
    let text = `Hello Pamnim Interior Designers! I just submitted an inquiry on your website.\n\n*Name:* ${name || modalName || 'Client'}\n*Phone:* ${phone || modalPhone || '—'}`;
    if (submittedType === 'project') {
      text += `\n*Site Visit Date:* ${siteVisitDate}\n*Desired Start Date:* ${startDate || 'To be aligned'}\n*Location:* ${locationAddress}`;
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
            {submittedType === 'project' ? 'Thank you! We are ready for your project.' : 'Thank you for reaching out!'}
          </h3>
          <p className="text-xs sm:text-sm text-charcoal/70 max-w-sm mx-auto leading-relaxed">
            {submittedType === 'project'
              ? `We have recorded your site visit preference for ${siteVisitDate}. Our lead designer will call you shortly to confirm the appointment.`
              : 'Our design team has received your inquiry and will reach out to you within 24 hours.'}
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
    <>
      {/* ============================================================ */}
      {/* HERO SECTION CONTACT FORM (REVERTED TO SIMPLE VERSION)       */}
      {/* Fields: Name, Email, Phone Number only                       */}
      {/* Action Options: "I Have a Project" (Dominant) & "Send Request"*/}
      {/* ============================================================ */}
      <div className="bg-white/95 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-charcoal/10 shadow-2xl transition-all duration-300">
        <div className="mb-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ochre/10 text-ochre text-[11px] font-bold uppercase tracking-widest mb-2">
            <span>Start Your Interior Journey</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-charcoal tracking-tight">
            Book your consultation
          </h3>
          <p className="text-xs text-charcoal/60 mt-1">
            Enter your details below to launch your project or send a general request.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium animate-fade-in flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleOpenProjectModal} className="space-y-4">
          {/* Field 1: Name */}
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

          {/* Field 2: Email */}
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

          {/* Field 3: Phone Number */}
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

          {/* TWO SIDE-BY-SIDE ACTION OPTIONS */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            {/* "I Have a Project" — Visually dominant / bolder button (Primary styling) */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:flex-1 py-3.5 px-5 rounded-xl bg-ochre hover:bg-ochre-dark text-white text-sm font-black tracking-wide shadow-lg shadow-ochre/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <span>I Have a Project</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>

            {/* "Send Request" — Secondary / lower-emphasis styling for general inquiries */}
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
            "I Have a Project" opens our site inspection & intake form.
          </p>
        </form>
      </div>

      {/* ============================================================ */}
      {/* "I HAVE A PROJECT" MODAL (NOT AN INLINE EXPAND)             */}
      {/* ============================================================ */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-50 bg-charcoal/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white w-full max-w-xl rounded-3xl p-6 sm:p-8 shadow-2xl border border-charcoal/10 my-8 space-y-5 relative max-h-[92vh] overflow-y-auto animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-charcoal/10 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ochre/10 text-ochre text-[10px] font-bold uppercase tracking-widest mb-1.5">
                  <span>Project Intake & Site Visit</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-charcoal tracking-tight">
                  Tell us about your project
                </h3>
                <p className="text-xs text-charcoal/60 mt-0.5">
                  Your contact info is pre-filled. Complete your site visit preferences below.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsProjectModalOpen(false)}
                className="p-2 rounded-xl text-charcoal/40 hover:text-charcoal hover:bg-cream/60 transition-colors cursor-pointer shrink-0"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitProjectModal} className="space-y-4">
              {/* Pre-filled & Editable Contact Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-cream/40 rounded-2xl border border-charcoal/10">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-charcoal/50 mb-1">
                    Your Name <span className="text-ochre">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={modalName}
                    onChange={(e) => setModalName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-charcoal/15 rounded-lg text-xs font-medium text-charcoal focus:border-ochre focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-charcoal/50 mb-1">
                    Phone / WhatsApp <span className="text-ochre">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={modalPhone}
                    onChange={(e) => setModalPhone(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-charcoal/15 rounded-lg text-xs font-medium text-charcoal focus:border-ochre focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-charcoal/50 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={modalEmail}
                    onChange={(e) => setModalEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-charcoal/15 rounded-lg text-xs font-medium text-charcoal focus:border-ochre focus:outline-none"
                  />
                </div>
              </div>

              {/* 1. Active Project Confirmation */}
              <div className="p-3.5 bg-white rounded-2xl border border-charcoal/15 flex items-center justify-between gap-3 shadow-2xs">
                <div className="min-w-0">
                  <label htmlFor="modal-active-proj" className="text-xs font-bold text-charcoal block cursor-pointer">
                    Active Project Ready to Go Ahead
                  </label>
                  <span className="text-[11px] text-charcoal/50 block">
                    Confirm you have an active residential or commercial property ready for execution.
                  </span>
                </div>
                <input
                  id="modal-active-proj"
                  type="checkbox"
                  checked={hasActiveProject}
                  onChange={(e) => setHasActiveProject(e.target.checked)}
                  className="w-4 h-4 text-ochre accent-ochre rounded focus:ring-ochre cursor-pointer shrink-0"
                />
              </div>

              {/* 2. Address Capture with "Use My Current Location" button (Client-side) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-charcoal/70 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-ochre" />
                    <span>Project Location & Address <span className="text-ochre">*</span></span>
                  </label>

                  {/* "Use My Current Location" button (Client only) */}
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={detectingLocation}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-ochre hover:text-ochre-dark bg-ochre/10 hover:bg-ochre/20 px-2.5 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {detectingLocation ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Detecting GPS...</span>
                      </>
                    ) : (
                      <>
                        <MapPin className="w-3 h-3" />
                        <span>Use My Current Location</span>
                      </>
                    )}
                  </button>
                </div>

                <input
                  type="text"
                  required
                  value={locationAddress}
                  onChange={(e) => setLocationAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre text-charcoal shadow-xs"
                />

                {locationNotice && (
                  <p className="text-[11px] text-ochre-dark font-medium animate-fade-in">
                    {locationNotice}
                  </p>
                )}
              </div>

              {/* 3. Describe Their Project (Free Text) */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1">
                  Describe Your Project
                </label>
                <textarea
                  rows={3}
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre text-charcoal shadow-xs resize-none"
                />
              </div>

              {/* 4. Book a Site Visit & Desired Start Date */}
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

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-ochre" />
                    <span>Desired Project Start Date</span>
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

              {/* 5. Terms & Conditions Checkbox */}
              <div className="p-3.5 bg-ochre/10 rounded-2xl border border-ochre/25">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-ochre accent-ochre rounded focus:ring-ochre cursor-pointer shrink-0"
                  />
                  <span className="text-[11px] font-semibold text-charcoal leading-snug">
                    Site visit fee is 5,000 KES within Nairobi. Areas outside Nairobi are negotiable. <span className="text-ochre font-bold">*</span>
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
                  onClick={() => setIsProjectModalOpen(false)}
                  className="w-full sm:w-auto py-3 px-5 rounded-xl border border-charcoal/15 text-xs font-semibold text-charcoal/70 hover:bg-cream transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
