import { useState, useEffect, useRef } from 'react';
import { Phone, Menu, X, ChevronDown, LogOut, LayoutDashboard } from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { cn, getOptimizedImageUrl } from '../lib/utils';
import { useCMS } from '../hooks/useCMS';
import { auth } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import NotificationCenter from './NotificationCenter';

const NAV_LINKS = [
  { name: 'Home', path: '/' },
  { name: 'Services', path: '/services' },
  { name: 'Portfolio', path: '/portfolio' },
  { name: 'Contact', path: '/contact' }
];

/** Text wordmark used until a logo has been uploaded, so the header never shows a placeholder box */
function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex flex-col leading-none', className)}>
      <span className="font-serif text-[26px] font-semibold tracking-tight text-charcoal">pamnim</span>
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ochre">Interior Designers</span>
    </span>
  );
}

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const { user, isStaff, profile } = useAuth();
  const { content, loading } = useCMS();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock page scroll while the mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // Close menus when the route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsAccountOpen(false);
  }, [location.pathname]);

  // Close the account menu on outside click or Escape
  useEffect(() => {
    if (!isAccountOpen && !isMobileMenuOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (isAccountOpen && accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setIsAccountOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAccountOpen(false);
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [isAccountOpen, isMobileMenuOpen]);

  const getDashboardDestination = () => {
    if (!profile) return '/login';
    if (profile.role === 'owner') return '/admin';
    if (profile.role === 'client') return '/client-portal';
    if (profile.role === 'worker') return '/dashboard';
    return isStaff ? '/admin' : '/dashboard';
  };

  const getDashboardText = () => {
    if (profile?.role === 'owner') return 'Admin dashboard';
    if (profile?.role === 'client') return 'Client portal';
    if (profile?.role === 'worker') return 'Worker dashboard';
    return 'Dashboard';
  };

  const handleSignOut = async () => {
    setIsAccountOpen(false);
    setIsMobileMenuOpen(false);
    await auth.signOut();
    navigate('/');
  };

  const phone = content.contact.phone;
  const phoneHref = `tel:${phone.replace(/\s/g, '')}`;
  const bookHref = `https://wa.me/${content.contact.whatsapp}?text=${encodeURIComponent("Hello Pamnim Interiors, I'd like to book a consultation.")}`;
  const initial = (profile?.name || user?.email || 'U').charAt(0).toUpperCase();

  const logo = loading ? (
    <div className="h-10 w-32 rounded-md bg-charcoal/10 animate-pulse" aria-hidden="true" />
  ) : content?.logoUrl ? (
    <img
      src={getOptimizedImageUrl(content.logoUrl, 250)}
      alt="Pamnim Interior Designers"
      className="h-10 md:h-11 w-auto object-contain"
      referrerPolicy="no-referrer"
      loading="eager"
      fetchPriority="high"
    />
  ) : (
    <Wordmark />
  );

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 bg-cream/95 backdrop-blur border-b transition-shadow duration-200',
          isScrolled ? 'border-charcoal/10 shadow-sm' : 'border-charcoal/[0.07]'
        )}
      >
        <div className="container-x flex h-[72px] items-center justify-between gap-6">
          <Link to="/" id="logo" className="flex shrink-0 items-center" aria-label="Pamnim Interior Designers, home">
            {logo}
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center gap-9" aria-label="Main">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                end={link.path === '/'}
                className={({ isActive }) =>
                  cn(
                    'relative py-2 text-[15px] font-medium transition-colors',
                    'after:absolute after:inset-x-0 after:-bottom-px after:h-px after:origin-left after:scale-x-0 after:bg-ochre after:transition-transform after:duration-200',
                    isActive
                      ? 'text-charcoal after:scale-x-100'
                      : 'text-charcoal/70 hover:text-charcoal hover:after:scale-x-100'
                  )
                }
              >
                {link.name}
              </NavLink>
            ))}
          </nav>

          <div id="contact-header" className="flex items-center gap-2 sm:gap-3">
            <a
              href={phoneHref}
              className="hidden xl:flex items-center gap-2 pr-2 text-sm font-medium text-charcoal/80 hover:text-ochre"
            >
              <Phone className="h-4 w-4 text-ochre" aria-hidden="true" />
              {phone}
            </a>

            {user && <NotificationCenter buttonClassName="border-charcoal/15 text-charcoal hover:bg-charcoal/5" />}

            {user ? (
              <div className="relative hidden md:block" ref={accountRef}>
                <button
                  type="button"
                  onClick={() => setIsAccountOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={isAccountOpen}
                  className="flex h-11 items-center gap-2 rounded-lg border border-charcoal/15 pl-1.5 pr-2.5 text-sm font-medium text-charcoal hover:bg-charcoal/[0.04]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-charcoal text-xs font-semibold text-white">
                    {initial}
                  </span>
                  <span className="hidden lg:inline max-w-[9rem] truncate">{profile?.name?.split(' ')[0] || 'Account'}</span>
                  <ChevronDown className={cn('h-4 w-4 text-charcoal/60 transition-transform', isAccountOpen && 'rotate-180')} aria-hidden="true" />
                </button>

                <AnimatePresence>
                  {isAccountOpen && (
                    <motion.div
                      role="menu"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-charcoal/10 bg-white py-1.5 shadow-lg"
                    >
                      <div className="border-b border-charcoal/10 px-4 pb-2.5 pt-2">
                        <p className="truncate text-sm font-semibold text-charcoal">{profile?.name || 'Signed in'}</p>
                        <p className="truncate text-xs capitalize text-charcoal/65">{profile?.role?.replace('_', ' ')}</p>
                      </div>
                      <Link
                        to={getDashboardDestination()}
                        id="cmd-dashboard-desktop"
                        role="menuitem"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-charcoal hover:bg-cream"
                      >
                        <LayoutDashboard className="h-4 w-4 text-ochre" aria-hidden="true" />
                        {getDashboardText()}
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-charcoal hover:bg-cream"
                      >
                        <LogOut className="h-4 w-4 text-charcoal/60" aria-hidden="true" />
                        Sign out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                to="/login"
                className="hidden md:inline-flex h-11 items-center px-3 text-sm font-medium text-charcoal/70 hover:text-charcoal"
              >
                Sign in
              </Link>
            )}

            <a
              href={bookHref}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary btn-sm hidden sm:inline-flex"
            >
              Book a consultation
            </a>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((o) => !o)}
              className="md:hidden flex h-11 w-11 items-center justify-center rounded-lg border border-charcoal/15 text-charcoal hover:bg-charcoal/[0.04]"
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 z-40 bg-charcoal/50 md:hidden"
              aria-hidden="true"
            />

            <motion.div
              id="mobile-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-cream shadow-2xl md:hidden"
            >
              <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-charcoal/10 px-5">
                <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center">
                  {loading ? (
                    <div className="h-9 w-28 rounded-md bg-charcoal/10 animate-pulse" />
                  ) : content?.logoUrl ? (
                    <img
                      src={getOptimizedImageUrl(content.logoUrl, 200)}
                      alt="Pamnim Interior Designers"
                      className="h-9 w-auto object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Wordmark />
                  )}
                </Link>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-charcoal/15 text-charcoal hover:bg-charcoal/[0.04]"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-5 py-6" aria-label="Mobile">
                <ul className="divide-y divide-charcoal/10 border-y border-charcoal/10">
                  {NAV_LINKS.map((link) => {
                    const active = link.path === '/' ? location.pathname === '/' : location.pathname.startsWith(link.path);
                    return (
                      <li key={link.path}>
                        <Link
                          to={link.path}
                          className={cn(
                            'flex min-h-[56px] items-center justify-between font-serif text-2xl',
                            active ? 'text-ochre' : 'text-charcoal'
                          )}
                          aria-current={active ? 'page' : undefined}
                        >
                          {link.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-6 space-y-2">
                  {user ? (
                    <>
                      <Link
                        to={getDashboardDestination()}
                        id="cmd-dashboard-mobile"
                        className="btn btn-outline w-full justify-start"
                      >
                        <LayoutDashboard className="h-4 w-4 text-ochre" aria-hidden="true" />
                        {getDashboardText()}
                      </Link>
                      <button type="button" onClick={handleSignOut} className="btn btn-outline w-full justify-start">
                        <LogOut className="h-4 w-4 text-charcoal/60" aria-hidden="true" />
                        Sign out
                      </button>
                    </>
                  ) : (
                    <Link to="/login" className="btn btn-outline w-full">
                      Sign in
                    </Link>
                  )}
                </div>
              </nav>

              <div className="shrink-0 space-y-3 border-t border-charcoal/10 bg-white px-5 py-5">
                <a href={phoneHref} className="flex items-center gap-3 text-base font-semibold text-charcoal">
                  <Phone className="h-5 w-5 text-ochre" aria-hidden="true" />
                  {phone}
                </a>
                <p className="text-sm text-charcoal/70">{content.contact.address}</p>
                <a href={bookHref} target="_blank" rel="noreferrer" className="btn btn-primary w-full">
                  Book a consultation
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
