'use client';

/**
 * Home page: map and list views over the nursing room dataset.
 */

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { LocationSearch } from '@/components/LocationSearch';
import { VenueCard } from '@/components/VenueCard';
import { AddVenueModal } from '@/components/AddVenueModal';
import { VenueWithDetails } from '@/lib/supabase';
import {
  Baby,
  ChevronRight,
  Droplets,
  List,
  Lock,
  Luggage,
  Map as MapIcon,
  Package,
  Plus,
  ShoppingBag,
  SlidersHorizontal,
  X,
  Zap,
} from 'lucide-react';

// Dynamic import to avoid server-side Leaflet issues
const Map = dynamic(() => import('@/components/Map').then(mod => ({ default: mod.Map })), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-slate-200 animate-pulse" />,
});

const DEFAULT_LAT = 1.3521; // Singapore center
const DEFAULT_LNG = 103.8198;

// Ignore GPS updates smaller than this. Consumer GPS jitters by tens of metres
// while standing still, and every accepted update refetches the venue list.
const MIN_MOVE_METRES = 100;

/**
 * Filter definitions. The label is what a parent reads; the key is the database
 * column. Rendering the raw key ("has_power_outlet") was leaking schema naming
 * into the interface.
 *
 * dad_friendly is absent on purpose: no venue in the dataset carries the
 * information, so the filter could only ever return an empty map.
 */
const FILTERS = [
  { key: 'has_lock', label: 'Lockable', icon: Lock },
  { key: 'has_changing_table', label: 'Changing table', icon: Baby },
  { key: 'has_sink', label: 'Sink', icon: Droplets },
  { key: 'has_power_outlet', label: 'Power outlet', icon: Zap },
  { key: 'stroller_friendly', label: 'Stroller friendly', icon: Luggage },
  { key: 'has_diaper_mat', label: 'Diaper mat', icon: Package },
  { key: 'can_buy_diaper', label: 'Buy diapers', icon: ShoppingBag },
] as const;

const INITIAL_FILTERS: Record<string, boolean> = Object.fromEntries(
  FILTERS.map(f => [f.key, false])
);

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

function formatDistance(metres: number) {
  return metres < 1000
    ? `${Math.round(metres)}m`
    : `${(metres / 1000).toFixed(1)}km`;
}

function isVerified(venue: VenueWithDetails) {
  return !venue.source || venue.source !== 'USER_SUBMITTED';
}

