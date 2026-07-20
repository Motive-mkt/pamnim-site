import React from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight, Compass, Layers, Grid, Sparkles } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { serviceCategories } from '../data/servicesData';

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-cream flex flex-col justify-between">
      <div>
        <Header />

        {/* Hero Section */}
        <section className="pt-28 sm:pt-36 pb-12 sm:pb-16 relative overflow-hidden bg-cream border-b border-charcoal/5">
          <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10 text-center">
            <motion.span 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-xs font-bold tracking-[0.2em] text-ochre uppercase mb-4 block"
            >
              OUR CORE DISCIPLINES
            </motion.span>
            <motion.h1 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-serif text-charcoal font-medium mb-6 leading-tight max-w-4xl mx-auto"
            >
              Refined Services & <span className="italic font-light">Elevated Architecture</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="text-sm sm:text-base md:text-lg lg:text-xl text-charcoal/60 max-w-2xl mx-auto leading-relaxed"
            >
              Experience our comprehensive design spectrum, carefully structured to assure pristine finish quality and warm minimalist sophistication.
            </motion.p>
          </div>
        </section>

        {/* Category Cards Grid */}
        <main className="py-20 max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
            {serviceCategories.map((category, index) => {
              const Icon = category.icon;
              return (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ y: -6, transition: { duration: 0.2 } }}
                  className="bg-white border border-charcoal/5 rounded-[2.5rem] p-8 md:p-12 shadow-sm hover:shadow-md hover:border-ochre/20 transition-all duration-300 flex flex-col justify-between group"
                >
                  <div>
                    {/* Index & Icon */}
                    <div className="flex justify-between items-center mb-8">
                      <span className="font-mono text-sm tracking-widest text-ochre font-extrabold">
                        {category.accent}
                      </span>
                      <div className="w-12 h-12 rounded-2xl bg-cream border border-charcoal/5 flex items-center justify-center group-hover:bg-ochre/5 group-hover:border-ochre/20 transition-all duration-300">
                        <Icon className="w-5 h-5 text-ochre" />
                      </div>
                    </div>

                    {/* Content */}
                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-charcoal mb-4 group-hover:text-ochre transition-colors duration-300">
                      {category.title}
                    </h2>
                    <p className="text-charcoal/60 text-sm leading-relaxed mb-6">
                      {category.description}
                    </p>

                    {/* Included Solutions Pills */}
                    <div className="mb-8">
                      <span className="text-[10px] font-bold tracking-[0.15em] text-charcoal/30 uppercase mb-3 block">
                        Included Solutions
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {category.items.map((item) => (
                          <Link
                            key={item.slug}
                            to={`/services/${category.id}/${item.slug}`}
                            className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-cream border border-charcoal/5 hover:border-ochre hover:bg-ochre/5 hover:text-ochre transition-all duration-300 inline-block"
                          >
                            {item.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Navigation CTA */}
                  <Link
                    to={`/services/${category.id}`}
                    className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-charcoal group-hover:text-ochre transition-all duration-300 self-start"
                  >
                    View Category
                    <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
