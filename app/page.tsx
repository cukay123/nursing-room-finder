'use client';

/**
 * Home page: Map view with location search and venue listings
 */

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { LocationSearch } from '@/components/LocationSearch';
import { VenueCard } from '@/components/VenueCard';
import { AddVenueModal } from '@/components/AddVenueModal';
import { VenueWithDetails } from '@/lib/supabase';
import { List, Map as MapIcon, Plus, X } from 'lucide-react';

// Dynamic import to avoid server-side Leaflet issues
const Map = dynamic(() => import('@/components/Map').then(mod => ({ default: mod.Map })), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-gray-200 animate-pulse" />,
});

const DEFAULT_LAT = 1.3521; // Singapore center
const DEFAULT_LNG = 103.8198;

// Ignore GPS updates smaller than this. Consumer GPS jitters by tens of metres
// while standing still, and every accepted update refetches the venue list.
const MIN_MOVE_METRES = 100;

function distanceMetres(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radius = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(a));
}

export default function Home() {
  const [userLat, setUserLat] = useState(DEFAULT_LAT);
  const [userLng, setUserLng] = useState(DEFAULT_LNG);
  // Bumped only by an explicit user action (location button, postal code search).
  // The map watches this, not the coordinates, so background GPS never moves the view.
  const [recenterAt, setRecenterAt] = useState(0);
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const [venues, setVenues] = useState<VenueWithDetails[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<VenueWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [searchRadius, setSearchRadius] = useState(50000); // 50km to show all venues
  const [hasSearched, setHasSearched] = useState(true); // Start as searched to show results
  const [showSearchResults, setShowSearchResults] = useState(false); // Show search results panel
  const [showAddVenueModal, setShowAddVenueModal] = useState(false); // Show add venue modal
  const [filters, setFilters] = useState<Record<string, boolean>>({
    has_lock: false,
    has_changing_table: false,
    has_sink: false,
    has_power_outlet: false,
    stroller_friendly: false,
    // dad_friendly deliberately omitted: no venue in the dataset carries the
    // information, so the filter could only ever return an empty map.
    has_diaper_mat: false,
    can_buy_diaper: false,
  });

  // Fetch nearest venues when location, radius, or active filters change
  useEffect(() => {
    fetchNearestVenues();
  }, [userLat, userLng, searchRadius, filters]);

  // Watch user location for real-time tracking.
  //
  // Deliberately does NOT recentre the map. Doing so meant every GPS tick yanked
  // the view back, so panning to look at another neighbourhood was impossible.
  // The map recentres only on an explicit request (see recenterAt), while the
  // blue "you are here" marker keeps following along.
  //
  // Small movements are also ignored, so standing still with a jittery GPS does
  // not refetch the venue list every few seconds.
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not available in this browser/context');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      position => {
        const { latitude, longitude } = position.coords;
        const last = lastPositionRef.current;

        if (last && distanceMetres(last.lat, last.lng, latitude, longitude) < MIN_MOVE_METRES) {
          return;
        }

        lastPositionRef.current = { lat: latitude, lng: longitude };
        setUserLat(latitude);
        setUserLng(longitude);
      },
      error => {
        console.warn('Location watch error:', {
          code: error?.code,
          message: error?.message,
          timestamp: new Date().toISOString()
        });
        // Don't show repeated errors - just continue with default location
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 5000, // Update every 5 seconds max
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const fetchNearestVenues = async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      // Build filter query string
      const activeFilters = Object.entries(filters)
        .filter(([, active]) => active)
        .map(([key]) => key)
        .join(',');

      const url = new URL('/api/nearest-venues', window.location.origin);
      url.searchParams.append('lat', userLat.toString());
      url.searchParams.append('lng', userLng.toString());
      url.searchParams.append('radius', searchRadius.toString());
      if (activeFilters) {
        url.searchParams.append('filters', activeFilters);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to fetch venues');
      }

      const data = await response.json();
      setVenues(data);
      setSelectedVenue(null);
    } catch (err) {
      console.error('Error fetching venues:', err);
      setVenues([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              🏥 Nursing Room Finder
            </h1>
            <p className="text-sm text-gray-600">Find breastfeeding rooms near you</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddVenueModal(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition flex items-center gap-2 text-black font-semibold"
              title="Add nursing room"
            >
              <Plus size={20} />
              <span className="text-sm">Add Room</span>
            </button>
            <button
              onClick={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
              className="p-2 hover:bg-gray-100 rounded-lg transition text-black"
              title={viewMode === 'map' ? 'Switch to list' : 'Switch to map'}
            >
              {viewMode === 'map' ? (
                <List size={20} />
              ) : (
                <MapIcon size={20} />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map view */}
        {viewMode === 'map' && (
          <div className="flex-1 relative">
            {/* Map - background layer */}
            <Map
              userLat={userLat}
              userLng={userLng}
              recenterAt={recenterAt}
              venues={venues}
              selectedVenueId={selectedVenue?.id}
              onVenueSelect={setSelectedVenue}
            />

            {/* UI Overlay - separate from map to avoid z-index issues */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Search panel - top left */}
              <div className="absolute top-4 left-4 right-4 max-w-sm pointer-events-auto">
                <LocationSearch
                  onLocationFound={(lat, lng) => {
                    setUserLat(lat);
                    setUserLng(lng);
                    lastPositionRef.current = { lat, lng };
                    // Explicit request, so this one does move the map.
                    setRecenterAt(Date.now());
                  }}
                  onSearchComplete={() => {
                    setSearchRadius(2000); // Reset to 2km for nearby results
                    setShowSearchResults(true); // Show search results panel
                  }}
                  isLoading={loading}
                />
              </div>

              {/* Filters - bottom left */}
              <div className="absolute bottom-4 left-4 max-w-sm bg-white rounded-lg shadow-md p-3 pointer-events-auto">
                <p className="text-xs font-semibold text-gray-600 mb-2">Filters</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(filters).map(([key, active]) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => handleFilterChange(key)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-xs text-gray-700">
                        {key.replace(/_/g, ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Venue card - bottom right */}
              {selectedVenue && (
                <div className="absolute bottom-4 right-4 max-w-sm pointer-events-auto">
                  <div className="relative">
                    <button
                      onClick={() => setSelectedVenue(null)}
                      className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
                    >
                      <X size={16} />
                    </button>
                    <VenueCard
                      venue={selectedVenue}
                      userLat={userLat}
                      userLng={userLng}
                    />
                  </div>
                </div>
              )}

              {/* Search results panel - bottom of map (like Google Maps) */}
              {showSearchResults && (
                <div className="absolute bottom-4 left-4 right-4 max-w-2xl pointer-events-auto bg-white rounded-lg shadow-lg pointer-events-auto">
                  <div className="p-4">
                    {/* Close button */}
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-semibold text-gray-900">Nursing Rooms Nearby</h3>
                      <button
                        onClick={() => {
                          setShowSearchResults(false);
                          setSearchRadius(50000); // Back to showing all venues
                        }}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {/* Venues list */}
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {venues.length === 0 ? (
                        <p className="text-gray-600 text-sm">No nursing rooms found nearby</p>
                      ) : (
                        venues.map(venue => (
                          <button
                            key={venue.id}
                            onClick={() => setSelectedVenue(venue)}
                            className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition border border-gray-200"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900">{venue.name}</p>
                                <p className="text-sm text-gray-600">{venue.address}</p>
                              </div>
                              <span className="text-sm font-semibold text-blue-600 ml-2">
                                {venue.distance_meters < 1000
                                  ? `${Math.round(venue.distance_meters)}m`
                                  : `${(venue.distance_meters / 1000).toFixed(1)}km`}
                              </span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* List view */}
        {viewMode === 'list' && (
          <div className="flex-1 flex flex-col bg-white">
            <div className="flex-shrink-0 border-b p-4">
              <LocationSearch
                onLocationFound={(lat, lng) => {
                  setUserLat(lat);
                  setUserLng(lng);
                }}
                isLoading={loading}
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500">Loading...</div>
              ) : venues.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No venues found
                </div>
              ) : (
                <div className="divide-y">
                  {venues.map(venue => (
                    <button
                      key={venue.id}
                      onClick={() => {
                        setSelectedVenue(venue);
                        setViewMode('map');
                      }}
                      className="w-full text-left p-4 hover:bg-gray-50 transition"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">
                            {venue.name}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {venue.address}
                          </p>
                        </div>
                        <span className="text-lg font-semibold text-blue-600 flex-shrink-0">
                          {venue.distance_meters < 1000
                            ? `${Math.round(
                                venue.distance_meters
                              )}m`
                            : `${(venue.distance_meters / 1000).toFixed(1)}km`}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Venue Modal */}
      <AddVenueModal
        isOpen={showAddVenueModal}
        onClose={() => setShowAddVenueModal(false)}
        userLat={userLat}
        userLng={userLng}
      />
    </div>
  );
}
