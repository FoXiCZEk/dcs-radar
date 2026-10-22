import React from 'react';
import { useRadar } from '../../context/RadarContext';
import { AlertTriangle, Bell, BellOff, Volume2, VolumeX, Crosshair, X } from 'lucide-react';

export const MissileAlertBanner: React.FC = () => {
  const {
    activeMissiles,
    filters,
    toggleMissileAlerts,
    toggleMissileAudio,
    selectObject,
    mapConfig,
  } = useRadar();

  if (!filters.missileAlertsEnabled || activeMissiles.length === 0) {
    return null;
  }

  const isAltFt = mapConfig?.altitudeUnit === 'ft';
  const isSpeedKmh = mapConfig?.speedUnit === 'kmh';

  return (
    <div
      style={{
        position: 'absolute',
        top: '72px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 25,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        maxWidth: '680px',
        width: '92%',
        pointerEvents: 'auto',
      }}
    >
      {activeMissiles.map((missile) => {
        const tr = missile.currentTransform;
        const altStr = isAltFt
          ? `${Math.round(tr.altitude * 3.28084)} ft`
          : `${Math.round(tr.altitude)} m`;
        const spdStr = isSpeedKmh
          ? `${Math.round((tr.speedKts || 0) * 1.852)} km/h`
          : `${Math.round(tr.speedKts || 0)} kts`;
        const machStr = missile.mach ? `M ${missile.mach.toFixed(1)}` : spdStr;

        return (
          <div
            key={missile.id}
            className="tactical-panel"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              backgroundColor: 'rgba(127, 29, 29, 0.92)',
              backdropFilter: 'blur(8px)',
              border: '2px solid #ef4444',
              borderRadius: '6px',
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.5), inset 0 0 15px rgba(239, 68, 68, 0.2)',
              animation: 'pulse 1.5s infinite',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(239, 68, 68, 0.3)',
                  border: '1px solid #ef4444',
                }}
              >
                <AlertTriangle size={20} color="#f87171" />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#fef2f2', letterSpacing: '0.05em' }}>
                    ⚠️ VÝSTRAHA: ODPÁLENÍ RAKETY!
                  </span>
                  <span
                    style={{
                      padding: '1px 6px',
                      borderRadius: '3px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      backgroundColor: missile.coalition === 'Red' ? '#dc2626' : '#2563eb',
                      color: '#ffffff',
                    }}
                  >
                    {missile.name || missile.type || 'Zbraň'}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#fca5a5', marginTop: '2px' }}>
                  Výška: <strong>{altStr}</strong> • Rychlost: <strong>{machStr}</strong>
                  {missile.country ? ` • Původ: ${missile.country}` : ''}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => selectObject(missile.id)}
                title="Zaměřit cíl na mapě"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Crosshair size={14} /> Zaměřit
              </button>

              <button
                onClick={toggleMissileAudio}
                title={filters.missileAlertAudio ? 'Ztišit zvuk výstrahy' : 'Zapnout zvuk výstrahy'}
                style={{
                  padding: '5px',
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: filters.missileAlertAudio ? '#fca5a5' : '#94a3b8',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {filters.missileAlertAudio ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>

              <button
                onClick={toggleMissileAlerts}
                title="Vypnout všechny výstrahy na odpálení raket"
                style={{
                  padding: '5px',
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fca5a5',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <BellOff size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
