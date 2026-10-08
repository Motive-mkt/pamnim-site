import React, { useId, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Check, MessageSquare, CheckCircle2, Clock, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCMS } from '../hooks/useCMS';
import Modal from './ui/Modal';
import { serviceCategories } from '../data/servicesData';

/**
 * Default service categories. The owner can override these from the admin CMS;
 * the copy here is deliberately plain so it reads like a studio describing its work.
 */
export const LUXURY_CATEGORIES = [
  {
    id: 'interior-architecture',
    title: 'Space planning and layouts',
    subtitle: 'Planning',
    outcome:
      'We plan layouts around how you actually live, so every square metre of your Nairobi home earns its place without losing its style.',
    bullets: ['Furniture and room layouts', 'Kitchen and living-area planning', 'Gypsum ceilings and feature walls'],
    items: ['Space planning', 'Kitchen planning', 'Gypsum ceilings'],
    accent: '01',
    startingPrice: 'From KES 50,000',
    timeline: '2 to 3 weeks',
    images: [
      'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&q=80&w=1200'
    ],
    whatsappText: "I'm interested in space planning and layouts"
  },
  {
    id: 'bespoke-finishes',
    title: 'Finishes and custom carpentry',
    subtitle: 'Finishes',
    outcome:
      'Wall paneling, wardrobes and cabinetry made to measure, finished cleanly. The details are what make a home feel considered.',
    bullets: ['Wall paneling and wainscoting', 'Fitted wardrobes and cabinetry', 'Plaster skim and painting'],
    items: ['Wall paneling', 'Cabinets and joinery', 'Painting'],
    accent: '02',
    isMostRequested: true,
    startingPrice: 'From KES 250,000',
    timeline: '3 to 4 weeks',
    images: [
      'https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&q=80&w=1200'
    ],
    whatsappText: "I'm interested in finishes and custom carpentry"
  },
  {
    id: 'premium-flooring',
    title: 'Flooring',
    subtitle: 'Flooring',
    outcome:
      'The right floor anchors every room. We supply and install hardwood, engineered wood, vinyl and stone, and fit it properly so it lasts.',
    bullets: ['Ceramic and porcelain tiling', 'Waterproof SPC and wood flooring', 'Stain-resistant floor coatings'],
    items: ['Tiling', 'SPC and wood floors', 'Floor coatings'],
    accent: '03',
    startingPrice: 'From KES 180,000',
    timeline: '1 to 2 weeks',
    images: [
      'https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=1200'
    ],
    whatsappText: "I'm interested in flooring"
  },
  {
    id: 'lighting-textures-styling',
    title: 'Lighting, curtains and styling',
    subtitle: 'Atmosphere',
    outcome:
      'Lighting changes everything. We plan ambient, accent and task lighting so your home feels warm at 7am and refined at 7pm.',
    bullets: ['Glare-free LED lighting', 'Custom curtains and blinds', '3D previews before work starts'],
    items: ['LED lighting', 'Curtains and blinds', '3D previews'],
    accent: '04',
    startingPrice: 'From KES 120,000',
    timeline: '1 to 2 weeks',
    images: [
      'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&q=80&w=1200'
    ],
    whatsappText: "I'm interested in lighting, curtains and styling"
  }
];

