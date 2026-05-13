import { Phone, Sparkle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useCMS } from '../hooks/useCMS';

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
            Book a free consultation today. We'll discuss your vision, budget and timeline — no obligations.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <a
              href={`tel:${content.contact.phone.replace(/\s/g, '')}`}
              className="w-full sm:w-auto bg-ochre hover:bg-ochre/90 text-white px-10 py-5 rounded-full font-bold flex items-center justify-center gap-3 transition-all duration-300 transform hover:-translate-y-1"
            >
              <Phone className="w-5 h-5" />
              Call {content.contact.phone}
            </a>
            <Link 
              to={user ? "/dashboard" : "/login"}
              className="w-full sm:w-auto bg-transparent border border-white/20 hover:border-white/40 text-white px-10 py-5 rounded-full font-bold transition-all duration-300 flex items-center justify-center gap-2"
            >
              {user ? "View My Dashboard" : "Client Portal"} →
            </Link>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid md:grid-cols-3 gap-12 py-16 border-y border-white/10">
          <div id="footer-call">
            <p className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase mb-4">CALL US</p>
            <p className="text-2xl font-serif font-medium">{content.contact.phone}</p>
          </div>
          <div id="footer-hours">
            <p className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase mb-4">EMAIL</p>
            <p className="text-2xl font-serif font-medium truncate">{content.contact.email}</p>
          </div>
          <div id="footer-area">
            <p className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase mb-4">SERVICE AREA</p>
            <p className="text-2xl font-serif font-medium">{content.contact.address}</p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-12 flex flex-col md:flex-row justify-between items-center gap-6 opacity-40">
          <div className="flex items-center gap-2">
            <Sparkle className="w-5 h-5 text-ochre-light" />
            <span className="font-serif text-lg font-bold">Pamnim Interiors</span>
          </div>
          <p className="text-sm">© 2026 Pamnim Interiors. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
