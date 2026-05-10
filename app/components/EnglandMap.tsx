'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Map, { Source, Layer } from 'react-map-gl/mapbox';
import type {
  FillLayerSpecification,
  LineLayerSpecification,
  CircleLayerSpecification,
  SymbolLayerSpecification,
  MapMouseEvent,
} from 'mapbox-gl';
import type { FeatureCollection } from 'geojson';
import type { User } from '@supabase/supabase-js';
import 'mapbox-gl/dist/mapbox-gl.css';
import { createClient } from '@/lib/supabase/client';
import CountySheet from './CountySheet';
import MapTitle from './MapTitle';
import AuthOverlay from './AuthOverlay';

const supabase = createClient();

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ']/g, '').replace(/[ ']+/g, '-');
}

// "Oct 28–31, 2025" / "Oct 28 – Nov 3, 2025" / "Oct 28, 2025"
function formatTooltipDateRange(start: string, end: string): string {
  if (!start) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const sM = months[s.getMonth()];
  const eM = months[e.getMonth()];
  const sD = s.getDate();
  const eD = e.getDate();
  const sY = s.getFullYear();
  const eY = e.getFullYear();
  if (start === end) return `${sM} ${sD}, ${sY}`;
  if (sY === eY && s.getMonth() === e.getMonth()) return `${sM} ${sD}–${eD}, ${sY}`;
  if (sY === eY) return `${sM} ${sD} – ${eM} ${eD}, ${sY}`;
  return `${sM} ${sD}, ${sY} – ${eM} ${eD}, ${eY}`;
}

const lineLayer: LineLayerSpecification = {
  id: 'counties-line',
  type: 'line',
  source: 'counties',
  paint: { 'line-color': '#374151', 'line-width': 1 },
};

// Stay pins: large filled bronze
const stayPinsLayer: CircleLayerSpecification = {
  id: 'stay-pins',
  type: 'circle',
  source: 'stay-pins',
  paint: {
    'circle-color': '#a16207',
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 1.5,
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      4, 3, 8, 6, 12, 10,
    ] as unknown as number,
  },
};

// Wishlist place pins: hollow dark-mauve outline
const wishlistPlacePinsLayer: CircleLayerSpecification = {
  id: 'wishlist-place-pins',
  type: 'circle',
  source: 'place-pins',
  filter: ['==', ['get', 'status'], 'wishlist'] as unknown as CircleLayerSpecification['filter'],
  paint: {
    'circle-color': 'rgba(0,0,0,0)',
    'circle-stroke-color': '#7c4a6b',
    'circle-stroke-width': 2,
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      4, 3, 8, 5, 12, 8,
    ] as unknown as number,
  },
};

// Visited place pins: smaller filled dark-mauve
const visitedPlacePinsLayer: CircleLayerSpecification = {
  id: 'visited-place-pins',
  type: 'circle',
  source: 'place-pins',
  filter: ['==', ['get', 'status'], 'visited'] as unknown as CircleLayerSpecification['filter'],
  paint: {
    'circle-color': '#7c4a6b',
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 1,
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      4, 2, 8, 4.5, 12, 7.5,
    ] as unknown as number,
  },
};

type SelectedCounty = { id: string; name: string };
type StayRow = {
  county_id: string;
  location_lat: number | null;
  location_lng: number | null;
  location: string | null;
  start_date: string;
  end_date: string;
};
type PlaceRow = {
  location_lat: number | null;
  location_lng: number | null;
  status: string;
  name: string;
  notes: string | null;
};
type HoveredCounty = { name: string; x: number; y: number };
type PinTooltip = { content: string; x: number; y: number };