/** Lowest "From KES x" figure across the categories, so the budget line never goes stale */
function lowestStartingPrice(categories: any[]): string {
  const values = categories
    .map((c) => parseInt(String(c.startingPrice || '').replace(/[^0-9]/g, ''), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  const min = values.length ? Math.min(...values) : 50000;
  return `KES ${min.toLocaleString('en-KE')}`;
}

export default function Services() {
  const { content } = useCMS();
  const uid = useId();
  const categories: any[] =
    content.luxuryCategories && content.luxuryCategories.length > 0 ? content.luxuryCategories : LUXURY_CATEGORIES;

  const [quoteOpen, setQuoteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('');
  const selectedService = useMemo(
    () => categories.find((c) => c.id === selectedId) || categories[0],
    [categories, selectedId]
  );

  // Quote form state
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadNotes, setLeadNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const waNumber = content?.contact?.whatsapp || '254714984268';

  const openQuote = (serviceId?: string) => {
    setSelectedId(serviceId || categories[0]?.id || '');
    setIsSubmitted(false);
    setLeadName('');
    setLeadEmail('');
    setLeadPhone('');
    setLeadNotes('');
    setQuoteOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'inquiries'), {
        name: leadName,
        email: leadEmail,
        phone: leadPhone,
        projectType: selectedService.title,
        message: `Quote Request for: ${selectedService.title}\nMessage: ${leadNotes || 'Interested in this service.'}`,
        status: 'new',
        createdAt: new Date().toISOString()
      });

      if (typeof (window as any).fbq === 'function') {
        (window as any).fbq('track', 'Lead', { content_name: 'Services Quote Form' });
      }

      setIsSubmitted(true);

      const prefilledMsg = `Hello Pamnim Interiors! I just submitted a quote request for *${selectedService.title}* on your website.\n\n*Name:* ${leadName}\n*Direct Inquiry:* ${leadNotes || 'I would like to discuss next steps.'}`;
      const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(prefilledMsg)}`;
      setTimeout(() => window.open(waUrl, '_blank'), 1000);
    } catch (err) {
      console.error('Lead submission error:', err);
      alert('We could not send that. Please message us on WhatsApp instead.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const budgetFrom = lowestStartingPrice(categories);

  return (
    <section className="section bg-paper border-y border-charcoal/[0.07]" id="services">
      <div className="container-x">
        <div id="services-section-header" className="mb-12 grid gap-6 md:mb-16 md:grid-cols-[1.2fr_1fr] md:items-end md:gap-16">
          <div>
            <p className="eyebrow mb-4">Services</p>
            <h2 className="max-w-[18ch]">Four services, one team from plan to finish.</h2>
          </div>
          <div>
            <p className="lede">
              Every project is planned, built and finished by the same people, so nothing gets lost between the design and the
              site.
            </p>
            <Link to="/services" className="btn-link mt-5">
              See all services
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="grid gap-x-8 gap-y-14 md:grid-cols-2 lg:gap-x-12">
          {categories.map((category, index) => {
            const image = category.images?.[0];
            return (
              <motion.article
                key={category.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: (index % 2) * 0.08 }}
                className="group flex flex-col"
              >
                <Link to={`/services/${category.id}`} className="block overflow-hidden rounded-xl bg-charcoal/5" tabIndex={-1} aria-hidden="true">
                  <div className="relative aspect-[4/3]">
                    {image ? (
                      <img
                        src={image}
                        alt=""
                        width={1200}
                        height={900}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-cream font-serif text-6xl text-charcoal/15">
                        {category.accent}
                      </div>
                    )}
                    {category.isMostRequested && (
                      <span className="absolute left-3 top-3 rounded-md bg-cream px-2.5 py-1 text-xs font-semibold text-charcoal">
                        Most requested
                      </span>
                    )}
                  </div>
                </Link>

                <div className="mt-6 flex items-baseline gap-4">
                  <span className="font-serif text-xl text-ochre" aria-hidden="true">
                    {category.accent}
                  </span>
                  <h3 className="text-[1.75rem] leading-tight">
                    <Link to={`/services/${category.id}`} className="hover:text-ochre">
                      {category.title}
                    </Link>
                  </h3>
                </div>

                <p className="mt-3 text-[15px] leading-relaxed text-charcoal/75 md:pl-9">{category.outcome}</p>

                {/* Each service inside the category links to its own page, with an arrow so it reads as clickable */}
                {serviceCategories.find((c) => c.id === category.id)?.items.length ? (
                  <ul className="mt-5 divide-y divide-charcoal/10 border-y border-charcoal/10 md:ml-9">
                    {serviceCategories
                      .find((c) => c.id === category.id)!
                      .items.map((item) => (
                        <li key={item.slug}>
                          <Link
                            to={`/services/${category.id}/${item.slug}`}
                            className="group/item flex min-h-11 items-center justify-between gap-4 py-2.5 text-[15px] font-medium text-charcoal hover:text-ochre"
                          >
                            <span>{item.name}</span>
                            <ArrowRight
                              className="h-4 w-4 shrink-0 text-ochre transition-transform group-hover/item:translate-x-1"
                              aria-hidden="true"
                            />
                          </Link>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <ul className="mt-5 space-y-2 md:pl-9">
                    {(category.bullets || []).map((bullet: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2.5 text-sm text-charcoal/80">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-ochre" aria-hidden="true" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-charcoal/10 pt-5 md:ml-9">
                  <p className="text-sm text-charcoal/70">
                    <span className="font-semibold text-charcoal">{category.startingPrice}</span>
                    <span className="mx-2 text-charcoal/30" aria-hidden="true">
                      /
                    </span>
                    {category.timeline}
                  </p>
                  <Link to={`/services/${category.id}`} className="btn-link">
                    View service
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </motion.article>
            );
          })}
        </div>

        {/* One clear quote action for the whole section, instead of three buttons on every card */}
        <div className="mt-16 flex flex-col items-start justify-between gap-6 rounded-2xl bg-charcoal p-8 text-white md:mt-20 md:flex-row md:items-center md:p-10 dark-surface">
          <div className="max-w-xl">
            <h3 className="text-[1.75rem] text-white">Not sure where to start?</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-white/80">
              Projects start from {budgetFrom}. Tell us your space and budget and we will recommend what to do first.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <button type="button" onClick={() => openQuote()} className="btn btn-primary btn-lg">
              Get a quote
            </button>
            <a
              href={`https://wa.me/${waNumber}?text=${encodeURIComponent("Hello Pamnim Interiors, I'd like to ask about a project.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline-light btn-lg"
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              WhatsApp us
            </a>
          </div>
        </div>
      </div>

      {/* Quote dialog */}
      <Modal open={quoteOpen} onClose={() => setQuoteOpen(false)} labelledBy={`${uid}-quote-title`} size="lg">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-charcoal/10 bg-white px-6 py-5 sm:px-8">
          <div>
            <h3 id={`${uid}-quote-title`} className="text-[1.65rem] sm:text-3xl">
              Request a quote
            </h3>
            <p className="mt-1 text-sm text-charcoal/70">Free first consultation, no commitment.</p>
          </div>
          <button
            type="button"
            onClick={() => setQuoteOpen(false)}
            className="-mr-2 -mt-1 flex h-11 w-11 items-center justify-center rounded-lg text-charcoal/60 hover:bg-charcoal/5 hover:text-charcoal"
            aria-label="Close"
          >
            <span aria-hidden="true" className="text-2xl leading-none">
              ×
            </span>
          </button>
        </div>

        {selectedService && (
          <div className="grid gap-8 px-6 py-6 sm:px-8 md:grid-cols-[1fr_1.05fr]">
            <div>
              <label htmlFor={`${uid}-service`} className="field-label">
                Service
              </label>
              <select
                id={`${uid}-service`}
                value={selectedService.id}
                onChange={(e) => setSelectedId(e.target.value)}
                className="field"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>

              <p className="mt-4 text-[15px] leading-relaxed text-charcoal/75">{selectedService.outcome}</p>

              <dl className="mt-5 grid grid-cols-2 gap-4 border-y border-charcoal/10 py-4 text-sm">
                <div>
                  <dt className="flex items-center gap-1.5 text-charcoal/65">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Timeline
                  </dt>
                  <dd className="mt-1 font-semibold">{selectedService.timeline}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-charcoal/65">
                    <Wallet className="h-3.5 w-3.5" aria-hidden="true" /> Starting from
                  </dt>
                  <dd className="mt-1 font-semibold">{String(selectedService.startingPrice || '').replace(/^From\s*/i, '')}</dd>
                </div>
              </dl>

              <ul className="mt-5 space-y-2">
                {selectedService.bullets.map((bullet: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm text-charcoal/80">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-ochre" aria-hidden="true" />
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              {!isSubmitted ? (
                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <div>
                    <label htmlFor={`${uid}-name`} className="field-label">
                      Full name
                    </label>
                    <input
                      id={`${uid}-name`}
                      type="text"
                      required
                      autoComplete="name"
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      className="field"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${uid}-phone`} className="field-label">
                      Phone number
                    </label>
                    <input
                      id={`${uid}-phone`}
                      type="tel"
                      required
                      autoComplete="tel"
                      inputMode="tel"
                      value={leadPhone}
                      onChange={(e) => setLeadPhone(e.target.value)}
                      className="field"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${uid}-email`} className="field-label">
                      Email address
                    </label>
                    <input
                      id={`${uid}-email`}
                      type="email"
                      required
                      autoComplete="email"
                      value={leadEmail}
                      onChange={(e) => setLeadEmail(e.target.value)}
                      className="field"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${uid}-notes`} className="field-label">
                      Rooms or requests <span className="font-normal text-charcoal/60">(optional)</span>
                    </label>
                    <textarea
                      id={`${uid}-notes`}
                      rows={3}
                      value={leadNotes}
                      onChange={(e) => setLeadNotes(e.target.value)}
                      className="field resize-none"
                    />
                  </div>

                  <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-lg w-full">
                    {isSubmitting ? 'Sending…' : 'Send request'}
                  </button>
                  <p className="text-center text-[13px] text-charcoal/65">
                    We will also open WhatsApp so you can follow up with us directly.
                  </p>
                </form>
              ) : (
                <div className="flex h-full flex-col items-center justify-center py-8 text-center" role="status">
                  <CheckCircle2 className="h-11 w-11 text-ochre" aria-hidden="true" />
                  <h4 className="mt-4 font-serif text-2xl font-medium">Request received</h4>
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-charcoal/75">
                    We have your details. If WhatsApp did not open on its own, use the button below to reach us straight away.
                  </p>
                  <a
                    href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Hello Pamnim Interiors! My name is ${leadName} and I just submitted a quote request for ${selectedService.title} on your website.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-dark mt-6"
                  >
                    <MessageSquare className="h-4 w-4" aria-hidden="true" />
                    Open WhatsApp
                  </a>
                  <button type="button" onClick={() => setQuoteOpen(false)} className="btn-link mt-4">
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
