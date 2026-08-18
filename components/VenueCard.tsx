'use client';

/**
 * Venue detail card shown over the map.
 */

import { Review, VenueWithDetails } from '@/lib/supabase';
import {
  Baby,
  CheckCircle2,
  Clock,
  Droplets,
  Loader2,
  Lock,
  Luggage,
  MapPin,
  Navigation,
  Package,
  ShoppingBag,
  ThumbsDown,
  ThumbsUp,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StarRating } from '@/components/StarRating';

interface VenueCardProps {
  venue: VenueWithDetails;
  onClose?: () => void;
  userLat?: number;
  userLng?: number;
}

/**
 * Both labels matter: a room without a lock is useful information, not an
 * absence to hide. dad_friendly is omitted — no venue carries the data.
 */
const AMENITIES = [
  { key: 'has_lock', label: 'Lockable', noLabel: 'No lock', icon: Lock },
  { key: 'has_changing_table', label: 'Changing table', noLabel: 'No changing table', icon: Baby },
  { key: 'has_sink', label: 'Sink', noLabel: 'No sink', icon: Droplets },
  { key: 'has_power_outlet', label: 'Power outlet', noLabel: 'No power', icon: Zap },
  { key: 'stroller_friendly', label: 'Stroller friendly', noLabel: 'Tight space', icon: Luggage },
  { key: 'has_diaper_mat', label: 'Diaper mat', noLabel: 'No diaper mat', icon: Package },
  { key: 'can_buy_diaper', label: 'Buy diapers', noLabel: 'No diapers sold', icon: ShoppingBag },
] as const;

