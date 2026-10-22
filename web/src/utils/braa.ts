import { BRAAData, ObjectEntity } from '../types/telemetry';

export interface LatLonAlt {
  latitude: number;
  longitude: number;
  altitude: number;
  heading?: number;
}

// Default theater Bullseye reference points
export const THEATER_BULLSEYE: Record<string, { lat: number; lon: number; name: string }> = {
  'Caucasus': { lat: 41.85, lon: 41.77, name: 'Kobuleti' },
  'Syria': { lat: 34.80, lon: 36.80, name: 'Homs' },
  'PersianGulf': { lat: 26.20, lon: 55.90, name: 'Khasab' },
  'Sinai': { lat: 29.80, lon: 33.75, name: 'Sinai Central' },
  'Nevada': { lat: 36.50, lon: -115.50, name: 'Nellis' },
  'Kola': { lat: 68.00, lon: 33.00, name: 'Kola Central' },
  'Falklands': { lat: -51.80, lon: -59.50, name: 'Mount Pleasant' },
};

/**
 * Calculates Great-Circle distance and initial bearing between two points.
 */
export function calculateDistanceAndBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): { distanceKm: number; distanceNM: number; bearingDeg: number } {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(rLat1) * Math.cos(rLat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;
  const distanceNM = distanceKm / 1.852;

  const y = Math.sin(dLon) * Math.cos(rLat2);
  const x =
    Math.cos(rLat1) * Math.sin(rLat2) -
    Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLon);
  let bearingDeg = (Math.atan2(y, x) * 180) / Math.PI;
  bearingDeg = (bearingDeg + 360) % 360;

  return { distanceKm, distanceNM, bearingDeg };
}

/**
 * Calculates full tactical BRAA (Bearing, Range, Altitude, Aspect) from origin to target.
 */
export function calculateBRAA(origin: LatLonAlt, target: LatLonAlt): BRAAData {
  const { distanceKm, distanceNM, bearingDeg } = calculateDistanceAndBearing(
    origin.latitude,
    origin.longitude,
    target.latitude,
    target.longitude
  );

  const targetAltM = target.altitude || 0;
  const targetAltFt = Math.round(targetAltM * 3.28084);

  // Aspect angle calculation
  const targetHeading = target.heading || 0;
  const reciprocalBearing = (bearingDeg + 180) % 360;
  let aspectDiff = Math.abs(targetHeading - reciprocalBearing);
  if (aspectDiff > 180) aspectDiff = 360 - aspectDiff;

  let aspectLabel: 'HOT' | 'FLANK' | 'BEAM' | 'COLD' = 'HOT';
  if (aspectDiff < 30) {
    aspectLabel = 'HOT';
  } else if (aspectDiff < 70) {
    aspectLabel = 'FLANK';
  } else if (aspectDiff < 110) {
    aspectLabel = 'BEAM';
  } else {
    aspectLabel = 'COLD';
  }

  return {
    bearing: Math.round(bearingDeg),
    rangeNM: Math.round(distanceNM * 10) / 10,
    rangeKm: Math.round(distanceKm * 10) / 10,
    altitudeM: Math.round(targetAltM),
    altitudeFt: targetAltFt,
    aspectAngle: Math.round(aspectDiff),
    aspectLabel,
  };
}

/**
 * Calculates target position relative to Bullseye reference point.
 */
export function calculateBullseye(
  targetLat: number,
  targetLon: number,
  bullseyeLat: number = 41.85,
  bullseyeLon: number = 41.77
): string {
  const { distanceNM, bearingDeg } = calculateDistanceAndBearing(
    bullseyeLat,
    bullseyeLon,
    targetLat,
    targetLon
  );
  const brgStr = Math.round(bearingDeg).toString().padStart(3, '0');
  const distStr = Math.round(distanceNM).toString();
  return `BULLSEYE ${brgStr}° / ${distStr} NM`;
}
