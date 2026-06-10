import { useState, useEffect } from 'react';
import { Sparkle, Phone, Menu, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import { useCMS } from '../hooks/useCMS';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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

  // Lock body scroll of main page when mobile overlay drawer is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // Close mobile drawer dynamically when the active route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const [isAdmin, setIsAdmin] = useState(false);

  // Monitor live session and check if the user is the administrator
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      const adminEmails = ['jessescaledyou@gmail.com', 'your-admin-email@example.com'];
      if (currentUser && currentUser.email && adminEmails.includes(currentUser.email.toLowerCase().trim())) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const headerBg = isScrolled 
    ? 'bg-cream/95 backdrop-blur-md py-4 shadow-sm' 
    : (isHomePage ? 'bg-transparent py-6' : 'bg-cream/50 backdrop-blur-sm py-6 border-b border-charcoal/5');

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' },
    { name: 'Portfolio', path: '/portfolio' },
    { name: 'Contact', path: '/contact' }
  ];

  return (
    <>
      <header className={cn("fixed top-0 left-0 right-0 z-50 transition-all duration-500", headerBg)}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 flex justify-between items-center text-charcoal transition-colors">
          {/* Logo */}
          <Link to="/" id="logo" className={cn("flex items-center gap-2 group cursor-pointer transition-colors shrink-0", displayLight ? "text-white" : "text-charcoal")}>
            <Sparkle className={cn("w-5 h-5 md:w-6 md:h-6 transition-transform duration-300 group-hover:rotate-12", displayLight ? "text-ochre-light" : "text-ochre")} />
            <span className="font-serif text-lg xs:text-xl md:text-2xl font-bold tracking-tight">Pamnim Interiors</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link 
                key={link.path}
                to={link.path} 
                className={cn(
                  "font-bold text-sm uppercase tracking-widest transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:bg-ochre after:transition-all hover:after:w-full", 
                  displayLight ? "text-white hover:text-ochre-light" : "text-charcoal hover:text-ochre",
                  location.pathname === link.path && (displayLight ? "text-ochre-light after:w-full" : "text-ochre after:w-full")
                )}
              >
                {link.name}
              </Link>
            ))}
            {isAdmin && (
              <Link 
                to="/admin" 
                id="cmd-dashboard-desktop"
                className={cn(
                  "font-bold text-xs uppercase tracking-[0.2em] transition-all relative py-1", 
                  displayLight ? "text-white/80 hover:text-white" : "text-charcoal/80 hover:text-charcoal"
                )}
              >
                ✦ COMMAND DASHBOARD
              </Link>
            )}
          </nav>

          {/* Contact Actions Section */}
          <div id="contact-header" className="flex items-center gap-2 sm:gap-4 md:gap-6">
            {/* Desktop Only Phone Number Label */}
            <div className={cn("hidden lg:flex items-center gap-2 transition-colors duration-300", displayLight ? "text-white" : "text-charcoal")}>
              <Phone className="w-4 h-4 text-ochre" />
              <a href={`tel:${content.contact.phone.replace(/\s/g, '')}`} className="font-bold text-sm hover:text-ochre transition-colors">{content.contact.phone}</a>
            </div>

            {/* Always visible "Book Consult" action button */}
            <a 
              href={`https://wa.me/${content.contact.whatsapp}?text=Hello%20Pamnim%20Interiors!%20I'd%20like%20to%20book%20a%20consultation.`}
              target="_blank" 
              rel="noreferrer"
              className="bg-ochre hover:bg-charcoal text-white text-[10px] sm:text-xs uppercase tracking-wider px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-bold transition-all text-center min-h-[36px] flex items-center shadow-sm shadow-ochre/15"
            >
              Book Consult
            </a>

            {/* Mobile Hamburg Toggle Button: Min 44x44px Touch Target for optimal ergonomics */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={cn(
                "md:hidden flex items-center justify-center w-11 h-11 rounded-full border transition-all cursor-pointer",
                displayLight 
                  ? "border-white/20 text-white hover:bg-white/10" 
                  : "border-charcoal/10 text-charcoal hover:bg-charcoal/5"
              )}
              aria-label="Toggle Navigation Menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Luxury Animated Drawer Navigation Menu for All Mobile Devices */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Sleek Darkened Overlay Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            />

            {/* Slide-out Menu Drawer Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-cream z-50 shadow-2xl p-8 flex flex-col justify-between md:hidden"
            >
              {/* Drawer Top Header with Branding & Close */}
              <div>
                <div className="flex justify-between items-center mb-12">
                  <div className="flex items-center gap-2">
                    <Sparkle className="w-5 h-5 text-ochre" />
                    <span className="font-serif text-xl font-bold text-charcoal">Pamnim</span>
                  </div>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-center w-11 h-11 text-charcoal/60 hover:text-charcoal border border-charcoal/5 hover:bg-charcoal/5 rounded-full transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Vertical Column Action Links */}
                <nav className="flex flex-col gap-6">
                  {navLinks.map((link, i) => (
                    <motion.div
                      key={link.path}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                    >
                      <Link
                        to={link.path}
                        className={cn(
                          "font-serif text-3xl font-medium tracking-tight block py-2 transition-colors",
                          location.pathname === link.path 
                            ? "text-ochre font-bold pl-2 border-l-4 border-ochre" 
                            : "text-charcoal/70 hover:text-charcoal"
                        )}
                      >
                        {link.name}
                      </Link>
                    </motion.div>
                  ))}
                  {isAdmin && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: navLinks.length * 0.08 }}
                    >
                      <Link
                        to="/admin"
                        className="font-bold text-xs uppercase tracking-[0.2em] text-ochre/80 hover:text-ochre transition-colors block py-2"
                      >
                        ✦ COMMAND DASHBOARD
                      </Link>
                    </motion.div>
                  )}
                </nav>
              </div>

              {/* Drawer Footer Contact card */}
              <div className="border-t border-charcoal/10 pt-8 mt-auto space-y-6">
                <div>
                  <span className="text-[10px] font-bold tracking-[0.2em] text-charcoal/40 uppercase block mb-3">GET IN TOUCH</span>
                  <div className="flex items-center gap-3 text-charcoal font-medium">
                    <Phone className="w-5 h-5 text-ochre shrink-0" />
                    <a href={`tel:${content.contact.phone.replace(/\s/g, '')}`} className="text-lg font-semibold hover:text-ochre transition-colors">
                      {content.contact.phone}
                    </a>
                  </div>
                </div>

                <div className="bg-charcoal/5 p-4 rounded-2xl">
                  <p className="text-xs text-charcoal/60 leading-relaxed mb-3">
                    Located at EDC Patto Plaza, Goa, near Central Library. Come visit our studio for materials consultations.
                  </p>
                  <a
                    href={`https://wa.me/${content.contact.whatsapp}?text=Hello%20Pamnim%20Interiors!%20I'd%20like%20to%20schedule%20a%20personal%20meeting.`}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-center w-full py-2.5 px-4 bg-charcoal hover:bg-ochre text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all"
                  >
                    WhatsApp Studio
                  </a>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
