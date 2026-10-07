import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCMS } from '../hooks/useCMS';
import { optimizeHeroCloudinaryUrl } from '../services/cloudinaryService';
import HeroContactForm from './HeroContactForm';

const FALLBACK_HERO_IMAGE =
  'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=90&w=2560';

const HERO_POINTS = [
  'Free first consultation, no commitment',
  'Design, joinery and finishing under one team',
  'Fixed-scope quotes before any work begins'
];

const SLIDE_INTERVAL_MS = 7000;

export default function Hero() {
  const { content, loading } = useCMS();
  const reduceMotion = useReducedMotion();
  const hero = content.hero;

  const slides: string[] =
    hero.heroSlideshow && hero.heroSlideshow.length > 0
      ? hero.heroSlideshow
      : [((hero as any).heroImage as string) || FALLBACK_HERO_IMAGE];

  const [activeIndex, setActiveIndex] = useState(0);

  // Slow cross-fade between the slides the owner picked; static when motion is reduced
  useEffect(() => {
    if (slides.length < 2 || reduceMotion) return;
    const id = window.setInterval(() => setActiveIndex((i) => (i + 1) % slides.length), SLIDE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [slides.length, reduceMotion]);

  const safeIndex = activeIndex % slides.length;
  const highlight = hero.highlightWord || '';
  const titleParts = highlight && hero.title.includes(highlight) ? hero.title.split(highlight) : [hero.title];

  return (
    <section className="dark-surface relative isolate overflow-hidden bg-charcoal pt-[72px]">
      {/* Background photography */}
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        {!loading && (
          <AnimatePresence initial={false}>
            <motion.img
              key={slides[safeIndex]}
              src={optimizeHeroCloudinaryUrl(slides[safeIndex])}
              alt=""
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 1.4, ease: 'easeInOut' }}
              className="absolute inset-0 h-full w-full object-cover object-center"
              referrerPolicy="no-referrer"
            />
          </AnimatePresence>
        )}
        {/* Directional scrim keeps the text readable while the right side of the photo stays visible */}
        <div className="absolute inset-0 bg-gradient-to-r from-charcoal/90 via-charcoal/70 to-charcoal/35" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-charcoal/60 to-transparent" />
      </div>

      <div className="container-x grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-24 min-h-[calc(100svh-72px)]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-white"
        >
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-ochre-light">
            Interior design in Nairobi, Kenya
          </p>

          <h1 className="max-w-[16ch] text-[2.5rem] leading-[1.06] text-white sm:text-6xl lg:text-[4.25rem]">
            {titleParts.map((part, i) => (
              <span key={i}>
                {part}
                {i < titleParts.length - 1 && <em className="font-medium italic text-ochre-light">{highlight}</em>}
              </span>
            ))}
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">{hero.subheadline}</p>

          <ul className="mt-8 space-y-3">
            {HERO_POINTS.map((item) => (
              <li key={item} className="flex items-start gap-3 text-[15px] text-white/90">
                <Check className="mt-0.5 h-[18px] w-[18px] shrink-0 text-ochre-light" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <a href="#consultation" className="btn btn-primary btn-lg lg:hidden">
              Get a free consultation
            </a>
            <Link
              to="/portfolio"
              className="inline-flex items-center gap-2 text-[15px] font-semibold text-white underline decoration-white/40 underline-offset-[6px] hover:decoration-ochre-light"
            >
              See recent projects
            </Link>
          </div>
        </motion.div>

        <motion.div
          id="consultation"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12, ease: 'easeOut' }}
          className="mx-auto w-full max-w-lg scroll-mt-24 lg:ml-auto lg:mr-0"
        >
          <HeroContactForm />
        </motion.div>
      </div>
    </section>
  );
}