export function VenueCard({ venue, onClose, userLat, userLng }: VenueCardProps) {
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [showIssueBox, setShowIssueBox] = useState(false);
  const [issueNotes, setIssueNotes] = useState('');

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');

  // "Confirmed N days ago" needs the current time, which is impure to read during
  // render. Sampling it once into a ref keeps the value stable across re-renders
  // of the same card, without the extra render an effect would cost.
  const mountedAtRef = useRef(Date.now());

  const daysAgo = useMemo(() => {
    if (!venue.last_confirmed_at) return null;
    const confirmedAt = new Date(venue.last_confirmed_at).getTime();
    return Math.floor((mountedAtRef.current - confirmedAt) / (1000 * 60 * 60 * 24));
  }, [venue.last_confirmed_at]);

  const loadReviews = useCallback(async () => {
    setReviewsLoading(true);
    try {
      const response = await fetch(`/api/reviews?venueId=${encodeURIComponent(venue.id)}`);
      if (!response.ok) throw new Error('Could not load reviews');
      const data = await response.json();
      setReviews(data.reviews ?? []);
    } catch {
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }, [venue.id]);

  // Per-venue state (a half-typed review, an open issue box) is reset by
  // remounting: page.tsx keys this component on venue.id. That is cheaper and
  // harder to get wrong than clearing seven pieces of state by hand.
  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const submitReview = async () => {
    if (reviewRating < 1) {
      setReviewError('Please choose a star rating first');
      return;
    }

    setReviewSubmitting(true);
    setReviewError('');

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venueId: venue.id,
          rating: reviewRating,
          comment: reviewComment,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Could not save your review');
      }

      setShowReviewForm(false);
      setReviewRating(0);
      setReviewComment('');
      await loadReviews();
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Could not save your review');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const sendConfirmation = async (stillThere: boolean, notes?: string) => {
    setConfirmLoading(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/confirm-venue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId: venue.id, stillThere, notes }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Could not send your report');
      }

      setFeedback({
        kind: 'ok',
        text: stillThere
          ? 'Thanks — marked as still accurate.'
          : 'Thanks for flagging it. We will take a look.',
      });
      setShowIssueBox(false);
      setIssueNotes('');
    } catch (err) {
      setFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Could not send your report',
      });
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleReportIssue = () => {
    if (!showIssueBox) {
      setShowIssueBox(true);
      return;
    }
    sendConfirmation(false, issueNotes);
  };

  const handleGetDirections = () => {
    if (!userLat || !userLng) {
      setFeedback({ kind: 'error', text: 'Turn on location to get directions.' });
      return;
    }

    const mapsUrl = `https://maps.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${venue.latitude},${venue.longitude}&travelmode=walking`;
    window.open(mapsUrl, '_blank');
  };

  const distanceText =
    venue.distance_meters < 1000
      ? `${Math.round(venue.distance_meters)}m`
      : `${(venue.distance_meters / 1000).toFixed(1)}km`;

  const verified = !venue.source || venue.source !== 'USER_SUBMITTED';
  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

  return (
    <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-200/80 flex flex-col max-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="p-5 pb-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full mb-2 ${
                verified
                  ? 'bg-teal-50 text-teal-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              {verified ? <CheckCircle2 size={11} /> : <Clock size={11} />}
              {verified ? 'Verified' : 'Community'}
            </span>

            <h2 className="font-display text-xl font-extrabold text-slate-900 leading-tight">
              {venue.name}
            </h2>

            <div className="flex gap-1.5 mt-1.5 text-sm text-slate-500">
              <MapPin size={15} className="shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p>{venue.address}</p>
                {(venue.postal_code || venue.floor_level) && (
                  <p className="text-slate-400">
                    {venue.postal_code}
                    {venue.postal_code && venue.floor_level && ' • '}
                    {venue.floor_level}
                  </p>
                )}
              </div>
            </div>

            {averageRating !== null && (
              <div className="flex items-center gap-1.5 mt-2">
                <StarRating value={averageRating} size={14} />
                <span className="text-xs text-slate-500">
                  {averageRating.toFixed(1)} · {reviews.length} review
                  {reviews.length === 1 ? '' : 's'}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            )}
            <span className="font-display text-lg font-extrabold text-teal-700">
              {distanceText}
            </span>
          </div>
        </div>

        {daysAgo !== null && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full">
            <CheckCircle2 size={12} />
            Confirmed {daysAgo === 0 ? 'today' : `${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`}
          </p>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto scroll-hide p-5 space-y-5">
        {/* Amenities */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
            Amenities
          </p>
          <div className="flex flex-wrap gap-1.5">
            {AMENITIES.map(({ key, label, noLabel, icon: Icon }) => {
              const available = Boolean(venue[key as keyof VenueWithDetails]);
              return (
                <span
                  key={key}
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                    available
                      ? 'bg-teal-50 text-teal-700 ring-1 ring-teal-100'
                      : 'bg-slate-50 text-slate-400'
                  }`}
                >
                  <Icon size={12} />
                  {available ? label : noLabel}
                </span>
              );
            })}
          </div>
        </div>

        {/* Directions */}
        <button
          onClick={handleGetDirections}
          className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-xl font-semibold transition"
        >
          <Navigation size={17} />
          Get walking directions
        </button>

        {/* Still accurate? */}
        <div className="bg-slate-50 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-900">Is this still accurate?</p>

          <div className="flex gap-2">
            <button
              onClick={() => sendConfirmation(true)}
              disabled={confirmLoading}
              className="flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white py-2.5 rounded-xl font-semibold text-sm transition"
            >
              <ThumbsUp size={16} />
              Yes
            </button>
            <button
              onClick={() => sendConfirmation(false)}
              disabled={confirmLoading}
              className="flex-1 flex items-center justify-center gap-2 bg-white border border-slate-300 hover:border-slate-400 disabled:opacity-50 text-slate-700 py-2.5 rounded-xl font-semibold text-sm transition"
            >
              <ThumbsDown size={16} />
              No
            </button>
          </div>

          {feedback && (
            <p
              role="status"
              className={`text-sm font-medium ${
                feedback.kind === 'ok' ? 'text-teal-700' : 'text-red-600'
              }`}
            >
              {feedback.text}
            </p>
          )}

          {showIssueBox && (
            <textarea
              value={issueNotes}
              onChange={e => setIssueNotes(e.target.value)}
              maxLength={500}
              rows={3}
              autoFocus
              placeholder="What's wrong? e.g. room is locked, moved to level 3, no longer there"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          )}

          <div className="flex gap-2">
            <button
              onClick={handleReportIssue}
              disabled={confirmLoading}
              className="flex-1 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:text-slate-300 py-2 transition"
            >
              {showIssueBox ? 'Send report' : 'Report an issue'}
            </button>
            {showIssueBox && (
              <button
                onClick={() => {
                  setShowIssueBox(false);
                  setIssueNotes('');
                }}
                className="px-4 text-sm font-medium text-slate-500 hover:text-slate-700 py-2 transition"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Reviews */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Reviews
            </p>
            {!showReviewForm && (
              <button
                onClick={() => setShowReviewForm(true)}
                className="text-sm font-semibold text-teal-700 hover:text-teal-800 transition"
              >
                Write a review
              </button>
            )}
          </div>

          {showReviewForm && (
            <div className="bg-teal-50/60 ring-1 ring-teal-100 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-700">Your rating</span>
                <StarRating
                  value={reviewRating}
                  onChange={setReviewRating}
                  disabled={reviewSubmitting}
                  size={22}
                />
              </div>

              <textarea
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="How was it? Clean, quiet, easy to find? (optional)"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />

              {reviewError && (
                <p role="alert" className="text-sm text-red-600">
                  {reviewError}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={submitReview}
                  disabled={reviewSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-sm py-2.5 rounded-xl font-semibold transition"
                >
                  {reviewSubmitting && <Loader2 size={15} className="animate-spin" />}
                  {reviewSubmitting ? 'Posting…' : 'Post review'}
                </button>
                <button
                  onClick={() => {
                    setShowReviewForm(false);
                    setReviewError('');
                  }}
                  disabled={reviewSubmitting}
                  className="px-4 text-sm font-medium text-slate-600 hover:text-slate-800 py-2.5 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {reviewsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="animate-pulse space-y-1.5">
                  <div className="h-3 bg-slate-200 rounded w-24" />
                  <div className="h-3 bg-slate-100 rounded w-full" />
                  <div className="h-3 bg-slate-100 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <p className="text-sm text-slate-500">
              No reviews yet — be the first to help other parents.
            </p>
          ) : (
            <ul className="space-y-3">
              {reviews.map(review => (
                <li key={review.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <StarRating value={review.rating} size={13} />
                    <span className="text-xs text-slate-400">
                      {new Date(review.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="text-slate-700 mt-1 whitespace-pre-wrap break-words">
                      {review.comment}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
