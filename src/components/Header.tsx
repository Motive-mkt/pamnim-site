import { useState, useEffect } from 'react';
import { Sparkle, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const { user } = useAuth();

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
        <div id="logo" className={`flex items-center gap-2 group cursor-pointer transition-colors ${isScrolled ? 'text-charcoal' : 'text-white'}`}>
          <Sparkle className={`w-6 h-6 transition-transform duration-300 group-hover:rotate-12 ${isScrolled ? 'text-ochre' : 'text-ochre-light'}`} />
          <span className="font-serif text-xl md:text-2xl font-bold tracking-tight">Pamnim Interiors</span>
        </div>

        {/* Contact & Auth */}
        <div id="contact-header" className="flex items-center gap-6">
          <div className={`flex items-center gap-2 transition-colors duration-300 ${isScrolled ? 'text-charcoal hover:text-ochre' : 'text-white hover:text-ochre-light'}`}>
            <Phone className="w-5 h-5" />
            <a href="tel:0714984268" className="font-medium text-sm md:text-base">
              0714 984 268
            </a>
          </div>
          
          <Link 
            to={user ? "/dashboard" : "/login"}
            className={cn(
              "px-6 py-2 rounded-full font-bold text-sm transition-all",
              isScrolled 
                ? "bg-ochre text-white hover:bg-charcoal" 
                : "bg-white/10 text-white border border-white/20 hover:bg-white/20"
            )}
          >
            {user ? "Dashboard" : "Sign In"}
          </Link>
        </div>
      </div>
    </header>
  );
}
