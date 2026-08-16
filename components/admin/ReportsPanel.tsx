'use client';

/**
 * Problems reported against existing rooms — the "No" button and Report Issue.
 *
 * Until this existed, those reports were written to the database and never
 * surfaced anywhere, so a room could be reported as gone indefinitely with
 * nobody the wiser.
 */

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader, RotateCcw } from 'lucide-react';

interface Report {
  id: string;
  venue_id: string;
  notes: string | null;
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
  venues: { name: string; address: string | null } | null;
}

export function ReportsPanel() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

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

  const setResolved = async (reportId: string, resolved: boolean) => {
    setBusyId(reportId);
    try {
      const response = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, resolved }),
      });
      if (!response.ok) throw new Error('Could not update the report');
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
      <div className="bg-white rounded-lg shadow p-6 flex items-center justify-between">
        <p className="text-lg font-semibold text-gray-900">
          🚨 Open reports: <span className="text-red-600">{openCount}</span>
        </p>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={e => setShowResolved(e.target.checked)}
          />
          Show resolved
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
          {reports.map(report => (
            <div
              key={report.id}
              className={`bg-white rounded-lg shadow p-6 ${
                report.resolved_at ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900">
                    {report.venues?.name ?? 'Unknown room'}
                  </h3>
                  {report.venues?.address && (
                    <p className="text-sm text-gray-600">{report.venues.address}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Reported {new Date(report.created_at).toLocaleString()}
                    {report.resolved_at &&
                      ` · resolved ${new Date(report.resolved_at).toLocaleDateString()}`}
                  </p>

                  <p className="mt-3 text-gray-800 whitespace-pre-wrap break-words">
                    {report.notes || (
                      <span className="text-gray-500 italic">
                        Marked &ldquo;not accurate&rdquo; with no further detail
                      </span>
                    )}
                  </p>
                </div>

                <button
                  onClick={() => setResolved(report.id, !report.resolved_at)}
                  disabled={busyId === report.id}
                  className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition disabled:bg-gray-400 ${
                    report.resolved_at
                      ? 'bg-gray-500 hover:bg-gray-600'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {busyId === report.id ? (
                    <Loader className="animate-spin" size={16} />
                  ) : report.resolved_at ? (
                    <RotateCcw size={16} />
                  ) : (
                    <Check size={16} />
                  )}
                  {report.resolved_at ? 'Reopen' : 'Mark resolved'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
