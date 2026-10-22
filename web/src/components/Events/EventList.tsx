import React, { useState } from 'react';
import { useRadar } from '../../context/RadarContext';
import { EventType } from '../../types/telemetry';
import {
  AlertTriangle,
  Flame,
  Layers,
  Plane,
  Radio,
  Target,
  X,
} from 'lucide-react';

interface EventListProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EventList: React.FC<EventListProps> = ({ isOpen, onClose }) => {
  const { events, scrubToTime, selectObject } = useRadar();
  const [filterType, setFilterType] = useState<string>('ALL');

  if (!isOpen) return null;

  const filteredEvents = events.filter((ev) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'WEAPON') return ev.type === 'WeaponLaunch';
    if (filterType === 'DESTROYED') return ev.type === 'Destroyed' || ev.type === 'Impact';
    if (filterType === 'SPAWN') return ev.type === 'Spawn' || ev.type === 'Despawn';
    return true;
  });

  const getEventIcon = (type: EventType) => {
    switch (type) {
      case 'WeaponLaunch':
        return <Target size={14} color="#fbbf24" />;
      case 'Destroyed':
      case 'Impact':
        return <Flame size={14} color="#f87171" />;
      case 'Spawn':
        return <Plane size={14} color="#38bdf8" />;
      case 'Despawn':
        return <Radio size={14} color="#94a3b8" />;
      default:
        return <AlertTriangle size={14} color="#a855f7" />;
    }
  };

  const handleEventClick = (timestamp: string, objectId: string) => {
    scrubToTime(new Date(timestamp));
    if (objectId) {
      selectObject(objectId);
    }
  };

  return (
    <aside
      className="tactical-panel"
      style={{
        position: 'absolute',
        top: '68px',
        left: '16px',
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
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={18} color="#38bdf8" />
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
            Záznam Událostí ({filteredEvents.length})
          </h2>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          padding: '8px 12px',
          borderBottom: '1px solid rgba(56, 189, 248, 0.1)',
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
        }}
      >
        {[
          { id: 'ALL', label: 'Vše' },
          { id: 'WEAPON', label: 'Odpaly' },
          { id: 'DESTROYED', label: 'Zničení' },
          { id: 'SPAWN', label: 'Vznik' },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFilterType(id)}
            style={{
              flex: 1,
              padding: '4px 6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '4px',
              border: 'none',
              backgroundColor: filterType === id ? '#38bdf8' : 'transparent',
              color: filterType === id ? '#0a0f1d' : '#94a3b8',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Event list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b', fontSize: '0.85rem' }}>
            Zatím nebyly zaznamenány žádné události.
          </div>
        ) : (
          filteredEvents.map((ev) => (
            <div
              key={ev.id}
              onClick={() => handleEventClick(ev.timestamp, ev.objectId)}
              title="Kliknutím skočíte v časové ose na tuto událost"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                padding: '8px 10px',
                borderRadius: '6px',
                backgroundColor: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(56, 189, 248, 0.15)',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.15)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.65)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {getEventIcon(ev.type)}
                  <span style={{ fontWeight: 600, fontSize: '0.8rem', color: '#f8fafc' }}>
                    {ev.objectName || ev.objectId}
                  </span>
                </div>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  {new Date(ev.timestamp).toLocaleTimeString('cs-CZ')}
                </span>
              </div>

              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                {ev.description}
              </div>

              {ev.derived && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      color: '#fbbf24',
                      backgroundColor: 'rgba(251, 191, 36, 0.1)',
                      padding: '1px 6px',
                      borderRadius: '3px',
                      fontWeight: 600,
                    }}
                  >
                    ODVOZENO ALGORITMEM
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
};
