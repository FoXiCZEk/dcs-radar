export interface SAMProfile {
  name: string;
  natoName: string;
  engagementRangeKm: number;
  engagementRangeNM: number;
  detectionRangeKm?: number;
  detectionRangeNM?: number;
  minAltM?: number;
  maxAltM?: number;
}

// Database of DCS World Surface-to-Air Missile (SAM), AAA, and Naval Air Defense systems
export const SAM_DATABASE: Record<string, SAMProfile> = {
  // Long Range Strategic SAMs
  'patriot': {
    name: 'MIM-104 Patriot',
    natoName: 'Patriot',
    engagementRangeKm: 85,
    engagementRangeNM: 46,
    detectionRangeKm: 140,
    detectionRangeNM: 75,
  },
  'sa-10': {
    name: 'S-300PS (SA-10 Grumble)',
    natoName: 'SA-10 Grumble',
    engagementRangeKm: 75,
    engagementRangeNM: 40,
    detectionRangeKm: 160,
    detectionRangeNM: 86,
  },
  's-300': {
    name: 'S-300PS (SA-10 Grumble)',
    natoName: 'SA-10 Grumble',
    engagementRangeKm: 75,
    engagementRangeNM: 40,
    detectionRangeKm: 160,
    detectionRangeNM: 86,
  },
  'sa-2': {
    name: 'S-75 Dvina (SA-2 Guideline)',
    natoName: 'SA-2 Guideline',
    engagementRangeKm: 45,
    engagementRangeNM: 24,
    detectionRangeKm: 100,
    detectionRangeNM: 54,
  },
  'sa-5': {
    name: 'S-200 (SA-5 Gammon)',
    natoName: 'SA-5 Gammon',
    engagementRangeKm: 240,
    engagementRangeNM: 130,
    detectionRangeKm: 300,
    detectionRangeNM: 162,
  },

  // Medium Range SAMs
  'sa-11': {
    name: '9K37 Buk (SA-11 Gadfly)',
    natoName: 'SA-11 Gadfly',
    engagementRangeKm: 35,
    engagementRangeNM: 19,
    detectionRangeKm: 85,
    detectionRangeNM: 46,
  },
  'buk': {
    name: '9K37 Buk (SA-11 Gadfly)',
    natoName: 'SA-11 Gadfly',
    engagementRangeKm: 35,
    engagementRangeNM: 19,
    detectionRangeKm: 85,
    detectionRangeNM: 46,
  },
  'sa-6': {
    name: '2K12 Kub (SA-6 Gainful)',
    natoName: 'SA-6 Gainful',
    engagementRangeKm: 25,
    engagementRangeNM: 13.5,
    detectionRangeKm: 65,
    detectionRangeNM: 35,
  },
  'kub': {
    name: '2K12 Kub (SA-6 Gainful)',
    natoName: 'SA-6 Gainful',
    engagementRangeKm: 25,
    engagementRangeNM: 13.5,
    detectionRangeKm: 65,
    detectionRangeNM: 35,
  },
  'hawk': {
    name: 'MIM-23 HAWK',
    natoName: 'HAWK',
    engagementRangeKm: 45,
    engagementRangeNM: 24,
    detectionRangeKm: 75,
    detectionRangeNM: 40,
  },
  'sa-3': {
    name: 'S-125 Neva (SA-3 Goa)',
    natoName: 'SA-3 Goa',
    engagementRangeKm: 25,
    engagementRangeNM: 13.5,
    detectionRangeKm: 60,
    detectionRangeNM: 32,
  },
  'nasams': {
    name: 'NASAMS',
    natoName: 'NASAMS',
    engagementRangeKm: 30,
    engagementRangeNM: 16,
    detectionRangeKm: 75,
    detectionRangeNM: 40,
  },

  // Short Range / Point Defense SAMs
  'pantsir': {
    name: 'Pantsir-S1 (SA-22 Greyhound)',
    natoName: 'SA-22 Greyhound',
    engagementRangeKm: 20,
    engagementRangeNM: 11,
    detectionRangeKm: 36,
    detectionRangeNM: 19.5,
  },
  'sa-15': {
    name: '9K331 Tor (SA-15 Gauntlet)',
    natoName: 'SA-15 Gauntlet',
    engagementRangeKm: 12,
    engagementRangeNM: 6.5,
    detectionRangeKm: 25,
    detectionRangeNM: 13.5,
  },
  'tor': {
    name: '9K331 Tor (SA-15 Gauntlet)',
    natoName: 'SA-15 Gauntlet',
    engagementRangeKm: 12,
    engagementRangeNM: 6.5,
    detectionRangeKm: 25,
    detectionRangeNM: 13.5,
  },
  'sa-8': {
    name: '9K33 Osa (SA-8 Gecko)',
    natoName: 'SA-8 Gecko',
    engagementRangeKm: 10,
    engagementRangeNM: 5.4,
    detectionRangeKm: 30,
    detectionRangeNM: 16,
  },
  'osa': {
    name: '9K33 Osa (SA-8 Gecko)',
    natoName: 'SA-8 Gecko',
    engagementRangeKm: 10,
    engagementRangeNM: 5.4,
    detectionRangeKm: 30,
    detectionRangeNM: 16,
  },
  'sa-19': {
    name: '2K22 Tunguska (SA-19 Grison)',
    natoName: 'SA-19 Grison',
    engagementRangeKm: 8,
    engagementRangeNM: 4.3,
    detectionRangeKm: 18,
    detectionRangeNM: 9.7,
  },
  'tunguska': {
    name: '2K22 Tunguska (SA-19 Grison)',
    natoName: 'SA-19 Grison',
    engagementRangeKm: 8,
    engagementRangeNM: 4.3,
    detectionRangeKm: 18,
    detectionRangeNM: 9.7,
  },
  'roland': {
    name: 'Roland ADS',
    natoName: 'Roland',
    engagementRangeKm: 8,
    engagementRangeNM: 4.3,
    detectionRangeKm: 16,
    detectionRangeNM: 8.6,
  },
  'strela': {
    name: '9K35 Strela-10 (SA-13 Gopher)',
    natoName: 'SA-13 Gopher',
    engagementRangeKm: 5,
    engagementRangeNM: 2.7,
  },
  'sa-13': {
    name: '9K35 Strela-10 (SA-13 Gopher)',
    natoName: 'SA-13 Gopher',
    engagementRangeKm: 5,
    engagementRangeNM: 2.7,
  },
  'sa-9': {
    name: '9K31 Strela-1 (SA-9 Gaskin)',
    natoName: 'SA-9 Gaskin',
    engagementRangeKm: 4.2,
    engagementRangeNM: 2.3,
  },
  'avenger': {
    name: 'M1097 Avenger (Stinger)',
    natoName: 'Avenger',
    engagementRangeKm: 5.5,
    engagementRangeNM: 3.0,
  },
  'linebacker': {
    name: 'M6 Linebacker (Stinger)',
    natoName: 'Linebacker',
    engagementRangeKm: 5.5,
    engagementRangeNM: 3.0,
  },

  // AAA (Anti-Aircraft Artillery)
  'vulcan': {
    name: 'M163 Vulcan VADS',
    natoName: 'Vulcan (AAA)',
    engagementRangeKm: 2.5,
    engagementRangeNM: 1.35,
    detectionRangeKm: 5,
    detectionRangeNM: 2.7,
  },
  'shilka': {
    name: 'ZSU-23-4 Shilka',
    natoName: 'Shilka (AAA)',
    engagementRangeKm: 3.0,
    engagementRangeNM: 1.6,
    detectionRangeKm: 10,
    detectionRangeNM: 5.4,
  },
  'zu-23': {
    name: 'ZU-23-2 Twin 23mm',
    natoName: 'ZU-23 (AAA)',
    engagementRangeKm: 2.5,
    engagementRangeNM: 1.35,
  },
  'gepard': {
    name: 'Flakpanzer Gepard',
    natoName: 'Gepard (AAA)',
    engagementRangeKm: 4.0,
    engagementRangeNM: 2.2,
    detectionRangeKm: 15,
    detectionRangeNM: 8.1,
  },
  'phalanx': {
    name: 'Phalanx CIWS',
    natoName: 'Phalanx CIWS',
    engagementRangeKm: 2.0,
    engagementRangeNM: 1.1,
  },

  // Naval Air Defense Systems (Cruisers, Destroyers, Frigates, Carriers)
  'ticonderog': {
    name: 'CG-47 Ticonderoga (SM-2MR)',
    natoName: 'SM-2MR (Ticonderoga)',
    engagementRangeKm: 120,
    engagementRangeNM: 65,
    detectionRangeKm: 350,
    detectionRangeNM: 190,
  },
  'moscow': {
    name: 'Moskva CG (SA-N-6 Fort / S-300F)',
    natoName: 'SA-N-6 Fort (Moskva)',
    engagementRangeKm: 90,
    engagementRangeNM: 48,
    detectionRangeKm: 300,
    detectionRangeNM: 160,
  },
  'perry': {
    name: 'FFG-7 OH Perry (SM-1MR)',
    natoName: 'SM-1MR (Perry)',
    engagementRangeKm: 40,
    engagementRangeNM: 21,
    detectionRangeKm: 200,
    detectionRangeNM: 108,
  },
  'neustrash': {
    name: 'Neustrashimy (SA-N-9 Gauntlet)',
    natoName: 'SA-N-9 (Neustrashimy)',
    engagementRangeKm: 12,
    engagementRangeNM: 6.5,
    detectionRangeKm: 120,
    detectionRangeNM: 65,
  },
  'cvn_73': {
    name: 'CVN-73 Nimitz (Sea Sparrow)',
    natoName: 'Sea Sparrow (Nimitz)',
    engagementRangeKm: 18,
    engagementRangeNM: 9.7,
    detectionRangeKm: 250,
    detectionRangeNM: 135,
  },
  'cv_1143_5': {
    name: 'Adm. Kuznetsov (SA-N-9 / Kashtan)',
    natoName: 'SA-N-9 (Kuznetsov)',
    engagementRangeKm: 12,
    engagementRangeNM: 6.5,
    detectionRangeKm: 200,
    detectionRangeNM: 108,
  },
  'lha_tarawa': {
    name: 'LHA-1 Tarawa (RAM / Phalanx)',
    natoName: 'RAM / Phalanx (Tarawa)',
    engagementRangeKm: 9,
    engagementRangeNM: 4.8,
    detectionRangeKm: 150,
    detectionRangeNM: 80,
  },

  // Early Warning & Search Radars
  '55g6': {
    name: '55G6 Nebo Early Warning Radar',
    natoName: '55G6 Nebo (EWR)',
    engagementRangeKm: 40,
    engagementRangeNM: 21.6,
    detectionRangeKm: 300,
    detectionRangeNM: 162,
  },
  'fps-117': {
    name: 'AN/FPS-117 3D Search Radar',
    natoName: 'FPS-117 Radar',
    engagementRangeKm: 50,
    engagementRangeNM: 27,
    detectionRangeKm: 370,
    detectionRangeNM: 200,
  },
};