export default function EnglandMap() {
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);
  const [completedSlugs, setCompletedSlugs] = useState<string[]>([]);
  const [pinsGeoJSON, setPinsGeoJSON] = useState<FeatureCollection>({
    type: 'FeatureCollection',
    features: [],
  });
  const [placePinsGeoJSON, setPlacePinsGeoJSON] = useState<FeatureCollection>({
    type: 'FeatureCollection',
    features: [],
  });
  const [selected, setSelected] = useState<SelectedCounty | null>(null);
  const [cursor, setCursor] = useState<string>('auto');
  const [hoveredCounty, setHoveredCounty] = useState<HoveredCounty | null>(null);
  const [hoveredPin, setHoveredPin] = useState<PinTooltip | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchStays() {
    const { data, error } = await supabase
      .from('stays')
      .select('county_id, location_lat, location_lng, location, start_date, end_date');
    if (error) {
      console.error('[EnglandMap] error fetching stays:', error);
      return;
    }
    const rows: StayRow[] = data ?? [];
    const slugSet = new Set(rows.map(s => s.county_id));
    setCompletedSlugs([...slugSet]);
    setPinsGeoJSON({
      type: 'FeatureCollection',
      features: rows
        .filter(s => s.location_lat != null && s.location_lng != null)
        .map((s, i) => ({
          type: 'Feature',
          id: i,
          geometry: {
            type: 'Point',
            coordinates: [s.location_lng as number, s.location_lat as number],
          },
          properties: {
            location: s.location,
            start_date: s.start_date,
            end_date: s.end_date,
          },
        })),
    });
  }

  async function fetchPlaces() {
    const { data, error } = await supabase
      .from('places')
      .select('location_lat, location_lng, status, name, notes');
    if (error) {
      console.error('[EnglandMap] error fetching places:', error);
      return;
    }
    const rows: PlaceRow[] = data ?? [];
    setPlacePinsGeoJSON({
      type: 'FeatureCollection',
      features: rows
        .filter(p => p.location_lat != null && p.location_lng != null)
        .map((p, i) => ({
          type: 'Feature',
          id: i,
          geometry: {
            type: 'Point',
            coordinates: [p.location_lng as number, p.location_lat as number],
          },
          properties: { status: p.status, name: p.name, notes: p.notes },
        })),
    });
  }

  useEffect(() => {
    fetch('/counties.geojson')
      .then(r => r.json())
      .then((data: FeatureCollection) => {
        setGeojson({
          ...data,
          features: data.features.map(f => ({
            ...f,
            properties: {
              ...f.properties,
              slug: slugify((f.properties as { NAME: string }).NAME),
            },
          })),
        });
      });
    fetchStays();
    fetchPlaces();
  }, []);

  const handleClick = useCallback((e: MapMouseEvent) => {
    if (!user) return;
    // Only county fill clicks open the sheet; ignore pin clicks
    const countyFeature = e.features?.find(f => (f.layer as { id?: string })?.id === 'counties-fill');
    if (!countyFeature) return;
    setSelected({
      id: countyFeature.properties?.slug as string,
      name: countyFeature.properties?.NAME as string,
    });
  }, [user]);

  const handleMouseMove = useCallback((e: MapMouseEvent) => {
    const feature = e.features?.[0];
    if (!feature) {
      setCursor('auto');
      setHoveredCounty(null);
      setHoveredPin(null);
      return;
    }

    const layerId = (feature.layer as { id?: string })?.id;

    if (layerId === 'stay-pins') {
      setCursor('default');
      setHoveredCounty(null);
      const loc = feature.properties?.location as string | null;
      const dateStr = formatTooltipDateRange(
        feature.properties?.start_date as string,
        feature.properties?.end_date as string,
      );
      setHoveredPin({ content: loc ? `${loc} · ${dateStr}` : dateStr, x: e.point.x, y: e.point.y });

    } else if (layerId === 'visited-place-pins' || layerId === 'wishlist-place-pins') {
      setCursor('default');
      setHoveredCounty(null);
      const name = feature.properties?.name as string;
      const status = feature.properties?.status as string;
      const notes = feature.properties?.notes as string | null;
      let content = `${name} · ${status}`;
      if (notes) content += ` · ${notes.length > 60 ? notes.slice(0, 60) + '…' : notes}`;
      setHoveredPin({ content, x: e.point.x, y: e.point.y });

    } else if (layerId === 'counties-fill') {
      setCursor(user ? 'pointer' : 'default');
      setHoveredPin(null);
      setHoveredCounty({
        name: feature.properties?.NAME as string,
        x: e.point.x,
        y: e.point.y,
      });
    }
  }, [user]);

  const handleMouseLeave = useCallback(() => {
    setCursor('auto');
    setHoveredCounty(null);
    setHoveredPin(null);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  const fillColor = (
    completedSlugs.length > 0
      ? ['match', ['get', 'slug'], completedSlugs, '#16a34a', '#e5e7eb']
      : '#e5e7eb'
  ) as unknown as string;

  const fillOpacity = (
    completedSlugs.length > 0
      ? ['match', ['get', 'slug'], completedSlugs, 0.5, 0.4]
      : 0.4
  ) as unknown as number;

  const fillLayer: FillLayerSpecification = {
    id: 'counties-fill',
    type: 'fill',
    source: 'counties',
    paint: { 'fill-color': fillColor, 'fill-opacity': fillOpacity },
  };

  const completedLabelsLayer: SymbolLayerSpecification = useMemo(() => ({
    id: 'counties-labels',
    type: 'symbol',
    source: 'counties',
    filter: (completedSlugs.length > 0
      ? ['in', ['get', 'slug'], ['literal', completedSlugs]]
      : ['==', false, true]) as unknown as SymbolLayerSpecification['filter'],
    layout: {
      'text-field': ['get', 'NAME'] as unknown as string,
      'text-size': 11,
      'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
      'text-max-width': 8,
      'text-allow-overlap': false,
      'text-ignore-placement': false,
    },
    paint: {
      'text-color': '#1f2937',
      'text-halo-color': 'rgba(255,255,255,0.85)',
      'text-halo-width': 1.5,
    },
  }), [completedSlugs]);

  const firstName = user?.user_metadata?.given_name
    || user?.email?.split('@')[0]
    || null;

  if (!geojson) return null;

  return (
    <>
      <Map
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{ longitude: -1.5, latitude: 52.8, zoom: 5.8 }}
        style={{ width: '100vw', height: '100vh' }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        touchZoomRotate
        touchPitch={false}
        interactiveLayerIds={['counties-fill', 'stay-pins', 'visited-place-pins', 'wishlist-place-pins']}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        cursor={cursor}
      >
        <Source id="counties" type="geojson" data={geojson}>
          <Layer {...fillLayer} />
          <Layer {...lineLayer} />
          <Layer {...completedLabelsLayer} />
        </Source>

        {/* Place pins render below stay pins so stays always appear on top */}
        <Source id="place-pins" type="geojson" data={placePinsGeoJSON}>
          <Layer {...wishlistPlacePinsLayer} />
          <Layer {...visitedPlacePinsLayer} />
        </Source>

        <Source id="stay-pins" type="geojson" data={pinsGeoJSON}>
          <Layer {...stayPinsLayer} />
        </Source>
      </Map>

      <MapTitle />

      {/* Progress counter + signed-in user */}
      <div className="fixed top-4 left-4 z-10 pointer-events-none select-none flex items-center gap-2">
        <div className="bg-white rounded-xl shadow px-4 py-2 text-sm font-semibold text-gray-700 tabular-nums">
          {completedSlugs.length} / 48
        </div>
        {!authLoading && user && firstName && (
          <button
            onClick={handleSignOut}
            className="pointer-events-auto bg-white rounded-xl shadow px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1.5"
          >
            <span>{firstName}</span>
            <span className="text-gray-300">·</span>
            <span className="text-xs">Sign out</span>
          </button>
        )}
      </div>

      {/* County hover tooltip */}
      {!selected && hoveredCounty && (
        <div
          className="fixed z-10 pointer-events-none bg-white text-gray-800 text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-lg border border-gray-100 whitespace-nowrap"
          style={{ left: hoveredCounty.x + 14, top: hoveredCounty.y - 10 }}
        >
          {hoveredCounty.name}
        </div>
      )}

      {/* Pin hover tooltip (desktop) */}
      {!selected && hoveredPin && (
        <div
          className="fixed z-10 pointer-events-none bg-white text-gray-800 text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-lg border border-gray-100 whitespace-nowrap max-w-xs truncate"
          style={{ left: hoveredPin.x + 14, top: hoveredPin.y - 10 }}
        >
          {hoveredPin.content}
        </div>
      )}

      {selected && user && (
        <CountySheet
          countyId={selected.id}
          countyName={selected.name}
          user={user}
          onClose={() => setSelected(null)}
          onStaysChanged={fetchStays}
          onPlacesChanged={fetchPlaces}
        />
      )}

      {!authLoading && !user && <AuthOverlay />}
    </>
  );
}
