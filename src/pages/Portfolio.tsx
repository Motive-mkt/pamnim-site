import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import LeadQualifyingForm from '../components/LeadQualifyingForm';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Play, Image as ImageIcon, Film, Trash2, AlertTriangle, X, CheckCircle2, Plus } from 'lucide-react';
import { optimizeCloudinaryUrl, getCloudinaryVideoPoster } from '../services/cloudinaryService';
import PortfolioUploadModal from '../components/PortfolioUploadModal';

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
  const [showUploadModal, setShowUploadModal] = useState(false);

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
    <div className="flex min-h-screen flex-col bg-cream">
      <Header />

      <PageHeader
        eyebrow="Portfolio"
        title="Our work."
        description="Photography and walkthrough films from homes we have designed and finished."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Portfolio' }]}
      />

      <main className="flex-1 pb-32 pt-10 md:pt-14">
        {/* Tabs */}
        <div id="portfolio-tabs" className="container-x mb-10 flex flex-wrap items-center justify-between gap-4 select-none">
          <div role="tablist" aria-label="Portfolio media" className="inline-flex gap-1 rounded-lg bg-charcoal/[0.06] p-1">
            {([
              { id: 'image', label: 'Photography', icon: ImageIcon },
              { id: 'video', label: 'Walkthrough films', icon: Film }
            ] as const).map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-10 items-center gap-2 rounded-md px-5 text-sm font-semibold transition-colors ${
                  activeTab === tab.id ? 'bg-white text-charcoal shadow-sm' : 'text-charcoal/65 hover:text-charcoal'
                }`}
              >
                <tab.icon className="h-4 w-4" aria-hidden="true" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Staff / Owner upload */}
          {isStaff && (
            <button onClick={() => setShowUploadModal(true)} className="btn btn-primary btn-sm">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Upload media
            </button>
          )}
        </div>

        <div className="container-x">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                    {filteredProjects.map((project, index) => (
                      <motion.div
                        key={project.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="group relative aspect-[4/5] overflow-hidden rounded-xl bg-white border border-charcoal/10"
                      >
                        <img 
                          src={optimizeCloudinaryUrl(project.image, 'image')} 
                          alt=""
                          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                          referrerPolicy="no-referrer"
                        />
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                    {filteredProjects.map((project, index) => (
                      <motion.div
                        key={project.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-white rounded-3xl overflow-hidden border border-charcoal/5 elevation-subtle hover:elevation-raised transition-all flex flex-col group relative"
                      >
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
                              {/* Elegant play button overlay */}
                              <button 
                                onClick={() => setPlayingVideoId(project.id)}
                                className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-cream hover:bg-ochre hover:text-white transition-all duration-300 flex items-center justify-center text-charcoal shadow-xl z-20 scale-95 group-hover:scale-100 cursor-pointer"
                                aria-label="Play video"
                              >
                                <Play className="w-6 h-6 fill-current ml-1" />
                              </button>
                              
                              {getCloudinaryVideoPoster(project.image) ? (
                                <img
                                  src={getCloudinaryVideoPoster(project.image)}
                                  alt=""
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
            <div className="text-center py-32 bg-white rounded-3xl border border-charcoal/5">
              <h2 className="text-2xl font-bold text-charcoal/60">
                No {activeTab === 'image' ? 'photography' : 'cinematic videos'} available yet.
              </h2>
            </div>
          )}
        </div>
      </main>

      {/* Sticky call to action */}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
        <button
          type="button"
          onClick={() => setShowLeadModal(true)}
          className="btn btn-dark btn-lg pointer-events-auto max-w-full shadow-xl"
        >
          <span className="truncate">Be our next portfolio? Tell us about your project</span>
        </button>
      </div>

      {/* Project enquiry dialog */}
      <Modal open={showLeadModal} onClose={() => setShowLeadModal(false)} labelledBy="portfolio-lead-title" size="lg">
        <LeadQualifyingForm
          variant="modal"
          source="portfolio_modal"
          onClose={() => setShowLeadModal(false)}
          title="Be our next featured project"
          subtitle="Tell us about your home and what you have in mind. We will come back with a clear plan."
        />
      </Modal>

      {/* Delete Confirmation Modal for Staff/Owner */}
      {deletingItem && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-charcoal/60 animate-fade-in">
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
                className="p-1.5 rounded-xl text-charcoal/60 hover:text-charcoal hover:bg-cream transition-colors"
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
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
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

      {/* Staff Upload to Portfolio Modal */}
      <PortfolioUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={() => {
          setToast("Media successfully added to Portfolio!");
          setTimeout(() => setToast(null), 4000);
        }}
      />

      <Footer />
    </div>
  );
}
