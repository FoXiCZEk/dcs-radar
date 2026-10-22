import React from 'react';
import { useRadar } from '../../context/RadarContext';
import {
  FastForward,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
} from 'lucide-react';

export const TimelineBar: React.FC = () => {
  const {
    isLive,
    isPlaying,
    playbackSpeed,
    currentPlaybackTime,
    historyStart,
    historyEnd,
    jumpToLive,
    scrubToTime,
    togglePlayPause,
    setPlaybackSpeed,
  } = useRadar();

  const totalDurationMs = Math.max(1000, historyEnd.getTime() - historyStart.getTime());
  const currentOffsetMs = Math.max(0, currentPlaybackTime.getTime() - historyStart.getTime());
  const sliderValue = Math.min(100, Math.max(0, (currentOffsetMs / totalDurationMs) * 100));

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const targetMs = historyStart.getTime() + (val / 100) * totalDurationMs;
    scrubToTime(new Date(targetMs));
  };

  const formatTime = (d: Date) => {
    return d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Historical offset calculation
  const diffFromEndSec = Math.round((historyEnd.getTime() - currentPlaybackTime.getTime()) / 1000);
  const diffMinutes = Math.floor(diffFromEndSec / 60);
  const diffSeconds = diffFromEndSec % 60;

  return (
    <div
      className="tactical-panel"
      style={{
        position: 'absolute',
        bottom: '12px',
        left: '16px',
        right: '16px',
        padding: '10px 18px',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* Top row: Status, timestamps, and controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Playback Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isLive ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px',
                backgroundColor: 'rgba(74, 222, 128, 0.15)',
                border: '1px solid #4ade80',
                borderRadius: '20px',
                color: '#4ade80',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#4ade80',
                }}
                className="radar-live-indicator"
              />
              <span>ŽIVÝ PŘENOS (LIVE)</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px',
                  backgroundColor: 'rgba(251, 191, 36, 0.15)',
                  border: '1px solid #fbbf24',
                  borderRadius: '20px',
                  color: '#fbbf24',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                }}
              >
                <span>HISTORICKÝ ZÁZNAM (-{diffMinutes}m {diffSeconds}s)</span>
              </div>
              <button
                onClick={jumpToLive}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px',
                  backgroundColor: '#38bdf8',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#0a0f1d',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                }}
              >
                <FastForward size={14} /> Přejít na živě
              </button>
            </div>
          )}

          <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Čas záznamu: <strong style={{ color: '#f8fafc' }}>{formatTime(currentPlaybackTime)}</strong>
          </div>
        </div>

        {/* Center: Play/Pause and navigation controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => scrubToTime(historyStart)}
            title="Skočit na začátek historie (před 60 min)"
            style={{
              padding: '6px',
              backgroundColor: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '6px',
              color: '#94a3b8',
              cursor: 'pointer',
            }}
          >
            <SkipBack size={16} />
          </button>

          <button
            onClick={togglePlayPause}
            title={isPlaying ? 'Pozastavit' : isLive ? 'Pozastavit a procházet historii' : 'Přehrávat'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 16px',
              backgroundColor: isPlaying ? '#fbbf24' : '#38bdf8',
              border: 'none',
              borderRadius: '6px',
              color: '#0a0f1d',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            <span>{isPlaying ? 'Pozastavit' : isLive ? 'Zastavit čas' : 'Přehrát'}</span>
          </button>

          <button
            onClick={jumpToLive}
            title="Skočit do současnosti (Živý režim)"
            style={{
              padding: '6px',
              backgroundColor: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '6px',
              color: '#94a3b8',
              cursor: 'pointer',
            }}
          >
            <FastForward size={16} />
          </button>
        </div>

        {/* Right: Speed controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', marginRight: '4px' }}>Rychlost:</span>
          {[0.25, 0.5, 1, 2, 4].map((speed) => (
            <button
              key={speed}
              onClick={() => setPlaybackSpeed(speed)}
              style={{
                padding: '3px 8px',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '4px',
                border: 'none',
                backgroundColor: playbackSpeed === speed ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                color: playbackSpeed === speed ? '#38bdf8' : '#94a3b8',
                cursor: 'pointer',
              }}
            >
              {speed}×
            </button>
          ))}
        </div>
      </div>

      {/* Scrubber slider and time range markers */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '0.75rem', color: '#64748b', minWidth: '55px' }}>
          {formatTime(historyStart)}
        </span>

        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={sliderValue}
          onChange={handleSliderChange}
          style={{
            flex: 1,
            height: '6px',
            borderRadius: '3px',
            backgroundColor: '#1e293b',
            accentColor: isLive ? '#4ade80' : '#fbbf24',
            cursor: 'pointer',
          }}
        />

        <span style={{ fontSize: '0.75rem', color: '#64748b', minWidth: '55px', textAlign: 'right' }}>
          {formatTime(historyEnd)}
        </span>
      </div>
    </div>
  );
};