export default function Home() {
  const [userLat, setUserLat] = useState(DEFAULT_LAT);
  const [userLng, setUserLng] = useState(DEFAULT_LNG);
  // Bumped only by an explicit user action (location button, place search).
  // The map watches this, not the coordinates, so background GPS never moves the view.
  const [recenterAt, setRecenterAt] = useState(0);
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const [venues, setVenues] = useState<VenueWithDetails[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<VenueWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [searchRadius, setSearchRadius] = useState(50000); // 50km to show all venues
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showAddVenueModal, setShowAddVenueModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Record<string, boolean>>(INITIAL_FILTERS);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

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
          timestamp: new Date().toISOString(),
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 5000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const fetchNearestVenues = async () => {
    setLoading(true);
    try {
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
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLocationFound = (lat: number, lng: number) => {
    setUserLat(lat);
    setUserLng(lng);
    lastPositionRef.current = { lat, lng };
    // Explicit request, so this one does move the map.
    setRecenterAt(Date.now());
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center shrink-0">
              <Baby size={22} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg font-extrabold text-slate-900 leading-tight truncate">
                Nursing Room Finder
              </h1>
              <p className="text-xs text-slate-500">
                {loading ? 'Finding rooms…' : `${venues.length} rooms in Singapore`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setShowFilters(v => !v)}
              aria-expanded={showFilters}
              className={`relative p-2.5 rounded-xl transition ${
                showFilters || activeFilterCount > 0
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="Filters"
            >
              <SlidersHorizontal size={18} />
              {activeFilterCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setShowAddVenueModal(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100 transition font-medium text-sm"
              title="Add a nursing room"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Add room</span>
            </button>

            <button
              onClick={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
              className="p-2.5 rounded-xl text-slate-700 hover:bg-slate-100 transition"
              title={viewMode === 'map' ? 'Switch to list' : 'Switch to map'}
            >
              {viewMode === 'map' ? <List size={18} /> : <MapIcon size={18} />}
            </button>
          </div>
        </div>

        {/* Filter strip */}
        {showFilters && (
          <div className="border-t border-slate-100 bg-white">
            <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-2 overflow-x-auto scroll-hide">
              {FILTERS.map(({ key, label, icon: Icon }) => {
                const active = filters[key];
                return (
                  <button
                    key={key}
                    onClick={() => handleFilterChange(key)}
                    aria-pressed={active}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium whitespace-nowrap transition ${
                      active
                        ? 'bg-teal-600 border-teal-600 text-white'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                );
              })}

              {activeFilterCount > 0 && (
                <button
                  onClick={() => setFilters(INITIAL_FILTERS)}
                  className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 whitespace-nowrap"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map view */}
        {viewMode === 'map' && (
          <div className="flex-1 relative">
            <Map
              userLat={userLat}
              userLng={userLng}
              recenterAt={recenterAt}
              venues={venues}
              selectedVenueId={selectedVenue?.id}
              onVenueSelect={setSelectedVenue}
            />

            {/* Overlay, kept out of the map's own stacking context */}
            <div className="absolute inset-0 pointer-events-none z-10">
              <div className="absolute top-4 left-4 right-4 max-w-sm pointer-events-auto">
                <LocationSearch
                  onLocationFound={handleLocationFound}
                  onSearchComplete={() => {
                    setSearchRadius(2000);
                    setShowSearchResults(true);
                  }}
                  isLoading={loading}
                  venueCount={venues.length}
                />
              </div>

              {/* Legend */}
              <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur rounded-xl shadow-md ring-1 ring-slate-200/80 px-3 py-2 pointer-events-auto">
                <div className="flex items-center gap-3 text-xs text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
                    Verified
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#F87171]" />
                    Community
                  </span>
                </div>
              </div>

              {/* Venue card */}
              {selectedVenue && (
                <div className="absolute bottom-4 right-4 w-[min(100%-2rem,24rem)] pointer-events-auto">
                  <VenueCard
                    key={selectedVenue.id}
                    venue={selectedVenue}
                    onClose={() => setSelectedVenue(null)}
                    userLat={userLat}
                    userLng={userLng}
                  />
                </div>
              )}

              {/* Nearby results after a search */}
              {showSearchResults && !selectedVenue && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[min(100%-2rem,42rem)] pointer-events-auto bg-white rounded-2xl shadow-xl ring-1 ring-slate-200/80">
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-display font-bold text-slate-900">
                        Rooms nearby
                      </h3>
                      <button
                        onClick={() => {
                          setShowSearchResults(false);
                          setSearchRadius(50000);
                        }}
                        aria-label="Close nearby results"
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-1.5 scroll-hide">
                      {venues.length === 0 ? (
                        <p className="text-slate-500 text-sm py-4 text-center">
                          No nursing rooms found nearby.
                        </p>
                      ) : (
                        venues.map(venue => (
                          <button
                            key={venue.id}
                            onClick={() => setSelectedVenue(venue)}
                            className="w-full text-left p-3 rounded-xl hover:bg-slate-50 transition flex items-center gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-900 truncate">
                                {venue.name}
                              </p>
                              <p className="text-sm text-slate-500 truncate">
                                {venue.address}
                              </p>
                            </div>
                            <span className="text-sm font-bold text-teal-700 shrink-0">
                              {formatDistance(venue.distance_meters)}
                            </span>
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
            <div className="shrink-0 border-b border-slate-200 p-4 bg-slate-50">
              <LocationSearch
                onLocationFound={handleLocationFound}
                isLoading={loading}
                venueCount={venues.length}
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="divide-y divide-slate-100">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="p-4 animate-pulse">
                      <div className="flex justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-slate-200 rounded w-2/5" />
                          <div className="h-3 bg-slate-100 rounded w-3/5" />
                          <div className="flex gap-1.5 pt-1">
                            <div className="h-5 w-16 bg-slate-100 rounded-full" />
                            <div className="h-5 w-20 bg-slate-100 rounded-full" />
                          </div>
                        </div>
                        <div className="h-5 w-12 bg-slate-200 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : venues.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <Baby size={26} className="text-slate-400" />
                  </div>
                  <p className="font-display font-bold text-slate-900">
                    No rooms match
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    {activeFilterCount > 0
                      ? 'Try removing a filter, or search a different area.'
                      : 'Try searching a different area.'}
                  </p>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={() => setFilters(INITIAL_FILTERS)}
                      className="mt-4 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {venues.map(venue => {
                    const amenities = FILTERS.filter(
                      f => venue[f.key as keyof VenueWithDetails]
                    );

                    return (
                      <button
                        key={venue.id}
                        onClick={() => {
                          setSelectedVenue(venue);
                          setViewMode('map');
                        }}
                        className="w-full text-left p-4 hover:bg-slate-50 transition flex items-center gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-display font-bold text-slate-900">
                              {venue.name}
                            </h3>
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                                isVerified(venue)
                                  ? 'bg-teal-50 text-teal-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {isVerified(venue) ? 'Verified' : 'Community'}
                            </span>
                          </div>

                          <p className="text-sm text-slate-500 mt-0.5 truncate">
                            {venue.address}
                          </p>

                          {amenities.length > 0 && (
                            <div className="flex gap-1.5 mt-2 flex-wrap">
                              {amenities.map(({ key, label, icon: Icon }) => (
                                <span
                                  key={key}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full"
                                >
                                  <Icon size={11} />
                                  {label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span className="font-display text-base font-bold text-teal-700">
                            {formatDistance(venue.distance_meters)}
                          </span>
                          <ChevronRight size={18} className="text-slate-300" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Submissions go to the moderation queue rather than straight onto the
          map, so there is nothing to refetch on success. */}
      <AddVenueModal
        isOpen={showAddVenueModal}
        onClose={() => setShowAddVenueModal(false)}
        userLat={userLat}
        userLng={userLng}
      />
    </div>
  );
}
