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
import 'mapbox-gl/dist/mapbox-gl.css';
import { createClient } from '@supabase/supabase-js';
import CountySheet from './CountySheet';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ']/g, '').replace(/[ ']+/g, '-');
}

const lineLayer: LineLayerSpecification = {
  id: 'counties-line',
  type: 'line',
  source: 'counties',
  paint: { 'line-color': '#374151', 'line-width': 1 },
};

const pinsLayer: CircleLayerSpecification = {
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

type SelectedCounty = { id: string; name: string };
type StayRow = { county_id: string; location_lat: number | null; location_lng: number | null };
type HoveredCounty = { name: string; x: number; y: number };

export default function EnglandMap() {
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);
  // Deduplicated — one entry per distinct county
  const [completedSlugs, setCompletedSlugs] = useState<string[]>([]);
  const [pinsGeoJSON, setPinsGeoJSON] = useState<FeatureCollection>({
    type: 'FeatureCollection',
    features: [],
  });
  const [selected, setSelected] = useState<SelectedCounty | null>(null);
  const [cursor, setCursor] = useState<string>('auto');
  const [hoveredCounty, setHoveredCounty] = useState<HoveredCounty | null>(null);

  async function fetchStays() {
    const { data, error } = await supabase
      .from('stays')
      .select('county_id, location_lat, location_lng');
    console.log('[EnglandMap] stays:', data);
    if (error) {
      console.error('[EnglandMap] error fetching stays:', error);
      return;
    }
    const rows: StayRow[] = data ?? [];

    // Deduplicate so each county counts once for coloring and labels
    const slugSet = new Set(rows.map(s => s.county_id));
    const slugs = [...slugSet];
    console.log('[EnglandMap] completed county ids:', slugSet);
    setCompletedSlugs(slugs);

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
          properties: {},
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
  }, []);

  const handleClick = useCallback((e: MapMouseEvent) => {
    const feature = e.features?.[0];
    if (!feature) return;
    setSelected({
      id: feature.properties?.slug as string,
      name: feature.properties?.NAME as string,
    });
  }, []);

  const handleMouseMove = useCallback((e: MapMouseEvent) => {
    const feature = e.features?.[0];
    if (feature) {
      setCursor('pointer');
      setHoveredCounty({
        name: feature.properties?.NAME as string,
        x: e.point.x,
        y: e.point.y,
      });
    } else {
      setCursor('auto');
      setHoveredCounty(null);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setCursor('auto');
    setHoveredCounty(null);
  }, []);

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

  // Symbol layer for permanent labels on completed counties only
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
        interactiveLayerIds={['counties-fill']}
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

        <Source id="stay-pins" type="geojson" data={pinsGeoJSON}>
          <Layer {...pinsLayer} />
        </Source>
      </Map>

      {/* Progress counter — top-left HUD badge */}
      <div className="fixed top-4 left-4 z-10 pointer-events-none select-none bg-white rounded-xl shadow px-4 py-2 text-sm font-semibold text-gray-700 tabular-nums">
        {completedSlugs.length} / 48
      </div>

      {/* Hover tooltip — desktop only, hidden when sheet is open */}
      {!selected && hoveredCounty && (
        <div
          className="fixed z-10 pointer-events-none bg-white text-gray-800 text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-lg border border-gray-100 whitespace-nowrap"
          style={{ left: hoveredCounty.x + 14, top: hoveredCounty.y - 10 }}
        >
          {hoveredCounty.name}
        </div>
      )}

      {selected && (
        <CountySheet
          countyId={selected.id}
          countyName={selected.name}
          onClose={() => setSelected(null)}
          onStaysChanged={fetchStays}
        />
      )}
    </>
  );
}
