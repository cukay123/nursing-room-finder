'use client';

/**
 * Location search component: GPS + postal code input
 */

import { useState } from 'react';
import { MapPin, Search } from 'lucide-react';

interface LocationSearchProps {
  onLocationFound: (lat: number, lng: number) => void;
  onSearchComplete?: () => void;
  isLoading?: boolean;
}

export function LocationSearch({ onLocationFound, isLoading, onSearchComplete }: LocationSearchProps) {
  const [postalCode, setPostalCode] = useState('');
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  const handleUseLocation = async () => {
    setSearching(true);
    setError('');

    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      setSearching(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        console.log('Got location:', latitude, longitude);
        onLocationFound(latitude, longitude);
        setError('');
        setSearching(false);

        // Show nearby results (like postal code search)
        setTimeout(() => {
          if (onSearchComplete) {
            onSearchComplete();
          }
        }, 200);
      },
      error => {
        console.error('Geolocation error details:', {
          code: error?.code,
          message: error?.message,
          toString: error?.toString?.(),
          rawError: error
        });

        // Handle different error codes
        const errorCode = error?.code;

        if (errorCode === 1) { // PERMISSION_DENIED
          setError('❌ Location permission denied. Use postal code search instead.');
        } else if (errorCode === 3) { // TIMEOUT
          setError('⏳ Location taking too long. Try postal code search.');
        } else if (errorCode === 2) { // POSITION_UNAVAILABLE
          setError('📍 GPS unavailable (desktop?). Use postal code search.');
        } else {
          // Generic error - likely HTTPS/secure context issue
          setError('📍 Location unavailable. Make sure you\'re on HTTPS or use postal code search.');
        }

        setSearching(false);
      },
      {
        enableHighAccuracy: true, // Use WiFi triangulation on desktop
        timeout: 60000, // 60 seconds for WiFi to work
        maximumAge: 0, // Don't use cache - get fresh location
      }
    );
  };

  const handlePostalCodeSearch = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault?.();
    if (!postalCode.trim()) {
      setError('Please enter a postal code');
      return;
    }

    setSearching(true);
    setError('');

    try {
      const response = await fetch(
        `/api/postal-code-to-coords?postal_code=${encodeURIComponent(postalCode.trim())}`
      );

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Postal code not found');
        setSearching(false);
        return;
      }

      const data = await response.json();
      console.log('API response:', data);

      const lat = Number(data.latitude);
      const lng = Number(data.longitude);

      console.log('Parsed coordinates:', lat, lng);

      if (isNaN(lat) || isNaN(lng)) {
        throw new Error('Invalid coordinates');
      }

      console.log('Calling onLocationFound');
      onLocationFound(lat, lng);

      console.log('Clearing search field');
      setPostalCode('');
      setError('');

      // Callback to switch to list view
      console.log('Calling onSearchComplete');
      try {
        if (onSearchComplete) {
          onSearchComplete();
        }
      } catch (callbackErr) {
        console.error('Callback error:', callbackErr);
      }

      setSearching(false);
    } catch (err) {
      console.error('Search error:', err);
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setSearching(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 space-y-3">
      <div className="text-sm text-black font-bold">
        📍 Find Nursing Rooms Near You
      </div>

      {/* Use My Location Button */}
      <button
        onClick={handleUseLocation}
        disabled={searching || isLoading}
        className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white py-3 rounded-lg font-bold transition"
      >
        📍 {searching ? 'Getting your location...' : 'Use My Current Location'}
      </button>

      {/* OR Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-300"></div>
        <span className="text-xs text-gray-600 font-semibold">OR</span>
        <div className="flex-1 h-px bg-gray-300"></div>
      </div>

      {/* Search by Postal Code */}
      <div className="text-sm text-black font-bold">
        🔍 Search by postal code
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3">
            <Search size={16} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Enter postal code (e.g., 238872)"
            value={postalCode}
            onChange={e => setPostalCode(e.target.value)}
            disabled={searching || isLoading}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 placeholder:text-gray-600"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handlePostalCodeSearch(e as any);
              }
            }}
          />
        </div>
        <button
          onClick={(e) => handlePostalCodeSearch(e as any)}
          disabled={searching || isLoading || !postalCode.trim()}
          className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-bold rounded-lg transition whitespace-nowrap"
        >
          {searching ? '⏳ Searching...' : '🔍 Search'}
        </button>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="text-xs text-gray-500">
        💡 All 85 nursing rooms visible on map by default
      </div>
    </div>
  );
}
