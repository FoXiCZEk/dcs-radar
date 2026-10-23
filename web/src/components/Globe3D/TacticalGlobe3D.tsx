import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Cesium from 'cesium';
import { useRadar } from '../../context/RadarContext';
import { MapStyleType } from '../../types/telemetry';
import { Crosshair, Eye, Zap, Maximize2 } from 'lucide-react';
import { getSAMProfile } from '../../utils/samDatabase';

export const TacticalGlobe3D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const entitiesMapRef = useRef<Map<string, Cesium.Entity>>(new Map());
  const samRingsMapRef = useRef<Map<string, Cesium.Entity>>(new Map());
  const autoCenteredRef = useRef<boolean>(false);

  const {
    objects,
    selectedObjectId,
    selectObject,
    followSelected,
    filters,
    mapConfig,
    mapStyle,
    viewMode,
  } = useRadar();

  const [perfMode, setPerfMode] = useState<boolean>(false);

  const createImageryProvider = (style: MapStyleType): Cesium.ImageryProvider => {
    switch (style) {
      case 'satellite':
        return new Cesium.UrlTemplateImageryProvider({
          url: mapConfig?.satelliteTileUrl || 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          credit: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, USDA, USGS',
        });
      case 'voyager':
        return new Cesium.UrlTemplateImageryProvider({
          url: 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=cb1_330x_1_ffa23c299bbe502ba07a7c8a',
          credit: '© OpenStreetMap přispěvatelé, © CARTO',
        });
      case 'osm':
        return new Cesium.UrlTemplateImageryProvider({
          url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          credit: '© OpenStreetMap contributors',
        });
      case 'dark':
      default:
        return new Cesium.UrlTemplateImageryProvider({
          url: mapConfig?.tileUrl || 'https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=cb1_330x_1_ffa23c299bbe502ba07a7c8a',
          credit: '© OpenStreetMap přispěvatelé, © CARTO',
        });
    }
  };

  // 1. Initialize Cesium Viewer
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    if (mapConfig?.cesiumIonToken) {
      Cesium.Ion.defaultAccessToken = mapConfig.cesiumIonToken;
    }

    const defaultLat = mapConfig?.defaultLat || 42.15;
    const defaultLon = mapConfig?.defaultLon || 41.80;

    const imageryProvider = createImageryProvider(mapStyle);

    const viewer = new Cesium.Viewer(containerRef.current, {
      baseLayer: new Cesium.ImageryLayer(imageryProvider),
      animation: false,
      timeline: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      baseLayerPicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      scene3DOnly: true,
      shouldAnimate: true,
      skyAtmosphere: false,
    });

    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.showGroundAtmosphere = false;
    if (viewer.scene.sun) viewer.scene.sun.show = false;
    if (viewer.scene.moon) viewer.scene.moon.show = false;
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0a0f1d');

    // Camera initial position over Caucasus
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(defaultLon, defaultLat - 0.2, 450000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-75),
        roll: 0.0,
      },
      duration: 1.5,
    });

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: any) => {
      const picked = viewer.scene.pick(click.position);
      if (Cesium.defined(picked) && picked.id && picked.id.id) {
        selectObject(picked.id.id);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    viewerRef.current = viewer;

    return () => {
      handler.destroy();
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [mapConfig]);

  // Handle container resizing when viewMode toggles to 3D
  useEffect(() => {
    if (viewMode === '3d' && viewerRef.current) {
      const timer = setTimeout(() => {
        viewerRef.current?.resize();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [viewMode]);

  // Switch imagery layer on mapStyle change
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    try {
      viewer.imageryLayers.removeAll();
      const provider = createImageryProvider(mapStyle);
      const layer = new Cesium.ImageryLayer(provider);
      viewer.imageryLayers.add(layer);
    } catch (err) {
      console.error('Failed to change 3D globe basemap:', err);
    }
  }, [mapStyle, mapConfig]);

  // Auto-fit theater helper in 3D
  const handleFitTheater3D = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const valid = objects.filter((o) => {
      if (!o?.currentTransform) return false;
      const { latitude, longitude } = o.currentTransform;
      return typeof latitude === 'number' && typeof longitude === 'number' && !isNaN(latitude) && !isNaN(longitude) && (latitude !== 0 || longitude !== 0);
    });

    if (valid.length > 0) {
      let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
      valid.forEach((o) => {
        const { longitude, latitude } = o.currentTransform;
        if (longitude < minLon) minLon = longitude;
        if (longitude > maxLon) maxLon = longitude;
        if (latitude < minLat) minLat = latitude;
        if (latitude > maxLat) maxLat = latitude;
      });

      const centerLon = (minLon + maxLon) / 2;
      const centerLat = (minLat + maxLat) / 2;
      const dLon = maxLon - minLon;
      const dLat = maxLat - minLat;
      const spanKm = Math.max(dLon * 80, dLat * 111, 80);
      const height = Math.max(spanKm * 950, 350000);

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(centerLon, centerLat - (dLat * 0.15), height),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-75),
          roll: 0.0,
        },
        duration: 1.2,
      });
    }
  }, [objects]);

  // 2. Render & update 3D entities
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const entitiesMap = entitiesMapRef.current;
    const samRingsMap = samRingsMapRef.current;
    const currentIDs = new Set<string>();
    const currentSamIDs = new Set<string>();

    // Apply active filters with strict transform validation
    const filteredObjects = objects.filter((obj) => {
      if (!obj || !obj.currentTransform) return false;
      const tr = obj.currentTransform;
      if (typeof tr.latitude !== 'number' || typeof tr.longitude !== 'number') return false;
      if (isNaN(tr.latitude) || isNaN(tr.longitude)) return false;
      if (tr.latitude === 0 && tr.longitude === 0) return false;

      if (filters.coalitions.length > 0 && obj.coalition && !filters.coalitions.includes(obj.coalition)) {
        return false;
      }
      if (filters.categories.length > 0 && obj.category && !filters.categories.includes(obj.category)) {
        return false;
      }
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

    // Auto-center camera on first valid units
    if (!autoCenteredRef.current && filteredObjects.length > 0) {
      autoCenteredRef.current = true;
      handleFitTheater3D();
    }

    filteredObjects.forEach((obj) => {
      currentIDs.add(obj.id);
      const tr = obj.currentTransform;
      const alt = typeof tr.altitude === 'number' && !isNaN(tr.altitude) ? tr.altitude : 0;
      const position = Cesium.Cartesian3.fromDegrees(tr.longitude, tr.latitude, alt);

      const color =
        obj.coalition === 'Blue'
          ? Cesium.Color.fromCssColorString('#38bdf8')
          : obj.coalition === 'Red'
          ? Cesium.Color.fromCssColorString('#f87171')
          : obj.coalition === 'Neutral'
          ? Cesium.Color.fromCssColorString('#4ade80')
          : Cesium.Color.fromCssColorString('#fbbf24');

      const isSelected = obj.id === selectedObjectId;

      let entity = entitiesMap.get(obj.id);
      if (!entity) {
        // Create new 3D entity
        entity = viewer.entities.add({
          id: obj.id,
          name: obj.name || obj.type,
          position: position,
          point: {
            pixelSize: isSelected ? 16 : obj.category === 'Weapon' ? 8 : 12,
            color: color,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: isSelected ? 3 : 1.5,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: filters.showLabels
            ? {
                text: `${obj.name || obj.type} (${Math.round(alt)}m)`,
                font: 'bold 12px sans-serif',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 3,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                pixelOffset: new Cesium.Cartesian2(0, -20),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 1500000),
              }
            : undefined,
        });

        // Add 3D Trajectory Polyline in space
        if (filters.showTrails && obj.trail && obj.trail.length > 1) {
          const positions = obj.trail
            .filter((t) => typeof t.longitude === 'number' && typeof t.latitude === 'number' && !isNaN(t.latitude))
            .map((t) => Cesium.Cartesian3.fromDegrees(t.longitude, t.latitude, t.altitude || 0));

          if (positions.length > 1) {
            entity.polyline = new Cesium.PolylineGraphics({
              positions: positions,
              width: 2,
              material: new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.2,
                color: color.withAlpha(0.7),
              }),
            });
          }
        }

        entitiesMap.set(obj.id, entity);
      } else {
        // Incremental update of 3D position
        entity.position = position as any;

        if (entity.point) {
          entity.point.pixelSize = (isSelected ? 16 : obj.category === 'Weapon' ? 8 : 12) as any;
          entity.point.outlineWidth = (isSelected ? 3 : 1.5) as any;
          entity.point.disableDepthTestDistance = Number.POSITIVE_INFINITY as any;
        }

        if (filters.showLabels && entity.label) {
          entity.label.text = `${obj.name || obj.type} (${Math.round(alt)}m)` as any;
          entity.label.disableDepthTestDistance = Number.POSITIVE_INFINITY as any;
        }

        if (filters.showTrails && obj.trail && obj.trail.length > 1) {
          const positions = obj.trail
            .filter((t) => typeof t.longitude === 'number' && typeof t.latitude === 'number' && !isNaN(t.latitude))
            .map((t) => Cesium.Cartesian3.fromDegrees(t.longitude, t.latitude, t.altitude || 0));

          if (positions.length > 1 && entity.polyline) {
            entity.polyline.positions = positions as any;
          }
        }
      }

      // SAM / AAA 3D Threat Cylinder
      if (filters.showThreatRings && obj.alive) {
        const profile = getSAMProfile(obj.type, obj.name);
        if (profile) {
          currentSamIDs.add(obj.id);
          const rangeMeters = profile.engagementRangeKm * 1000;
          const maxAltMeters = Math.min(profile.maxAltM || 15000, 25000);
          const isThreat = obj.coalition === 'Red';
          const ringColor = isThreat
            ? Cesium.Color.RED.withAlpha(0.12)
            : obj.coalition === 'Blue'
            ? Cesium.Color.SKYBLUE.withAlpha(0.1)
            : Cesium.Color.LIME.withAlpha(0.1);

          let samEntity = samRingsMap.get(obj.id);
          if (!samEntity) {
            samEntity = viewer.entities.add({
              id: `sam-ring-3d-${obj.id}`,
              position: Cesium.Cartesian3.fromDegrees(tr.longitude, tr.latitude, maxAltMeters / 2),
              cylinder: {
                length: maxAltMeters,
                topRadius: rangeMeters,
                bottomRadius: rangeMeters,
                material: ringColor,
                outline: true,
                outlineColor: (isThreat ? Cesium.Color.RED : Cesium.Color.SKYBLUE).withAlpha(0.6),
                outlineWidth: 1,
              },
            });
            samRingsMap.set(obj.id, samEntity);
          } else {
            samEntity.position = Cesium.Cartesian3.fromDegrees(tr.longitude, tr.latitude, maxAltMeters / 2) as any;
          }
        }
      }
    });

    // Remove deleted entities
    entitiesMap.forEach((entity, id) => {
      if (!currentIDs.has(id)) {
        viewer.entities.remove(entity);
        entitiesMap.delete(id);
      }
    });

    // Remove deleted SAM rings
    samRingsMap.forEach((entity, id) => {
      if (!currentSamIDs.has(id)) {
        viewer.entities.remove(entity);
        samRingsMap.delete(id);
      }
    });

    // Camera follow entity in 3D
    if (followSelected && selectedObjectId) {
      const entity = entitiesMap.get(selectedObjectId);
      if (entity && viewer.trackedEntity !== entity) {
        viewer.trackedEntity = entity;
      }
    } else if (!followSelected && viewer.trackedEntity) {
      viewer.trackedEntity = undefined;
    }
  }, [objects, filters, selectedObjectId, followSelected, handleFitTheater3D]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={containerRef}
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

      {/* Floating 3D controls */}
      <div
        style={{
          position: 'absolute',
          top: '72px',
          left: '16px',
          zIndex: 10,
          display: 'flex',
          gap: '8px',
        }}
      >
        <button
          onClick={handleFitTheater3D}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            fontSize: '0.8rem',
            fontWeight: 700,
            borderRadius: '6px',
            backgroundColor: 'rgba(15, 23, 42, 0.88)',
            color: '#38bdf8',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            cursor: 'pointer',
          }}
        >
          <Maximize2 size={13} /> Vycentrovat bojiště
        </button>

        <button
          onClick={() => setPerfMode(!perfMode)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            fontSize: '0.75rem',
            fontWeight: 600,
            borderRadius: '4px',
            backgroundColor: perfMode ? '#fbbf24' : 'rgba(15, 23, 42, 0.85)',
            color: perfMode ? '#0a0f1d' : '#f8fafc',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            cursor: 'pointer',
          }}
        >
          <Zap size={12} /> {perfMode ? 'Výkonnostní režim (ZAP)' : 'Běžný výkon'}
        </button>
      </div>
    </div>
  );
};
