import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import LeadQualifyingForm from '../components/LeadQualifyingForm';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Play, Image as ImageIcon, Film, Trash2, AlertTriangle, X, CheckCircle2, Sparkles } from 'lucide-react';
import { optimizeCloudinaryUrl, getCloudinaryVideoPoster } from '../services/cloudinaryService';

interface PortfolioItem {
  id: string;
  title: string;
  category: string;
  image: string; // url (could be image or video path)
  type?: 'image' | 'video';
  createdAt?: any;
  source?: 'gallery' | 'portfolio_assets';
  isGallery?: boolean;
}

export default function PortfolioPage() {
  const { isStaff } = useAuth();
  const [projects, setProjects] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');
  const [deletingItem, setDeletingItem] = useState<PortfolioItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showLeadModal, setShowLeadModal] = useState(false);

  // Video playback states - mapping item ID to playing boolean
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  const handleDeleteItem = async () => {
    if (!deletingItem || isDeleting) return;
    setIsDeleting(true);
    try {
      const collectionName = deletingItem.source || (deletingItem.isGallery ? 'gallery' : 'portfolio_assets');
      await deleteDoc(doc(db, collectionName, deletingItem.id));
      setProjects(prev => prev.filter(p => p.id !== deletingItem.id));
      setToast(`"${deletingItem.title || 'Item'}" deleted successfully.`);
      setTimeout(() => setToast(null), 4000);
      setDeletingItem(null);
    } catch (err: any) {
      console.error('Error deleting portfolio item:', err);
      alert('Failed to delete item: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    let galleryList: PortfolioItem[] = [];
    let portfolioList: PortfolioItem[] = [];
    let galleryLoaded = false;
    let portfolioLoaded = false;

    const updateCombined = () => {
      // Sort gallery items newest first
      const sortedGallery = [...galleryList].sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      // Sort portfolio assets newest first
      const sortedPortfolio = [...portfolioList].sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      // Deduplicate images and place all gallery section items at the very top
      const combined: PortfolioItem[] = [];
      const seenUrls = new Set<string>();

      // 1. Gallery items always placed at the very top
      for (const item of sortedGallery) {
        if (item.image && !seenUrls.has(item.image)) {
          seenUrls.add(item.image);
          combined.push(item);
        }
      }

      // 2. Followed by dedicated portfolio assets
      for (const item of sortedPortfolio) {
        if (item.image && !seenUrls.has(item.image)) {
          seenUrls.add(item.image);
          combined.push(item);
        }
      }

      setProjects(combined);
      if (galleryLoaded && portfolioLoaded) {
        setLoading(false);
      }
    };

    // Real-time listener for Gallery collection
    const unsubGallery = onSnapshot(
      collection(db, 'gallery'),
      (snap) => {
        galleryList = snap.docs.map(doc => {
          const data = doc.data();
          const isVideo = data.type === 'video' || (data.image && (data.image.includes('.mp4') || data.image.includes('/video/upload/')));
          return {
            id: doc.id,
            title: data.title || '',
            category: data.category || 'Featured Gallery',
            image: data.image || '',
            type: isVideo ? 'video' : 'image',
            createdAt: data.createdAt,
            source: 'gallery',
            isGallery: true
          } as PortfolioItem;
        });
        galleryLoaded = true;
        updateCombined();
      },
      (err) => {
        console.error('Error subscribing to gallery collection:', err);
        galleryLoaded = true;
        updateCombined();
      }
    );

    // Real-time listener for Portfolio Assets collection
    const unsubPortfolio = onSnapshot(
      collection(db, 'portfolio_assets'),
      (snap) => {
        portfolioList = snap.docs.map(doc => {
          const data = doc.data();
          const isVideo = data.type === 'video' || (data.image && (data.image.includes('.mp4') || data.image.includes('/video/upload/')));
          return {
            id: doc.id,
            title: data.title || '',
            category: data.category || 'Luxury Spaces',
            image: data.image || '',
            type: isVideo ? 'video' : 'image',
            createdAt: data.createdAt,
            source: 'portfolio_assets',
            isGallery: false
          } as PortfolioItem;
        });
        portfolioLoaded = true;
        updateCombined();
      },
      (err) => {
        console.error('Error subscribing to portfolio_assets collection:', err);
        portfolioLoaded = true;
        updateCombined();
      }
    );

    return () => {
      unsubGallery();
      unsubPortfolio();
    };
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
                        className="group relative aspect-[4/5] overflow-hidden rounded-3xl cursor-pointer bg-white border border-charcoal/5 elevation-subtle hover:elevation-raised transition-all"
                      >
                        <img 
                          src={optimizeCloudinaryUrl(project.image, 'image')} 
                          alt={project.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                        {project.isGallery && (
                          <div className="absolute top-4 left-4 z-20 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5 shadow-sm pointer-events-none">
                            <Sparkles className="w-3 h-3 text-ochre" />
                            <span>Featured Gallery</span>
                          </div>
                        )}
                        {(project.category || project.title) && (
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent flex flex-col justify-end p-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            {project.category && <span className="text-ochre-light text-xs font-bold uppercase tracking-widest mb-1">{project.category}</span>}
                            {project.title && <h3 className="text-white text-2xl font-bold tracking-tight">{project.title}</h3>}
                          </div>
                        )}
                        {/* Staff / Owner Quick Delete Button */}
                        {isStaff && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingItem(project);
                            }}
                            className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-red-600/90 hover:bg-red-600 text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            title="Delete this portfolio photo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
                        className="bg-white rounded-3xl overflow-hidden border border-charcoal/5 elevation-subtle hover:elevation-raised transition-all flex flex-col group relative"
                      >
                        {project.isGallery && (
                          <div className="absolute top-4 left-4 z-30 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5 shadow-sm pointer-events-none">
                            <Sparkles className="w-3 h-3 text-ochre" />
                            <span>Featured Gallery</span>
                          </div>
                        )}
                        {/* Staff / Owner Quick Delete Button */}
                        {isStaff && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingItem(project);
                            }}
                            className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-red-600/90 hover:bg-red-600 text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            title="Delete this portfolio video"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {/* Widescreen Video Player Canvas */}
                        <div className="relative aspect-video w-full bg-black overflow-hidden select-none">
                          {playingVideoId === project.id ? (
                            <video
                              src={optimizeCloudinaryUrl(project.image, 'video')}
                              poster={getCloudinaryVideoPoster(project.image)}
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
                              
                              {getCloudinaryVideoPoster(project.image) ? (
                                <img
                                  src={getCloudinaryVideoPoster(project.image)}
                                  alt={project.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-charcoal/40 flex items-center justify-center text-white/20 select-none">
                                  <Film className="w-16 h-16 animate-pulse" />
                                </div>
                              )}
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

      {/* Sticky Bottom-Center CTA: "Be our next portfolio? Tell us about your project" */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[92vw] sm:max-w-md w-full px-4 pointer-events-auto">
        <button
          type="button"
          onClick={() => setShowLeadModal(true)}
          className="w-full py-3.5 px-6 rounded-xl bg-ochre hover:bg-ochre-dark text-white text-xs sm:text-sm font-bold shadow-2xl shadow-ochre/35 border border-white/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer backdrop-blur-md"
        >
          <span className="truncate">Be our next portfolio? Tell us about your project</span>
        </button>
      </div>

      {/* Modal containing shared LeadQualifyingForm */}
      {showLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl elevation-modal overflow-hidden animate-scale-up my-8 max-h-[90vh] overflow-y-auto">
            <LeadQualifyingForm
              variant="modal"
              source="portfolio_modal"
              onClose={() => setShowLeadModal(false)}
              title="Be our next featured project"
              subtitle="Tell us about your home and design dreams. We'll craft a bespoke spatial transformation."
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal for Staff/Owner */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl border border-red-200 elevation-modal overflow-hidden p-6 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-charcoal">Delete Item</h3>
                  <p className="text-xs text-red-700 font-medium">Permanent Action ({deletingItem.isGallery ? 'Home Gallery Item' : 'Portfolio Catalog'})</p>
                </div>
              </div>
              <button
                onClick={() => setDeletingItem(null)}
                disabled={isDeleting}
                className="p-1.5 rounded-xl text-charcoal/40 hover:text-charcoal hover:bg-cream transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-charcoal/70 leading-relaxed">
              Are you sure you want to permanently delete this {deletingItem.type || 'portfolio'} item: <strong className="text-charcoal font-bold">{deletingItem.title || '(Untitled Item)'}</strong>? This cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-charcoal/20 text-xs font-bold text-charcoal/70 hover:bg-cream transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-red-600/20 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Deleting...' : 'Delete Item'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
          <div className="p-4 bg-charcoal text-white rounded-2xl shadow-xl flex items-center gap-3 border border-charcoal/20 text-xs font-bold">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{toast}</span>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
