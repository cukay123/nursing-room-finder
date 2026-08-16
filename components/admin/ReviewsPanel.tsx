'use client';

/**
 * Review moderation. Reviews publish immediately, so this is the after-the-fact
 * control: hide abuse, and put it back if the call was wrong.
 */

import { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, Loader } from 'lucide-react';

import { StarRating } from '@/components/StarRating';

interface AdminReview {
  id: string;
  venue_id: string;
  rating: number;
  comment: string | null;
  status: 'visible' | 'hidden';
  created_at: string;
  venues: { name: string } | null;
}

export function ReviewsPanel() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/reviews');
      if (!response.ok) throw new Error('Failed to load reviews');
      const data = await response.json();
      setReviews(data.reviews ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (reviewId: string, status: 'visible' | 'hidden') => {
    setBusyId(reviewId);
    try {
      const response = await fetch('/api/admin/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, status }),
      });
      if (!response.ok) throw new Error('Could not update the review');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the review');
    } finally {
      setBusyId(null);
    }
  };

  const hiddenCount = reviews.filter(r => r.status === 'hidden').length;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-lg font-semibold text-gray-900">
          ⭐ Reviews: <span className="text-blue-600">{reviews.length}</span>
          {hiddenCount > 0 && (
            <span className="text-gray-500 text-base font-normal">
              {' '}· {hiddenCount} hidden
            </span>
          )}
        </p>
        <p className="text-sm text-gray-600 mt-1">
          Reviews go live immediately. Hidden reviews disappear from the app but are kept, so
          hiding one by mistake is reversible.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
          ❌ {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <Loader className="animate-spin mx-auto mb-4" size={32} />
          <p className="text-gray-600">Loading reviews...</p>
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
          No reviews yet.
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map(review => (
            <div
              key={review.id}
              className={`bg-white rounded-lg shadow p-6 ${
                review.status === 'hidden' ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-gray-900">
                      {review.venues?.name ?? 'Unknown room'}
                    </h3>
                    <StarRating value={review.rating} size={14} />
                    {review.status === 'hidden' && (
                      <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                        hidden
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(review.created_at).toLocaleString()}
                  </p>
                  {review.comment && (
                    <p className="mt-3 text-gray-800 whitespace-pre-wrap break-words">
                      {review.comment}
                    </p>
                  )}
                </div>

                <button
                  onClick={() =>
                    setStatus(review.id, review.status === 'hidden' ? 'visible' : 'hidden')
                  }
                  disabled={busyId === review.id}
                  className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition disabled:bg-gray-400 ${
                    review.status === 'hidden'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-gray-600 hover:bg-gray-700'
                  }`}
                >
                  {busyId === review.id ? (
                    <Loader className="animate-spin" size={16} />
                  ) : review.status === 'hidden' ? (
                    <Eye size={16} />
                  ) : (
                    <EyeOff size={16} />
                  )}
                  {review.status === 'hidden' ? 'Show' : 'Hide'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
