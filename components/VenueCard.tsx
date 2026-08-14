'use client';

/**
 * Venue detail card shown in bottom sheet / detail view
 */

import { VenueWithDetails } from '@/lib/supabase';
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
import { useState } from 'react';

interface VenueCardProps {
  venue: VenueWithDetails;
  onClose?: () => void;
  userLat?: number;
  userLng?: number;
}

export function VenueCard({ venue, onClose, userLat, userLng }: VenueCardProps) {
  const [confirmLoading, setConfirmLoading] = useState(false);

  const handleConfirm = async (stillThere: boolean) => {
    setConfirmLoading(true);
    // TODO: Call /api/confirm-venue endpoint
    // await fetch('/api/confirm-venue', { method: 'POST', body: JSON.stringify({ venue_id: venue.id, still_there: stillThere }) })
    setConfirmLoading(false);
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
          {venue.dad_friendly !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <Users
                size={16}
                className={venue.dad_friendly ? 'text-green-600' : 'text-gray-300'}
              />
              <span className={venue.dad_friendly ? 'text-gray-900' : 'text-gray-400'}>
                {venue.dad_friendly ? 'All Welcome' : 'Women Only'}
              </span>
            </div>
          )}
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
      </div>

      {/* Get Directions - Primary Button */}
      <button
        onClick={handleGetDirections}
        className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-bold transition flex items-center justify-center gap-2"
      >
        🗺️ Get Directions
      </button>

      {/* Other Actions */}
      <div className="flex gap-2 pt-2">
        <button className="flex-1 text-sm text-blue-600 hover:text-blue-700 py-2 font-medium bg-blue-50 rounded-lg transition">
          🚨 Report Issue
        </button>
        <button className="flex-1 text-sm text-purple-600 hover:text-purple-700 py-2 font-medium bg-purple-50 rounded-lg transition">
          ⭐ Write Review
        </button>
      </div>
    </div>
  );
}
