import { Phone, Mail, MapPin, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCMS } from '../hooks/useCMS';
import { getOptimizedImageUrl, isFreeMailAddress } from '../lib/utils';

const FOOTER_LINKS = [
  { name: 'Home', path: '/' },
  { name: 'Services', path: '/services' },
  { name: 'Portfolio', path: '/portfolio' },
  { name: 'Contact', path: '/contact' }
];

export default function Footer() {
  const { content } = useCMS();
  const { phone, email, address, whatsapp } = content.contact;
  const year = new Date().getFullYear();
  // A free Gmail-style address undercuts a premium brand, so it is only shown once a branded one is set
  const showEmail = !!email && !isFreeMailAddress(email);

  return (
    <footer className="dark-surface bg-charcoal text-white">
      <div className="container-x">
        {/* Closing call to action */}
        <div id="footer-cta" className="grid gap-8 border-b border-white/15 py-16 md:grid-cols-[1.4fr_1fr] md:items-end md:py-20">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-ochre-light">Start a project</p>
            <h2 className="max-w-[20ch] text-4xl text-white md:text-5xl">Let&rsquo;s design a home you&rsquo;ll love coming back to.</h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75">
              Book a free consultation. We will talk through your plans, budget and timeline, with no obligation.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:flex-col lg:flex-row md:justify-end">
            <a href={`tel:${phone.replace(/\s/g, '')}`} className="btn btn-primary btn-lg">
              <Phone className="h-4 w-4" aria-hidden="true" />
              Call {phone}
            </a>
            <a
              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent("Hello Pamnim Interiors, I'd like to book a consultation.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline-light btn-lg"
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              WhatsApp
            </a>
          </div>
        </div>

        {/* Details */}
        <div className="grid gap-10 py-14 md:grid-cols-12">
          <div className="md:col-span-5">
            <Link to="/" className="inline-block" aria-label="Pamnim Interior Designers, home">
              {content?.logoUrl ? (
                <span className="inline-flex rounded-lg bg-white px-3.5 py-2">
                  <img
                    src={getOptimizedImageUrl(content.logoUrl, 220)}
                    alt="Pamnim Interior Designers"
                    className="h-9 w-auto object-contain"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                </span>
              ) : (
                <span className="flex flex-col leading-none">
                  <span className="font-serif text-3xl font-semibold tracking-tight text-white">pamnim</span>
                  <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-ochre-light">Interior Designers</span>
                </span>
              )}
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/70">
              Interior design, joinery, flooring and lighting for homes in Nairobi and across Kenya.
            </p>
          </div>

          <nav className="md:col-span-3" aria-label="Footer">
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">Explore</h4>
            <ul className="space-y-2.5">
              {FOOTER_LINKS.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="text-[15px] text-white/85 hover:text-ochre-light">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="md:col-span-4">
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">Contact</h4>
            <ul className="space-y-3 text-[15px] text-white/85">
              <li id="footer-call" className="flex items-start gap-3">
                <Phone className="mt-1 h-4 w-4 shrink-0 text-ochre-light" aria-hidden="true" />
                <a href={`tel:${phone.replace(/\s/g, '')}`} className="hover:text-ochre-light">
                  {phone}
                </a>
              </li>
              {showEmail && (
                <li id="footer-hours" className="flex items-start gap-3">
                  <Mail className="mt-1 h-4 w-4 shrink-0 text-ochre-light" aria-hidden="true" />
                  <a href={`mailto:${email}`} className="break-all hover:text-ochre-light">
                    {email}
                  </a>
                </li>
              )}
              <li id="footer-area" className="flex items-start gap-3">
                <MapPin className="mt-1 h-4 w-4 shrink-0 text-ochre-light" aria-hidden="true" />
                <span>{address}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Legal */}
        <div className="flex flex-col items-start justify-between gap-4 border-t border-white/15 py-6 text-sm text-white/65 sm:flex-row sm:items-center">
          <p>&copy; {year} Pamnim Interior Designers. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link to="/privacy" className="hover:text-white">
              Privacy policy
            </Link>
            <Link to="/terms" className="hover:text-white">
              Terms of service
            </Link>
            <Link to="/login" className="hover:text-white">
              Client portal
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
