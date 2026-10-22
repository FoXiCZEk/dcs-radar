import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import { useRadar } from '../../context/RadarContext';
import { PauseCircle, WifiOff, Radio, Server } from 'lucide-react';

interface TacticalMap2DProps {
  onMapReady?: (map: maplibregl.Map) => void;
}

export const TacticalMap2D: React.FC<TacticalMap2DProps> = ({ onMapReady }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const {
    objects,
    selectedObjectId,
    selectObject,
    followSelected,
    filters,
    mapConfig,
    mapStyle,
    status,
  } = useRadar();

  const isAltFt = mapConfig?.altitudeUnit === 'ft';
  const isSpeedKmh = mapConfig?.speedUnit === 'kmh';

  // 1. Initialize MapLibre GL instance
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const defaultLat = mapConfig?.defaultLat || 42.15;
    const defaultLon = mapConfig?.defaultLon || 41.80;
    const defaultZoom = mapConfig?.defaultZoom || 8.5;
    const darkUrl = mapConfig?.tileUrl || 'https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=cb1_330x_1_ffa23c299bbe502ba07a7c8a';
    const satelliteUrl = mapConfig?.satelliteTileUrl || 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    const voyagerUrl = 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=cb1_330x_1_ffa23c299bbe502ba07a7c8a';
    const osmUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'basemap-dark': {
            type: 'raster',
            tiles: [darkUrl],
            tileSize: 256,
            attribution: '© OpenStreetMap přispěvatelé, © CARTO',
          },
          'basemap-satellite': {
            type: 'raster',
            tiles: [satelliteUrl],
            tileSize: 256,
            attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, USDA, USGS',
            maxzoom: 19,
          },
          'basemap-voyager': {
            type: 'raster',
            tiles: [voyagerUrl],
            tileSize: 256,
            attribution: '© OpenStreetMap přispěvatelé, © CARTO',
          },
          'basemap-osm': {
            type: 'raster',
            tiles: [osmUrl],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'basemap-dark-layer',
            type: 'raster',
            source: 'basemap-dark',
            layout: { visibility: mapStyle === 'dark' ? 'visible' : 'none' },
            minzoom: 0,
            maxzoom: 19,
          },
          {
            id: 'basemap-satellite-layer',
            type: 'raster',
            source: 'basemap-satellite',
            layout: { visibility: mapStyle === 'satellite' ? 'visible' : 'none' },
            minzoom: 0,
            maxzoom: 19,
          },
          {
            id: 'basemap-voyager-layer',
            type: 'raster',
            source: 'basemap-voyager',
            layout: { visibility: mapStyle === 'voyager' ? 'visible' : 'none' },
            minzoom: 0,
            maxzoom: 19,
          },
          {
            id: 'basemap-osm-layer',
            type: 'raster',
            source: 'basemap-osm',
            layout: { visibility: mapStyle === 'osm' ? 'visible' : 'none' },
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [defaultLon, defaultLat],
      zoom: defaultZoom,
      pitch: 0,
      bearing: 0,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-left');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.on('load', () => {
      // 1. Add GeoJSON source for trajectories
      map.addSource('trajectories-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'trajectories-layer',
        type: 'line',
        source: 'trajectories-source',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2,
          'line-opacity': 0.7,
          'line-dasharray': [2, 1],
        },
      });

      // 2. Add GeoJSON source for unit markers
      map.addSource('units-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Unit circle background
      map.addLayer({
        id: 'units-circle',
        type: 'circle',
        source: 'units-source',
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'id'], selectedObjectId || ''],
            10,
            ['==', ['get', 'category'], 'Weapon'],
            5,
            7,
          ],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.85,
          'circle-stroke-width': [
            'case',
            ['==', ['get', 'id'], selectedObjectId || ''],
            3,
            1.5,
          ],
          'circle-stroke-color': '#ffffff',
        },
      });

      // Labels layer
      map.addLayer({
        id: 'units-labels',
        type: 'symbol',
        source: 'units-source',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 11,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#f8fafc',
          'text-halo-color': '#0a0f1d',
          'text-halo-width': 1.5,
        },
      });

      // Click event on unit markers
      map.on('click', 'units-circle', (e: any) => {
        if (e.features && e.features[0]) {
          const id = e.features[0].properties?.id;
          if (id) {
            selectObject(id);
          }
        }
      });

      map.on('mouseenter', 'units-circle', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'units-circle', () => {
        map.getCanvas().style.cursor = '';
      });

      mapRef.current = map;
      if (onMapReady) onMapReady(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapConfig]);

  // Switch visible basemap layer on mapStyle change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyVisibility = () => {
      const layers = [
        { id: 'basemap-dark-layer', style: 'dark' },
        { id: 'basemap-satellite-layer', style: 'satellite' },
        { id: 'basemap-voyager-layer', style: 'voyager' },
        { id: 'basemap-osm-layer', style: 'osm' },
      ];

      layers.forEach(({ id, style }) => {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', mapStyle === style ? 'visible' : 'none');
        }
      });
    };

    if (map.isStyleLoaded()) {
      applyVisibility();
    } else {
      map.once('load', applyVisibility);
    }
  }, [mapStyle]);

  // 2. Filter and update GeoJSON data
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Apply active filters
    const filteredObjects = objects.filter((obj) => {
      // Coalition filter
      if (!filters.coalitions.includes(obj.coalition)) return false;
      // Category filter
      if (!filters.categories.includes(obj.category)) return false;
      // Search term
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        const matchesName = obj.name?.toLowerCase().includes(term);
        const matchesPilot = obj.pilot?.toLowerCase().includes(term);
        const matchesCallsign = obj.callsign?.toLowerCase().includes(term);
        const matchesID = obj.id.toLowerCase().includes(term);
        if (!matchesName && !matchesPilot && !matchesCallsign && !matchesID) return false;
      }
      // Altitude range
      if (obj.currentTransform.altitude < filters.minAltitude || obj.currentTransform.altitude > filters.maxAltitude) {
        return false;
      }
      // Speed range
      const speed = obj.currentTransform.speedKts || 0;
      if (speed < filters.minSpeed || speed > filters.maxSpeed) {
        return false;
      }
      return true;
    });

    // Build Trajectory GeoJSON
    const trajectoryFeatures: any[] = [];
    if (filters.showTrails) {
      filteredObjects.forEach((obj) => {
        if (obj.trail && obj.trail.length > 1) {
          const coords = obj.trail.map((t) => [t.longitude, t.latitude]);
          const color =
            obj.coalition === 'Blue'
              ? '#38bdf8'
              : obj.coalition === 'Red'
              ? '#f87171'
              : obj.coalition === 'Neutral'
              ? '#4ade80'
              : '#fbbf24';

          trajectoryFeatures.push({
            type: 'Feature',
            properties: { id: obj.id, color },
            geometry: {
              type: 'LineString',
              coordinates: coords,
            },
          });
        }
      });
    }

    const trailSource = map.getSource('trajectories-source') as maplibregl.GeoJSONSource;
    if (trailSource) {
      trailSource.setData({
        type: 'FeatureCollection',
        features: trajectoryFeatures,
      });
    }

    // Build Unit Point Features
    const unitFeatures: any[] = filteredObjects.map((obj) => {
      const tr = obj.currentTransform;
      const color =
        obj.coalition === 'Blue'
          ? '#38bdf8'
          : obj.coalition === 'Red'
          ? '#f87171'
          : obj.coalition === 'Neutral'
          ? '#4ade80'
          : obj.category === 'Weapon'
          ? '#fbbf24'
          : '#94a3b8';

      const altStr = isAltFt
        ? `${Math.round(tr.altitude * 3.28084)}ft`
        : `${Math.round(tr.altitude)}m`;

      const speedStr = isSpeedKmh
        ? `${Math.round((tr.speedKts || 0) * 1.852)}km/h`
        : `${Math.round(tr.speedKts || 0)}kt`;

      const label = filters.showLabels
        ? `${obj.name || obj.type}\n${altStr} • ${speedStr}`
        : '';

      return {
        type: 'Feature',
        properties: {
          id: obj.id,
          name: obj.name || obj.type,
          coalition: obj.coalition,
          category: obj.category,
          heading: tr.heading || tr.yaw || 0,
          color,
          label,
        },
        geometry: {
          type: 'Point',
          coordinates: [tr.longitude, tr.latitude],
        },
      };
    });

    const unitsSource = map.getSource('units-source') as maplibregl.GeoJSONSource;
    if (unitsSource) {
      unitsSource.setData({
        type: 'FeatureCollection',
        features: unitFeatures,
      });
    }

    // 3. Camera follow mode
    if (followSelected && selectedObjectId) {
      const selected = objects.find((o) => o.id === selectedObjectId);
      if (selected) {
        map.easeTo({
          center: [selected.currentTransform.longitude, selected.currentTransform.latitude],
          duration: 300,
        });
      }
    }
  }, [objects, filters, selectedObjectId, followSelected, isAltFt, isSpeedKmh]);

  const [isBannerDismissed, setIsBannerDismissed] = React.useState(false);

  useEffect(() => {
    setIsBannerDismissed(false);
  }, [status?.connectionState]);

  const connState = status?.connectionState || 'disconnected';
  const showBanner = objects.length === 0 && !isBannerDismissed;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={mapContainerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
        }}
      />

      {showBanner && (
        <div
          style={{
            position: 'absolute',
            top: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            pointerEvents: 'auto',
            maxWidth: '560px',
            width: '92%',
          }}
        >
          <div
            className="tactical-panel"
            style={{
              padding: '16px 20px',
              backgroundColor: 'rgba(15, 23, 42, 0.92)',
              backdropFilter: 'blur(10px)',
              borderRadius: '8px',
              border: `1px solid ${
                connState === 'connected'
                  ? '#38bdf8'
                  : connState === 'paused'
                  ? '#eab308'
                  : '#ef4444'
              }`,
              boxShadow: '0 20px 40px rgba(0,0,0,0.7)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {connState === 'paused' ? (
                  <PauseCircle size={28} color="#facc15" style={{ flexShrink: 0 }} />
                ) : connState === 'disconnected' ? (
                  <WifiOff size={28} color="#f87171" style={{ flexShrink: 0 }} />
                ) : (
                  <Radio size={28} color="#38bdf8" style={{ flexShrink: 0 }} />
                )}
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.04em' }}>
                    {connState === 'paused'
                      ? 'MISE DCS JE POZASTAVENA'
                      : connState === 'disconnected'
                      ? 'DCS SERVER NEPOSLOUCHÁ'
                      : 'ČEKÁNÍ NA JEDNOTKY V MISI'}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '3px', lineHeight: 1.4 }}>
                    {connState === 'paused'
                      ? 'Server i telemetrické porty jsou připraveny, ale mise je v DCS pozastavena. Jakmile misi v DCS odpausujete (klávesa Pause), telemetrie se okamžitě zobrazí.'
                      : connState === 'disconnected'
                      ? 'Nepodařilo se navázat spojení se serverem DCS (192.168.0.120). Zkontrolujte, zda běží DCS World a je spuštěn export Tacview.'
                      : 'Spojení se serverem DCS je aktivní. V misi zatím nebyly detekovány žádné letouny ani pozemní cíle.'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsBannerDismissed(true)}
                title="Skrýt upozornění"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  lineHeight: 1,
                  padding: '2px 6px',
                }}
              >
                ×
              </button>
            </div>

            {/* Ports Status Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                marginTop: '14px',
                paddingTop: '12px',
                borderTop: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div
                style={{
                  padding: '6px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Tacview Telemetrie</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: status?.dcsHealth?.tacviewPortOpen ? '#4ade80' : '#f87171' }}>
                  :{status?.dcsHealth?.tacviewPort || 42674} {status?.dcsHealth?.tacviewPortOpen ? '● OTEVŘEN' : '○ ZAVŘEN'}
                </div>
              </div>

              <div
                style={{
                  padding: '6px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>DCS Herní Port</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: status?.dcsHealth?.gamePortOpen ? '#4ade80' : '#f87171' }}>
                  :{status?.dcsHealth?.gamePort || 10308} {status?.dcsHealth?.gamePortOpen ? '● AKTIVNÍ' : '○ NEDOSTUPNÝ'}
                </div>
              </div>

              <div
                style={{
                  padding: '6px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>DCS-gRPC API</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: status?.dcsHealth?.grpcPortOpen ? '#4ade80' : '#f87171' }}>
                  :{status?.dcsHealth?.grpcPort || 40051} {status?.dcsHealth?.grpcPortOpen ? '● DOSTUPNÝ' : '○ NEDOSTUPNÝ'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
