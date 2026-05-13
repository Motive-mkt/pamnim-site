import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Star, Check, Send } from 'lucide-react';
import { useCMS } from '../hooks/useCMS';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Hero() {
  const { content } = useCMS();
  const hero = content.hero;
  const contact = content.contact;

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    projectType: 'Residential Design',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'inquiries'), {
        name: formData.name,
        email: 'Provided via Hero Form',
        phone: formData.phone,
        projectType: formData.projectType,
        message: formData.message || "Consultation requested from Hero form",
        status: 'new',
        createdAt: new Date().toISOString()
      });

      const waMessage = `Hello Pamnim Interiors! I'd like to book a consultation.\n\n*Name:* ${formData.name}\n*Phone:* ${formData.phone}\n*Project:* ${formData.projectType}\n*Message:* ${formData.message || 'Consultation requested'}`;
      const whatsappUrl = `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(waMessage)}`;
      window.open(whatsappUrl, '_blank');
      setSubmitted(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="relative min-h-screen flex items-center pt-20">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=80&w=2000"
          alt="Modern luxury interior by Pamnim Interiors"
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-black/50" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 grid lg:grid-cols-2 gap-12 items-center w-full">
        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-white"
        >
          <div id="badge" className="inline-flex items-center gap-2 bg-ochre/20 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 mb-6">
            <Star className="w-4 h-4 fill-ochre text-ochre" />
            <span className="text-xs font-bold tracking-widest uppercase">★ RATED 5.0 BY CLIENTS</span>
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] mb-6">
            {hero.title.split(hero.highlightWord || 'home.').map((part, i, arr) => (
              <span key={i}>
                {part}
                {i < arr.length - 1 && <span className="text-ochre">{hero.highlightWord || 'home.'}</span>}
              </span>
            ))}
          </h1>

          <p className="text-lg md:text-xl text-white/90 mb-8 max-w-lg leading-relaxed">
            {hero.subheadline}
          </p>

          <ul className="space-y-4 mb-10">
            {['Free consultation', 'Bespoke styling', 'On-time delivery'].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-ochre flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-medium">{item}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Lead Gen Form */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="bg-white rounded-2xl p-8 shadow-2xl max-w-md mx-auto lg:ml-auto"
        >
          {submitted ? (
            <div className="py-10 text-center space-y-4">
              <div className="w-16 h-16 bg-ochre/10 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-ochre" />
              </div>
              <h2 className="text-2xl font-bold text-charcoal">Request Sent!</h2>
              <p className="text-charcoal/60">We'll be in touch soon.</p>
              <button onClick={() => setSubmitted(false)} className="text-ochre font-bold underline text-sm">Send another request</button>
            </div>
          ) : (
            <>
              <h2 className="text-2xl text-charcoal font-bold mb-2">Book your free consultation</h2>
              <p className="text-charcoal/60 mb-6 text-sm">Tell us about your space — we'll respond within 24 hours.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-charcoal/40 mb-1">Full Name</label>
                  <input
                    type="text" required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Jane Doe"
                    className="w-full px-4 py-3 bg-cream border border-charcoal/10 rounded-lg focus:outline-none focus:border-ochre transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-charcoal/40 mb-1">Phone Number</label>
                  <input
                    type="tel" required
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="07XX XXX XXX"
                    className="w-full px-4 py-3 bg-cream border border-charcoal/10 rounded-lg focus:outline-none focus:border-ochre transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-charcoal/40 mb-1">Project Type</label>
                  <select 
                    value={formData.projectType}
                    onChange={(e) => setFormData({...formData, projectType: e.target.value})}
                    className="w-full px-4 py-3 bg-cream border border-charcoal/10 rounded-lg focus:outline-none focus:border-ochre transition-colors appearance-none"
                  >
                    <option>Residential Design</option>
                    <option>Space Styling</option>
                    <option>Renovation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-charcoal/40 mb-1">Tell Us More (Optional)</label>
                  <textarea
                    rows={3}
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                    placeholder="Briefly describe your vision..."
                    className="w-full px-4 py-3 bg-cream border border-charcoal/10 rounded-lg focus:outline-none focus:border-ochre transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-ochre disabled:opacity-50 hover:bg-ochre/90 text-white font-bold py-4 rounded-lg transition-all duration-300 shadow-lg shadow-ochre/20 flex items-center justify-center gap-2 group"
                >
                  {submitting ? "Sending..." : "Get Started"}
                  <motion.span
                    animate={{ x: [0, 5, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    →
                  </motion.span>
                </button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </section>
  );
}
