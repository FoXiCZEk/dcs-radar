import React from 'react';
import { useRadar } from '../../context/RadarContext';
import {
  Activity,
  Bell,
  BellOff,
  Box,
  Compass,
  Globe,
  Layers,
  Map as MapIcon,
  Moon,
  Radio,
  Satellite,
  SlidersHorizontal,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface SystemBarProps {
  onToggleFilters: () => void;
  onToggleEvents: () => void;
  onOpenDiagnostics: () => void;
  isFiltersOpen: boolean;
  isEventsOpen: boolean;
}

export const SystemBar: React.FC<SystemBarProps> = ({
  onToggleFilters,
  onToggleEvents,
  onOpenDiagnostics,
  isFiltersOpen,
  isEventsOpen,
}) => {
  const {
    status,
    wsState,
    viewMode,
    setViewMode,
    objects,
    mapStyle,
    setMapStyle,
    filters,
    toggleMissileAlerts,
  } = useRadar();

  const isConnected = wsState === 'connected' && status?.connectionState === 'connected';
  const isPaused = status?.connectionState === 'paused' || status?.dcsHealth?.state === 'paused';
  const isStale = status?.connectionState === 'stale';

  const blueCount = objects.filter((o) => o.coalition === 'Blue').length;
  const redCount = objects.filter((o) => o.coalition === 'Red').length;
  const neutralCount = objects.filter((o) => o.coalition === 'Neutral').length;

  return (
    <header className="tactical-panel" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 16px',
      margin: '8px',
      zIndex: 10,
      position: 'relative',
      height: '52px',
    }}>
      {/* Brand & Connection State */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Radio size={20} color="#38bdf8" />
          <span style={{ fontWeight: 800, letterSpacing: '1px', fontSize: '1.1rem', color: '#f8fafc' }}>
            DCS RADAR
          </span>
        </div>

        {/* Status Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '20px',
          backgroundColor: isConnected
            ? 'rgba(74, 222, 128, 0.1)'
            : isPaused
            ? 'rgba(251, 191, 36, 0.15)'
            : isStale
            ? 'rgba(251, 191, 36, 0.1)'
            : 'rgba(248, 113, 113, 0.1)',
          border: `1px solid ${
            isConnected
              ? 'rgba(74, 222, 128, 0.4)'
              : isPaused
              ? 'rgba(251, 191, 36, 0.5)'
              : isStale
              ? 'rgba(251, 191, 36, 0.4)'
              : 'rgba(248, 113, 113, 0.4)'
          }`,
          fontSize: '0.8rem',
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isConnected ? '#4ade80' : isPaused ? '#fbbf24' : isStale ? '#fbbf24' : '#f87171',
          }} className={isConnected ? 'radar-live-indicator' : ''} />
          <span style={{ color: isConnected ? '#4ade80' : isPaused ? '#fbbf24' : isStale ? '#fbbf24' : '#f87171', fontWeight: 600 }}>
            {isConnected ? 'PŘIPOJENO' : isPaused ? 'MISE POZASTAVENA' : isStale ? 'DATA ZASTARALÁ' : 'SERVER NEPOSLOUCHÁ'}
          </span>
          {status && status.latencyMs > 0 && (
            <span style={{ color: '#94a3b8', marginLeft: '4px' }}>({status.latencyMs} ms)</span>
          )}
        </div>

        {/* Source Badge */}
        {status?.sourceType && (
          <span style={{
            fontSize: '0.75rem',
            padding: '3px 8px',
            borderRadius: '4px',
            backgroundColor: 'rgba(56, 189, 248, 0.15)',
            color: '#38bdf8',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            fontWeight: 600,
            textTransform: 'uppercase',
          }}>
            {status.sourceType === 'simulator' ? 'Simulátor Kavkaz' : status.sourceType === 'tcp' ? 'Tacview TCP' : 'ACMI Soubor'}
          </span>
        )}

        {/* DCS Theater Badge */}
        {status?.theatre && (
          <span style={{
            fontSize: '0.75rem',
            padding: '3px 8px',
            borderRadius: '4px',
            backgroundColor: 'rgba(234, 179, 8, 0.15)',
            color: '#facc15',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            fontWeight: 700,
          }}>
            🗺️ {status.theatre}
          </span>
        )}

        {/* Players Count Badge */}
        {status?.playerCount !== undefined && status.playerCount > 0 && (
          <span style={{
            fontSize: '0.75rem',
            padding: '3px 8px',
            borderRadius: '4px',
            backgroundColor: 'rgba(56, 189, 248, 0.15)',
            color: '#38bdf8',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            fontWeight: 600,
          }}>
            👥 {status.playerCount} {status.playerCount === 1 ? 'pilot' : status.playerCount < 5 ? 'piloti' : 'pilotů'}
          </span>
        )}
      </div>

      {/* Center Tactical Counts */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#94a3b8' }}>Celkem:</span>
          <strong style={{ color: '#f8fafc' }}>{objects.length}</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#38bdf8' }} />
          <span style={{ color: '#38bdf8' }}>Modří:</span>
          <strong>{blueCount}</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#f87171' }} />
          <span style={{ color: '#f87171' }}>Červení:</span>
          <strong>{redCount}</strong>
        </div>
        {neutralCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#4ade80' }} />
            <span style={{ color: '#4ade80' }}>Neutrální:</span>
            <strong>{neutralCount}</strong>
          </div>
        )}
      </div>

      {/* Right Action Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* 2D / 3D Switch */}
        <div style={{
          display: 'flex',
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          borderRadius: '6px',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          overflow: 'hidden',
        }}>
          <button
            onClick={() => setViewMode('2d')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 10px',
              fontSize: '0.8rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: viewMode === '2d' ? '#38bdf8' : 'transparent',
              color: viewMode === '2d' ? '#0a0f1d' : '#94a3b8',
              transition: 'all 0.2s',
            }}
          >
            <MapIcon size={14} /> 2D Mapa
          </button>
          <button
            onClick={() => setViewMode('3d')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 10px',
              fontSize: '0.8rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: viewMode === '3d' ? '#38bdf8' : 'transparent',
              color: viewMode === '3d' ? '#0a0f1d' : '#94a3b8',
              transition: 'all 0.2s',
            }}
          >
            <Box size={14} /> 3D Glóbus
          </button>
        </div>

        {/* Basemap Switcher */}
        <div style={{
          display: 'flex',
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          borderRadius: '6px',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          overflow: 'hidden',
        }}>
          <button
            onClick={() => setMapStyle('dark')}
            title="Taktická tmavá mapa (Carto Dark)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 9px',
              fontSize: '0.78rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: mapStyle === 'dark' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
              color: mapStyle === 'dark' ? '#38bdf8' : '#94a3b8',
              transition: 'all 0.2s',
            }}
          >
            <Moon size={13} /> Tmavá
          </button>
          <button
            onClick={() => setMapStyle('satellite')}
            title="Satelitní mapa (ESRI World Imagery)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 9px',
              fontSize: '0.78rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: mapStyle === 'satellite' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
              color: mapStyle === 'satellite' ? '#38bdf8' : '#94a3b8',
              transition: 'all 0.2s',
            }}
          >
            <Satellite size={13} /> Satelit
          </button>
          <button
            onClick={() => setMapStyle('voyager')}
            title="Barevná podrobná mapa (Carto Voyager)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 9px',
              fontSize: '0.78rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: mapStyle === 'voyager' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
              color: mapStyle === 'voyager' ? '#38bdf8' : '#94a3b8',
              transition: 'all 0.2s',
            }}
          >
            <Compass size={13} /> Voyager
          </button>
          <button
            onClick={() => setMapStyle('osm')}
            title="OpenStreetMap"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 9px',
              fontSize: '0.78rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: mapStyle === 'osm' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
              color: mapStyle === 'osm' ? '#38bdf8' : '#94a3b8',
              transition: 'all 0.2s',
            }}
          >
            <Globe size={13} /> OSM
          </button>
        </div>

        {/* Filters Button */}
        <button
          onClick={onToggleFilters}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            fontSize: '0.8rem',
            fontWeight: 600,
            borderRadius: '6px',
            border: `1px solid ${isFiltersOpen ? '#38bdf8' : 'rgba(56, 189, 248, 0.3)'}`,
            backgroundColor: isFiltersOpen ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.8)',
            color: isFiltersOpen ? '#38bdf8' : '#f8fafc',
            cursor: 'pointer',
          }}
        >
          <SlidersHorizontal size={14} /> Filtry
        </button>

        {/* Events Button */}
        <button
          onClick={onToggleEvents}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            fontSize: '0.8rem',
            fontWeight: 600,
            borderRadius: '6px',
            border: `1px solid ${isEventsOpen ? '#38bdf8' : 'rgba(56, 189, 248, 0.3)'}`,
            backgroundColor: isEventsOpen ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.8)',
            color: isEventsOpen ? '#38bdf8' : '#f8fafc',
            cursor: 'pointer',
          }}
        >
          <Layers size={14} /> Události
        </button>

        {/* Missile Alerts Toggle Button */}
        <button
          onClick={toggleMissileAlerts}
          title={
            filters.missileAlertsEnabled
              ? 'Výstrahy na odpálení raket jsou ZAPNUTY (kliknutím vypnout)'
              : 'Výstrahy na odpálení raket jsou VYPNUTY (kliknutím zapnout)'
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            border: `1px solid ${filters.missileAlertsEnabled ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
            backgroundColor: filters.missileAlertsEnabled ? 'rgba(239, 68, 68, 0.15)' : 'rgba(15, 23, 42, 0.8)',
            color: filters.missileAlertsEnabled ? '#f87171' : '#64748b',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {filters.missileAlertsEnabled ? <Bell size={16} /> : <BellOff size={16} />}
        </button>

        {/* Diagnostics Button */}
        <button
          onClick={onOpenDiagnostics}
          title="Diagnostika a stav systému"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            color: '#94a3b8',
            cursor: 'pointer',
          }}
        >
          <Activity size={16} />
        </button>
      </div>
    </header>
  );
};
