import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Star } from 'lucide-react';
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
  if (!fullName || !fullName.trim()) return 'Client';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

function Stars({ value, className = 'h-4 w-4' }: { value: number; className?: string }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={`${className} ${i < Math.round(value) ? 'fill-ochre-light text-ochre-light' : 'text-charcoal/20'}`}
        />
      ))}
    </span>
  );
}

/**
 * Only shows real client reviews. With fewer than two written reviews the whole section is left out,
 * so visitors never see an empty "reviews will appear here" box or an unbacked star rating.
 */
export default function Testimonials() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [average, setAverage] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReviews() {
      try {
        const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(50));
        const snap = await getDocs(q);
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReviewItem));

        const rated = all.filter((r) => typeof r.rating === 'number' && r.rating > 0);
        setTotal(rated.length);
        setAverage(rated.length ? rated.reduce((sum, r) => sum + r.rating, 0) / rated.length : null);

        setReviews(
          all
            .filter((r) => (r.rating || 0) >= 4 && r.comment && r.comment.trim().length > 0)
            .slice(0, 6)
        );
      } catch (err) {
        console.error('Error fetching testimonials:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchReviews();
  }, []);

  if (loading || reviews.length < 2) return null;

  return (
    <section className="section bg-paper border-t border-charcoal/[0.07]" id="testimonials">
      <div className="container-x">
        <div id="testimonials-header" className="mb-10 flex flex-col justify-between gap-6 md:mb-14 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="eyebrow mb-4">Client reviews</p>
            <h2>In their words.</h2>
          </div>
          {average !== null && total >= 3 && (
            <div className="flex items-center gap-3">
              <span className="font-serif text-5xl leading-none text-charcoal">{average.toFixed(1)}</span>
              <div>
                <Stars value={average} />
                <p className="mt-1 text-sm text-charcoal/70">
                  from {total} client review{total === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((rev, index) => (
            <motion.figure
              key={rev.id}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: index * 0.06 }}
              className="flex flex-col justify-between rounded-xl border border-charcoal/10 bg-white p-7"
            >
              <div>
                <Stars value={rev.rating} className="h-4 w-4" />
                <blockquote className="mt-4 font-serif text-[1.35rem] leading-snug text-charcoal">
                  &ldquo;{rev.comment}&rdquo;
                </blockquote>
              </div>
              <figcaption className="mt-6 flex items-end justify-between gap-4 border-t border-charcoal/10 pt-4 text-sm">
                <div>
                  <p className="font-semibold text-charcoal">{formatPrivateName(rev.clientName)}</p>
                  {rev.projectName && <p className="text-charcoal/65">{rev.projectName}</p>}
                </div>
                {rev.createdAt && (
                  <time className="shrink-0 text-charcoal/65" dateTime={rev.createdAt}>
                    {new Date(rev.createdAt).toLocaleDateString('en-KE', { month: 'short', year: 'numeric' })}
                  </time>
                )}
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
