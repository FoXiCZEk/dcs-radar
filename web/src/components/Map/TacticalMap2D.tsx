import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import { useRadar } from '../../context/RadarContext';
import { Maximize2, ShieldAlert, Crosshair, Target } from 'lucide-react';
import { getSAMProfile, createGeoJSONCircle } from '../../utils/samDatabase';
import { calculateBRAA, THEATER_BULLSEYE } from '../../utils/braa';
import { ObjectEntity } from '../../types/telemetry';

interface TacticalMap2DProps {
  onMapReady?: (map: maplibregl.Map) => void;
}

// Return tactical SVG symbol based on category and coalition
function getTacticalSVG(category: string, color: string, heading: number): string {
  const rot = Math.round(heading || 0);

  switch (category) {
    case 'AirFixedWing':
      return `
        <svg viewBox="0 0 32 32" width="28" height="28" style="transform: rotate(${rot}deg); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));">
          <!-- Jet Aircraft Silhouette -->
          <path d="M16 2 L19 12 L29 17 L29 19 L19 17 L19 25 L23 28 L23 30 L16 28 L9 30 L9 28 L13 25 L13 17 L3 19 L3 17 L13 12 Z" fill="${color}" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round"/>
        </svg>
      `;
    case 'AirRotor':
      return `
        <svg viewBox="0 0 32 32" width="26" height="26" style="transform: rotate(${rot}deg); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));">
          <!-- Helicopter Silhouette -->
          <circle cx="16" cy="16" r="13" fill="none" stroke="${color}" stroke-width="1" stroke-dasharray="3, 2" opacity="0.6"/>
          <path d="M16 6 L16 26 M6 16 L26 16" stroke="${color}" stroke-width="1.5"/>
          <ellipse cx="16" cy="16" rx="4" ry="7" fill="${color}" stroke="#ffffff" stroke-width="1"/>
          <rect x="15" y="23" width="2" height="6" fill="${color}"/>
          <rect x="13" y="28" width="6" height="2" fill="${color}"/>
        </svg>
      `;
    case 'Sea':
      return `
        <svg viewBox="0 0 32 32" width="26" height="26" style="transform: rotate(${rot}deg); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));">
          <!-- Warship / Naval Vessel Silhouette -->
          <path d="M16 3 L22 10 L22 25 L16 29 L10 25 L10 10 Z" fill="${color}" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round"/>
          <line x1="16" y1="8" x2="16" y2="24" stroke="#ffffff" stroke-width="1.2"/>
        </svg>
      `;
    case 'Weapon':
      return `
        <svg viewBox="0 0 28 28" width="22" height="22" style="transform: rotate(${rot}deg); filter: drop-shadow(0 0 6px #f59e0b);">
          <!-- Guided Missile Silhouette -->
          <path d="M14 2 L17 10 L17 22 L20 25 L20 27 L14 24 L8 27 L8 25 L11 22 L11 10 Z" fill="#fbbf24" stroke="#ffffff" stroke-width="1.2"/>
        </svg>
      `;
    case 'Navaid':
      return `
        <svg viewBox="0 0 28 28" width="22" height="22" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));">
          <!-- Bullseye / Navpoint -->
          <circle cx="14" cy="14" r="10" fill="none" stroke="${color}" stroke-width="1.5"/>
          <circle cx="14" cy="14" r="5" fill="none" stroke="${color}" stroke-width="1.5"/>
          <circle cx="14" cy="14" r="2" fill="${color}"/>
        </svg>
      `;
    case 'Ground':
    default:
      return `
        <svg viewBox="0 0 28 28" width="24" height="24" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));">
          <!-- Ground Unit / Armor / SAM Icon -->
          <rect x="5" y="7" width="18" height="14" rx="3" fill="${color}" stroke="#ffffff" stroke-width="1.2"/>
          <line x1="5" y1="14" x2="23" y2="14" stroke="#ffffff" stroke-width="1" opacity="0.7"/>
          <circle cx="14" cy="14" r="2.5" fill="#ffffff"/>
        </svg>
      `;
  }
}

