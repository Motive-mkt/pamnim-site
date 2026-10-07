import { motion } from 'motion/react';
import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  getCloudinaryGalleryPreview,
  getCloudinaryVideoPoster
} from '../services/cloudinaryService';

function GalleryVideoItem({ item, className }: { item: any; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsInView(entry.isIntersecting);
        });
      },
      { threshold: 0.25 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isInView && videoRef.current) {
      videoRef.current.play().catch(() => {});
    } else if (!isInView && videoRef.current) {
      videoRef.current.pause();
    }
  }, [isInView]);

  const videoSrc = getCloudinaryGalleryPreview(item.image);
  const posterUrl = getCloudinaryVideoPoster(item.image);

  return (
    <div ref={containerRef} className="w-full h-full">
      <video
        ref={videoRef}
        src={isInView ? videoSrc : undefined}
        poster={posterUrl}
        autoPlay={isInView}
        muted
        loop
        playsInline
        preload="none"
        className={className}
      />
    </div>
  );
}

export default function Portfolio() {
  const [gallery, setGallery] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'gallery'),
      (snap) => {
        const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any);

        // Newest first
        items.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });

        // Show only the 3 most recent curated items
        setGallery(items.slice(0, 3));
        setLoading(false);
      },
      (err) => {
        console.error("Error subscribing to gallery:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // No photos yet: leave the section out rather than showing an empty frame
  if (!loading && gallery.length === 0) return null;

  return (
    <section className="section bg-cream" id="portfolio">
      <div className="container-x">
        <div id="portfolio-header" className="mb-10 flex flex-col justify-between gap-6 md:mb-14 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="eyebrow mb-4">Recent work</p>
            <h2>Homes we have finished.</h2>
          </div>
          <Link to="/portfolio" className="btn-link self-start md:self-auto">
            View the full portfolio
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:auto-rows-[300px] md:gap-5">
          {loading ? (
            [1, 2, 3].map(i => (
              <div
                key={i}
                className={cn(
                  "animate-pulse rounded-xl bg-charcoal/5 aspect-[4/3] md:aspect-auto",
                  i === 1 && "md:col-span-2 md:row-span-2"
                )}
              />
            ))
          ) : (
            gallery.map((item, index) => {
              const isVideo = item.type === 'video' || (item.image && (item.image.includes('.mp4') || item.image.includes('/video/upload/')));
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                  className={cn(
                    "group relative aspect-[4/3] overflow-hidden rounded-xl bg-charcoal/5 md:aspect-auto",
                    index === 0 ? "md:col-span-2 md:row-span-2" : "md:col-span-1 md:row-span-1"
                  )}
                >
                  {isVideo ? (
                    <GalleryVideoItem
                      item={item}
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                    />
                  ) : (
                    <img
                      src={getCloudinaryGalleryPreview(item.image)}
                      alt=""
                      loading={index === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
