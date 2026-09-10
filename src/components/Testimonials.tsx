import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Star, MessageSquareQuote } from 'lucide-react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface ReviewItem {
  id: string;
  projectId?: string;
  projectName?: string;
  clientId?: string;
  clientName?: string;
  rating: number;
  comment?: string;
  createdAt?: string;
}

function formatPrivateName(fullName?: string): string {
  if (!fullName || !fullName.trim()) return 'Verified Client';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}.`;
}

export default function Testimonials() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReviews() {
      try {
        // Query recent reviews, then filter for rating >= 4
        const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(20));
        const snap = await getDocs(q);
        const docs = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as ReviewItem))
          .filter(r => (r.rating || 0) >= 4 && r.comment && r.comment.trim().length > 0)
          .slice(0, 6);
        setReviews(docs);
      } catch (err) {
        console.error('Error fetching testimonials:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchReviews();
  }, []);

  return (
    <section className="py-24 bg-white" id="testimonials">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div id="testimonials-header" className="text-center mb-16">
          <span className="text-xs font-bold tracking-[0.2em] text-ochre uppercase mb-4 block">CLIENT LOVE</span>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">A 5-star experience.</h2>
          <div className="flex justify-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-6 h-6 fill-ochre text-ochre" />
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-charcoal/40 text-sm animate-pulse">
            Loading verified client reviews...
          </div>
        ) : reviews.length < 2 ? (
          <div className="max-w-xl mx-auto text-center py-12 px-6 rounded-3xl bg-cream/50 border border-charcoal/5">
            <MessageSquareQuote className="w-8 h-8 text-ochre/60 mx-auto mb-3" />
            <p className="text-charcoal/60 text-sm font-medium">
              New reviews from clients will appear here.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {reviews.map((rev, index) => {
              const isDark = index % 2 === 1;
              return (
                <motion.div
                  key={rev.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-8 rounded-3xl flex flex-col justify-between transition-all ${
                    isDark
                      ? 'bg-charcoal text-white'
                      : 'bg-cream text-charcoal border border-charcoal/5'
                  }`}
                >
                  <div>
                    <div className="flex gap-1 mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < rev.rating
                              ? 'fill-ochre text-ochre'
                              : isDark
                              ? 'text-white/20'
                              : 'text-charcoal/20'
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-sm leading-relaxed italic mb-6 ${
                      isDark ? 'text-white/80' : 'text-charcoal/80'
                    }`}>
                      "{rev.comment}"
                    </p>
                  </div>
                  <div className="pt-4 border-t border-current/10 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">{formatPrivateName(rev.clientName)}</p>
                      {rev.projectName ? (
                        <p className={`text-xs ${isDark ? 'text-white/50' : 'text-charcoal/40'}`}>
                          {rev.projectName}
                        </p>
                      ) : (
                        <p className={`text-xs ${isDark ? 'text-white/50' : 'text-charcoal/40'}`}>
                          Verified Client
                        </p>
                      )}
                    </div>
                    {rev.createdAt && (
                      <span className={`text-[10px] ${isDark ? 'text-white/40' : 'text-charcoal/40'}`}>
                        {new Date(rev.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

