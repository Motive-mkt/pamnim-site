import React, { useState, useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronRight, MessageSquare, Image as ImageIcon } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { serviceCategories } from '../data/servicesData';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { optimizeHeroCloudinaryUrl } from '../services/cloudinaryService';

export default function ServiceDetailPage() {
  const { categoryId, serviceSlug } = useParams();

  const category = serviceCategories.find(c => c.id === categoryId);
  if (!category) {
    return <Navigate to="/services" replace />;
  }

  const staticService = category.items.find(s => s.slug === serviceSlug);
  if (!staticService) {
    return <Navigate to={`/services/${category.id}`} replace />;
  }

  const [dbService, setDbService] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDbService = async () => {
      try {
        const docRef = doc(db, 'detailedServices', `${categoryId}_${serviceSlug}`);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setDbService(docSnap.data());
        }
      } catch (err) {
        console.error("Error fetching detailed service:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDbService();
  }, [categoryId, serviceSlug]);

  // Merge static and DB data (DB data overrides if exists)
  const serviceName = dbService?.name || staticService.name;
  const serviceDesc = dbService?.desc || staticService.desc;
  const heroImage = dbService?.heroImage || staticService.heroImage;
  const galleryImages = dbService?.images || staticService.images || ["", "", ""];

  return (
    <div className="min-h-screen bg-cream flex flex-col justify-between">
      <div>
        <Header />

        {/* 6. Breadcrumb at the top of the page */}
        <div className="pt-32 pb-4 bg-cream border-b border-charcoal/5">
          <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center gap-2 text-xs font-mono text-charcoal/40">
            <Link to="/services" className="hover:text-ochre transition-colors duration-200">
              Services
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-charcoal/20" />
            <Link to={`/services/${category.id}`} className="hover:text-ochre transition-colors duration-200">
              {category.title}
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-charcoal/20" />
            <span className="text-ochre font-medium">{serviceName}</span>
          </div>
        </div>

        {/* 1. Hero image — full-width image at the top */}
        <div className="max-w-7xl mx-auto px-6 md:px-12 pt-8">
          {heroImage ? (
            <div className="w-full aspect-[21/9] rounded-[2.5rem] overflow-hidden border border-charcoal/5 shadow-md bg-cream">
              <img
                src={optimizeHeroCloudinaryUrl(heroImage)}
                alt={`${serviceName} Hero`}
                className="w-full h-full object-cover object-center"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="w-full aspect-[21/9] rounded-[2.5rem] border-2 border-dashed border-charcoal/10 bg-white/40 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden group hover:border-ochre/20 transition-colors duration-300">
              <div className="w-12 h-12 rounded-full bg-cream border border-charcoal/5 flex items-center justify-center mb-4 text-charcoal/30 group-hover:text-ochre group-hover:bg-ochre/5 transition-colors duration-300">
                <ImageIcon className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-charcoal/40 uppercase tracking-widest mb-1">
                Hero Image coming soon
              </p>
              <p className="text-[11px] text-charcoal/30 max-w-[280px]">
                A luxury hero view is currently being curated for this service page.
              </p>
            </div>
          )}
        </div>

        {/* Service Core Detail: 2. Service Name H1 & 3. Brief description */}
        <main className="py-16 max-w-7xl mx-auto px-6 md:px-12">
          <div className="max-w-4xl">
            <span className="text-xs font-bold tracking-[0.2em] text-ochre uppercase mb-3 block">
              DETAILED SERVICE STUDY
            </span>
            <motion.h1 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif text-charcoal font-medium mb-6 leading-tight"
            >
              {serviceName}
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-base sm:text-lg md:text-xl text-charcoal/60 leading-relaxed font-sans mb-12"
            >
              {serviceDesc}
            </motion.p>
          </div>

          {/* 4. Three image cards */}
          <div className="mt-12 space-y-6">
            <h3 className="text-xs font-bold tracking-[0.2em] text-charcoal/30 uppercase pb-3 border-b border-charcoal/5">
              PROJECT PORTFOLIO LOOKBOOK
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[0, 1, 2].map((index) => {
                const imgUrl = galleryImages[index];
                return imgUrl ? (
                  <div key={index} className="aspect-[4/3] rounded-[2rem] overflow-hidden border border-charcoal/5 shadow-sm bg-cream">
                    <img
                      src={imgUrl}
                      alt={`${serviceName} project reference ${index + 1}`}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div 
                    key={index} 
                    className="aspect-[4/3] rounded-[2rem] border-2 border-dashed border-charcoal/10 bg-white/40 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden group hover:border-ochre/20 transition-colors duration-300"
                  >
                    <div className="w-12 h-12 rounded-full bg-cream border border-charcoal/5 flex items-center justify-center mb-4 text-charcoal/30 group-hover:text-ochre group-hover:bg-ochre/5 transition-colors duration-300">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-charcoal/40 uppercase tracking-widest mb-1">
                      Photo coming soon
                    </p>
                    <p className="text-[11px] text-charcoal/30 max-w-[180px]">
                      Aesthetic portfolio updates are currently in progress.
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        {/* 5. CTA band — "Get a Quote" */}
        <section className="py-20 bg-cream">
          <div className="max-w-5xl mx-auto px-6 md:px-12 text-center">
            <div className="bg-charcoal text-white rounded-[3rem] p-10 md:p-16 relative overflow-hidden border border-white/5 shadow-2xl">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-ochre to-transparent opacity-50" />
              
              <div className="relative z-10 space-y-6">
                <span className="text-xs font-bold tracking-[0.2em] text-ochre uppercase block">TAILORED HOME SERVICE</span>
                
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-medium leading-tight max-w-2xl mx-auto">
                  Bring <span className="italic font-light text-ochre-light">{serviceName}</span> to your residence
                </h2>
                
                <p className="text-white/60 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
                  Every home deserves architectural precision. Speak with our experts to discuss custom scheduling, design coordination, and direct material options.
                </p>

                <div className="pt-6 flex justify-center">
                  <Link 
                    to="/contact"
                    className="w-full sm:w-auto bg-ochre hover:bg-ochre/90 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shadow-ochre/20 text-sm"
                  >
                    <MessageSquare className="w-5 h-5" />
                    Get a Quote
                  </Link>
                </div>
              </div>
              
              {/* Soft lighting */}
              <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full bg-ochre/10 blur-3xl opacity-30" />
              <div className="absolute -bottom-40 -right-40 w-80 h-80 rounded-full bg-ochre/10 blur-3xl opacity-30" />
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
}
