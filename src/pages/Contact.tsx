import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Mail, Phone, MapPin } from 'lucide-react';
import { useCMS } from '../hooks/useCMS';
import LeadQualifyingForm from '../components/LeadQualifyingForm';

export default function ContactPage() {
  const { content } = useCMS();

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
            <div className="w-full">
              <LeadQualifyingForm
                variant="card"
                source="contact_page"
                title="Send a message or launch a project"
                subtitle="Whether you have an upcoming property renovation or a simple inquiry, we are here to help."
              />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
