import React, { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Mail, Phone, MapPin, Send, CheckCircle2 } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCMS } from '../hooks/useCMS';

export default function ContactPage() {
  const { content } = useCMS();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    projectType: 'Residential Interior',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Save to Firestore for owner's history/dashboard
      await addDoc(collection(db, 'inquiries'), {
        ...formData,
        status: 'new',
        createdAt: new Date().toISOString()
      });

      // Prepare WhatsApp Redirect
      const phoneNumber = content.contact.whatsapp;
      const waMessage = `Hello Pamnim Interiors! I'm interested in a project.\n\n*Name:* ${formData.name}\n*Email:* ${formData.email}\n*Project:* ${formData.projectType}\n*Message:* ${formData.message}`;
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(waMessage)}`;
      
      // Open WhatsApp in new tab
      window.open(whatsappUrl, '_blank');
      
      setSubmitted(true);
    } catch (err) {
      console.error("Error submitting inquiry:", err);
      alert("Something went wrong. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream">
      <Header />
      
      <main className="pt-32 pb-24">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            {/* Info */}
            <div>
              <span className="text-xs font-bold tracking-[0.2em] text-ochre uppercase mb-4 block">CONTACT US</span>
              <h1 className="text-5xl md:text-6xl font-sans font-bold mb-8">Let's talk about your space.</h1>
              <p className="text-lg text-charcoal/60 mb-12 max-w-md">
                We're ready to help you transform your vision into a reality. Reach out to us through any of these channels.
              </p>

              <div className="space-y-8">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-charcoal/5">
                    <Phone className="w-6 h-6 text-ochre" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-charcoal/40 uppercase mb-1">Call Us</p>
                    <p className="text-xl font-bold">{content.contact.phone}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-charcoal/5">
                    <Mail className="w-6 h-6 text-ochre" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-charcoal/40 uppercase mb-1">Email Us</p>
                    <p className="text-xl font-bold truncate max-w-[250px]">{content.contact.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-charcoal/5">
                    <MapPin className="w-6 h-6 text-ochre" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-charcoal/40 uppercase mb-1">Visit Us</p>
                    <p className="text-xl font-bold">{content.contact.address}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="bg-white p-10 md:p-16 rounded-[3rem] shadow-xl shadow-ochre/5 border border-charcoal/5">
              {submitted ? (
                <div className="py-20 text-center space-y-6">
                  <div className="w-20 h-20 bg-ochre/10 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10 text-ochre" />
                  </div>
                  <h2 className="text-3xl font-bold">Message Sent!</h2>
                  <p className="text-lg text-charcoal/60">Thank you for reaching out. We'll get back to you within 24 hours.</p>
                  <button 
                    onClick={() => setSubmitted(false)}
                    className="text-ochre font-bold underline"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="text-3xl font-bold mb-8">Send a message</h2>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-charcoal/40">Your Name</label>
                        <input 
                          type="text" required
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          className="w-full bg-cream border-none p-5 rounded-2xl focus:ring-2 focus:ring-ochre outline-none" placeholder="John Doe" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-charcoal/40">Email Address</label>
                        <input 
                          type="email" required
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          className="w-full bg-cream border-none p-5 rounded-2xl focus:ring-2 focus:ring-ochre outline-none" placeholder="john@example.com" 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-charcoal/40">Project Type</label>
                      <select 
                        value={formData.projectType}
                        onChange={(e) => setFormData({...formData, projectType: e.target.value})}
                        className="w-full bg-cream border-none p-5 rounded-2xl focus:ring-2 focus:ring-ochre outline-none appearance-none"
                      >
                        <option>Residential Interior</option>
                        <option>Commercial Space</option>
                        <option>Outdoor Living</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-charcoal/40">Message</label>
                      <textarea 
                        rows={4} required
                        value={formData.message}
                        onChange={(e) => setFormData({...formData, message: e.target.value})}
                        className="w-full bg-cream border-none p-5 rounded-2xl focus:ring-2 focus:ring-ochre outline-none" placeholder="Tell us about your project..."
                      ></textarea>
                    </div>
                    <button 
                      disabled={submitting}
                      className="w-full bg-ochre disabled:opacity-50 hover:bg-charcoal text-white font-bold py-6 rounded-2xl transition-all shadow-lg shadow-ochre/20 flex items-center justify-center gap-2"
                    >
                      {submitting ? "Sending..." : (
                        <>
                          <Send className="w-5 h-5" />
                          Send Inquiry
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
