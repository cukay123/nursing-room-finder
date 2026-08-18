'use client';

/**
 * Location search: GPS, or a place name / postal code.
 */

import { useState } from 'react';
import { Loader2, Navigation, Search } from 'lucide-react';

interface LocationSearchProps {
  onLocationFound: (lat: number, lng: number) => void;
  onSearchComplete?: () => void;
  isLoading?: boolean;
  venueCount?: number;
}

export function LocationSearch({
  onLocationFound,
  isLoading,
  onSearchComplete,
  venueCount,
}: LocationSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  const handleUseLocation = () => {
    setLocating(true);
    setError('');

    if (!navigator.geolocation) {
      setError('This browser cannot share your location. Try searching instead.');
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        onLocationFound(latitude, longitude);
        setError('');
        setLocating(false);
        setTimeout(() => onSearchComplete?.(), 200);
      },
      geoError => {
        // Codes are the W3C constants: 1 denied, 2 unavailable, 3 timeout.
        const messages: Record<number, string> = {
          1: 'Location access was blocked. Search by place name instead.',
          2: 'Your location is unavailable. Search by place name instead.',
          3: 'Finding your location took too long. Try searching instead.',
        };

        setError(
          messages[geoError?.code] ??
            'Could not get your location. Search by place name instead.'
        );
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 60000,
        maximumAge: 0,
      }
    );
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchQuery.trim()) {
      setError('Enter a place name or postal code');
      return;
    }

    setSearching(true);
    setError('');

    try {
      const response = await fetch(
        `/api/location-search?q=${encodeURIComponent(searchQuery.trim())}`
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Could not find that place');
        return;
      }

      const lat = Number(data.latitude);
      const lng = Number(data.longitude);

      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        setError('That search returned an unusable location. Try another name.');
        return;
      }

      onLocationFound(lat, lng);
      setSearchQuery('');
      setError('');
      onSearchComplete?.();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const busy = searching || locating || isLoading;

  return (
    <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/80 p-4 space-y-3">
      <h2 className="font-display text-base font-bold text-slate-900">
        Find a nursing room
      </h2>

      <button
        onClick={handleUseLocation}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:text-slate-500 text-white py-3 rounded-xl font-semibold transition"
      >
        {locating ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Navigation size={18} />
        )}
        {locating ? 'Finding you…' : 'Use my current location'}
      </button>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-slate-500 font-medium">or</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Bedok Mall, Orchard Road, or 238872"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            disabled={busy}
            aria-label="Search by place name or postal code"
            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-60 placeholder:text-slate-400"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !searchQuery.trim()}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold rounded-xl transition whitespace-nowrap"
        >
          {searching ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {typeof venueCount === 'number' && venueCount > 0 && (
        <p className="text-xs text-slate-500">
          Showing all {venueCount} rooms across Singapore
        </p>
      )}
    </div>
  );
}
