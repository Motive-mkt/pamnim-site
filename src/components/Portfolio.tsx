import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

export default function Portfolio() {
  const [gallery, setGallery] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGallery() {
      try {
        const q = query(collection(db, 'gallery'), orderBy('createdAt', 'desc'), limit(3));
        const snap = await getDocs(q);
        setGallery(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Error fetching gallery:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchGallery();
  }, []);

  return (
    <section className="py-24 bg-cream" id="portfolio">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div id="portfolio-header" className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div className="max-w-2xl">
            <span className="text-xs font-bold tracking-[0.2em] text-ochre uppercase mb-4 block">GALLERY</span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Recent projects & spaces.</h2>
            <p className="text-lg text-charcoal/60">
              A glimpse into the homes and spaces we've transformed for clients across the region.
            </p>
          </div>
          <Link to="/portfolio" className="text-ochre font-bold flex items-center gap-2 group">
            View all projects <span className="group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[300px]">
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="bg-charcoal/5 animate-pulse rounded-3xl" />
            ))
          ) : gallery.length > 0 ? (
            gallery.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className={cn(
                  "relative overflow-hidden rounded-3xl group cursor-pointer",
                  index === 0 ? "md:col-span-2 md:row-span-2" : "md:col-span-1 md:row-span-1"
                )}
              >
                <img
                  src={item.image}
                  alt={item.title || "Gallery Image"}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-8">
                  <span className="text-ochre-light text-xs font-bold uppercase tracking-widest mb-2">{item.category}</span>
                  <h3 className="text-white text-2xl font-bold">{item.title}</h3>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-charcoal/10 rounded-3xl">
              <p className="text-charcoal/30 font-bold">No gallery images added yet.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
