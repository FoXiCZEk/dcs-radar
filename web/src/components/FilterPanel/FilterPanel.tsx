import React, { useState } from 'react';
import { useRadar } from '../../context/RadarContext';
import { Category, Coalition } from '../../types/telemetry';
import {
  Bookmark,
  Check,
  RotateCcw,
  Search,
  Sliders,
  X,
} from 'lucide-react';

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({ isOpen, onClose }) => {
  const {
    filters,
    setFilters,
    resetFilters,
    saveFilterPreset,
    loadFilterPreset,
    availablePresets,
    mapConfig,
  } = useRadar();

  const [newPresetName, setNewPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);

  if (!isOpen) return null;

  const isAltFt = mapConfig?.altitudeUnit === 'ft';
  const isSpeedKmh = mapConfig?.speedUnit === 'kmh';

  const toggleCoalition = (c: Coalition) => {
    setFilters((prev) => {
      const exists = prev.coalitions.includes(c);
      const next = exists
        ? prev.coalitions.filter((item) => item !== c)
        : [...prev.coalitions, c];
      return { ...prev, coalitions: next };
    });
  };

  const toggleCategory = (cat: Category) => {
    setFilters((prev) => {
      const exists = prev.categories.includes(cat);
      const next = exists
        ? prev.categories.filter((item) => item !== cat)
        : [...prev.categories, cat];
      return { ...prev, categories: next };
    });
  };

  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPresetName.trim()) {
      saveFilterPreset(newPresetName.trim());
      setNewPresetName('');
      setShowSavePreset(false);
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
        width: '320px',
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
          <Sliders size={18} color="#38bdf8" />
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>Taktické Filtry</h2>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Quick Presets */}
        <div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, marginBottom: '6px' }}>
            RYCHLÉ PŘEDVOLBY
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {availablePresets.map((name) => (
              <button
                key={name}
                onClick={() => loadFilterPreset(name)}
                style={{
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#38bdf8',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {name}
              </button>
            ))}
          </div>

          {showSavePreset ? (
            <form onSubmit={handleSavePreset} style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
              <input
                type="text"
                placeholder="Název předvolby..."
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  backgroundColor: '#0a0f1d',
                  border: '1px solid #38bdf8',
                  borderRadius: '4px',
                  color: '#f8fafc',
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#38bdf8',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#0a0f1d',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Uložit
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowSavePreset(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '6px',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              <Bookmark size={12} /> Uložit aktuální nastavení...
            </button>
          )}
        </div>

        {/* Text Search */}
        <div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, marginBottom: '6px' }}>
            VYHLEDAT OBJEKT / PILOTA
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '8px', top: '8px' }} />
            <input
              type="text"
              placeholder="Jméno pilota, typ, volací znak..."
              value={filters.searchTerm}
              onChange={(e) => setFilters((p) => ({ ...p, searchTerm: e.target.value }))}
              style={{
                width: '100%',
                padding: '6px 8px 6px 28px',
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '6px',
                color: '#f8fafc',
                fontSize: '0.8rem',
              }}
            />
          </div>
        </div>

        {/* Coalition Filter */}
        <div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, marginBottom: '6px' }}>
            KOALICE
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {[
              { id: 'Blue' as Coalition, label: 'Modří (Allies)', color: '#38bdf8' },
              { id: 'Red' as Coalition, label: 'Červení (Enemies)', color: '#f87171' },
              { id: 'Neutral' as Coalition, label: 'Neutrální', color: '#4ade80' },
              { id: 'Unknown' as Coalition, label: 'Neznámá', color: '#94a3b8' },
            ].map(({ id, label, color }) => {
              const active = filters.coalitions.includes(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleCoalition(id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 8px',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    border: `1px solid ${active ? color : 'rgba(255, 255, 255, 0.1)'}`,
                    backgroundColor: active ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                    color: active ? '#f8fafc' : '#64748b',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />
                  <span style={{ flex: 1 }}>{label}</span>
                  {active && <Check size={12} color={color} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Filter */}
        <div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, marginBottom: '6px' }}>
            KATEGORIE
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {[
              { id: 'AirFixedWing' as Category, label: 'Letouny (Fixed Wing)' },
              { id: 'AirRotor' as Category, label: 'Vrtulníky (Helicopters)' },
              { id: 'Ground' as Category, label: 'Pozemní jednotky / SAM' },
              { id: 'Sea' as Category, label: 'Námořní plavidla' },
              { id: 'Weapon' as Category, label: 'Střely a zbraně' },
            ].map(({ id, label }) => {
              const active = filters.categories.includes(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleCategory(id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    border: `1px solid ${active ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
                    backgroundColor: active ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.5)',
                    color: active ? '#f8fafc' : '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  <span>{label}</span>
                  {active && <Check size={12} color="#38bdf8" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Display Toggles */}
        <div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, marginBottom: '6px' }}>
            ZOBRAZENÍ PRVKŮ
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filters.showTrails}
                onChange={(e) => setFilters((p) => ({ ...p, showTrails: e.target.checked }))}
                style={{ accentColor: '#38bdf8' }}
              />
              <span>Zobrazovat trajektorie letu</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filters.showLabels}
                onChange={(e) => setFilters((p) => ({ ...p, showLabels: e.target.checked }))}
                style={{ accentColor: '#38bdf8' }}
              />
              <span>Zobrazovat textové popisky u značek</span>
            </label>
          </div>
        </div>

        {/* Reset */}
        <button
          onClick={resetFilters}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backgroundColor: 'rgba(30, 41, 59, 0.8)',
            color: '#94a3b8',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: 'auto',
          }}
        >
          <RotateCcw size={14} /> Obnovit výchozí filtry
        </button>
      </div>
    </aside>
  );
};
