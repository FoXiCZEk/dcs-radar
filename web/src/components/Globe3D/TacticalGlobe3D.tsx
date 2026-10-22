import React, { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import { useRadar } from '../../context/RadarContext';
import { Crosshair, Eye, Zap } from 'lucide-react';

export const TacticalGlobe3D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const entitiesMapRef = useRef<Map<string, Cesium.Entity>>(new Map());

  const {
    objects,
    selectedObjectId,
    selectObject,
    followSelected,
    filters,
    mapConfig,
  } = useRadar();

  const [perfMode, setPerfMode] = useState<boolean>(false);

  // 1. Initialize Cesium Viewer
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    if (mapConfig?.cesiumIonToken) {
      Cesium.Ion.defaultAccessToken = mapConfig.cesiumIonToken;
    }

    const defaultLat = mapConfig?.defaultLat || 42.15;
    const defaultLon = mapConfig?.defaultLon || 41.80;

    // Use OpenStreetMap imagery provider (no Cesium Ion token requirement!)
    const imageryProvider = new Cesium.OpenStreetMapImageryProvider({
      url: 'https://tile.openstreetmap.org/',
    });

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
    });

    // Dark sky atmosphere
    viewer.scene.globe.enableLighting = true;
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0a0f1d');

    // Camera initial position over Caucasus
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(defaultLon, defaultLat - 0.4, 25000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-35),
        roll: 0.0,
      },
      duration: 1.5,
    });

    // Click handler for picking entities in 3D
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

  // 2. Render & update 3D entities
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const entitiesMap = entitiesMapRef.current;
    const currentIDs = new Set<string>();

    // Apply active filters
    const filteredObjects = objects.filter((obj) => {
      if (!filters.coalitions.includes(obj.coalition)) return false;
      if (!filters.categories.includes(obj.category)) return false;
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        if (
          !obj.name?.toLowerCase().includes(term) &&
          !obj.pilot?.toLowerCase().includes(term) &&
          !obj.callsign?.toLowerCase().includes(term) &&
          !obj.id.toLowerCase().includes(term)
        )
          return false;
      }
      return true;
    });

    filteredObjects.forEach((obj) => {
      currentIDs.add(obj.id);
      const tr = obj.currentTransform;
      const position = Cesium.Cartesian3.fromDegrees(tr.longitude, tr.latitude, tr.altitude);

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
            pixelSize: isSelected ? 14 : obj.category === 'Weapon' ? 7 : 10,
            color: color,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: isSelected ? 3 : 1,
          },
          label: filters.showLabels
            ? {
                text: `${obj.name || obj.type} (${Math.round(tr.altitude)}m)`,
                font: '11px sans-serif',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                pixelOffset: new Cesium.Cartesian2(0, -18),
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 150000),
              }
            : undefined,
        });

        // Add 3D Trajectory Polyline in space
        if (filters.showTrails && obj.trail && obj.trail.length > 1) {
          const positions = obj.trail.map((t) =>
            Cesium.Cartesian3.fromDegrees(t.longitude, t.latitude, t.altitude)
          );
          entity.polyline = new Cesium.PolylineGraphics({
            positions: positions,
            width: 2,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.2,
              color: color.withAlpha(0.7),
            }),
          });
        }

        entitiesMap.set(obj.id, entity);
      } else {
        // Inkrementální aktualizace 3D pozice
        entity.position = position as any;

        if (entity.point) {
          entity.point.pixelSize = (isSelected ? 14 : obj.category === 'Weapon' ? 7 : 10) as any;
          entity.point.outlineWidth = (isSelected ? 3 : 1) as any;
        }

        if (filters.showLabels && entity.label) {
          entity.label.text = `${obj.name || obj.type} (${Math.round(tr.altitude)}m)` as any;
        }

        // Update trail polyline
        if (filters.showTrails && obj.trail && obj.trail.length > 1) {
          const positions = obj.trail.map((t) =>
            Cesium.Cartesian3.fromDegrees(t.longitude, t.latitude, t.altitude)
          );
          if (entity.polyline) {
            entity.polyline.positions = positions as any;
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

    // Camera follow entity in 3D
    if (followSelected && selectedObjectId) {
      const entity = entitiesMap.get(selectedObjectId);
      if (entity && viewer.trackedEntity !== entity) {
        viewer.trackedEntity = entity;
      }
    } else if (!followSelected && viewer.trackedEntity) {
      viewer.trackedEntity = undefined;
    }
  }, [objects, filters, selectedObjectId, followSelected]);

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
          gap: '6px',
        }}
      >
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
