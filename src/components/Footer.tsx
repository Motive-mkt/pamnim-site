import { Phone, Sparkle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useCMS } from '../hooks/useCMS';
import { getOptimizedImageUrl } from '../lib/utils';

export default function Footer() {
  const { user } = useAuth();
  const { content } = useCMS();
  return (
    <footer className="pt-24 pb-12 bg-charcoal text-white">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        {/* CTA Section */}
        <div id="footer-cta" className="mb-24 text-center">
          <span className="text-xs font-bold tracking-[0.2em] text-ochre uppercase mb-4 block">READY WHEN YOU ARE</span>
          <h2 className="text-5xl md:text-7xl font-bold mb-8 max-w-4xl mx-auto leading-tight">
            Let's design a home you'll love coming back to.
          </h2>
          <p className="text-xl text-white/60 mb-12 max-w-2xl mx-auto leading-relaxed">
            Book a free consultation today. We'll discuss your vision, budget and timeline with no obligations.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <a
              href={`tel:${content.contact.phone.replace(/\s/g, '')}`}
              className="w-full sm:w-auto bg-ochre hover:bg-ochre/90 text-white px-10 py-5 rounded-full font-bold flex items-center justify-center gap-3 transition-all duration-300 transform hover:-translate-y-1"
            >
              <Phone className="w-5 h-5" />
              Call {content.contact.phone}
            </a>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid md:grid-cols-12 gap-12 py-16 border-y border-white/10">
          <div id="footer-call" className="md:col-span-3">
            <p className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase mb-4">CALL US</p>
            <p className="text-2xl font-serif font-medium">{content.contact.phone}</p>
          </div>
          <div id="footer-hours" className="md:col-span-3">
            <p className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase mb-4">EMAIL DIRECT</p>
            <p className="text-2xl font-serif font-medium truncate">{content.contact.email}</p>
          </div>
          <div id="footer-area" className="md:col-span-6">
            <p className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase mb-4">STUDIO ADDRESS & LANDMARKS</p>
            <p className="text-lg font-serif font-medium leading-relaxed mb-2">
              Office No. 229, 2nd Floor, Gera's Imperium Star, EDC Patto Plaza, Panaji, Goa 403001
            </p>
            <p className="text-xs text-ochre font-sans tracking-wide">
              Located right next to the Central Library in the EDC Patto Plaza / Patto Centre commercial hub.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-12 flex flex-col md:flex-row justify-between items-center gap-6">
          <Link to="/" className="flex items-center gap-2 group transition-all duration-300">
            {content?.logoUrl ? (
              <div className="bg-white/95 px-3 py-1.5 rounded-xl shadow-sm backdrop-blur-sm flex items-center justify-center group-hover:bg-white transition-colors">
                <img 
                  src={getOptimizedImageUrl(content.logoUrl, 200)} 
                  alt="Company Logo" 
                  className="h-8 w-auto object-contain transition-transform duration-300 group-hover:scale-105" 
                  referrerPolicy="no-referrer"
                  loading="eager"
                />
              </div>
            ) : (
              <div className="h-8 px-3 rounded-lg border border-dashed border-white/20 bg-white/5 flex items-center gap-1.5 text-xs text-white/50 font-medium">
                <Sparkle className="w-3.5 h-3.5 text-ochre/70" />
                <span>Logo Placeholder</span>
              </div>
            )}
          </Link>
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-sm text-white/40">
            <p>© 2026 Pamnim Interiors. All rights reserved.</p>
            <span className="hidden sm:inline h-3 w-[1px] bg-white/10" />
            <Link to="/login" className="hover:text-white transition-colors duration-300 font-sans tracking-wide">
              Client Portal
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
