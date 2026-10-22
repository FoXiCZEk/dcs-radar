import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  Category,
  Coalition,
  FilterSettings,
  MapConfig,
  ObjectEntity,
  SystemStatus,
  TelemetryEvent,
  WSMessage,
} from '../types/telemetry';
import { fetchHistoryRange, fetchHistorySnapshot, fetchPublicConfig, fetchStatus } from '../services/api';
import { WebSocketClient, WSConnectionState } from '../services/websocket';

const DEFAULT_FILTERS: FilterSettings = {
  coalitions: ['Blue', 'Red', 'Neutral', 'Unknown'],
  categories: ['AirFixedWing', 'AirRotor', 'Ground', 'Sea', 'Weapon', 'Navaid', 'Other'],
  searchTerm: '',
  minAltitude: 0,
  maxAltitude: 30000,
  minSpeed: 0,
  maxSpeed: 2500,
  showTrails: true,
  showLabels: true,
  trailLength: 60,
  selectedOnly: false,
};

interface RadarContextType {
  // Live State
  objects: ObjectEntity[];
  selectedObjectId: string | null;
  selectedObject: ObjectEntity | null;
  followSelected: boolean;
  events: TelemetryEvent[];
  status: SystemStatus | null;
  wsState: WSConnectionState;
  viewMode: '2d' | '3d';
  mapConfig: MapConfig | null;

  // Filters
  filters: FilterSettings;
  setFilters: React.Dispatch<React.SetStateAction<FilterSettings>>;
  resetFilters: () => void;
  saveFilterPreset: (name: string) => void;
  loadFilterPreset: (name: string) => void;
  availablePresets: string[];

  // Selection & View actions
  selectObject: (id: string | null) => void;
  toggleFollowSelected: () => void;
  setViewMode: (mode: '2d' | '3d') => void;

  // Timeline & Playback
  isLive: boolean;
  isPlaying: boolean;
  playbackSpeed: number;
  currentPlaybackTime: Date;
  historyStart: Date;
  historyEnd: Date;
  jumpToLive: () => void;
  scrubToTime: (time: Date) => void;
  togglePlayPause: () => void;
  setPlaybackSpeed: (speed: number) => void;
}

const RadarContext = createContext<RadarContextType | null>(null);

