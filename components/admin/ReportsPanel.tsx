'use client';

/**
 * Problems reported against existing rooms — the "No" button and Report Issue.
 *
 * Handling one is a decision with two outcomes: the room is fine and the report
 * was mistaken (Keep), or the room is genuinely gone (Remove from map). Removal
 * is a soft delete, so it can be undone.
 */

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader, RotateCcw, Trash2 } from 'lucide-react';

interface Report {
  id: string;
  venue_id: string;
  notes: string | null;
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
  venues: { name: string; address: string | null; removed_at: string | null } | null;
}

type Action = 'keep' | 'remove' | 'restore';

export function ReportsPanel() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  // Remove takes a room off the public map, so it asks for a second click
  // rather than firing on the first.
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/reports?includeResolved=${showResolved}`);
      if (!response.ok) throw new Error('Failed to load reports');
      const data = await response.json();
      setReports(data.reports ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [showResolved]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (reportId: string, action: Action) => {
    setBusyId(reportId);
    setError('');
    try {
      const response = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, action }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Could not update the report');
      }
      setConfirmingRemoveId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the report');
    } finally {
      setBusyId(null);
    }
  };

  const openCount = reports.filter(r => !r.resolved_at).length;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-gray-900">
            🚨 Open reports: <span className="text-red-600">{openCount}</span>
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Check the room, then decide: <strong>Keep</strong> if it is still there and correct,
            or <strong>Remove from map</strong> if it is gone. Removing hides it from parents but
            keeps the record, so it can be restored.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 shrink-0">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={e => setShowResolved(e.target.checked)}
          />
          Show handled
        </label>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
          ❌ {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <Loader className="animate-spin mx-auto mb-4" size={32} />
          <p className="text-gray-600">Loading reports...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
          No reports. Nothing has been flagged as inaccurate.
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map(report => {
            const isRemoved = Boolean(report.venues?.removed_at);
            const isHandled = Boolean(report.resolved_at);
            const busy = busyId === report.id;

            return (
              <div
                key={report.id}
                className={`bg-white rounded-lg shadow p-6 ${isHandled ? 'opacity-70' : ''}`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-[240px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-gray-900">
                        {report.venues?.name ?? 'Unknown room'}
                      </h3>
                      {isRemoved && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-semibold">
                          removed from map
                        </span>
                      )}
                    </div>

                    {report.venues?.address && (
                      <p className="text-sm text-gray-600">{report.venues.address}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Reported {new Date(report.created_at).toLocaleString()}
                    </p>

                    <p className="mt-3 text-gray-800 whitespace-pre-wrap break-words">
                      {report.notes || (
                        <span className="text-gray-500 italic">
                          Marked &ldquo;not accurate&rdquo; with no further detail
                        </span>
                      )}
                    </p>

                    {report.resolution_note && (
                      <p className="mt-2 text-sm text-gray-600 italic">
                        → {report.resolution_note}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    {isRemoved ? (
                      <button
                        onClick={() => act(report.id, 'restore')}
                        disabled={busy}
                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 transition"
                      >
                        {busy ? <Loader className="animate-spin" size={16} /> : <RotateCcw size={16} />}
                        Put back on map
                      </button>
                    ) : isHandled ? (
                      <span className="text-sm text-green-700 font-medium px-2">✓ Handled</span>
                    ) : confirmingRemoveId === report.id ? (
                      <>
                        <p className="text-xs text-red-700 max-w-[200px]">
                          Remove <strong>{report.venues?.name}</strong> from the map? Parents will
                          no longer see it.
                        </p>
                        <button
                          onClick={() => act(report.id, 'remove')}
                          disabled={busy}
                          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-400 transition"
                        >
                          {busy ? <Loader className="animate-spin" size={16} /> : <Trash2 size={16} />}
                          Yes, remove it
                        </button>
                        <button
                          onClick={() => setConfirmingRemoveId(null)}
                          disabled={busy}
                          className="px-4 py-2 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => act(report.id, 'keep')}
                          disabled={busy}
                          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 transition"
                        >
                          {busy ? <Loader className="animate-spin" size={16} /> : <Check size={16} />}
                          Keep on map
                        </button>
                        <button
                          onClick={() => setConfirmingRemoveId(report.id)}
                          disabled={busy}
                          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition"
                        >
                          <Trash2 size={16} />
                          Remove from map
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
