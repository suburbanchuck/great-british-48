'use client';

import Map, { Source, Layer } from 'react-map-gl/mapbox';
import type { FillLayerSpecification, LineLayerSpecification } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const countiesFill: FillLayerSpecification = {
  id: 'counties-fill',
  type: 'fill',
  source: 'counties',
  paint: {
    'fill-color': '#e5e7eb',
    'fill-opacity': 0.4,
  },
};

const countiesLine: LineLayerSpecification = {
  id: 'counties-line',
  type: 'line',
  source: 'counties',
  paint: {
    'line-color': '#374151',
    'line-width': 1,
  },
};

export default function EnglandMap() {
  return (
    <Map
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      initialViewState={{
        longitude: -1.5,
        latitude: 52.8,
        zoom: 5.8,
      }}
      style={{ width: '100vw', height: '100vh' }}
      mapStyle="mapbox://styles/mapbox/light-v11"
      touchZoomRotate
      touchPitch={false}
    >
      <Source id="counties" type="geojson" data="/counties.geojson">
        <Layer {...countiesFill} />
        <Layer {...countiesLine} />
      </Source>
    </Map>
  );
}
