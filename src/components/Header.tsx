import { useState, useEffect } from 'react';
import { Sparkle, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import { useCMS } from '../hooks/useCMS';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const { user } = useAuth();
  const { content } = useCMS();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? 'bg-cream/90 backdrop-blur-md py-4 shadow-sm' : 'bg-transparent py-6'}`}>
      <div className="max-w-7xl mx-auto px-6 md:px-12 flex justify-between items-center text-charcoal transition-colors">
        {/* Logo */}
        <Link to="/" id="logo" className={`flex items-center gap-2 group cursor-pointer transition-colors ${isScrolled ? 'text-charcoal' : 'text-white'}`}>
          <Sparkle className={`w-6 h-6 transition-transform duration-300 group-hover:rotate-12 ${isScrolled ? 'text-ochre' : 'text-ochre-light'}`} />
          <span className="font-serif text-xl md:text-2xl font-bold tracking-tight">Pamnim Interiors</span>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <Link to="/" className={`font-bold text-sm uppercase tracking-widest transition-colors ${isScrolled ? 'text-charcoal hover:text-ochre' : 'text-white hover:text-ochre-light'}`}>Home</Link>
          <Link to="/portfolio" className={`font-bold text-sm uppercase tracking-widest transition-colors ${isScrolled ? 'text-charcoal hover:text-ochre' : 'text-white hover:text-ochre-light'}`}>Portfolio</Link>
          <Link to="/contact" className={`font-bold text-sm uppercase tracking-widest transition-colors ${isScrolled ? 'text-charcoal hover:text-ochre' : 'text-white hover:text-ochre-light'}`}>Contact</Link>
          {user && (
            <Link to="/dashboard" className={`font-bold text-sm uppercase tracking-widest transition-colors ${isScrolled ? 'text-charcoal hover:text-ochre' : 'text-white hover:text-ochre-light'}`}>Dashboard</Link>
          )}
        </nav>

        {/* Contact & Auth */}
        <div id="contact-header" className="flex items-center gap-6">
          <div className="hidden lg:flex items-center gap-4 border-r border-charcoal/10 pr-6 mr-2">
            <div className={`flex items-center gap-2 transition-colors duration-300 ${isScrolled ? 'text-charcoal' : 'text-white'}`}>
              <Phone className="w-5 h-5 text-ochre" />
              <a href={`tel:${content.contact.phone.replace(/\s/g, '')}`} className="font-bold text-sm">{content.contact.phone}</a>
            </div>
            <a 
              href={`https://wa.me/${content.contact.whatsapp}?text=Hello%20Pamnim%20Interiors!%20I'd%20like%20to%20book%20a%20consultation.`}
              target="_blank" 
              rel="noreferrer"
              className="bg-ochre hover:bg-charcoal text-white text-[10px] uppercase tracking-tighter px-3 py-1 rounded font-black transition-all"
            >
              Book Consult
            </a>
          </div>
          
          <Link 
            to={user ? "/dashboard" : "/login"}
            className={cn(
              "px-6 py-2 rounded-full font-bold text-sm transition-all",
              isScrolled 
                ? "bg-charcoal text-white hover:bg-ochre" 
                : "bg-white text-charcoal hover:bg-ochre hover:text-white"
            )}
          >
            {user ? "Portal" : "Sign In"}
          </Link>
          {!user && (
            <Link 
              to="/signup"
              className={cn(
                "hidden sm:block px-6 py-2 rounded-full font-bold text-sm border transition-all",
                isScrolled 
                  ? "border-charcoal text-charcoal hover:bg-charcoal hover:text-white" 
                  : "border-white text-white hover:bg-white hover:text-charcoal"
              )}
            >
              Sign Up
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
