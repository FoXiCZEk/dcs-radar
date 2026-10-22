import React, { useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { RadarProvider, useRadar } from './context/RadarContext';
import { SystemBar } from './components/Header/SystemBar';
import { TacticalMap2D } from './components/Map/TacticalMap2D';
import { TacticalGlobe3D } from './components/Globe3D/TacticalGlobe3D';
import { TimelineBar } from './components/Timeline/TimelineBar';
import { ObjectDetail } from './components/Sidebar/ObjectDetail';
import { FilterPanel } from './components/FilterPanel/FilterPanel';
import { EventList } from './components/Events/EventList';
import { DiagnosticsModal } from './components/Diagnostics/DiagnosticsModal';
import { MissileAlertBanner } from './components/Alerts/MissileAlertBanner';

const RadarApp: React.FC = () => {
  const { viewMode } = useRadar();
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isEventsOpen, setIsEventsOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

  const mapInstanceRef = useRef<maplibregl.Map | null>(null);

  const handleCenterObject = (lat: number, lon: number) => {
    if (mapInstanceRef.current && viewMode === '2d') {
      mapInstanceRef.current.flyTo({
        center: [lon, lat],
        zoom: 11,
        duration: 1000,
      });
    }
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Top Tactical System Bar */}
      <SystemBar
        isFiltersOpen={isFiltersOpen}
        isEventsOpen={isEventsOpen}
        onToggleFilters={() => setIsFiltersOpen(!isFiltersOpen)}
        onToggleEvents={() => setIsEventsOpen(!isEventsOpen)}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
      />

      {/* Tactical Missile Launch Warning Banner */}
      <MissileAlertBanner />

      {/* Main Map / Globe Display */}
      <main style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}>
        {viewMode === '2d' ? (
          <TacticalMap2D onMapReady={(map) => (mapInstanceRef.current = map)} />
        ) : (
          <TacticalGlobe3D />
        )}
      </main>

      {/* Sidebars & Panels */}
      <FilterPanel isOpen={isFiltersOpen} onClose={() => setIsFiltersOpen(false)} />
      <EventList isOpen={isEventsOpen} onClose={() => setIsEventsOpen(false)} />
      <ObjectDetail onCenterObject={handleCenterObject} />

      {/* Bottom Timeline Bar */}
      <TimelineBar />

      {/* Diagnostics Modal */}
      <DiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <RadarProvider>
      <RadarApp />
    </RadarProvider>
  );
}
