import React from 'react';
import { useRadar } from '../../context/RadarContext';
import {
  Compass,
  Crosshair,
  Download,
  Eye,
  Gauge,
  MapPin,
  Navigation,
  Shield,
  Target,
  User,
  X,
} from 'lucide-react';
import { getExportUrl } from '../../services/api';
import { calculateBRAA, calculateBullseye, THEATER_BULLSEYE } from '../../utils/braa';

interface ObjectDetailProps {
  onCenterObject: (lat: number, lon: number) => void;
}

export const ObjectDetail: React.FC<ObjectDetailProps> = ({ onCenterObject }) => {
  const {
    selectedObject,
    selectObject,
    referenceObjectId,
    referenceObject,
    setReferenceObjectId,
    followSelected,
    toggleFollowSelected,
    events,
    mapConfig,
    status,
  } = useRadar();

  if (!selectedObject) return null;

  const tr = selectedObject.currentTransform;
  const isAltFt = mapConfig?.altitudeUnit === 'ft';
  const isSpeedKmh = mapConfig?.speedUnit === 'kmh';

  const altDisplay = isAltFt
    ? `${Math.round(tr.altitude * 3.28084).toLocaleString()} ft`
    : `${Math.round(tr.altitude).toLocaleString()} m`;

  const speedDisplay = isSpeedKmh
    ? `${Math.round((tr.speedKts || 0) * 1.852)} km/h`
    : `${Math.round(tr.speedKts || 0)} kts`;

  // Object-specific events
  const objectEvents = events.filter(
    (e) => e.objectId === selectedObject.id || e.targetId === selectedObject.id
  ).slice(0, 10);

  const getCoalitionColor = (c: string) => {
    if (c === 'Blue') return '#38bdf8';
    if (c === 'Red') return '#f87171';
    if (c === 'Neutral') return '#4ade80';
    return '#94a3b8';
  };

  return (
    <aside
      className="tactical-panel"
      style={{
        position: 'absolute',
        top: '68px',
        right: '16px',
        bottom: '96px',
        width: '340px',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: getCoalitionColor(selectedObject.coalition),
              }}
            />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
              {selectedObject.name || selectedObject.type || 'Neznámý objekt'}
            </h2>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
            ID: {selectedObject.id} • {selectedObject.type}
          </div>
        </div>
        <button
          onClick={() => selectObject(null)}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '2px',
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Body: Telemetry Metrics */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Pilot & Coalition Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem' }}>
          {selectedObject.pilot && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={14} color="#94a3b8" />
              <span style={{ color: '#94a3b8' }}>Pilot:</span>
              <strong style={{ color: '#f8fafc' }}>{selectedObject.pilot}</strong>
            </div>
          )}
          {selectedObject.callsign && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Compass size={14} color="#94a3b8" />
              <span style={{ color: '#94a3b8' }}>Volací znak:</span>
              <strong style={{ color: '#f8fafc' }}>{selectedObject.callsign}</strong>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Shield size={14} color={getCoalitionColor(selectedObject.coalition)} />
            <span style={{ color: '#94a3b8' }}>Koalice:</span>
            <strong style={{ color: getCoalitionColor(selectedObject.coalition) }}>
              {selectedObject.coalition === 'Blue' ? 'Modrá (Allies)' : selectedObject.coalition === 'Red' ? 'Červená (Enemies)' : selectedObject.coalition}
            </strong>
            {selectedObject.country && (
              <span style={{ color: '#64748b', textTransform: 'uppercase' }}>({selectedObject.country})</span>
            )}
          </div>
        </div>

        {/* Telemetry Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            padding: '10px',
            borderRadius: '6px',
            border: '1px solid rgba(56, 189, 248, 0.15)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>NADMOŘSKÁ VÝŠKA</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#38bdf8' }}>{altDisplay}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>RYCHLOST</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#38bdf8' }}>{speedDisplay}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>KURZ (HEADING)</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>
              {Math.round(tr.heading || tr.yaw || 0)}°
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>NÁKLON / SKLON</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>
              {Math.round(tr.roll || 0)}° / {Math.round(tr.pitch || 0)}°
            </div>
          </div>
        </div>

        {/* Bullseye Reference */}
        {(() => {
          const th = status?.theatre || 'Caucasus';
          const bullseyeRef = THEATER_BULLSEYE[th] || THEATER_BULLSEYE['Caucasus'];
          const bullseyeString = calculateBullseye(tr.latitude, tr.longitude, bullseyeRef.lat, bullseyeRef.lon);
          return (
            <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={12} color="#38bdf8" /> POLOHA VŮČI BULLSEYE ({bullseyeRef.name})
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px', letterSpacing: '0.04em' }}>
                {bullseyeString}
              </div>
            </div>
          );
        })()}

        {/* Tactical BRAA Panel if reference object exists */}
        {(() => {
          if (!referenceObject || referenceObject.id === selectedObject.id) return null;
          const braaFromRef = calculateBRAA(
            {
              latitude: referenceObject.currentTransform.latitude,
              longitude: referenceObject.currentTransform.longitude,
              altitude: referenceObject.currentTransform.altitude,
              heading: referenceObject.currentTransform.heading || referenceObject.currentTransform.yaw || 0,
            },
            {
              latitude: tr.latitude,
              longitude: tr.longitude,
              altitude: tr.altitude,
              heading: tr.heading || tr.yaw || 0,
            }
          );
          return (
            <div style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', padding: '10px', borderRadius: '6px', border: '1px solid #eab308' }}>
              <div style={{ fontSize: '0.72rem', color: '#facc15', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Target size={13} color="#facc15" /> TAKTICKÁ BRAA (Z {referenceObject.name || referenceObject.type})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px', fontSize: '0.8rem' }}>
                <div>Kurz: <strong style={{ color: '#f8fafc' }}>{braaFromRef.bearing.toString().padStart(3, '0')}°</strong></div>
                <div>Vzdálenost: <strong style={{ color: '#f8fafc' }}>{braaFromRef.rangeNM} NM</strong></div>
                <div>Výška: <strong style={{ color: '#f8fafc' }}>{Math.round(braaFromRef.altitudeFt / 1000)}k ft</strong></div>
                <div>
                  Aspekt:{' '}
                  <span style={{
                    padding: '1px 5px',
                    borderRadius: '3px',
                    fontWeight: 800,
                    fontSize: '0.72rem',
                    backgroundColor: braaFromRef.aspectLabel === 'HOT' ? 'rgba(239, 68, 68, 0.3)' : braaFromRef.aspectLabel === 'BEAM' ? 'rgba(234, 179, 8, 0.3)' : 'rgba(56, 189, 248, 0.3)',
                    color: braaFromRef.aspectLabel === 'HOT' ? '#f87171' : braaFromRef.aspectLabel === 'BEAM' ? '#facc15' : '#38bdf8',
                  }}>
                    {braaFromRef.aspectLabel} ({braaFromRef.aspectAngle}°)
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Coordinates */}
        <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div>Zem. šířka (Lat): <strong style={{ color: '#f8fafc' }}>{tr.latitude.toFixed(5)}°</strong></div>
          <div>Zem. délka (Lon): <strong style={{ color: '#f8fafc' }}>{tr.longitude.toFixed(5)}°</strong></div>
          {selectedObject.mach && <div>Mach: <strong style={{ color: '#f8fafc' }}>{selectedObject.mach.toFixed(2)}</strong></div>}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Reference Aircraft Toggle for BRAA */}
          <button
            onClick={() => setReferenceObjectId(referenceObjectId === selectedObject.id ? null : selectedObject.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px',
              borderRadius: '6px',
              border: `1px solid ${referenceObjectId === selectedObject.id ? '#eab308' : 'rgba(234, 179, 8, 0.4)'}`,
              backgroundColor: referenceObjectId === selectedObject.id ? 'rgba(234, 179, 8, 0.2)' : 'rgba(15, 23, 42, 0.8)',
              color: referenceObjectId === selectedObject.id ? '#facc15' : '#fef08a',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            <Target size={14} /> {referenceObjectId === selectedObject.id ? '✓ Referenční letoun (Zrušit)' : 'Nastavit jako referenční letoun (BRAA)'}
          </button>

          <button
            onClick={() => onCenterObject(tr.latitude, tr.longitude)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px',
              borderRadius: '6px',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              color: '#38bdf8',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            <Crosshair size={14} /> Přiblížit na objekt
          </button>

          <button
            onClick={toggleFollowSelected}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px',
              borderRadius: '6px',
              border: `1px solid ${followSelected ? '#38bdf8' : 'rgba(56, 189, 248, 0.2)'}`,
              backgroundColor: followSelected ? '#38bdf8' : 'rgba(15, 23, 42, 0.8)',
              color: followSelected ? '#0a0f1d' : '#f8fafc',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            <Eye size={14} /> {followSelected ? 'Ukončit sledování kamerou' : 'Sledovat kamerou'}
          </button>

          {/* Export trajectory */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
            <a
              href={getExportUrl('csv', undefined, undefined, selectedObject.id)}
              download
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                padding: '6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(30, 41, 59, 0.8)',
                color: '#94a3b8',
                fontSize: '0.75rem',
                textDecoration: 'none',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <Download size={12} /> Trajektorie CSV
            </a>
            <a
              href={getExportUrl('geojson', undefined, undefined, selectedObject.id)}
              download
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                padding: '6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(30, 41, 59, 0.8)',
                color: '#94a3b8',
                fontSize: '0.75rem',
                textDecoration: 'none',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <Download size={12} /> GeoJSON
            </a>
          </div>
        </div>

        {/* Object Events */}
        {objectEvents.length > 0 && (
          <div style={{ marginTop: '8px' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, marginBottom: '6px' }}>
              ZÁZNAM UDÁLOSTÍ JEDNOTKY
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {objectEvents.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    fontSize: '0.75rem',
                    padding: '6px 8px',
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    borderRadius: '4px',
                    borderLeft: `2px solid ${ev.type === 'Destroyed' ? '#f87171' : ev.type === 'WeaponLaunch' ? '#fbbf24' : '#38bdf8'}`,
                  }}
                >
                  <div style={{ color: '#f8fafc' }}>{ev.description}</div>
                  <div style={{ color: '#64748b', fontSize: '0.7rem' }}>
                    {new Date(ev.timestamp).toLocaleTimeString('cs-CZ')} {ev.derived && '(odvozeno)'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