/**
 * Searches the SAM database for matching unit name or type.
 */
export function getSAMProfile(type: string, name: string): SAMProfile | null {
  const t = (type || '').toLowerCase();
  const n = (name || '').toLowerCase();

  for (const [key, profile] of Object.entries(SAM_DATABASE)) {
    if (t.includes(key) || n.includes(key)) {
      return profile;
    }
  }

  // Common missile, AAA & naval air defense search patterns
  if (t.includes('vulcan') || n.includes('vulcan') || t.includes('m163') || n.includes('m163')) return SAM_DATABASE['vulcan'];
  if (t.includes('shilka') || n.includes('shilka') || t.includes('zsu-23') || n.includes('zsu-23') || t.includes('zsu_23')) return SAM_DATABASE['shilka'];
  if (t.includes('zu-23') || n.includes('zu-23') || t.includes('zu_23')) return SAM_DATABASE['zu-23'];
  if (t.includes('strela') || n.includes('strela') || t.includes('sa-13') || n.includes('sa-13') || t.includes('9k35')) return SAM_DATABASE['strela'];
  if (t.includes('avenger') || n.includes('avenger') || t.includes('m1097') || n.includes('m1097')) return SAM_DATABASE['avenger'];
  if (t.includes('hawk') || n.includes('hawk') || t.includes('mim-23') || n.includes('mim-23')) return SAM_DATABASE['hawk'];
  if (t.includes('55g6') || n.includes('55g6') || t.includes('nebo') || n.includes('nebo')) return SAM_DATABASE['55g6'];
  if (t.includes('fps-117') || n.includes('fps-117') || t.includes('fps117')) return SAM_DATABASE['fps-117'];
  if (t.includes('ticonderog') || n.includes('ticonderog')) return SAM_DATABASE['ticonderog'];
  if (t.includes('moscow') || n.includes('moscow') || t.includes('moskva') || n.includes('slava')) return SAM_DATABASE['moscow'];
  if (t.includes('perry') || n.includes('perry')) return SAM_DATABASE['perry'];
  if (t.includes('neustrash') || n.includes('neustrash')) return SAM_DATABASE['neustrash'];
  if (t.includes('cvn_73') || n.includes('cvn_73') || t.includes('nimitz') || n.includes('cvn')) return SAM_DATABASE['cvn_73'];
  if (t.includes('cv_1143_5') || n.includes('cv_1143_5') || t.includes('kuznetsov')) return SAM_DATABASE['cv_1143_5'];
  if (t.includes('tarawa') || n.includes('tarawa') || t.includes('lha_1') || n.includes('lha_tarawa')) return SAM_DATABASE['lha_tarawa'];
  if (t.includes('patriot') || n.includes('patriot')) return SAM_DATABASE['patriot'];
  if (t.includes('s-300') || n.includes('s-300') || t.includes('sa-10') || n.includes('sa-10') || t.includes('5v55')) return SAM_DATABASE['sa-10'];
  if (t.includes('buk') || n.includes('buk') || t.includes('sa-11') || n.includes('sa-11') || t.includes('9k37')) return SAM_DATABASE['sa-11'];
  if (t.includes('kub') || n.includes('kub') || t.includes('sa-6') || n.includes('sa-6') || t.includes('2k12')) return SAM_DATABASE['sa-6'];
  if (t.includes('tor') || n.includes('tor') || t.includes('sa-15') || n.includes('sa-15')) return SAM_DATABASE['sa-15'];
  if (t.includes('osa') || n.includes('osa') || t.includes('sa-8') || n.includes('sa-8')) return SAM_DATABASE['sa-8'];
  if (t.includes('tunguska') || n.includes('tunguska') || t.includes('sa-19') || n.includes('2k22')) return SAM_DATABASE['sa-19'];
  if (t.includes('pantsir') || n.includes('pantsir')) return SAM_DATABASE['pantsir'];
  if (t.includes('gepard') || n.includes('gepard')) return SAM_DATABASE['gepard'];

  return null;
}

/**
 * Generates a GeoJSON Polygon circle of given radius in kilometers around [lon, lat].
 */
export function createGeoJSONCircle(
  centerLon: number,
  centerLat: number,
  radiusKm: number,
  points: number = 48
): number[][] {
  const coords: number[][] = [];
  const distanceX = radiusKm / (111.32 * Math.cos((centerLat * Math.PI) / 180));
  const distanceY = radiusKm / 110.574;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([centerLon + x, centerLat + y]);
  }
  // Close polygon loop
  coords.push(coords[0]);
  return coords;
}
