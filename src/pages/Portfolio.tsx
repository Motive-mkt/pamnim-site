import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Play, Image as ImageIcon, Film } from 'lucide-react';
import { optimizeCloudinaryUrl } from '../services/cloudinaryService';

interface PortfolioItem {
  id: string;
  title: string;
  category: string;
  image: string; // url (could be image or video path)
  type?: 'image' | 'video';
  createdAt?: any;
}

export default function PortfolioPage() {
  const [projects, setProjects] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');

  // Video playback states - mapping item ID to playing boolean
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const q = query(collection(db, 'portfolio_assets'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const fetched = snap.docs.map(doc => {
          const data = doc.data();
          // Auto-classify URL as video if filename contains mp4 or type is video
          const isVideo = data.type === 'video' || (data.image && data.image.includes('.mp4'));
          return {
            id: doc.id,
            title: data.title || '',
            category: data.category || 'Luxury Spaces',
            image: data.image || '',
            type: isVideo ? 'video' : 'image',
            createdAt: data.createdAt
          } as PortfolioItem;
        });
        setProjects(fetched);
      } catch (err) {
        console.error("Error fetching portfolio:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProjects();
  }, []);

  const filteredProjects = projects.filter(p => p.type === activeTab);

  return (
    <div className="min-h-screen bg-cream">
      <Header />
      
      <main className="pt-32 pb-24">
        {/* Editorial Header */}
        <div id="portfolio-title-section" className="max-w-7xl mx-auto px-6 md:px-12 text-center mb-12">
          <span className="text-xs font-bold tracking-[0.2em] text-ochre uppercase mb-4 block">PORTFOLIO</span>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-sans font-bold mb-6">Our Design Canvas.</h1>
          <p className="text-lg md:text-xl text-charcoal/60 max-w-2xl mx-auto">
            A curated luxury catalog showcasing elegant space transformations, custom millwork, and cinematic walkthroughs.
          </p>
        </div>

        {/* Minimalist Tab System */}
        <div id="portfolio-tabs" className="max-w-7xl mx-auto px-6 md:px-12 flex justify-center mb-16 select-none">
          <div className="bg-charcoal/5 p-1 rounded-full flex gap-1">
            <button
              onClick={() => setActiveTab('image')}
              className={`flex items-center gap-2 px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
                activeTab === 'image' 
                  ? "bg-charcoal text-white shadow-md shadow-charcoal/10" 
                  : "text-charcoal/50 hover:text-charcoal"
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              Photography
            </button>
            <button
              onClick={() => setActiveTab('video')}
              className={`flex items-center gap-2 px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
                activeTab === 'video' 
                  ? "bg-charcoal text-white shadow-md shadow-charcoal/10" 
                  : "text-charcoal/50 hover:text-charcoal"
              }`}
            >
              <Film className="w-4 h-4" />
              Cinematic Walks
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 md:px-12">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map(i => (
                <div key={i} className="aspect-[4/5] bg-charcoal/5 animate-pulse rounded-3xl" />
              ))}
            </div>
          ) : filteredProjects.length > 0 ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.4 }}
              >
                {activeTab === 'image' ? (
                  /* photography - Beautiful Luxury Grid Layout */
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredProjects.map((project, index) => (
                      <motion.div
                        key={project.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="group relative aspect-[4/5] overflow-hidden rounded-3xl cursor-pointer bg-white border border-charcoal/5 shadow-sm"
                      >
                        <img 
                          src={optimizeCloudinaryUrl(project.image, 'image')} 
                          alt={project.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                        {(project.category || project.title) && (
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent flex flex-col justify-end p-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            {project.category && <span className="text-ochre-light text-xs font-bold uppercase tracking-widest mb-1">{project.category}</span>}
                            {project.title && <h3 className="text-white text-2xl font-bold tracking-tight">{project.title}</h3>}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  /* video - Widescreen Walkthroughs */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {filteredProjects.map((project, index) => (
                      <motion.div
                        key={project.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-white rounded-3xl overflow-hidden border border-charcoal/5 shadow-sm flex flex-col group"
                      >
                        {/* Widescreen Video Player Canvas */}
                        <div className="relative aspect-video w-full bg-black overflow-hidden select-none">
                          {playingVideoId === project.id ? (
                            <video
                              src={optimizeCloudinaryUrl(project.image, 'video')}
                              className="w-full h-full object-cover"
                              controls
                              autoPlay
                              playsInline
                              onEnded={() => setPlayingVideoId(null)}
                            />
                          ) : (
                            <div className="absolute inset-0 w-full h-full">
                              {/* High-quality cover - if no separate cover exists, use a smart overlay */}
                              <div className="absolute inset-0 bg-gradient-to-tr from-charcoal to-black/30 mix-blend-multiply z-10" />
                              
                              {/* Overlay Details */}
                              {(project.category || project.title) && (
                                <div className="absolute bottom-6 left-6 right-6 z-20 text-white pointer-events-none">
                                  {project.category && <span className="text-ochre-light text-xs font-bold uppercase tracking-widest block mb-1">{project.category}</span>}
                                  {project.title && <h3 className="text-xl md:text-2xl font-bold tracking-tight">{project.title}</h3>}
                                </div>
                              )}

                              {/* Elegant play button overlay */}
                              <button 
                                onClick={() => setPlayingVideoId(project.id)}
                                className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-cream hover:bg-ochre hover:text-white transition-all duration-300 flex items-center justify-center text-charcoal shadow-xl z-20 scale-95 group-hover:scale-100"
                              >
                                <Play className="w-6 h-6 fill-current ml-1" />
                              </button>
                              
                              <div className="w-full h-full bg-charcoal/40 flex items-center justify-center text-white/20 select-none">
                                <Film className="w-16 h-16 animate-pulse" />
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="text-center py-32 bg-white rounded-[3rem] border border-charcoal/5">
              <h2 className="text-2xl font-bold text-charcoal/30">
                No {activeTab === 'image' ? 'photography' : 'cinematic videos'} available yet.
              </h2>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
