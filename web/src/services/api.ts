import { MapConfig, ObjectEntity, SystemStatus, TelemetryEvent } from '../types/telemetry';

const API_BASE = '/api/v1';

export async function fetchStatus(): Promise<SystemStatus> {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) throw new Error(`Chyba při načítání stavu (${res.status})`);
  return res.json();
}

export async function fetchObjects(): Promise<ObjectEntity[]> {
  const res = await fetch(`${API_BASE}/objects`);
  if (!res.ok) throw new Error(`Chyba při načítání objektů (${res.status})`);
  const data = await res.json();
  return data.objects || [];
}

export async function fetchObjectDetail(id: string): Promise<ObjectEntity> {
  const res = await fetch(`${API_BASE}/objects/${id}`);
  if (!res.ok) throw new Error(`Objekt ${id} nenalezen`);
  return res.json();
}

export async function fetchHistoryRange(): Promise<{
  startTime: string;
  endTime: string;
  totalRecords: number;
  retentionMinutes: number;
}> {
  const res = await fetch(`${API_BASE}/history/range`);
  if (!res.ok) throw new Error(`Chyba při načítání historie`);
  return res.json();
}

export async function fetchHistorySnapshot(timeISO: string): Promise<ObjectEntity[]> {
  const res = await fetch(`${API_BASE}/history/snapshot?time=${encodeURIComponent(timeISO)}`);
  if (!res.ok) throw new Error(`Chyba při načítání snapshotu`);
  const data = await res.json();
  return data.objects || [];
}

export async function fetchEvents(limit = 100, type?: string, objectId?: string): Promise<TelemetryEvent[]> {
  const params = new URLSearchParams();
  if (limit) params.set('limit', limit.toString());
  if (type) params.set('type', type);
  if (objectId) params.set('objectId', objectId);

  const res = await fetch(`${API_BASE}/events?${params.toString()}`);
  if (!res.ok) throw new Error(`Chyba při načítání událostí`);
  const data = await res.json();
  return data.events || [];
}

export async function fetchPublicConfig(): Promise<MapConfig> {
  const res = await fetch(`${API_BASE}/config`);
  if (!res.ok) throw new Error(`Chyba při načítání konfigurace mapy`);
  return res.json();
}

export function getExportUrl(format: 'geojson' | 'csv', from?: string, to?: string, objectId?: string): string {
  const params = new URLSearchParams({ format });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (objectId) params.set('objectId', objectId);
  return `${API_BASE}/history/export?${params.toString()}`;
}
