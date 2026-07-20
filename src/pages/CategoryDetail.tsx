import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronRight, ArrowRight, Sparkles, MessageSquare } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { serviceCategories } from '../data/servicesData';

export default function CategoryDetailPage() {
  const { categoryId } = useParams();
  const category = serviceCategories.find(c => c.id === categoryId);

  if (!category) {
    return <Navigate to="/services" replace />;
  }

  const Icon = category.icon;

  return (
    <div className="min-h-screen bg-cream flex flex-col justify-between">
      <div>
        <Header />

        {/* Breadcrumbs Section */}
        <div className="pt-32 pb-4 bg-cream border-b border-charcoal/5">
          <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center gap-2 text-xs font-mono text-charcoal/40">
            <Link to="/services" className="hover:text-ochre transition-colors duration-200">
              Services
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-charcoal/20" />
            <span className="text-ochre font-medium">{category.title}</span>
          </div>
        </div>

        {/* Hero Section */}
        <section className="py-16 relative overflow-hidden bg-cream border-b border-charcoal/5">
          <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="font-mono text-xs tracking-widest text-ochre font-extrabold uppercase">
                Category {category.accent}
              </span>
              <div className="h-[1px] w-8 bg-ochre/20" />
              <div className="w-8 h-8 rounded-lg bg-cream border border-charcoal/5 flex items-center justify-center">
                <Icon className="w-4 h-4 text-ochre" />
              </div>
            </div>

            <motion.h1 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif text-charcoal font-medium mb-6 leading-tight max-w-4xl"
            >
              {category.title}
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-sm sm:text-base md:text-lg text-charcoal/60 max-w-3xl leading-relaxed"
            >
              {category.description}
            </motion.p>
          </div>
        </section>

        {/* Sub-services Grid */}
        <main className="py-20 max-w-7xl mx-auto px-6 md:px-12">
          <h2 className="text-xs font-bold tracking-[0.2em] text-charcoal/30 uppercase mb-8 pb-4 border-b border-charcoal/5">
            DETAILED SERVICE BREAKDOWN
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {category.items.map((item, idx) => (
              <motion.div
                key={item.slug}
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="bg-white border border-charcoal/5 rounded-[2rem] p-8 shadow-sm hover:shadow-md hover:border-ochre/20 transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  <h3 className="text-xl font-bold text-charcoal mb-4 group-hover:text-ochre transition-colors duration-300">
                    {item.name}
                  </h3>
                  <p className="text-charcoal/50 text-sm leading-relaxed mb-8">
                    {item.desc}
                  </p>
                </div>

                <Link
                  to={`/services/${category.id}/${item.slug}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-charcoal group-hover:text-ochre transition-all duration-300 self-start"
                >
                  Explore Details
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </motion.div>
            ))}
          </div>
        </main>

        {/* Get a Quote CTA Band */}
        <section className="py-16 bg-cream border-t border-charcoal/5">
          <div className="max-w-5xl mx-auto px-6 md:px-12">
            <div className="bg-charcoal text-white rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden border border-white/5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="relative z-10 space-y-3 text-center md:text-left max-w-2xl">
                <span className="text-[10px] font-bold tracking-[0.2em] text-ochre uppercase block">READY TO START?</span>
                <h3 className="text-2xl md:text-3xl font-serif font-medium leading-tight text-white">
                  Discuss your <span className="italic font-light text-ochre-light">{category.title}</span> project
                </h3>
                <p className="text-white/60 text-xs leading-relaxed">
                  Connect with our design advisors today. We'll map out your structural planning and spatial options without any obligation.
                </p>
              </div>

              <div className="relative z-10 flex-shrink-0 w-full md:w-auto">
                <Link
                  to="/contact"
                  className="w-full md:w-auto bg-ochre hover:bg-ochre/90 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shadow-ochre/20 text-sm"
                >
                  <MessageSquare className="w-4 h-4" />
                  Get a Quote
                </Link>
              </div>

              {/* Subtle visual lighting */}
              <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-ochre/5 blur-2xl opacity-30" />
              <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-ochre/5 blur-2xl opacity-30" />
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
}
