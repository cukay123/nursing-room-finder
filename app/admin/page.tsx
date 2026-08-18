'use client';

import { useEffect, useState } from 'react';
import { Check, X, Loader, Edit2, Save, Merge } from 'lucide-react';
import { ReportsPanel } from '@/components/admin/ReportsPanel';
import { ReviewsPanel } from '@/components/admin/ReviewsPanel';

type AdminTab = 'submissions' | 'reports' | 'reviews';

interface VenueMatch {
  id: string;
  name: string;
  address: string | null;
  floor_level: string | null;
  distance_meters: number;
  name_similarity: number;
}

interface Submission {
  id: string;
  payload: {
    name: string;
    address?: string;
    postalCode?: string;
    floorLevel?: string;
    latitude: number;
    longitude: number;
    amenities?: Record<string, boolean>;
    notes?: string;
    locationSource?: 'gps' | 'geocoded';
  };
  status: string;
  created_at: string;
}

export default function AdminPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Typed to match Submission['payload'] so edits can be written straight back
  // into the submissions list without widening its type.
  const [tab, setTab] = useState<AdminTab>('submissions');
  // Possible existing rooms each submission might be about, keyed by submission id.
  const [matches, setMatches] = useState<Record<string, VenueMatch[]>>({});
  // Which room a submission should update, per submission. 'new' means create one.
  // Deliberately starts unset when recommendations exist, so approving is a
  // decision rather than a default.
  const [selectedTarget, setSelectedTarget] = useState<Record<string, string>>({});
  const [editData, setEditData] = useState<Submission['payload']>({
    name: '',
    latitude: 0,
    longitude: 0,
  });

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/submissions');
      if (!response.ok) {
        throw new Error('Failed to fetch submissions');
      }
      const data = await response.json();
      setSubmissions(data.submissions || []);
      loadMatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching submissions');
    } finally {
      setLoading(false);
    }
  };

  // A submission for a place already on the map is usually someone adding detail,
  // not a new room. Fetching candidates up front means the admin sees that before
  // clicking Approve and creating a duplicate.
  // One request for the whole queue. Previously this fired one per submission in
  // parallel, each re-reading every venue — fine for four, a fifty-way burst once
  // the queue filled up.
  const loadMatches = async () => {
    try {
      const response = await fetch('/api/admin/submission-matches');
      if (!response.ok) return;
      const data = await response.json();
      setMatches(data.matchesBySubmission ?? {});
    } catch {
      // Recommendations are an aid, not a gate — a failure here still leaves
      // every submission approvable.
      setMatches({});
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    // Proxy will bounce the unauthenticated request on to the login page.
    window.location.href = '/admin';
  };

  const startEdit = (submission: Submission) => {
    setEditingId(submission.id);
    setEditData({ ...submission.payload });
  };

  const saveEdit = (submissionId: string) => {
    setSubmissions(prev =>
      prev.map(s =>
        s.id === submissionId ? { ...s, payload: editData } : s
      )
    );
    setEditingId(null);
  };

  const handleApprove = async (submissionId: string, targetVenueId?: string) => {
    setProcessingId(submissionId);
    try {
      const submission = submissions.find(s => s.id === submissionId);
      const dataToApprove = editingId === submissionId ? editData : submission?.payload;

      const response = await fetch('/api/admin/approve-submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          action: 'approve',
          payload: dataToApprove,
          targetVenueId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to approve submission');
      }

      setSubmissions(prev => prev.filter(s => s.id !== submissionId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error approving submission');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (submissionId: string) => {
    if (!confirm('Are you sure you want to reject this submission?')) return;

    setProcessingId(submissionId);
    try {
      const response = await fetch('/api/admin/approve-submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, action: 'reject' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reject submission');
      }

      setSubmissions(prev => prev.filter(s => s.id !== submissionId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error rejecting submission');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-2">
              New rooms, reported problems, and reviews
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="shrink-0 text-sm font-medium text-gray-700 border rounded-lg px-3 py-2 bg-white hover:bg-gray-50 transition"
          >
            Sign out
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          {([
            ['submissions', '📋 New rooms'],
            ['reports', '🚨 Reported issues'],
            ['reviews', '⭐ Reviews'],
          ] as [AdminTab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 font-semibold transition border-b-2 -mb-px ${
                tab === key
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'reports' && <ReportsPanel />}
        {tab === 'reviews' && <ReviewsPanel />}

        {tab === 'submissions' && (
        <>
        {/* Stats */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <p className="text-lg font-semibold text-gray-900">
            📋 Pending Submissions: <span className="text-blue-600">{submissions.length}</span>
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg mb-8">
            ❌ {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <Loader className="animate-spin mx-auto mb-4" size={32} />
            <p className="text-gray-600">Loading submissions...</p>
          </div>
        )}

        {/* No Submissions */}
        {!loading && submissions.length === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
            <p className="text-green-800 font-semibold">✅ No pending submissions</p>
          </div>
        )}

        {/* Submissions List */}
        {!loading && submissions.length > 0 && (
          <div className="space-y-6">
            {submissions.map(submission => (
              <div key={submission.id} className="bg-white rounded-lg shadow overflow-hidden">
                {/* Header */}
                <div className="bg-blue-50 px-6 py-4 border-b">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        {submission.payload.name}
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">
                        Submitted: {new Date(submission.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">
                      Pending Review
                    </span>
                  </div>
                </div>

                {/* Edit Mode Toggle */}
                <div className="px-6 py-4 border-b bg-gray-50">
                  {editingId === submission.id ? (
                    <button
                      onClick={() => saveEdit(submission.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition"
                    >
                      <Save size={16} />
                      Done Editing
                    </button>
                  ) : (
                    <button
                      onClick={() => startEdit(submission)}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                    >
                      <Edit2 size={16} />
                      Edit Details
                    </button>
                  )}
                </div>

                {/* Details */}
                <div className="px-6 py-6 space-y-4">
                  {editingId === submission.id ? (
                    // Edit Mode
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-1">
                          Building Name
                        </label>
                        <input
                          type="text"
                          value={editData.name || ''}
                          onChange={e => setEditData({ ...editData, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-1">
                          Floor Level
                        </label>
                        <input
                          type="text"
                          value={editData.floorLevel || ''}
                          onChange={e => setEditData({ ...editData, floorLevel: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-1">
                          Postal Code
                        </label>
                        <input
                          type="text"
                          value={editData.postalCode || ''}
                          onChange={e => setEditData({ ...editData, postalCode: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Amenities
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { key: 'has_lock', label: '🔒 Lockable' },
                            { key: 'has_changing_table', label: '👶 Changing Table' },
                            { key: 'has_sink', label: '💧 Sink' },
                            { key: 'has_power_outlet', label: '⚡ Power Outlet' },
                            { key: 'stroller_friendly', label: '🛒 Stroller Friendly' },
                            { key: 'dad_friendly', label: '👨 Dad Friendly' },
                            { key: 'has_diaper_mat', label: '🧷 Diaper Mat' },
                            { key: 'can_buy_diaper', label: '🛍️ Can Buy Diaper' },
                          ].map(({ key, label }) => (
                            <label key={key} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editData.amenities?.[key] || false}
                                onChange={e =>
                                  setEditData({
                                    ...editData,
                                    amenities: {
                                      ...(editData.amenities || {}),
                                      [key]: e.target.checked,
                                    },
                                  })
                                }
                                className="w-4 h-4 rounded"
                              />
                              <span className="text-sm text-gray-700">{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-1">
                          Notes
                        </label>
                        <textarea
                          value={editData.notes || ''}
                          onChange={e => setEditData({ ...editData, notes: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-gray-600 uppercase">Location</p>
                          <p className="text-gray-900">
                            {submission.payload.latitude.toFixed(4)}, {submission.payload.longitude.toFixed(4)}
                          </p>
                        </div>
                        {submission.payload.postalCode && (
                          <div>
                            <p className="text-xs font-semibold text-gray-600 uppercase">Postal Code</p>
                            <p className="text-gray-900">{submission.payload.postalCode}</p>
                          </div>
                        )}
                        {submission.payload.floorLevel && (
                          <div>
                            <p className="text-xs font-semibold text-gray-600 uppercase">Floor Level</p>
                            <p className="text-gray-900">{submission.payload.floorLevel}</p>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {editingId !== submission.id && (
                    <>
                      {/* Amenities - View Mode */}
                      {submission.payload.amenities && Object.values(submission.payload.amenities).some(v => v) && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Amenities</p>
                          <div className="grid grid-cols-2 gap-2">
                            {submission.payload.amenities.has_lock && <span className="text-sm text-green-700">✓ Lockable</span>}
                            {submission.payload.amenities.has_changing_table && <span className="text-sm text-green-700">✓ Changing Table</span>}
                            {submission.payload.amenities.has_sink && <span className="text-sm text-green-700">✓ Sink</span>}
                            {submission.payload.amenities.has_power_outlet && <span className="text-sm text-green-700">✓ Power Outlet</span>}
                            {submission.payload.amenities.stroller_friendly && <span className="text-sm text-green-700">✓ Stroller Friendly</span>}
                            {submission.payload.amenities.dad_friendly && <span className="text-sm text-green-700">✓ Dad Friendly</span>}
                            {submission.payload.amenities.has_diaper_mat && <span className="text-sm text-green-700">✓ Diaper Mat</span>}
                            {submission.payload.amenities.can_buy_diaper && <span className="text-sm text-green-700">✓ Can Buy Diaper</span>}
                          </div>
                        </div>
                      )}

                      {/* Notes - View Mode */}
                      {submission.payload.notes && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 uppercase">Notes</p>
                          <p className="text-gray-700">{submission.payload.notes}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* How this submission's position was obtained. Older ones predate
                    the field and carry the map's default centre, which is not a
                    usable position for a new room. */}
                <div className="px-6 pb-3">
                  {(() => {
                    const p = submission.payload;
                    const atDefault =
                      p.latitude === 1.3521 && p.longitude === 103.8198;

                    if (atDefault) {
                      return (
                        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          <strong>No usable position.</strong> This was submitted before
                          location was recorded properly, so it carries the map&rsquo;s
                          default centre. Safe to merge into an existing room; do not add
                          it as a new one without fixing the coordinates.
                        </p>
                      );
                    }

                    return (
                      <p className="text-sm text-gray-600">
                        Position:{' '}
                        {p.locationSource === 'gps'
                          ? 'from the submitter\u2019s GPS'
                          : p.locationSource === 'geocoded'
                            ? 'looked up from the building name'
                            : 'unknown'}{' '}
                        ({p.latitude?.toFixed?.(5)}, {p.longitude?.toFixed?.(5)})
                      </p>
                    );
                  })()}
                </div>

                {/* Recommendations. Choosing is a separate step from approving:
                    proximity surfaces neighbours as well as the same place, so a
                    one-click merge is too easy to fire at the wrong room. */}
                {(matches[submission.id]?.length ?? 0) > 0 && (
                  <div className="px-6 pb-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <p className="text-sm font-semibold text-amber-900">
                        Recommended: this may already be on the map
                      </p>
                      <p className="text-xs text-amber-800 mt-0.5">
                        Pick one, then approve. Updating an existing room adds these
                        details to it — amenities are only switched on, and its name,
                        address and position are kept.
                      </p>

                      <div className="mt-3 space-y-2">
                        {matches[submission.id].map(match => {
                          // Proximity alone surfaces neighbours: PLQ sits 238m from
                          // SingPost Centre. Merging into the wrong one corrupts a good
                          // record, so say plainly which signal produced the candidate.
                          const likelySame = match.name_similarity >= 0.6;
                          const chosen = selectedTarget[submission.id] === match.id;

                          return (
                            <button
                              key={match.id}
                              type="button"
                              onClick={() =>
                                setSelectedTarget(prev => ({
                                  ...prev,
                                  [submission.id]: match.id,
                                }))
                              }
                              aria-pressed={chosen}
                              className={`w-full flex items-start gap-3 text-left rounded-lg border px-3 py-2 transition ${
                                chosen
                                  ? 'bg-teal-50 border-teal-500 ring-1 ring-teal-500'
                                  : 'bg-white border-amber-200 hover:border-amber-300'
                              }`}
                            >
                              <span
                                className={`mt-1 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                                  chosen ? 'border-teal-600' : 'border-gray-300'
                                }`}
                              >
                                {chosen && (
                                  <span className="w-2 h-2 rounded-full bg-teal-600" />
                                )}
                              </span>

                              <span className="min-w-0">
                                <span className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-gray-900">
                                    {match.name}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                                      likelySame
                                        ? 'bg-teal-100 text-teal-800'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}
                                  >
                                    {likelySame ? 'Name matches' : 'Nearby — check the name'}
                                  </span>
                                </span>
                                <span className="block text-xs text-gray-500">
                                  {match.distance_meters === null
                                    ? 'distance unknown'
                                    : `${match.distance_meters}m away`}
                                  {match.floor_level ? ` · ${match.floor_level}` : ''}
                                </span>
                              </span>
                            </button>
                          );
                        })}

                        {/* Always available, so "none of these" is an explicit choice
                            rather than the default that happens when nothing is picked. */}
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedTarget(prev => ({ ...prev, [submission.id]: 'new' }))
                          }
                          aria-pressed={selectedTarget[submission.id] === 'new'}
                          className={`w-full flex items-center gap-3 text-left rounded-lg border px-3 py-2 transition ${
                            selectedTarget[submission.id] === 'new'
                              ? 'bg-teal-50 border-teal-500 ring-1 ring-teal-500'
                              : 'bg-white border-amber-200 hover:border-amber-300'
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                              selectedTarget[submission.id] === 'new'
                                ? 'border-teal-600'
                                : 'border-gray-300'
                            }`}
                          >
                            {selectedTarget[submission.id] === 'new' && (
                              <span className="w-2 h-2 rounded-full bg-teal-600" />
                            )}
                          </span>
                          <span className="font-semibold text-gray-900">
                            None of these — add as a new room
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end border-t">
                  <button
                    onClick={() => handleReject(submission.id)}
                    disabled={processingId === submission.id}
                    className="flex items-center gap-2 px-6 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition"
                  >
                    <X size={18} />
                    Reject
                  </button>
                  {(() => {
                    const candidates = matches[submission.id] ?? [];
                    const choice = selectedTarget[submission.id];
                    // With recommendations on screen, approving without picking one
                    // is what created duplicates in the first place.
                    const mustChoose = candidates.length > 0 && !choice;
                    const target =
                      choice && choice !== 'new' ? choice : undefined;
                    const targetName = candidates.find(m => m.id === target)?.name;

                    return (
                      <button
                        onClick={() => handleApprove(submission.id, target)}
                        disabled={processingId === submission.id || mustChoose}
                        title={mustChoose ? 'Choose an option above first' : undefined}
                        className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-lg font-medium transition"
                      >
                        {processingId === submission.id ? (
                          <Loader size={18} className="animate-spin" />
                        ) : (
                          <Check size={18} />
                        )}
                        {processingId === submission.id
                          ? 'Processing...'
                          : mustChoose
                            ? 'Choose an option above'
                            : targetName
                              ? `Approve — update ${targetName}`
                              : candidates.length > 0
                                ? 'Approve — add as new room'
                                : 'Approve'}
                      </button>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
