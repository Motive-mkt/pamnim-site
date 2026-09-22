import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { 
  Star, 
  ExternalLink, 
  CheckCircle2, 
  MessageSquareHeart, 
  Sparkles, 
  ArrowRight,
  ShieldCheck,
  Building,
  User,
  HeartHandshake
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';

export default function ClientReviewPage() {
  const { profile, user } = useAuth();
  
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [clientName, setClientName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copiedReviewText, setCopiedReviewText] = useState(false);

  useEffect(() => {
    if (profile?.name) {
      setClientName(profile.name);
    }
  }, [profile?.name]);

  const placeId = ((import.meta as any).env?.VITE_GOOGLE_PLACE_ID as string | undefined) || '';
  const googleReviewUrl = placeId 
    ? `https://search.google.com/local/writereview?placeid=${placeId.trim()}`
    : `https://www.google.com/maps/search/?api=1&query=Pamnim+Interior+Designers`;

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      alert('Please enter your name.');
      return;
    }
    if (!comment.trim()) {
      alert('Please enter a few words about your experience.');
      return;
    }

    setSubmitting(true);
    try {
      const reviewData = {
        clientName: clientName.trim(),
        projectName: projectName.trim() || 'Residential & Commercial Interior Project',
        clientId: user?.uid || null,
        clientEmail: user?.email || null,
        rating,
        comment: comment.trim(),
        source: 'client_review_link',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'reviews'), reviewData);
      setSubmitted(true);

      // Attempt to open the Google Review page in a new window
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

  const handleCopyReviewText = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(comment.trim());
      setCopiedReviewText(true);
      setTimeout(() => setCopiedReviewText(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-cream/40 flex flex-col justify-between font-sans text-charcoal">
      <Header />

      <main className="flex-1 pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Header Badge & Title */}
          <div className="text-center mb-8 space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ochre/10 text-ochre text-xs font-bold uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Pamnim Client Experience</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-charcoal tracking-tight">
              Share Your Review & Experience
            </h1>
            <p className="text-sm sm:text-base text-charcoal/70 max-w-lg mx-auto">
              Your feedback helps us maintain our uncompromising standards of craftsmanship and bespoke interior design across Kenya.
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-charcoal/10 shadow-xl shadow-charcoal/5">
            {submitted ? (
              <div className="space-y-6 text-center animate-fade-in py-4">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-charcoal">
                    Thank You, {clientName}!
                  </h2>
                  <p className="text-sm text-charcoal/70 max-w-md mx-auto">
                    Your feedback has been submitted to the Pamnim team. We deeply appreciate your partnership and trust in our design work.
                  </p>
                </div>

                <div className="p-6 bg-cream/50 rounded-2xl border border-charcoal/10 text-left space-y-3">
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={cn(
                          "w-5 h-5",
                          star <= rating
                            ? "text-ochre fill-ochre"
                            : "text-charcoal/20"
                        )}
                      />
                    ))}
                    <span className="text-xs font-bold text-charcoal/80 ml-2">
                      {rating} of 5 Stars
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-charcoal/80 italic bg-white p-4 rounded-xl border border-charcoal/5">
                    "{comment}"
                  </p>

                  {projectName && (
                    <p className="text-[11px] font-bold text-charcoal/50 uppercase tracking-wider">
                      Project: {projectName}
                    </p>
                  )}
                </div>

                {/* Direct Google Review Callout */}
                <div className="p-6 bg-ochre/5 border border-ochre/20 rounded-2xl text-left space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-ochre/20 text-ochre flex items-center justify-center shrink-0 mt-0.5">
                      <HeartHandshake className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-charcoal">
                        Help us on Google Reviews!
                      </h3>
                      <p className="text-xs text-charcoal/70 mt-0.5">
                        Copy your written review and paste it directly onto our Google Business profile to help other homeowners discover Pamnim.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleCopyReviewText}
                      className="px-4 py-2.5 rounded-xl bg-white border border-charcoal/15 text-xs font-bold text-charcoal hover:border-ochre hover:text-ochre transition-all cursor-pointer text-center"
                    >
                      {copiedReviewText ? 'Review Copied to Clipboard!' : 'Copy Review Text'}
                    </button>

                    <a
                      href={googleReviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 rounded-xl bg-ochre text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-ochre/20 hover:bg-ochre-dark transition-all"
                    >
                      <span>Open Google Reviews</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-xs font-bold text-charcoal/60 hover:text-charcoal transition-colors"
                  >
                    <span>Return to Pamnim Homepage</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="space-y-6">
                {/* Rating Stars Section */}
                <div className="text-center pb-4 border-b border-charcoal/10">
                  <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/50 mb-3">
                    Overall Experience Rating
                  </label>
                  <div className="flex items-center justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isLit = (hoverRating !== null ? hoverRating : rating) >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(null)}
                          className="p-1.5 rounded-xl transition-all hover:scale-125 focus:outline-none cursor-pointer"
                        >
                          <Star
                            className={cn(
                              "w-8 h-8 sm:w-10 sm:h-10 transition-colors drop-shadow-sm",
                              isLit ? "text-ochre fill-ochre" : "text-charcoal/20"
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 text-sm font-bold text-ochre">
                    {rating === 5 && '★★★★★ Exceptional (5 / 5)'}
                    {rating === 4 && '★★★★☆ Very Good (4 / 5)'}
                    {rating === 3 && '★★★☆☆ Good (3 / 5)'}
                    {rating === 2 && '★★☆☆☆ Fair (2 / 5)'}
                    {rating === 1 && '★☆☆☆☆ Needs Improvement (1 / 5)'}
                  </div>
                </div>

                {/* Client Name Input */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/60 mb-2">
                    Your Full Name <span className="text-ochre">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-charcoal/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sarah Mwangi"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-cream/30 border border-charcoal/15 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre focus:bg-white"
                    />
                  </div>
                </div>

                {/* Project / Residence (Optional) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/60 mb-2">
                    Project or Residence Name <span className="text-charcoal/40 font-normal normal-case">(optional)</span>
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-charcoal/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="e.g. Karen Villa Master Suite, Kilimani Duplex, or Office"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-cream/30 border border-charcoal/15 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre focus:bg-white"
                    />
                  </div>
                </div>

                {/* Review Details Textarea */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/60 mb-2">
                    Your Feedback & Review <span className="text-ochre">*</span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Tell us what you appreciated about our craftsmanship, timeline, finish quality, or team communication..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full p-4 bg-cream/30 border border-charcoal/15 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre focus:bg-white"
                  />
                  <p className="text-[11px] text-charcoal/50 mt-1.5">
                    Your review will be verified by our team and posted to help clients discover Pamnim.
                  </p>
                </div>

                {/* Submit Button */}
                <div className="pt-2 space-y-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 rounded-2xl bg-ochre text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-ochre/25 hover:bg-ochre-dark transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Star className="w-4 h-4 fill-white" />
                    <span>{submitting ? 'Submitting Your Review...' : 'Submit Review to Pamnim'}</span>
                  </button>

                  <div className="flex items-center justify-center gap-2 text-[11px] text-charcoal/50">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Submitting saves your review and opens our Google Reviews page in a new tab.</span>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