export const TacticalMap2D: React.FC<TacticalMap2DProps> = ({ onMapReady }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState<boolean>(false);
  const autoCenteredRef = useRef<boolean>(false);

  // Store interactive unit DOM markers: objectId -> Marker
  const unitMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  // Store SAM Threat Ring Badge DOM markers: samId -> Marker
  const samBadgeMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  // Store BRAA midpoint badge marker
  const braaBadgeRef = useRef<maplibregl.Marker | null>(null);

  const {
    objects,
    selectedObjectId,
    selectedObject,
    referenceObjectId,
    referenceObject,
    selectObject,
    followSelected,
    filters,
    mapConfig,
    mapStyle,
    status,
    viewMode,
  } = useRadar();

  const isAltFt = mapConfig?.altitudeUnit === 'ft';
  const isSpeedKmh = mapConfig?.speedUnit === 'kmh';

  // 1. Initialize MapLibre GL instance once on mount
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const defaultLat = mapConfig?.defaultLat || 42.15;
    const defaultLon = mapConfig?.defaultLon || 41.80;
    const defaultZoom = mapConfig?.defaultZoom || 8.5;
    const darkUrl = mapConfig?.tileUrl || 'https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=cb1_330x_1_ffa23c299bbe502ba07a7c8a';
    const satelliteUrl = mapConfig?.satelliteTileUrl || 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    const voyagerUrl = 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=cb1_330x_1_ffa23c299bbe502ba07a7c8a';
    const osmUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        canvasContextAttributes: {
          antialias: false,
          powerPreference: 'default',
          failIfMajorPerformanceCaveat: false,
          preserveDrawingBuffer: false,
          desynchronized: false,
          contextType: 'webgl2',
        },
      style: {
        version: 8,
        sources: {
          'basemap-dark': {
            type: 'raster',
            tiles: [darkUrl],
            tileSize: 256,
            attribution: '© OpenStreetMap, © CARTO',
          },
          'basemap-satellite': {
            type: 'raster',
            tiles: [satelliteUrl],
            tileSize: 256,
            attribution: 'Tiles © Esri',
            maxzoom: 19,
          },
          'basemap-voyager': {
            type: 'raster',
            tiles: [voyagerUrl],
            tileSize: 256,
            attribution: '© OpenStreetMap, © CARTO',
          },
          'basemap-osm': {
            type: 'raster',
            tiles: [osmUrl],
            tileSize: 256,
            attribution: '© OpenStreetMap',
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

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-left');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    const setupVectorLayers = () => {
      try {
        // 1. Trajectories Line Layer
        if (!map.getSource('trajectories-source')) {
          map.addSource('trajectories-source', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });

          map.addLayer({
            id: 'trajectories-layer',
            type: 'line',
            source: 'trajectories-source',
            paint: {
              'line-color': ['coalesce', ['get', 'color'], '#38bdf8'],
              'line-width': 2,
              'line-opacity': 0.75,
              'line-dasharray': [2, 1],
            },
          });
        }

        // 2. SAM Threat Rings GeoJSON Layers (Fill + Dashed Stroke)
        if (!map.getSource('sam-rings-source')) {
          map.addSource('sam-rings-source', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });

          map.addLayer({
            id: 'sam-rings-fill',
            type: 'fill',
            source: 'sam-rings-source',
            paint: {
              'fill-color': ['coalesce', ['get', 'color'], '#ef4444'],
              'fill-opacity': 0.12,
            },
          });

          map.addLayer({
            id: 'sam-rings-line',
            type: 'line',
            source: 'sam-rings-source',
            paint: {
              'line-color': ['coalesce', ['get', 'color'], '#ef4444'],
              'line-width': 2,
              'line-dasharray': [4, 2],
              'line-opacity': 0.85,
            },
          });
        }

        // 3. BRAA Vector Measurement Line Layer
        if (!map.getSource('braa-vector-source')) {
          map.addSource('braa-vector-source', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });

          map.addLayer({
            id: 'braa-vector-line',
            type: 'line',
            source: 'braa-vector-source',
            paint: {
              'line-color': '#facc15',
              'line-width': 2.5,
              'line-dasharray': [3, 2],
              'line-opacity': 0.95,
            },
          });
        }
      } catch (err) {
        console.warn('Vector layer setup exception:', err);
      } finally {
        setIsMapReady(true);
        if (onMapReady) onMapReady(map);
      }
    };

    if (map.loaded() || map.isStyleLoaded()) {
      setupVectorLayers();
    } else {
      map.once('load', setupVectorLayers);
    }
    map.on('styledata', setupVectorLayers);
    } catch (err) {
      console.error('MapLibre GL failed to initialize:', err);
    }

    return () => {
      setIsMapReady(false);
      autoCenteredRef.current = false;
      // Cleanup all DOM markers
      unitMarkersRef.current.forEach((m) => m.remove());
      unitMarkersRef.current.clear();
      samBadgeMarkersRef.current.forEach((m) => m.remove());
      samBadgeMarkersRef.current.clear();
      if (braaBadgeRef.current) {
        braaBadgeRef.current.remove();
        braaBadgeRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Handle Window Resize and ViewMode switch
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) mapRef.current.resize();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (viewMode === '2d' && mapRef.current) {
      setTimeout(() => {
        const map = mapRef.current;
        if (!map) return;
        map.resize();
      }, 80);
    }
  }, [viewMode]);

  // Basemap switcher
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

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
    map.triggerRepaint();
  }, [mapStyle, isMapReady]);

  // Auto-fit theater helper
  const handleFitTheater = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const validObjects = objects.filter((o) => {
      if (!o || !o.currentTransform) return false;
      const { latitude, longitude } = o.currentTransform;
      return (
        typeof latitude === 'number' &&
        typeof longitude === 'number' &&
        !isNaN(latitude) &&
        !isNaN(longitude) &&
        (latitude !== 0 || longitude !== 0)
      );
    });

    if (validObjects.length > 0) {
      let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
      validObjects.forEach((o) => {
        const lon = o.currentTransform.longitude;
        const lat = o.currentTransform.latitude;
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      });

      if (minLon <= maxLon && minLat <= maxLat) {
        if (minLon === maxLon && minLat === maxLat) {
          map.easeTo({ center: [minLon, minLat], zoom: 10, duration: 800 });
        } else {
          map.fitBounds(
            [
              [minLon - 0.15, minLat - 0.15],
              [maxLon + 0.15, maxLat + 0.15],
            ],
            { padding: 80, maxZoom: 10.5, duration: 900 }
          );
        }
        return;
      }
    }

    const th = status?.theatre;
    if (th && THEATER_BULLSEYE[th]) {
      const b = THEATER_BULLSEYE[th];
      map.easeTo({ center: [b.lon, b.lat], zoom: 8, duration: 800 });
    } else {
      map.easeTo({
        center: [mapConfig?.defaultLon || 41.80, mapConfig?.defaultLat || 42.15],
        zoom: 8.5,
        duration: 800,
      });
    }
  }, [objects, status, mapConfig]);

  // 2. Main Render Loop: Units, SAM Threat Rings, BRAA, Trails
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // A. Apply active filters
    const filteredObjects = objects.filter((obj) => {
      if (!obj || !obj.currentTransform) return false;
      const tr = obj.currentTransform;
      if (typeof tr.latitude !== 'number' || typeof tr.longitude !== 'number') return false;
      if (isNaN(tr.latitude) || isNaN(tr.longitude)) return false;
      if (tr.latitude === 0 && tr.longitude === 0) return false;

      // Coalition filter
      if (filters.coalitions.length > 0 && obj.coalition && !filters.coalitions.includes(obj.coalition)) {
        return false;
      }
      // Category filter
      if (filters.categories.length > 0 && obj.category && !filters.categories.includes(obj.category)) {
        return false;
      }
      // Search term
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        const matchesName = obj.name?.toLowerCase().includes(term);
        const matchesPilot = obj.pilot?.toLowerCase().includes(term);
        const matchesCallsign = obj.callsign?.toLowerCase().includes(term);
        const matchesID = obj.id.toLowerCase().includes(term);
        if (!matchesName && !matchesPilot && !matchesCallsign && !matchesID) return false;
      }
      return true;
    });

    // Auto-center camera on first reception of valid units
    const canvas = map.getCanvas();
    if (!autoCenteredRef.current && filteredObjects.length > 0 && canvas && canvas.clientWidth > 100) {
      autoCenteredRef.current = true;
      handleFitTheater();
    }

    // B. Interactive DOM Tactical Markers for Units
    const currentObjectIds = new Set<string>();

    filteredObjects.forEach((obj) => {
      currentObjectIds.add(obj.id);
      const tr = obj.currentTransform;
      const isSelected = obj.id === selectedObjectId;
      const isReference = obj.id === referenceObjectId;

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

      const heading = tr.heading || tr.yaw || 0;
      let marker = unitMarkersRef.current.get(obj.id);

      if (!marker) {
        // Create new interactive tactical DOM marker
        const el = document.createElement('div');
        el.className = 'tactical-unit-marker';
        el.style.display = 'flex';
        el.style.flexDirection = 'column';
        el.style.alignItems = 'center';
        el.style.cursor = 'pointer';
        el.style.userSelect = 'none';
        el.style.pointerEvents = 'auto';
        el.style.transition = 'transform 0.15s ease-out';

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          selectObject(obj.id);
        });

        marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([tr.longitude, tr.latitude])
          .addTo(map);

        unitMarkersRef.current.set(obj.id, marker);
      } else {
        marker.setLngLat([tr.longitude, tr.latitude]);
      }

      // Update marker DOM content
      const el = marker.getElement();
      const selectionRing = isSelected
        ? `border: 2px solid #ffffff; box-shadow: 0 0 12px #38bdf8, inset 0 0 8px #38bdf8; border-radius: 4px;`
        : isReference
        ? `border: 2px solid #facc15; box-shadow: 0 0 10px #facc15; border-radius: 50%;`
        : `border: 1px solid transparent;`;

      const labelHTML = filters.showLabels
        ? `
          <div style="
            background: rgba(10, 15, 29, 0.88);
            backdrop-filter: blur(4px);
            border: 1px solid ${isSelected ? '#38bdf8' : isReference ? '#facc15' : 'rgba(255,255,255,0.15)'};
            border-radius: 4px;
            padding: 2px 6px;
            font-size: 10px;
            font-weight: 700;
            color: #f8fafc;
            text-align: center;
            white-space: nowrap;
            margin-top: 2px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.6);
            letter-spacing: 0.02em;
          ">
            <div>${obj.name || obj.type || obj.id}</div>
            <div style="font-size: 9px; color: ${color}; font-weight: 600;">
              ${altStr} • ${speedStr}
            </div>
          </div>
        `
        : '';

      el.innerHTML = `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; padding: 2px; ${selectionRing}">
          ${getTacticalSVG(obj.category, color, heading)}
        </div>
        ${labelHTML}
      `;
    });

    // Remove obsolete unit markers
    unitMarkersRef.current.forEach((marker, id) => {
      if (!currentObjectIds.has(id)) {
        marker.remove();
        unitMarkersRef.current.delete(id);
      }
    });

    // C. SAM & AAA Threat Rings (Kruhy dosahu)
    const samFeatures: any[] = [];
    const activeSamIds = new Set<string>();

    if (filters.showThreatRings) {
      filteredObjects.forEach((obj) => {
        if (!obj.alive) return;
        const profile = getSAMProfile(obj.type, obj.name);
        if (profile && obj.currentTransform) {
          const { longitude, latitude } = obj.currentTransform;
          activeSamIds.add(obj.id);

          const isThreat = obj.coalition === 'Red';
          const ringColor = isThreat ? '#ef4444' : obj.coalition === 'Blue' ? '#38bdf8' : '#4ade80';

          // 1. Engagement Ring Polygon
          const rangeKm = profile.engagementRangeKm || 10;
          const coords = createGeoJSONCircle(longitude, latitude, rangeKm, 48);

          samFeatures.push({
            type: 'Feature',
            properties: {
              id: obj.id,
              color: ringColor,
            },
            geometry: {
              type: 'Polygon',
              coordinates: [coords],
            },
          });

          // 2. Threat Ring Range Badge DOM Marker placed on top edge of ring
          const latOffset = (rangeKm / 110.574);
          const badgeLon = longitude;
          const badgeLat = latitude + latOffset;

          let badgeMarker = samBadgeMarkersRef.current.get(obj.id);
          if (!badgeMarker) {
            const badgeEl = document.createElement('div');
            badgeEl.className = 'sam-range-badge';
            badgeEl.style.pointerEvents = 'none';

            badgeMarker = new maplibregl.Marker({ element: badgeEl, anchor: 'bottom' })
              .setLngLat([badgeLon, badgeLat])
              .addTo(map);

            samBadgeMarkersRef.current.set(obj.id, badgeMarker);
          } else {
            badgeMarker.setLngLat([badgeLon, badgeLat]);
          }

          badgeMarker.getElement().innerHTML = `
            <div style="
              background: rgba(15, 23, 42, 0.9);
              border: 1px solid ${ringColor};
              border-radius: 4px;
              padding: 2px 6px;
              font-size: 9.5px;
              font-weight: 800;
              color: ${ringColor};
              white-space: nowrap;
              box-shadow: 0 2px 6px rgba(0,0,0,0.6);
              display: flex;
              align-items: center;
              gap: 4px;
            ">
              <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${ringColor};"></span>
              ${profile.natoName} • ${profile.engagementRangeNM} NM
            </div>
          `;
        }
      });
    }

    // Remove obsolete SAM badges
    samBadgeMarkersRef.current.forEach((marker, id) => {
      if (!activeSamIds.has(id)) {
        marker.remove();
        samBadgeMarkersRef.current.delete(id);
      }
    });

    const samSource = map.getSource('sam-rings-source') as maplibregl.GeoJSONSource;
    if (samSource) {
      samSource.setData({
        type: 'FeatureCollection',
        features: samFeatures,
      });
    }

    // D. Trajectories / Flight Trails
    const trajectoryFeatures: any[] = [];
    if (filters.showTrails) {
      filteredObjects.forEach((obj) => {
        if (obj.trail && obj.trail.length > 1) {
          const coords = obj.trail
            .filter((t) => typeof t.longitude === 'number' && typeof t.latitude === 'number' && !isNaN(t.latitude))
            .map((t) => [t.longitude, t.latitude]);

          if (coords.length > 1) {
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

    // E. Tactical BRAA Vector & Measurement HUD
    const braaFeatures: any[] = [];
    if (
      referenceObject &&
      selectedObject &&
      referenceObject.id !== selectedObject.id &&
      referenceObject.currentTransform &&
      selectedObject.currentTransform
    ) {
      const refTr = referenceObject.currentTransform;
      const selTr = selectedObject.currentTransform;

      const braa = calculateBRAA(
        {
          latitude: refTr.latitude,
          longitude: refTr.longitude,
          altitude: refTr.altitude,
          heading: refTr.heading || refTr.yaw || 0,
        },
        {
          latitude: selTr.latitude,
          longitude: selTr.longitude,
          altitude: selTr.altitude,
          heading: selTr.heading || selTr.yaw || 0,
        }
      );

      // 1. Line connecting reference to selected
      braaFeatures.push({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [
            [refTr.longitude, refTr.latitude],
            [selTr.longitude, selTr.latitude],
          ],
        },
      });

      // 2. High-visibility midpoint tactical HUD badge
      const midLon = (refTr.longitude + selTr.longitude) / 2;
      const midLat = (refTr.latitude + selTr.latitude) / 2;
      const braaLabel = `BRAA: ${braa.bearing.toString().padStart(3, '0')}° / ${braa.rangeNM} NM / ${Math.round(braa.altitudeFt / 1000)}k • ${braa.aspectLabel}`;

      if (!braaBadgeRef.current) {
        const el = document.createElement('div');
        el.className = 'tactical-braa-badge';
        el.style.pointerEvents = 'none';

        braaBadgeRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([midLon, midLat])
          .addTo(map);
      } else {
        braaBadgeRef.current.setLngLat([midLon, midLat]);
      }

      braaBadgeRef.current.getElement().innerHTML = `
        <div style="
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(6px);
          border: 1.5px solid #facc15;
          border-radius: 6px;
          padding: 4px 10px;
          color: #facc15;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.04em;
          box-shadow: 0 4px 15px rgba(0,0,0,0.8), 0 0 10px rgba(250, 204, 21, 0.3);
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 6px;
        ">
          <span style="color:#ffffff;">🎯</span> ${braaLabel}
        </div>
      `;
    } else {
      if (braaBadgeRef.current) {
        braaBadgeRef.current.remove();
        braaBadgeRef.current = null;
      }
    }

    const braaSource = map.getSource('braa-vector-source') as maplibregl.GeoJSONSource;
    if (braaSource) {
      braaSource.setData({
        type: 'FeatureCollection',
        features: braaFeatures,
      });
    }

    // F. Camera follow selected unit
    if (followSelected && selectedObjectId) {
      const selected = objects.find((o) => o.id === selectedObjectId);
      if (selected && selected.currentTransform) {
        map.easeTo({
          center: [selected.currentTransform.longitude, selected.currentTransform.latitude],
          duration: 250,
        });
      }
    }

    map.triggerRepaint();
  }, [
    isMapReady,
    objects,
    filters,
    selectedObjectId,
    referenceObjectId,
    referenceObject,
    selectedObject,
    followSelected,
    isAltFt,
    isSpeedKmh,
    handleFitTheater,
  ]);

  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  useEffect(() => {
    setIsBannerDismissed(false);
  }, [status?.connectionState]);

  const connState = status?.connectionState || 'disconnected';
  const showBanner = objects.length === 0 && !isBannerDismissed;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* MapLibre WebGL Canvas Container */}
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

      {/* Top Left Live Status Pill */}
      <div
        style={{
          position: 'absolute',
          top: '72px',
          left: '16px',
          zIndex: 8,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          backgroundColor: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '6px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: connState === 'connected' ? '#4ade80' : '#f87171',
            boxShadow: connState === 'connected' ? '0 0 8px #4ade80' : 'none',
          }}
        />
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '0.03em' }}>
          2D RADAR: {objects.length} JEDNOTEK {status?.theatre ? `• ${status.theatre}` : ''}
        </span>
      </div>

      {/* Disconnected / Paused Tactical Banner */}
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
                <ShieldAlert size={28} color={connState === 'paused' ? '#facc15' : '#f87171'} style={{ flexShrink: 0 }} />
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
                      ? 'Nepodařilo se navázat spojení se serverem DCS. Zkontrolujte, zda běží DCS World a je spuštěn export Tacview.'
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
          </div>
        </div>
      )}

      {/* Floating Tactical Auto-Fit Theater Button & Unit Counter */}
      <button
        onClick={handleFitTheater}
        title="Vycentrovat kameru na aktivní jednotky / bojiště"
        style={{
          position: 'absolute',
          bottom: '75px',
          right: '16px',
          zIndex: 15,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 14px',
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(8px)',
          border: '1px solid #38bdf8',
          borderRadius: '6px',
          color: '#38bdf8',
          fontSize: '0.78rem',
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
          transition: 'all 0.2s',
        }}
      >
        <Maximize2 size={15} /> Vycentrovat bojiště ({objects.length})
      </button>
    </div>
  );
};
