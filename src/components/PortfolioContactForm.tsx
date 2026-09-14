import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCMS } from '../hooks/useCMS';
import { 
  Send, 
  Phone, 
  Mail, 
  MapPin, 
  MessageSquare, 
  CheckCircle2, 
  Sparkles, 
  Clock,
  ArrowRight
} from 'lucide-react';

const PROJECT_TYPES = [
  'Full Residence Interior',
  'Living & Dining Room',
  'Kitchen & Custom Cabinetry',
  'Commercial / Boutique Office',
  'Interior Styling & Consultation'
];

export default function PortfolioContactForm() {
  const { content } = useCMS();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    projectType: PROJECT_TYPES[0],
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.name.trim() || !formData.email.trim()) {
      setErrorMessage('Please provide your name and email address.');
      return;
    }

    setSubmitting(true);
    try {
      // Save lead to inquiries collection in Firestore
      await addDoc(collection(db, 'inquiries'), {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || '',
        projectType: formData.projectType,
        message: formData.message.trim() || `Inquiry from Portfolio page for ${formData.projectType}.`,
        source: 'portfolio_page',
        status: 'new',
        createdAt: new Date().toISOString()
      });

      // Track Meta Pixel Lead event if present
      if (typeof (window as any).fbq === 'function') {
        try {
          (window as any).fbq('track', 'Lead', {
            content_name: 'Portfolio Page Contact Form',
            project_type: formData.projectType
          });
        } catch (fbErr) {
          console.warn('Meta Pixel event dispatch failed:', fbErr);
        }
      }

      setSubmitted(true);
    } catch (err: any) {
      console.error('Error submitting inquiry from portfolio:', err);
      setErrorMessage(err?.message || 'Something went wrong while submitting. Please try again or reach out on WhatsApp.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenWhatsApp = () => {
    const rawNumber = content.contact.whatsapp || '254714984268';
    const cleanNumber = rawNumber.replace(/[^0-9]/g, '');
    const waText = `Hello Pamnim Interior Designers! I was browsing your Portfolio and would like to discuss a project.\n\n*Name:* ${formData.name || 'Client'}\n*Project Type:* ${formData.projectType}\n*Notes:* ${formData.message || 'Consultation request'}`;
    const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(waText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <section id="portfolio-contact-section" className="mt-24 pt-16 border-t border-charcoal/10">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="bg-white rounded-[2.5rem] border border-charcoal/10 shadow-sm overflow-hidden p-8 sm:p-12 lg:p-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            
            {/* Left Column: Editorial Studio Invitation */}
            <div className="lg:col-span-5 space-y-8">
              <div>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-ochre/10 text-ochre text-xs font-bold uppercase tracking-widest mb-4">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Start Your Project</span>
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-sans font-bold text-charcoal tracking-tight leading-tight">
                  Love what you see in our portfolio?
                </h2>
                <p className="mt-4 text-sm sm:text-base text-charcoal/70 leading-relaxed">
                  Every home we design begins with an in-depth conversation about your lifestyle, spatial flow, and material preferences. Let us bring timeless bespoke craftsmanship to your space.
                </p>
              </div>

              {/* Direct Studio Highlights */}
              <div className="space-y-4 pt-2">
                <a
                  href={`tel:${content.contact.phone.replace(/[^0-9+]/g, '')}`}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-cream/50 hover:bg-cream border border-charcoal/5 transition-colors group"
                >
                  <div className="w-12 h-12 rounded-xl bg-white shadow-xs border border-charcoal/10 flex items-center justify-center text-ochre group-hover:scale-105 transition-transform">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-charcoal/50 uppercase tracking-wider">Direct Studio Line</p>
                    <p className="text-sm font-bold text-charcoal group-hover:text-ochre transition-colors">
                      {content.contact.phone || '+254 714 984 268'}
                    </p>
                  </div>
                </a>

                <a
                  href={`mailto:${content.contact.email}`}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-cream/50 hover:bg-cream border border-charcoal/5 transition-colors group"
                >
                  <div className="w-12 h-12 rounded-xl bg-white shadow-xs border border-charcoal/10 flex items-center justify-center text-ochre group-hover:scale-105 transition-transform">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-charcoal/50 uppercase tracking-wider">Design Inquiries</p>
                    <p className="text-sm font-bold text-charcoal truncate group-hover:text-ochre transition-colors">
                      {content.contact.email || 'hinteriors01@gmail.com'}
                    </p>
                  </div>
                </a>

                <div className="flex items-center gap-4 p-4 rounded-2xl bg-cream/50 border border-charcoal/5">
                  <div className="w-12 h-12 rounded-xl bg-white shadow-xs border border-charcoal/10 flex items-center justify-center text-ochre shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-charcoal/50 uppercase tracking-wider">Studio & Workshop</p>
                    <p className="text-sm font-bold text-charcoal">
                      {content.contact.address || 'Nairobi, Kenya'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-charcoal/5 flex items-center gap-3 text-xs text-charcoal/70">
                <Clock className="w-4 h-4 text-ochre shrink-0" />
                <span>We reply to all portfolio inquiries within 24 business hours.</span>
              </div>
            </div>

            {/* Right Column: Contact Inquiry Form */}
            <div className="lg:col-span-7 bg-cream/30 border border-charcoal/10 rounded-3xl p-6 sm:p-8 lg:p-10">
              {submitted ? (
                <div className="py-8 space-y-6 animate-fade-in text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-charcoal">Inquiry Received!</h3>
                    <p className="text-sm text-charcoal/70 mt-2 max-w-md mx-auto leading-relaxed">
                      Thank you <strong className="text-charcoal">{formData.name}</strong>. Our lead architectural designer will review your <strong className="text-charcoal">{formData.projectType}</strong> project and connect with you shortly.
                    </p>
                  </div>

                  <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={handleOpenWhatsApp}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#25D366] text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#20ba59] shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Chat on WhatsApp Now</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSubmitted(false);
                        setFormData({
                          name: '',
                          email: '',
                          phone: '',
                          projectType: PROJECT_TYPES[0],
                          message: ''
                        });
                      }}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl border border-charcoal/20 text-xs font-bold text-charcoal hover:bg-white transition-colors cursor-pointer"
                    >
                      Submit Another Inquiry
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="border-b border-charcoal/10 pb-4 mb-2">
                    <h3 className="text-xl font-bold text-charcoal">Tell Us About Your Project</h3>
                    <p className="text-xs text-charcoal/60 mt-1">Fill out the quick form below and our team will prepare tailored recommendations.</p>
                  </div>

                  {errorMessage && (
                    <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                      {errorMessage}
                    </div>
                  )}

                  {/* Name and Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="portfolio-form-name" className="block text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-1.5">
                        Your Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="portfolio-form-name"
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g. Wanjiku Kimani"
                        className="w-full p-3.5 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium text-charcoal placeholder:text-charcoal/30 focus:border-ochre focus:outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label htmlFor="portfolio-form-phone" className="block text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-1.5">
                        Phone / WhatsApp <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="portfolio-form-phone"
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="e.g. 0712 345 678"
                        className="w-full p-3.5 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium text-charcoal placeholder:text-charcoal/30 focus:border-ochre focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="portfolio-form-email" className="block text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-1.5">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="portfolio-form-email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="e.g. client@example.com"
                      className="w-full p-3.5 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium text-charcoal placeholder:text-charcoal/30 focus:border-ochre focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Project Type */}
                  <div>
                    <label htmlFor="portfolio-form-type" className="block text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-2">
                      Space or Project Type
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {PROJECT_TYPES.map((type) => {
                        const isSelected = formData.projectType === type;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, projectType: type }))}
                            className={`p-2.5 rounded-xl text-left text-xs font-semibold border transition-all cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'bg-ochre text-white border-ochre shadow-xs'
                                : 'bg-white text-charcoal/70 border-charcoal/15 hover:border-charcoal/30'
                            }`}
                          >
                            <span className="truncate">{type}</span>
                            {isSelected && <span className="text-xs">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Message */}
                  <div>
                    <label htmlFor="portfolio-form-message" className="block text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-1.5">
                      Project Details or Scope (Optional)
                    </label>
                    <textarea
                      id="portfolio-form-message"
                      rows={3}
                      value={formData.message}
                      onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                      placeholder="Share your space location (e.g. Karen, Westlands), approximate timeline, or particular aesthetic preferences..."
                      className="w-full p-3.5 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium text-charcoal placeholder:text-charcoal/30 focus:border-ochre focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <p className="text-[11px] text-charcoal/50">
                      Your privacy is respected. No spam, only architectural consultation.
                    </p>

                    <button
                      id="portfolio-form-submit-btn"
                      type="submit"
                      disabled={submitting}
                      className="px-8 py-3.5 rounded-xl bg-ochre hover:bg-ochre-dark text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-ochre/20 transition-all disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {submitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Sending Inquiry...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit Project Inquiry</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
