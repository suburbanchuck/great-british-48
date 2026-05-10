'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { CheckCircle2, Pencil, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import PlacesAutocomplete from './PlacesAutocomplete';

const supabase = createClient();

type Stay = {
  id: string;
  start_date: string;
  end_date: string;
  location: string | null;
  notes: string | null;
  location_lat: number | null;
  location_lng: number | null;
  added_by: string | null;
};

type Place = {
  id: string;
  name: string;
  notes: string | null;
  location_lat: number | null;
  location_lng: number | null;
  status: 'wishlist' | 'visited';
  visited_on: string | null;
  added_by: string | null;
};

type Coords = { lat: number; lng: number };

type Props = {
  countyId: string;
  countyName: string;
  user: User;
  onClose: () => void;
  onStaysChanged: () => void;
  onPlacesChanged: () => void;
};

function today() {
  return new Date().toISOString().split('T')[0];
}

function formatDateRange(start: string, end: string): string {
  return start === end ? start : `${start} → ${end}`;
}

function formatMonthYear(dateStr: string): string {
  const [year, month] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  });
}

async function geocodeLocation(query: string): Promise<Coords | null> {
  try {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&country=gb&limit=1`,
    );
    const json = await res.json();
    const feature = json.features?.[0];
    if (!feature) return null;
    const [lng, lat] = feature.center as [number, number];
    return { lat, lng };
  } catch (err) {
    console.warn('[CountySheet] geocoding error:', err);
    return null;
  }
}

export default function CountySheet({
  countyId,
  countyName,
  user,
  onClose,
  onStaysChanged,
  onPlacesChanged,
}: Props) {
  // ── Stay state ──
  const [stays, setStays] = useState<Stay[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingStay, setEditingStay] = useState<Stay | null>(null);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [location, setLocation] = useState('');
  const [stayCoords, setStayCoords] = useState<Coords | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ── Place state ──
  const [places, setPlaces] = useState<Place[]>([]);
  const [showPlaceForm, setShowPlaceForm] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [placeName, setPlaceName] = useState('');
  const [placeCoords, setPlaceCoords] = useState<Coords | null>(null);
  const [placeNotes, setPlaceNotes] = useState('');
  const [placeStatus, setPlaceStatus] = useState<'wishlist' | 'visited'>('wishlist');
  const [placeVisitedOn, setPlaceVisitedOn] = useState('');
  const [savingPlace, setSavingPlace] = useState(false);
  const [confirmDeletePlaceId, setConfirmDeletePlaceId] = useState<string | null>(null);

  async function fetchCountyStays() {
    const { data } = await supabase
      .from('stays')
      .select('id, start_date, end_date, location, notes, location_lat, location_lng, added_by')
      .eq('county_id', countyId)
      .order('start_date', { ascending: false });
    const rows = data ?? [];
    setStays(rows);
    setLoaded(true);
    if (rows.length === 0) setShowForm(true);
  }

  async function fetchCountyPlaces() {
    const { data } = await supabase
      .from('places')
      .select('id, name, notes, location_lat, location_lng, status, visited_on, added_by')
      .eq('county_id', countyId)
      .order('created_at', { ascending: true });
    setPlaces((data ?? []) as Place[]);
  }

  useEffect(() => {
    fetchCountyStays();
    fetchCountyPlaces();
  }, [countyId]);

  // ── Derived values ──
  const dateRangeLabel = (() => {
    if (!stays.length) return '';
    const minStart = stays.reduce((a, s) => (s.start_date < a ? s.start_date : a), stays[0].start_date);
    const maxEnd = stays.reduce((a, s) => (s.end_date > a ? s.end_date : a), stays[0].end_date);
    const sl = formatMonthYear(minStart);
    const el = formatMonthYear(maxEnd);
    return sl === el ? sl : `${sl} – ${el}`;
  })();

  const wishlistPlaces = places.filter(p => p.status === 'wishlist');
  const visitedPlaces = places.filter(p => p.status === 'visited');

  // ── Stay handlers ──
  function startEdit(stay: Stay) {
    setStartDate(stay.start_date);
    setEndDate(stay.end_date);
    setLocation(stay.location ?? '');
    setStayCoords(null);
    setNotes(stay.notes ?? '');
    setEditingStay(stay);
    setShowForm(true);
  }

  function resetForm() {
    setStartDate(today());
    setEndDate(today());
    setLocation('');
    setStayCoords(null);
    setNotes('');
    setEditingStay(null);
  }

  function handleCancel() {
    if (stays.length === 0) {
      onClose();
    } else {
      setShowForm(false);
      resetForm();
    }
  }

  async function handleSave() {
    if (!startDate || !endDate) return;
    setSaving(true);

    const locationText = location.trim() || null;
    const isNewStay = !editingStay;
    const addedBy = user.user_metadata?.given_name || user.email?.split('@')[0] || 'Someone';
    let savedId: string | null = null;

    if (editingStay) {
      const { data, error } = await supabase
        .from('stays')
        .update({
          start_date: startDate,
          end_date: endDate,
          location: locationText,
          notes: notes.trim() || null,
          ...(stayCoords ? { location_lat: stayCoords.lat, location_lng: stayCoords.lng } : {}),
        })
        .eq('id', editingStay.id)
        .select('id')
        .single();
      if (error) { console.error('[CountySheet] stay update error:', error); setSaving(false); return; }
      savedId = data.id;
    } else {
      const { data, error } = await supabase
        .from('stays')
        .insert({
          county_id: countyId,
          start_date: startDate,
          end_date: endDate,
          location: locationText,
          notes: notes.trim() || null,
          user_id: user.id,
          added_by: addedBy,
          ...(stayCoords ? { location_lat: stayCoords.lat, location_lng: stayCoords.lng } : {}),
        })
        .select('id')
        .single();
      if (error) { console.error('[CountySheet] stay insert error:', error); setSaving(false); return; }
      savedId = data.id;
    }

    setSaving(false);
    onStaysChanged();
    onClose();

    // Mapbox geocoding fallback — only for new stays when Google didn't provide coords
    if (locationText && savedId && !stayCoords && isNewStay) {
      const id = savedId;
      geocodeLocation(locationText).then(coords => {
        if (!coords) return;
        supabase.from('stays')
          .update({ location_lat: coords.lat, location_lng: coords.lng })
          .eq('id', id)
          .then(({ error }) => { if (!error) onStaysChanged(); });
      });
    }
  }

  async function handleDelete(id: string) {
    setConfirmDeleteId(null);
    await supabase.from('stays').delete().eq('id', id);
    await fetchCountyStays();
    onStaysChanged();
  }

  // ── Place handlers ──
  function startEditPlace(place: Place) {
    setPlaceName(place.name);
    setPlaceCoords(null);
    setPlaceNotes(place.notes ?? '');
    setPlaceStatus(place.status);
    setPlaceVisitedOn(place.visited_on ?? '');
    setEditingPlace(place);
    setShowPlaceForm(true);
  }

  function resetPlaceForm() {
    setPlaceName('');
    setPlaceCoords(null);
    setPlaceNotes('');
    setPlaceStatus('wishlist');
    setPlaceVisitedOn('');
    setEditingPlace(null);
  }

  async function handleSavePlace() {
    if (!placeName.trim()) return;
    setSavingPlace(true);

    const isNewPlace = !editingPlace;
    const addedBy = user.user_metadata?.given_name || user.email?.split('@')[0] || 'Someone';
    const visitedOnValue = placeStatus === 'visited' ? (placeVisitedOn || null) : null;
    let savedId: string | null = null;

    if (editingPlace) {
      const { data, error } = await supabase
        .from('places')
        .update({
          name: placeName.trim(),
          notes: placeNotes.trim() || null,
          status: placeStatus,
          visited_on: visitedOnValue,
          ...(placeCoords ? { location_lat: placeCoords.lat, location_lng: placeCoords.lng } : {}),
        })
        .eq('id', editingPlace.id)
        .select('id')
        .single();
      if (error) { console.error('[CountySheet] place update error:', error); setSavingPlace(false); return; }
      savedId = data.id;
    } else {
      const { data, error } = await supabase
        .from('places')
        .insert({
          county_id: countyId,
          name: placeName.trim(),
          notes: placeNotes.trim() || null,
          status: placeStatus,
          visited_on: visitedOnValue,
          user_id: user.id,
          added_by: addedBy,
          ...(placeCoords ? { location_lat: placeCoords.lat, location_lng: placeCoords.lng } : {}),
        })
        .select('id')
        .single();
      if (error) { console.error('[CountySheet] place insert error:', error); setSavingPlace(false); return; }
      savedId = data.id;
    }

    setSavingPlace(false);
    setShowPlaceForm(false);
    resetPlaceForm();
    await fetchCountyPlaces();
    onPlacesChanged();

    // Mapbox geocoding fallback — only for new places when Google didn't provide coords
    if (savedId && !placeCoords && isNewPlace) {
      const id = savedId;
      const query = `${placeName.trim()}, ${countyName}`;
      geocodeLocation(query).then(coords => {
        if (!coords) return;
        supabase.from('places')
          .update({ location_lat: coords.lat, location_lng: coords.lng })
          .eq('id', id)
          .then(({ error }) => { if (!error) onPlacesChanged(); });
      });
    }
  }

  async function handleDeletePlace(id: string) {
    setConfirmDeletePlaceId(null);
    await supabase.from('places').delete().eq('id', id);
    await fetchCountyPlaces();
    onPlacesChanged();
  }

  const isCompleted = loaded && stays.length > 0;

  // Shared input class strings
  const inputCls = 'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent';
  const amberInputCls = 'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent';

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      <div className="fixed z-50 bg-white bottom-0 left-0 right-0 rounded-t-2xl shadow-2xl md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-md md:rounded-2xl">
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="px-6 pb-8 pt-2 md:pt-6 max-h-[85vh] overflow-y-auto">

          {/* ── Header ── */}
          {isCompleted ? (
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                  <h2 className="text-xl font-semibold text-gray-900 leading-tight">{countyName}</h2>
                </div>
                <p className="text-sm text-gray-400 ml-[28px]">
                  {stays.length} {stays.length === 1 ? 'stay' : 'stays'} · {dateRangeLabel}
                </p>
              </div>
              <button onClick={onClose} aria-label="Close"
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-start justify-between mb-5">
              <h2 className="text-xl font-semibold text-gray-900 leading-tight pr-4">{countyName}</h2>
              <button onClick={onClose} aria-label="Close"
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <X size={16} />
              </button>
            </div>
          )}

          {/* ── Stays list ── */}
          {isCompleted && (
            <div className="mb-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">Your stays</p>
              <ul className="divide-y divide-gray-100">
                {stays.map(stay => (
                  <li key={stay.id} className="py-2.5">
                    {confirmDeleteId === stay.id ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-gray-500">Delete this stay?</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => handleDelete(stay.id)}
                            className="px-3 py-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors">
                            Delete
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)}
                            className="px-3 py-1 text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm flex-1 min-w-0">
                          <span className="font-medium text-gray-800">{formatDateRange(stay.start_date, stay.end_date)}</span>
                          {stay.location && <span className="text-gray-500"> · {stay.location}</span>}
                          {stay.added_by && (
                            <span className="ml-1.5 text-[10px] font-medium text-gray-300 uppercase tracking-wide">{stay.added_by}</span>
                          )}
                          {stay.notes && <p className="text-gray-400 text-xs mt-0.5 leading-snug">{stay.notes}</p>}
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
                          <button onClick={() => startEdit(stay)} aria-label="Edit stay"
                            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => setConfirmDeleteId(stay.id)} aria-label="Delete stay"
                            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Log another stay CTA ── */}
          {!showForm && isCompleted && (
            <button onClick={() => setShowForm(true)}
              className="w-full mt-4 py-2.5 text-sm font-medium text-green-700 hover:text-green-800 border border-dashed border-green-300 hover:border-green-400 rounded-xl transition-colors">
              + Log another stay
            </button>
          )}

          {/* ── Stay form ── */}
          {showForm && (
            <>
              {isCompleted && <div className="border-t border-gray-100 mt-4 mb-6" />}
              <div>
                {isCompleted && (
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">
                    {editingStay ? 'Edit stay' : 'Log a stay'}
                  </p>
                )}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Start date</label>
                      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">End date</label>
                      <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Location <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <PlacesAutocomplete
                      value={location}
                      onChange={val => { setLocation(val); setStayCoords(null); }}
                      onPlaceSelect={result => {
                        setLocation(result.formattedAddress || result.name);
                        setStayCoords(result.coords);
                      }}
                      placeholder="e.g. Penzance"
                      inputClassName={inputCls}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Notes <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                      placeholder="What did you do there?"
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={handleSave} disabled={saving || !startDate || !endDate}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-3 text-sm font-semibold transition-colors">
                  {saving ? 'Saving…' : editingStay ? 'Update stay' : 'Save stay'}
                </button>
                <button onClick={handleCancel}
                  className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl py-3 text-sm font-semibold transition-colors">
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* ── Places section ── */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">Places</p>

            {places.length > 0 && (
              <div className="mb-3">
                {wishlistPlaces.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 mb-1.5">Wishlist</p>
                    <ul className="divide-y divide-gray-100">
                      {wishlistPlaces.map(place => (
                        <li key={place.id} className="py-2">
                          {confirmDeletePlaceId === place.id ? (
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm text-gray-500">Delete this place?</span>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button onClick={() => handleDeletePlace(place.id)}
                                  className="px-3 py-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors">Delete</button>
                                <button onClick={() => setConfirmDeletePlaceId(null)}
                                  className="px-3 py-1 text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-sm flex-1 min-w-0">
                                <span className="font-medium text-gray-800">{place.name}</span>
                                {place.added_by && (
                                  <span className="ml-1.5 text-[10px] font-medium text-gray-300 uppercase tracking-wide">{place.added_by}</span>
                                )}
                                {place.notes && <p className="text-gray-400 text-xs mt-0.5 leading-snug">{place.notes}</p>}
                              </div>
                              <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
                                <button onClick={() => startEditPlace(place)} aria-label="Edit place"
                                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors">
                                  <Pencil size={12} />
                                </button>
                                <button onClick={() => setConfirmDeletePlaceId(place.id)} aria-label="Delete place"
                                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {visitedPlaces.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-green-600 mb-1.5">Visited</p>
                    <ul className="divide-y divide-gray-100">
                      {visitedPlaces.map(place => (
                        <li key={place.id} className="py-2">
                          {confirmDeletePlaceId === place.id ? (
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm text-gray-500">Delete this place?</span>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button onClick={() => handleDeletePlace(place.id)}
                                  className="px-3 py-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors">Delete</button>
                                <button onClick={() => setConfirmDeletePlaceId(null)}
                                  className="px-3 py-1 text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-sm flex-1 min-w-0">
                                <span className="font-medium text-gray-800">{place.name}</span>
                                {place.visited_on && (
                                  <span className="text-gray-400 text-xs"> · {formatMonthYear(place.visited_on)}</span>
                                )}
                                {place.added_by && (
                                  <span className="ml-1.5 text-[10px] font-medium text-gray-300 uppercase tracking-wide">{place.added_by}</span>
                                )}
                                {place.notes && <p className="text-gray-400 text-xs mt-0.5 leading-snug">{place.notes}</p>}
                              </div>
                              <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
                                <button onClick={() => startEditPlace(place)} aria-label="Edit place"
                                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors">
                                  <Pencil size={12} />
                                </button>
                                <button onClick={() => setConfirmDeletePlaceId(place.id)} aria-label="Delete place"
                                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* ── Add a place CTA ── */}
            {!showPlaceForm && (
              <button onClick={() => setShowPlaceForm(true)}
                className="w-full py-2.5 text-sm font-medium text-amber-700 hover:text-amber-800 border border-dashed border-amber-300 hover:border-amber-400 rounded-xl transition-colors">
                + Add a place
              </button>
            )}

            {/* ── Place form ── */}
            {showPlaceForm && (
              <>
                {places.length > 0 && <div className="border-t border-gray-100 mb-5" />}
                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">
                  {editingPlace ? 'Edit place' : 'Add a place'}
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                    <PlacesAutocomplete
                      value={placeName}
                      onChange={val => { setPlaceName(val); setPlaceCoords(null); }}
                      onPlaceSelect={result => {
                        setPlaceName(result.name);
                        setPlaceCoords(result.coords);
                      }}
                      placeholder="e.g. The Pig at Combe"
                      inputClassName={amberInputCls}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Notes <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <textarea value={placeNotes} onChange={e => setPlaceNotes(e.target.value)} rows={2}
                      placeholder="Why do you want to go?"
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none" />
                  </div>

                  {editingPlace ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                      <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
                        <button type="button" onClick={() => setPlaceStatus('wishlist')}
                          className={`flex-1 py-2 font-medium transition-colors ${placeStatus === 'wishlist' ? 'bg-amber-50 text-amber-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                          Wishlist
                        </button>
                        <button type="button" onClick={() => setPlaceStatus('visited')}
                          className={`flex-1 py-2 font-medium border-l border-gray-200 transition-colors ${placeStatus === 'visited' ? 'bg-green-50 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                          Visited
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={placeStatus === 'visited'}
                        onChange={e => {
                          setPlaceStatus(e.target.checked ? 'visited' : 'wishlist');
                          if (!e.target.checked) setPlaceVisitedOn('');
                        }}
                        className="w-4 h-4 rounded accent-green-600" />
                      <span className="text-sm text-gray-700">Mark as visited</span>
                    </label>
                  )}

                  {placeStatus === 'visited' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Visited on <span className="font-normal text-gray-400">(optional)</span>
                      </label>
                      <input type="date" value={placeVisitedOn} onChange={e => setPlaceVisitedOn(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent" />
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  <button onClick={handleSavePlace} disabled={savingPlace || !placeName.trim()}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-3 text-sm font-semibold transition-colors">
                    {savingPlace ? 'Saving…' : editingPlace ? 'Update place' : 'Save place'}
                  </button>
                  <button onClick={() => { setShowPlaceForm(false); resetPlaceForm(); }}
                    className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl py-3 text-sm font-semibold transition-colors">
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
