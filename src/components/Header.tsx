import { useState, useEffect } from 'react';
import { Sparkle, Phone } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import { useCMS } from '../hooks/useCMS';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const { user } = useAuth();
  const { content } = useCMS();
  const location = useLocation();

  const isHomePage = location.pathname === '/';
  const displayLight = !isScrolled && isHomePage;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const headerBg = isScrolled 
    ? 'bg-cream/90 backdrop-blur-md py-4 shadow-sm' 
    : (isHomePage ? 'bg-transparent py-6' : 'bg-cream/50 backdrop-blur-sm py-6 border-b border-charcoal/5');

  return (
    <header className={cn("fixed top-0 left-0 right-0 z-50 transition-all duration-500", headerBg)}>
      <div className="max-w-7xl mx-auto px-6 md:px-12 flex justify-between items-center text-charcoal transition-colors">
        {/* Logo */}
        <Link to="/" id="logo" className={cn("flex items-center gap-2 group cursor-pointer transition-colors", displayLight ? "text-white" : "text-charcoal")}>
          <Sparkle className={cn("w-6 h-6 transition-transform duration-300 group-hover:rotate-12", displayLight ? "text-ochre-light" : "text-ochre")} />
          <span className="font-serif text-xl md:text-2xl font-bold tracking-tight">Pamnim Interiors</span>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <Link to="/" className={cn("font-bold text-sm uppercase tracking-widest transition-colors", displayLight ? "text-white hover:text-ochre-light" : "text-charcoal hover:text-ochre")}>Home</Link>
          <Link to="/services" className={cn("font-bold text-sm uppercase tracking-widest transition-colors", displayLight ? "text-white hover:text-ochre-light" : "text-charcoal hover:text-ochre")}>Services</Link>
          <Link to="/portfolio" className={cn("font-bold text-sm uppercase tracking-widest transition-colors", displayLight ? "text-white hover:text-ochre-light" : "text-charcoal hover:text-ochre")}>Portfolio</Link>
          <Link to="/contact" className={cn("font-bold text-sm uppercase tracking-widest transition-colors", displayLight ? "text-white hover:text-ochre-light" : "text-charcoal hover:text-ochre")}>Contact</Link>
          {user && (
            <Link to="/dashboard" className={cn("font-bold text-sm uppercase tracking-widest transition-colors", displayLight ? "text-white hover:text-ochre-light" : "text-charcoal hover:text-ochre")}>Dashboard</Link>
          )}
        </nav>

        {/* Contact & Auth */}
        <div id="contact-header" className="flex items-center gap-6">
          <div className="hidden lg:flex items-center gap-4 border-r border-charcoal/10 pr-6 mr-2">
            <div className={cn("flex items-center gap-2 transition-colors duration-300", displayLight ? "text-white" : "text-charcoal")}>
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
              displayLight 
                ? "bg-white text-charcoal hover:bg-ochre hover:text-white" 
                : "bg-charcoal text-white hover:bg-ochre"
            )}
          >
            {user ? "Portal" : "Sign In"}
          </Link>
          {!user && (
            <Link 
              to="/signup"
              className={cn(
                "hidden sm:block px-6 py-2 rounded-full font-bold text-sm border transition-all",
                displayLight 
                  ? "border-white text-white hover:bg-white hover:text-charcoal" 
                  : "border-charcoal text-charcoal hover:bg-charcoal hover:text-white"
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
