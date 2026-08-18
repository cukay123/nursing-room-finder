'use client';

import { useState } from 'react';
import {
  AlertCircle,
  Baby,
  CheckCircle2,
  Droplets,
  Loader2,
  Lock,
  Luggage,
  Package,
  ShoppingBag,
  X,
  Zap,
} from 'lucide-react';

interface AddVenueModalProps {
  isOpen: boolean;
  onClose: () => void;
  userLat: number;
  userLng: number;
  /** False while userLat/userLng are still the Singapore-centre default. */
  hasPreciseLocation?: boolean;
}

/**
 * Amenity toggles. Keys match the form payload the API expects.
 *
 * dadFriendly is omitted: no venue in the dataset carries the information, so
 * collecting it here would add a field nothing reads.
 */
const AMENITY_TOGGLES = [
  { key: 'hasLock', label: 'Lockable door', icon: Lock },
  { key: 'hasChangingTable', label: 'Changing table', icon: Baby },
  { key: 'hasSink', label: 'Sink', icon: Droplets },
  { key: 'hasPowerOutlet', label: 'Power outlet', icon: Zap },
  { key: 'strollerFriendly', label: 'Stroller friendly', icon: Luggage },
  { key: 'hasDiaperMat', label: 'Diaper mat', icon: Package },
  { key: 'canBuyDiaper', label: 'Can buy diapers', icon: ShoppingBag },
] as const;

const EMPTY_FORM = {
  name: '',
  floorLevel: '',
  hasLock: false,
  hasChangingTable: false,
  hasSink: false,
  hasPowerOutlet: false,
  strollerFriendly: false,
  dadFriendly: false,
  hasDiaperMat: false,
  canBuyDiaper: false,
  notes: '',
};

export function AddVenueModal({
  isOpen,
  onClose,
  userLat,
  userLng,
  hasPreciseLocation = false,
}: AddVenueModalProps) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);

  /**
   * Where the room actually is.
   *
   * With a real GPS fix, the submitter is standing at the room and that is the
   * best position available. Without one, userLat/userLng are still the map's
   * Singapore-centre default — submitting that silently pinned rooms to the
   * middle of the island. So look the typed name up instead, and refuse to
   * submit if it cannot be found rather than guessing.
   */
  const resolveLocation = async (name: string) => {
    if (hasPreciseLocation) {
      return { latitude: userLat, longitude: userLng, source: 'gps' as const };
    }

    const response = await fetch(`/api/location-search?q=${encodeURIComponent(name)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          `We could not find "${name}". Try the full building name, or turn on location and submit while you are there.`
      );
    }

    return {
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      source: 'geocoded' as const,
      matchedAddress: data.matchedAddress as string | null,
    };
  };

  const toggleAmenity = (key: string) => {
    setFormData(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const location = await resolveLocation(formData.name.trim());

      const response = await fetch('/api/submit-venue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          latitude: location.latitude,
          longitude: location.longitude,
          locationSource: location.source,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit venue');
      }

      setSuccess(true);
      setResolvedAddress(
        'matchedAddress' in location ? location.matchedAddress ?? null : null
      );
      setFormData(EMPTY_FORM);

      setTimeout(() => {
        onClose();
        setSuccess(false);
        setResolvedAddress(null);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error submitting venue');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-start p-5 border-b border-slate-100">
          <div>
            <h2 className="font-display text-xl font-extrabold text-slate-900">
              Add a nursing room
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Help other parents find it. We review every submission.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} className="text-teal-600" />
            </div>
            <p className="font-display text-lg font-bold text-slate-900">Thank you</p>
            <p className="text-sm text-slate-500 mt-1">
              Your room has been sent for review.
            </p>
            {resolvedAddress && (
              <p className="text-xs text-slate-500 mt-3">
                Recorded at <span className="font-medium">{resolvedAddress}</span>
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto scroll-hide p-5 space-y-5">
            {/* Location notice. Says which of the two positions will actually be
                recorded, rather than always promising GPS. */}
            <div className="flex gap-2.5 bg-amber-50 ring-1 ring-amber-200 rounded-xl p-3">
              <AlertCircle size={17} className="text-amber-700 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                {hasPreciseLocation ? (
                  <>
                    We will use <strong>your current location</strong> as the room&rsquo;s
                    position, so please submit while you are there.
                  </>
                ) : (
                  <>
                    Location is off, so we will look up the position from the{' '}
                    <strong>building name</strong> you type. Please give the full name.
                  </>
                )}
              </p>
            </div>

            <div>
              <label htmlFor="venue-name" className="block text-sm font-semibold text-slate-900 mb-1.5">
                Building or place name <span className="text-red-500">*</span>
              </label>
              <input
                id="venue-name"
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Bedok Mall"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-slate-400"
              />
            </div>

            <div>
              <label htmlFor="venue-floor" className="block text-sm font-semibold text-slate-900 mb-1.5">
                Floor or level
              </label>
              <input
                id="venue-floor"
                type="text"
                value={formData.floorLevel}
                onChange={e => setFormData(prev => ({ ...prev, floorLevel: e.target.value }))}
                placeholder="e.g. Level 3, near the restrooms"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-slate-400"
              />
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-900 mb-2">
                What does it have?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {AMENITY_TOGGLES.map(({ key, label, icon: Icon }) => {
                  const active = Boolean(formData[key as keyof typeof formData]);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleAmenity(key)}
                      aria-pressed={active}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium text-left transition ${
                        active
                          ? 'bg-teal-50 border-teal-500 text-teal-800 ring-1 ring-teal-500'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <Icon size={15} className={active ? 'text-teal-600' : 'text-slate-400'} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="venue-notes" className="block text-sm font-semibold text-slate-900 mb-1.5">
                Anything else?
              </label>
              <textarea
                id="venue-notes"
                rows={3}
                value={formData.notes}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="e.g. armchair inside, gets busy at weekends"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-slate-400"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={loading || !formData.name.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 text-white py-3 rounded-xl font-semibold transition"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? 'Sending…' : 'Submit room'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
