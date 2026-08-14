'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface AddVenueModalProps {
  isOpen: boolean;
  onClose: () => void;
  userLat: number;
  userLng: number;
}

export function AddVenueModal({ isOpen, onClose, userLat, userLng }: AddVenueModalProps) {
  const [formData, setFormData] = useState({
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
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/submit-venue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          latitude: userLat,
          longitude: userLng,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit venue');
      }

      setSuccess(true);
      setFormData({
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
      });

      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error submitting venue');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-gray-900">Add Nursing Room</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        {/* Success message */}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 p-4 m-6 rounded-lg">
            ✅ Thank you! Your submission has been received and will be reviewed by our team.
          </div>
        )}

        {/* Form */}
        {!success && (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Basic Info */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Building Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Takashimaya Nursing Room"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Floor Level
              </label>
              <input
                type="text"
                name="floorLevel"
                value={formData.floorLevel}
                onChange={handleChange}
                placeholder="e.g., Level 3, Ground Floor"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600"
              />
            </div>

            {/* Amenities */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Amenities
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'hasLock', label: '🔒 Lockable' },
                  { key: 'hasChangingTable', label: '👶 Changing Table' },
                  { key: 'hasSink', label: '💧 Sink' },
                  { key: 'hasPowerOutlet', label: '⚡ Power Outlet' },
                  { key: 'strollerFriendly', label: '🛒 Stroller Friendly' },
                  { key: 'dadFriendly', label: '👨 Dad Friendly' },
                  { key: 'hasDiaperMat', label: '🧷 Diaper Mat' },
                  { key: 'canBuyDiaper', label: '🛍️ Can Buy Diaper' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name={key}
                      checked={formData[key as keyof typeof formData] as boolean}
                      onChange={handleChange}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Additional Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="e.g., Operating hours, condition, etc."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
                ❌ {error}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 justify-end pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.name}
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition"
              >
                {loading ? 'Submitting...' : 'Submit Nursing Room'}
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              Your submission will be reviewed before appearing on the map.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
