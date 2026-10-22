export type Coalition = 'Blue' | 'Red' | 'Neutral' | 'Unknown';

export type Category =
  | 'AirFixedWing'
  | 'AirRotor'
  | 'Ground'
  | 'Sea'
  | 'Weapon'
  | 'Navaid'
  | 'Other';

export interface Transform {
  timeOffset: number;
  timestamp: string;
  longitude: number;
  latitude: number;
  altitude: number;
  roll?: number;
  pitch?: number;
  yaw?: number;
  heading?: number;
  speedMS?: number;
  speedKts?: number;
}

export interface ObjectEntity {
  id: string;
  name: string;
  type: string;
  category: Category;
  coalition: Coalition;
  color: string;
  country?: string;
  pilot?: string;
  callsign?: string;
  group?: string;
  squawk?: string;
  ias?: number;
  tas?: number;
  mach?: number;
  aoa?: number;
  currentTransform: Transform;
  trail?: Transform[];
  firstSeen: string;
  lastSeen: string;
  alive: boolean;
  properties?: Record<string, string>;
}

export type EventType =
  | 'Spawn'
  | 'Despawn'
  | 'WeaponLaunch'
  | 'Impact'
  | 'SpeedAnomaly'
  | 'AltAnomaly'
  | 'Destroyed'
  | 'Comment';

export interface TelemetryEvent {
  id: string;
  timestamp: string;
  timeOffset: number;
  type: EventType;
  objectId: string;
  objectName?: string;
  targetId?: string;
  targetName?: string;
  description: string;
  derived: boolean;
  details?: Record<string, any>;
}

export interface DCSHealthStatus {
  tacviewPortOpen: boolean;
  gamePortOpen: boolean;
  grpcPortOpen: boolean;
  state: 'connected' | 'paused' | 'offline';
  message: string;
  host: string;
  tacviewPort: number;
  gamePort: number;
  grpcPort: number;
}

export interface SystemStatus {
  sourceType: string;
  connectionState: 'connected' | 'disconnected' | 'stale' | 'connecting' | 'paused';
  lastReceived: string;
  latencyMs: number;
  objectCount: number;
  coalitionCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  historyDurationMinutes: number;
  historyStartTime: string;
  historyEndTime: string;
  totalHistoryRecords: number;
  version: string;
  dcsHealth?: DCSHealthStatus;
  theatre?: string;
  playerCount?: number;
  missionTime?: string;
}

export interface DCSPlayer {
  id: number;
  name: string;
  coalition: string;
  ping: number;
}

export interface DCSWeather {
  temperature: number;
  pressureQNH: number;
  windSpeed: number;
  windHeading: number;
}

export interface BRAAData {
  bearing: number;        // degrees (0-360)
  rangeNM: number;        // Nautical Miles
  rangeKm: number;        // Kilometers
  altitudeM: number;      // target altitude in meters
  altitudeFt: number;     // target altitude in feet
  aspectAngle: number;    // 0 - 180 degrees
  aspectLabel: 'HOT' | 'FLANK' | 'BEAM' | 'COLD';
}

export interface FilterSettings {
  coalitions: Coalition[];
  categories: Category[];
  searchTerm: string;
  minAltitude: number;
  maxAltitude: number;
  minSpeed: number;
  maxSpeed: number;
  showTrails: boolean;
  showLabels: boolean;
  trailLength: number;
  selectedOnly: boolean;
  showThreatRings: boolean;
  missileAlertsEnabled: boolean;
  missileAlertAudio: boolean;
}

export type MapStyleType = 'dark' | 'satellite' | 'voyager' | 'osm';

export interface MapConfig {
  defaultLat: number;
  defaultLon: number;
  defaultZoom: number;
  tileUrl: string;
  satelliteTileUrl?: string;
  attribution: string;
  cesiumIonToken?: string;
  altitudeUnit: 'm' | 'ft';
  speedUnit: 'kts' | 'kmh';
  language: string;
}

export interface WSMessage {
  type: 'snapshot' | 'delta';
  timestamp: string;
  timeOffset?: number;
  referenceTime?: string;
  objects?: ObjectEntity[];
  events?: TelemetryEvent[];
}
