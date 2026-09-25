import React from 'react';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { useCMS } from '../hooks/useCMS';
import { optimizeHeroCloudinaryUrl } from '../services/cloudinaryService';
import LeadQualifyingForm from './LeadQualifyingForm';

const FALLBACK_HERO_IMAGE = "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=90&w=2560";

export default function Hero() {
  const { content, loading } = useCMS();
  const hero = content.hero;

  const heroImage = (hero.heroSlideshow && hero.heroSlideshow.length > 0)
    ? hero.heroSlideshow[0]
    : ((hero as any).heroImage || FALLBACK_HERO_IMAGE);

  return (
    <section className="relative min-h-screen flex items-center pt-36 sm:pt-40 md:pt-44 lg:pt-36 xl:pt-40 pb-20 lg:pb-24 overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0 bg-charcoal overflow-hidden">
        {!loading && (
          <motion.img
            key={heroImage}
            src={optimizeHeroCloudinaryUrl(heroImage)}
            alt="Modern luxury interior by Pamnim Interiors"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="absolute inset-0 w-full h-full object-cover object-center"
            referrerPolicy="no-referrer"
          />
        )}
        <div className="absolute inset-0 bg-black/50 z-10 pointer-events-none" />
      </div>

      <div className="relative z-20 max-w-7xl mx-auto px-6 md:px-12 grid lg:grid-cols-2 gap-12 items-center w-full">
        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-white pt-2 sm:pt-4 lg:pt-6"
        >
          <div id="badge" className="inline-flex items-center gap-2 bg-ochre/20 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 mb-6 mt-1 sm:mt-2 shadow-sm">
            <span className="text-xs font-bold tracking-widest uppercase">RATED 4.6 BY CLIENTS ACROSS KENYA</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] mb-6">
            {hero.title.split(hero.highlightWord || 'home.').map((part, i, arr) => (
              <span key={i}>
                {part}
                {i < arr.length - 1 && <span className="text-ochre">{hero.highlightWord || 'home.'}</span>}
              </span>
            ))}
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-white/90 mb-8 max-w-lg leading-relaxed">
            {hero.subheadline}
          </p>

          <ul className="space-y-4 mb-10">
            {[
              'Free first consultation with no commitment',
              'Bespoke design for your budget and space',
              'On-time delivery, fully managed project'
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-ochre flex items-center justify-center flex-shrink-0">
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-medium text-sm md:text-base">{item}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Lead Gen Form */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="w-full max-w-lg mx-auto lg:ml-auto"
        >
          <LeadQualifyingForm
            variant="card"
            source="hero_form"
            title="Book your free consultation"
            subtitle="Tell us about your space. We'll respond with tailored recommendations within 24 hours."
            className="shadow-2xl border-white/20"
          />
        </motion.div>
      </div>
    </section>
  );
}
