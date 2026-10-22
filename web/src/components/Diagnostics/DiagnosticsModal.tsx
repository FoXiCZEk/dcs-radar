import React from 'react';
import { useRadar } from '../../context/RadarContext';
import { Activity, Clock, Database, HardDrive, Radio, Server, Shield, X } from 'lucide-react';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({ isOpen, onClose }) => {
  const { status, wsState, objects, mapConfig } = useRadar();

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="tactical-panel"
        style={{
          width: '520px',
          maxWidth: '100%',
          backgroundColor: '#0f172a',
          border: '1px solid #38bdf8',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={20} color="#38bdf8" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
              Diagnostika a Provozní Stav Systému
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.85rem' }}>
          {/* Section: Telemetry Source */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontWeight: 700, marginBottom: '8px' }}>
              <Radio size={16} /> ZDROJ TELEMETRIE & SÍŤ
            </div>
            <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>Zdroj: <strong style={{ color: '#f8fafc' }}>{status?.sourceType || 'neznámý'}</strong></div>
              <div>Stav spojení: <strong style={{ color: status?.connectionState === 'connected' ? '#4ade80' : '#f87171' }}>{status?.connectionState || 'odpojeno'}</strong></div>
              <div>WebSocket: <strong style={{ color: wsState === 'connected' ? '#4ade80' : '#f87171' }}>{wsState}</strong></div>
              <div>Zpoždění (latence): <strong style={{ color: '#f8fafc' }}>{status?.latencyMs || 0} ms</strong></div>
              <div style={{ gridColumn: 'span 2' }}>
                Poslední přijatý záznam: <strong style={{ color: '#f8fafc' }}>{status?.lastReceived ? new Date(status.lastReceived).toLocaleString('cs-CZ') : 'žádný'}</strong>
              </div>
            </div>
          </div>

          {/* Section: Objects & Entities */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontWeight: 700, marginBottom: '8px' }}>
              <Shield size={16} /> AKTIVNÍ OBJEKTY & BOJIŠTĚ
            </div>
            <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Celkem sledovaných objektů:</span>
                <strong style={{ color: '#f8fafc' }}>{objects.length}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Modrá koalice (Allies):</span>
                <strong style={{ color: '#38bdf8' }}>{status?.coalitionCounts?.['Blue'] || 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Červená koalice (Enemies):</span>
                <strong style={{ color: '#f87171' }}>{status?.coalitionCounts?.['Red'] || 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Neutrální:</span>
                <strong style={{ color: '#4ade80' }}>{status?.coalitionCounts?.['Neutral'] || 0}</strong>
              </div>
            </div>
          </div>

          {/* Section: History & Retention */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontWeight: 700, marginBottom: '8px' }}>
              <Database size={16} /> ÚLOŽIŠTĚ HISTORIE (SQLite WAL)
            </div>
            <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Celkem vzorků v historii:</span>
                <strong style={{ color: '#f8fafc' }}>{status?.totalHistoryRecords?.toLocaleString() || 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Dostupný časový rozsah:</span>
                <strong style={{ color: '#f8fafc' }}>{Math.round(status?.historyDurationMinutes || 0)} minut</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Pravidlo retence:</span>
                <strong style={{ color: '#38bdf8' }}>Automatický úklid &gt; 60 min</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid rgba(56, 189, 248, 0.2)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              backgroundColor: '#38bdf8',
              color: '#0a0f1d',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
};
