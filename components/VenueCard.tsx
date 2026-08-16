'use client';

/**
 * Venue detail card shown in bottom sheet / detail view
 */

import { Review, VenueWithDetails } from '@/lib/supabase';
import {
  Lock,
  Baby,
  Droplets,
  Zap,
  Luggage,
  Users,
  MapPin,
  CheckCircle2,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Package,
  ShoppingBag,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { StarRating } from '@/components/StarRating';

interface VenueCardProps {
  venue: VenueWithDetails;
  onClose?: () => void;
  userLat?: number;
  userLng?: number;
}

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

  useEffect(() => {
    // Reset per-venue state when the card switches to a different room, or the
    // previous room's reviews and half-typed comment would linger.
    setShowReviewForm(false);
    setReviewRating(0);
    setReviewComment('');
    setReviewError('');
    setFeedback(null);
    setShowIssueBox(false);
    setIssueNotes('');
    loadReviews();
  }, [venue.id, loadReviews]);

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

  const handleConfirm = (stillThere: boolean) => sendConfirmation(stillThere);

  const handleReportIssue = () => {
    if (!showIssueBox) {
      setShowIssueBox(true);
      return;
    }
    sendConfirmation(false, issueNotes);
  };

  const handleGetDirections = () => {
    if (!userLat || !userLng) {
      alert('Please enable location access first');
      return;
    }

    // Google Maps directions URL
    const mapsUrl = `https://maps.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${venue.latitude},${venue.longitude}&travelmode=walking`;
    window.open(mapsUrl, '_blank');
  };

  const getDistanceText = () => {
    if (venue.distance_meters < 1000) {
      return `${Math.round(venue.distance_meters)}m`;
    }
    return `${(venue.distance_meters / 1000).toFixed(1)}km`;
  };

  const lastConfirmed = venue.last_confirmed_at
    ? new Date(venue.last_confirmed_at)
    : null;
  const daysAgo = lastConfirmed
    ? Math.floor((Date.now() - lastConfirmed.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="bg-white rounded-2xl p-6 space-y-4 max-w-md">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">{venue.name}</h2>
            <p className="text-sm text-gray-600 mt-1 capitalize">{venue.type}</p>
          </div>
          <span className="text-lg font-bold text-blue-600">
            {getDistanceText()}
          </span>
        </div>

      </div>

      {/* Address & Location */}
      <div className="space-y-2">
        <div className="flex gap-2 text-sm">
          <MapPin size={16} className="text-gray-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-gray-700">{venue.address}</p>
            {venue.postal_code && (
              <p className="text-gray-500">
                {venue.postal_code}
                {venue.floor_level && ` • ${venue.floor_level}`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Amenities */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-900">Amenities</p>
        <div className="grid grid-cols-2 gap-3">
          {venue.has_lock !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <Lock
                size={16}
                className={venue.has_lock ? 'text-green-600' : 'text-gray-300'}
              />
              <span className={venue.has_lock ? 'text-gray-900' : 'text-gray-400'}>
                {venue.has_lock ? 'Lockable' : 'No Lock'}
              </span>
            </div>
          )}
          {venue.has_changing_table !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <Baby
                size={16}
                className={
                  venue.has_changing_table ? 'text-green-600' : 'text-gray-300'
                }
              />
              <span
                className={
                  venue.has_changing_table ? 'text-gray-900' : 'text-gray-400'
                }
              >
                {venue.has_changing_table ? 'Changing Table' : 'No Changing'}
              </span>
            </div>
          )}
          {venue.has_sink !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <Droplets
                size={16}
                className={venue.has_sink ? 'text-green-600' : 'text-gray-300'}
              />
              <span className={venue.has_sink ? 'text-gray-900' : 'text-gray-400'}>
                {venue.has_sink ? 'Sink' : 'No Sink'}
              </span>
            </div>
          )}
          {venue.has_power_outlet !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <Zap
                size={16}
                className={
                  venue.has_power_outlet ? 'text-green-600' : 'text-gray-300'
                }
              />
              <span
                className={
                  venue.has_power_outlet ? 'text-gray-900' : 'text-gray-400'
                }
              >
                {venue.has_power_outlet ? 'Power' : 'No Power'}
              </span>
            </div>
          )}
          {venue.stroller_friendly !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <Luggage
                size={16}
                className={
                  venue.stroller_friendly ? 'text-green-600' : 'text-gray-300'
                }
              />
              <span
                className={
                  venue.stroller_friendly ? 'text-gray-900' : 'text-gray-400'
                }
              >
                {venue.stroller_friendly ? 'Stroller OK' : 'Tight Space'}
              </span>
            </div>
          )}
          {/*
            dad_friendly is intentionally not shown. The source data says nothing
            about it for any venue, so the flag is false everywhere — which made
            this render "Women Only" on all 85 rooms, stating as fact something
            nobody had checked. Restore it only alongside real data.
          */}
          {venue.has_diaper_mat !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <Package
                size={16}
                className={venue.has_diaper_mat ? 'text-green-600' : 'text-gray-300'}
              />
              <span className={venue.has_diaper_mat ? 'text-gray-900' : 'text-gray-400'}>
                {venue.has_diaper_mat ? 'Diaper Mat' : 'No Mat'}
              </span>
            </div>
          )}
          {venue.can_buy_diaper !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <ShoppingBag
                size={16}
                className={venue.can_buy_diaper ? 'text-green-600' : 'text-gray-300'}
              />
              <span className={venue.can_buy_diaper ? 'text-gray-900' : 'text-gray-400'}>
                {venue.can_buy_diaper ? 'Buy Diaper' : 'No Shop'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Last Verified - Optional */}
      {lastConfirmed && daysAgo !== null && (
        <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
          <CheckCircle2 size={14} />
          <span>✅ Verified {daysAgo} days ago</span>
        </div>
      )}

      {/* Is This Still Accurate? - Prominent Section */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-3">
        <p className="text-sm font-bold text-gray-900">✅ Is this still accurate?</p>
        <div className="flex gap-2">
          <button
            onClick={() => handleConfirm(true)}
            disabled={confirmLoading}
            className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white py-3 rounded-lg font-bold transition"
          >
            <ThumbsUp size={18} />
            Yes
          </button>
          <button
            onClick={() => handleConfirm(false)}
            disabled={confirmLoading}
            className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white py-3 rounded-lg font-bold transition"
          >
            <ThumbsDown size={18} />
            No
          </button>
        </div>

        {feedback && (
          <p
            role="status"
            className={`text-sm font-medium ${
              feedback.kind === 'ok' ? 'text-green-700' : 'text-red-600'
            }`}
          >
            {feedback.text}
          </p>
        )}
      </div>

      {/* Get Directions - Primary Button */}
      <button
        onClick={handleGetDirections}
        className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-bold transition flex items-center justify-center gap-2"
      >
        🗺️ Get Directions
      </button>

      {/* Report an issue: a negative confirmation, optionally with detail */}
      <div className="pt-2 space-y-2">
        {showIssueBox && (
          <textarea
            value={issueNotes}
            onChange={e => setIssueNotes(e.target.value)}
            maxLength={500}
            rows={3}
            autoFocus
            placeholder="What's wrong? e.g. room is locked, moved to level 3, no longer exists"
            className="w-full border rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        <div className="flex gap-2">
          <button
            onClick={handleReportIssue}
            disabled={confirmLoading}
            className="flex-1 text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400 py-2 font-medium bg-blue-50 rounded-lg transition"
          >
            {showIssueBox ? '📨 Send report' : '🚨 Report Issue'}
          </button>

          {showIssueBox && (
            <button
              onClick={() => {
                setShowIssueBox(false);
                setIssueNotes('');
              }}
              className="px-4 text-sm text-gray-600 hover:text-gray-800 py-2 font-medium bg-gray-100 rounded-lg transition"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Reviews */}
      <div className="pt-4 border-t space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-gray-900">Reviews</p>
          {!showReviewForm && (
            <button
              onClick={() => setShowReviewForm(true)}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium bg-purple-50 px-3 py-1.5 rounded-lg transition"
            >
              ⭐ Write Review
            </button>
          )}
        </div>

        {reviews.length > 0 && (
          <div className="flex items-center gap-2">
            <StarRating
              value={reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length}
            />
            <span className="text-sm text-gray-600">
              {(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)} ·{' '}
              {reviews.length} review{reviews.length === 1 ? '' : 's'}
            </span>
          </div>
        )}

        {showReviewForm && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Your rating:</span>
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
              className="w-full border rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white text-sm py-2 rounded-lg font-semibold transition"
              >
                {reviewSubmitting ? 'Posting...' : 'Post review'}
              </button>
              <button
                onClick={() => {
                  setShowReviewForm(false);
                  setReviewError('');
                }}
                disabled={reviewSubmitting}
                className="px-4 text-sm text-gray-600 hover:text-gray-800 py-2 font-medium bg-gray-100 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {reviewsLoading ? (
          <p className="text-sm text-gray-500">Loading reviews...</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-gray-500">
            No reviews yet — be the first to help other parents.
          </p>
        ) : (
          <ul className="space-y-3">
            {reviews.map(review => (
              <li key={review.id} className="text-sm">
                <div className="flex items-center gap-2">
                  <StarRating value={review.rating} size={14} />
                  <span className="text-xs text-gray-500">
                    {new Date(review.created_at).toLocaleDateString()}
                  </span>
                </div>
                {review.comment && (
                  <p className="text-gray-700 mt-1 whitespace-pre-wrap break-words">
                    {review.comment}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
