import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { Star, ExternalLink, CheckCircle2, MessageSquareHeart } from 'lucide-react';
import { cn } from '../lib/utils';

interface ProjectReviewCardProps {
  project: {
    id: string;
    name: string;
    clientId: string;
  };
}

export default function ProjectReviewCard({ project }: ProjectReviewCardProps) {
  const { profile } = useAuth();
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingReview, setExistingReview] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if client already reviewed this project
  useEffect(() => {
    async function checkExistingReview() {
      if (!profile?.uid || !project?.id) {
        setLoading(false);
        return;
      }
      try {
        const q = query(
          collection(db, 'reviews'),
          where('projectId', '==', project.id),
          where('clientId', '==', profile.uid)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          setExistingReview(snap.docs[0].data());
          setSubmitted(true);
        }
      } catch (err) {
        console.error('Error checking existing review:', err);
      } finally {
        setLoading(false);
      }
    }

    checkExistingReview();
  }, [project.id, profile?.uid]);

  const placeId = ((import.meta as any).env?.VITE_GOOGLE_PLACE_ID as string | undefined) || 'ChIJl37WkPj_sokRNChh2NN5__o';
  const googleReviewUrl = `https://search.google.com/local/writereview?placeid=${placeId.trim()}`;

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;

    setSubmitting(true);
    try {
      const newReview = {
        projectId: project.id,
        projectName: project.name,
        clientId: profile.uid,
        clientName: profile.name || 'Client',
        rating,
        comment: comment.trim(),
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'reviews'), newReview);
      setExistingReview(newReview);
      setSubmitted(true);

      // Open official Google Review form in a new tab
      try {
        window.open(googleReviewUrl, '_blank', 'noopener,noreferrer');
      } catch (windowErr) {
        console.warn('Could not open new window automatically:', windowErr);
      }
    } catch (err) {
      console.error('Error submitting review:', err);
      alert('Could not submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-charcoal/10 shadow-sm space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-ochre/10 text-ochre flex items-center justify-center">
          <MessageSquareHeart className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-charcoal">How was your experience with Pamnim?</h3>
          <p className="text-xs text-charcoal/60">Your feedback helps us continue delivering handcrafted luxury design across Kenya.</p>
        </div>
      </div>

      {submitted ? (
        <div className="p-6 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3 animate-fade-in">
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Review submitted — thank you!</span>
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={cn(
                  "w-5 h-5",
                  star <= (existingReview?.rating || rating)
                    ? "text-ochre fill-ochre"
                    : "text-charcoal/20"
                )}
              />
            ))}
            <span className="text-xs font-bold text-charcoal/70 ml-2">
              {existingReview?.rating || rating} of 5 Stars
            </span>
          </div>

          {existingReview?.comment && (
            <p className="text-xs text-charcoal/70 italic bg-white/80 p-3 rounded-xl border border-emerald-100">
              "{existingReview.comment}"
            </p>
          )}

          <p className="text-xs text-charcoal/60 pt-1">
            Thank you for your review! We've also opened Google Reviews so you can share your experience with other homeowners looking for interior design.
          </p>

          <a
            href={googleReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs font-bold text-ochre hover:text-ochre-dark pt-1"
          >
            <span>Open Pamnim on Google Reviews</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      ) : (
        <form onSubmit={handleSubmitReview} className="space-y-4">
          {/* Star Rating Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/50 mb-2">
              Your Rating
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const isLit = (hoverRating !== null ? hoverRating : rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    className="p-1 rounded-lg transition-transform hover:scale-110 focus:outline-none cursor-pointer"
                  >
                    <Star
                      className={cn(
                        "w-7 h-7 transition-colors",
                        isLit ? "text-ochre fill-ochre" : "text-charcoal/20"
                      )}
                    />
                  </button>
                );
              })}
              <span className="text-xs font-bold text-charcoal/70 ml-2">
                {rating === 5 ? 'Exceptional (5/5)' : rating === 4 ? 'Very Good (4/5)' : rating === 3 ? 'Good (3/5)' : `${rating}/5`}
              </span>
            </div>
          </div>

          {/* Comment Area */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/50 mb-1.5">
              Share details of your experience (optional)
            </label>
            <textarea
              rows={3}
              placeholder="Tell us what you loved about our craftsmanship, timeline, or design team..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full p-3.5 bg-cream/40 border border-charcoal/15 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre focus:bg-white"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <p className="text-[11px] text-charcoal/50">
              Submitting saves your review and opens our official Google Review page in a new tab.
            </p>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-2xl bg-ochre text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-ochre/20 hover:bg-ochre-dark transition-all disabled:opacity-50 cursor-pointer shrink-0"
            >
              <Star className="w-3.5 h-3.5 fill-white" />
              <span>{submitting ? 'Submitting...' : 'Submit Review'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