export const RadarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Live Objects Map
  const [liveObjectsMap, setLiveObjectsMap] = useState<Map<string, ObjectEntity>>(new Map());
  const [historicalObjects, setHistoricalObjects] = useState<ObjectEntity[]>([]);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [wsState, setWsState] = useState<WSConnectionState>('disconnected');
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [mapConfig, setMapConfig] = useState<MapConfig | null>(null);

  // Selection
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [followSelected, setFollowSelected] = useState<boolean>(false);

  // Filters from LocalStorage fallback
  const [filters, setFilters] = useState<FilterSettings>(() => {
    try {
      const saved = localStorage.getItem('radar_filters_active');
      return saved ? JSON.parse(saved) : DEFAULT_FILTERS;
    } catch {
      return DEFAULT_FILTERS;
    }
  });

  const [availablePresets, setAvailablePresets] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('radar_presets_list');
      return saved ? JSON.parse(saved) : ['Výchozí', 'Pouze letadla', 'Modrá koalice', 'Červená koalice', 'Zbraně'];
    } catch {
      return ['Výchozí', 'Pouze letadla', 'Modrá koalice', 'Červená koalice', 'Zbraně'];
    }
  });

  // Timeline & Playback State
  const [isLive, setIsLive] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState<Date>(new Date());
  const [historyStart, setHistoryStart] = useState<Date>(new Date(Date.now() - 60 * 60 * 1000));
  const [historyEnd, setHistoryEnd] = useState<Date>(new Date());

  const wsRef = useRef<WebSocketClient | null>(null);
  const playbackTimerRef = useRef<number | null>(null);

  // 1. Initial configuration and status
  useEffect(() => {
    fetchPublicConfig().then(setMapConfig).catch(console.error);

    const updateStatus = () => {
      fetchStatus().then(setStatus).catch(console.error);
      fetchHistoryRange()
        .then((range) => {
          if (range.startTime && range.endTime) {
            setHistoryStart(new Date(range.startTime));
            setHistoryEnd(new Date(range.endTime));
          }
        })
        .catch(console.error);
    };

    updateStatus();
    const interval = setInterval(updateStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // 2. Connect WebSocket
  useEffect(() => {
    const ws = new WebSocketClient();
    wsRef.current = ws;

    ws.onStateChange = (st) => setWsState(st);

    ws.onMessage = (msg: WSMessage) => {
      if (msg.type === 'snapshot') {
        const nextMap = new Map<string, ObjectEntity>();
        (msg.objects || []).forEach((obj) => nextMap.set(obj.id, obj));
        setLiveObjectsMap(nextMap);
        if (msg.events) setEvents(msg.events);
      } else if (msg.type === 'delta') {
        setLiveObjectsMap((prev) => {
          const next = new Map(prev);
          (msg.objects || []).forEach((obj) => {
            if (obj.alive) {
              next.set(obj.id, obj);
            } else {
              next.delete(obj.id);
            }
          });
          return next;
        });

        if (msg.events && msg.events.length > 0) {
          setEvents((prev) => [...msg.events!, ...prev].slice(0, 500));
        }
      }
    };

    ws.connect();
    return () => ws.disconnect();
  }, []);

  // Save active filters to local storage
  useEffect(() => {
    try {
      localStorage.setItem('radar_filters_active', JSON.stringify(filters));
    } catch {}
  }, [filters]);

  // 3. Historical Playback Loop
  useEffect(() => {
    if (isLive) {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
      return;
    }

    if (isPlaying) {
      const stepIntervalMs = 250;
      playbackTimerRef.current = window.setInterval(() => {
        setCurrentPlaybackTime((prevTime) => {
          const advanceSeconds = (stepIntervalMs / 1000) * playbackSpeed;
          const nextTime = new Date(prevTime.getTime() + advanceSeconds * 1000);

          if (nextTime >= historyEnd) {
            // Reached present time, jump back to live
            setIsLive(true);
            setIsPlaying(false);
            return historyEnd;
          }

          // Fetch snapshot for historical frame
          fetchHistorySnapshot(nextTime.toISOString())
            .then(setHistoricalObjects)
            .catch(console.error);

          return nextTime;
        });
      }, stepIntervalMs);
    } else {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    }

    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    };
  }, [isLive, isPlaying, playbackSpeed, historyEnd]);

  // Actions
  const jumpToLive = () => {
    setIsLive(true);
    setIsPlaying(false);
    setCurrentPlaybackTime(new Date());
  };

  const scrubToTime = (time: Date) => {
    setIsLive(false);
    setCurrentPlaybackTime(time);
    fetchHistorySnapshot(time.toISOString())
      .then(setHistoricalObjects)
      .catch(console.error);
  };

  const togglePlayPause = () => {
    if (isLive) {
      // Pause live mode and enter history at current point
      setIsLive(false);
      setIsPlaying(false);
      setCurrentPlaybackTime(new Date());
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const selectObject = (id: string | null) => {
    setSelectedObjectId(id);
    if (!id) setFollowSelected(false);
  };

  const toggleFollowSelected = () => {
    setFollowSelected(!followSelected);
  };

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  const saveFilterPreset = (name: string) => {
    try {
      localStorage.setItem(`radar_preset_${name}`, JSON.stringify(filters));
      if (!availablePresets.includes(name)) {
        const next = [...availablePresets, name];
        setAvailablePresets(next);
        localStorage.setItem('radar_presets_list', JSON.stringify(next));
      }
    } catch {}
  };

  const loadFilterPreset = (name: string) => {
    if (name === 'Výchozí') {
      resetFilters();
      return;
    }
    if (name === 'Pouze letadla') {
      setFilters({
        ...DEFAULT_FILTERS,
        categories: ['AirFixedWing', 'AirRotor'],
      });
      return;
    }
    if (name === 'Modrá koalice') {
      setFilters({
        ...DEFAULT_FILTERS,
        coalitions: ['Blue'],
      });
      return;
    }
    if (name === 'Červená koalice') {
      setFilters({
        ...DEFAULT_FILTERS,
        coalitions: ['Red'],
      });
      return;
    }
    if (name === 'Zbraně') {
      setFilters({
        ...DEFAULT_FILTERS,
        categories: ['Weapon'],
      });
      return;
    }

    try {
      const data = localStorage.getItem(`radar_preset_${name}`);
      if (data) setFilters(JSON.parse(data));
    } catch {}
  };

  // Determine effective objects (live or historical)
  const effectiveObjectsList = isLive
    ? Array.from(liveObjectsMap.values())
    : historicalObjects;

  // Selected object entity
  const selectedObject =
    effectiveObjectsList.find((o) => o.id === selectedObjectId) || null;

  return (
    <RadarContext.Provider
      value={{
        objects: effectiveObjectsList,
        selectedObjectId,
        selectedObject,
        followSelected,
        events,
        status,
        wsState,
        viewMode,
        mapConfig,
        filters,
        setFilters,
        resetFilters,
        saveFilterPreset,
        loadFilterPreset,
        availablePresets,
        selectObject,
        toggleFollowSelected,
        setViewMode,
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
      }}
    >
      {children}
    </RadarContext.Provider>
  );
};

export const useRadar = (): RadarContextType => {
  const ctx = useContext(RadarContext);
  if (!ctx) throw new Error('useRadar must be used within RadarProvider');
  return ctx;
};
