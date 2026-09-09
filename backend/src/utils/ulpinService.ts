// src/utils/ulpinService.ts
/**
 * ULPIN Service – State‑wise Unique Land Parcel Identification Number utility
 * ---------------------------------------------------------------
 * Provides:
 *   1. Typed mapping of Indian states / union territories (LGD 2‑digit codes).
 *   2. fetchStateULPINs – fetches verified ULPINs from the official Setu / DILRMP API.
 *      Falls back to randomly generated mock data when the API is unreachable.
 *   3. seedAllStatesULPINs – bulk‑generates parcels and proposals for every state
 *      and inserts them into the PostGIS database using parameterised queries.
 *
 * Usage example (Express route):
 *   router.post('/api/gis/seed-states', async (req, res) => {
 *     const { countPerState = 100 } = req.body;
 *     await seedAllStatesULPINs(countPerState);
 *     res.json({ ok: true, message: `Seeded ${countPerState} parcels per state` });
 *   });
 */

import axios, { AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import knex from 'knex';
import { createLogger, format, transports } from 'winston';

// ---------------------------------------------------------------------------
// 1️⃣  State‑wise mapping (LGD / State codes)
// ---------------------------------------------------------------------------
export type StateCode =
  | 'AP' // Andhra Pradesh
  | 'AR' // Arunachal Pradesh
  | 'AS' // Assam
  | 'BR' // Bihar
  | 'CT' // Chhattisgarh
  | 'GA' // Goa
  | 'GJ' // Gujarat
  | 'HR' // Haryana
  | 'HP' // Himachal Pradesh
  | 'JK' // Jammu & Kashmir
  | 'JH' // Jharkhand
  | 'KA' // Karnataka
  | 'KL' // Kerala
  | 'MP' // Madhya Pradesh
  | 'MH' // Maharashtra
  | 'MN' // Manipur
  | 'ML' // Meghalaya
  | 'MZ' // Mizoram
  | 'NL' // Nagaland
  | 'OR' // Odisha
  | 'PB' // Punjab
  | 'RJ' // Rajasthan
  | 'SK' // Sikkim
  | 'TN' // Tamil Nadu
  | 'TG' // Telangana
  | 'TR' // Tripura
  | 'UT' // Uttarakhand
  | 'UP' // Uttar Pradesh
  | 'WB' // West Bengal
  // Union Territories (UTs)
  | 'AN' // Andaman & Nicobar Islands
  | 'CH' // Chandigarh
  | 'DH' // Dadra & Nagar Haveli and Daman & Diu
  | 'DD' // Daman & Diu (legacy)
  | 'DL' // Delhi
  | 'LD' // Lakshadweep
  | 'PY' // Puducherry
  | 'JK' // Jammu & Kashmir (treated as state for legacy compatibility)
  ;

export const StateNames: Record<StateCode, string> = {
  AP: 'Andhra Pradesh',
  AR: 'Arunachal Pradesh',
  AS: 'Assam',
  BR: 'Bihar',
  CT: 'Chhattisgarh',
  GA: 'Goa',
  GJ: 'Gujarat',
  HR: 'Haryana',
  HP: 'Himachal Pradesh',
  JK: 'Jammu & Kashmir',
  JH: 'Jharkhand',
  KA: 'Karnataka',
  KL: 'Kerala',
  MP: 'Madhya Pradesh',
  MH: 'Maharashtra',
  MN: 'Manipur',
  ML: 'Meghalaya',
  MZ: 'Mizoram',
  NL: 'Nagaland',
  OR: 'Odisha',
  PB: 'Punjab',
  RJ: 'Rajasthan',
  SK: 'Sikkim',
  TN: 'Tamil Nadu',
  TG: 'Telangana',
  TR: 'Tripura',
  UT: 'Uttarakhand',
  UP: 'Uttar Pradesh',
  WB: 'West Bengal',
  AN: 'Andaman & Nicobar Islands',
  CH: 'Chandigarh',
  DH: 'Dadra & Nagar Haveli and Daman & Diu',
  DD: 'Daman & Diu', // legacy code – kept for compatibility
  DL: 'Delhi',
  LD: 'Lakshadweep',
  PY: 'Puducherry',
};

// ---------------------------------------------------------------------------
// 2️⃣  Types returned by the Setu / DILRMP API (simplified for demo)
// ---------------------------------------------------------------------------
export interface UlpinRecord {
  ulpin: string; // 14‑character alphanumeric ID
  khasra_no: string;
  district: string; // district name
  village: string;
  state_code: StateCode;
  spatial_extent: GeoJSON.Geometry; // GeoJSON geometry of the parcel
}

// ---------------------------------------------------------------------------
// 3️⃣  Logger (Winston – JSON for structured logs)
// ---------------------------------------------------------------------------
const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

// ---------------------------------------------------------------------------
// 4️⃣  Database – Knex instance (expects a .env with PG credentials)
// ---------------------------------------------------------------------------
// NOTE: The backend already ships a Prisma client, but this utility is kept
// lightweight and uses raw Knex for bulk inserts – far more efficient for
// thousands of rows.
const db = knex({
  client: 'pg',
  connection: {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT) || 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    database: process.env.PGDATABASE || 'bhumitra',
  },
});

// ---------------------------------------------------------------------------
// 5️⃣  Helper – Random mock generator (used when Setu API is unavailable)
// ---------------------------------------------------------------------------
function randomULPIN(): string {
  // ULPIN pattern: 3 letters + 11 numeric characters (e.g. ULP17700000000)
  const prefix = 'ULP';
  const numeric = String(Math.floor(Math.random() * 1e11)).padStart(11, '0');
  return `${prefix}${numeric}`;
}

function randomGeoJSON(): GeoJSON.Polygon {
  // Generate a tiny square around a random lat/long – suitable for demo only
  const lat = 8 + Math.random() * 22; // approx Indian lat range 8‑30°
  const lng = 68 + Math.random() * 30; // approx 68‑98°
  const delta = 0.001; // ~100m square
  const coordinates: GeoJSON.Position[] = [
    [lng - delta, lat - delta],
    [lng + delta, lat - delta],
    [lng + delta, lat + delta],
    [lng - delta, lat + delta],
    [lng - delta, lat - delta],
  ];
  return { type: 'Polygon', coordinates: [coordinates] };
}

function mockRecord(stateCode: StateCode): UlpinRecord {
  return {
    ulpin: randomULPIN(),
    khasra_no: `KH-${Math.floor(Math.random() * 1e5)}`,
    district: `District-${Math.floor(Math.random() * 100)}`,
    village: `Village-${Math.floor(Math.random() * 500)}`,
    state_code: stateCode,
    spatial_extent: randomGeoJSON(),
  };
}

// ---------------------------------------------------------------------------
// 6️⃣  fetchStateULPINs – real or mock implementation
// ---------------------------------------------------------------------------
/**
 * Fetches verified ULPIN records for a given state.
 *
 * @param stateCode Two‑digit LGD/State code (e.g. 'MH')
 * @param limit     Optional maximum number of records to retrieve.
 * @returns         Array of UlpinRecord objects.
 */
export async function fetchStateULPINs(
  stateCode: StateCode,
  limit = 100
): Promise<UlpinRecord[]> {
  const apiUrl = `https://setu.gov.in/dilrmp/v1/ulpin/${stateCode}?limit=${limit}`;
  try {
    logger.info('Fetching ULPINs from Setu API', { stateCode, limit, apiUrl });
    const response = await axios.get<UlpinRecord[]>(apiUrl, { timeout: 8_000 });
    if (Array.isArray(response.data) && response.data.length > 0) {
      return response.data;
    }
    logger.warn('Setu API returned empty payload – falling back to mock', { stateCode });
    // Fallback to mock if Setu returns empty array (unlikely but defensive)
    return Array.from({ length: limit }, () => mockRecord(stateCode));
  } catch (err) {
    const axiosErr = err as AxiosError;
    logger.error('Failed to fetch ULPINs – using mock data', {
      stateCode,
      message: axiosErr.message,
      code: axiosErr.code,
      responseStatus: axiosErr.response?.status,
    });
    // Simulate mock data – guaranteed to resolve quickly.
    return Array.from({ length: limit }, () => mockRecord(stateCode));
  }
}

// ---------------------------------------------------------------------------
// 7️⃣  seedAllStatesULPINs – bulk generator + INSERT … ON CONFLICT DO NOTHING
// ---------------------------------------------------------------------------
/**
 * Seeds the `land_parcels` and `land_proposals` tables for every Indian state.
 * The function is intentionally idempotent – duplicate `ulpin` values are ignored.
 *
 * @param countPerState Number of parcels to generate per state (default = 200).
 */
export async function seedAllStatesULPINs(countPerState = 200): Promise<void> {
  logger.info('Starting bulk ULPIN seeding', { countPerState });

  // Build a massive batch – using Knex's INSERT … ON CONFLICT for speed.
  const parcelRows: any[] = [];
  const proposalRows: any[] = [];

  for (const stateCode of Object.keys(StateNames) as StateCode[]) {
    const records = await fetchStateULPINs(stateCode, countPerState);
    for (const rec of records) {
      const parcelId = uuidv4();
      const proposalId = uuidv4();
      // ---- land_parcels ----
      parcelRows.push({
        id: parcelId,
        ulpin: rec.ulpin,
        khasra_no: rec.khasra_no,
        district: rec.district,
        village: rec.village,
        state_code: rec.state_code,
        geometry: JSON.stringify(rec.spatial_extent), // PostGIS GeoJSON loader
        created_at: new Date().toISOString(),
      });
      // ---- land_proposals (high‑level project proposal) ----
      proposalRows.push({
        id: proposalId,
        parcel_id: parcelId,
        proposal_number: `PROP-${stateCode}-${Math.floor(Math.random() * 1e6)}`,
        status: 'DRAFT',
        created_at: new Date().toISOString(),
      });
    }
  }

  // Insert in a transaction – ensures atomicity per batch.
  await db.transaction(async (trx) => {
    // land_parcels – unique on ulpin
    await trx
      .insert(parcelRows)
      .into('land_parcels')
      .onConflict('ulpin')
      .ignore();

    // land_proposals – unique on proposal_number
    await trx
      .insert(proposalRows)
      .into('land_proposals')
      .onConflict('proposal_number')
      .ignore();
  });

  logger.info('ULPIN seeding completed', { totalParcels: parcelRows.length, totalProposals: proposalRows.length });
}

// ---------------------------------------------------------------------------
// 8️⃣  Export helpers for health‑check / debugging (optional)
// ---------------------------------------------------------------------------
export async function countParcels(): Promise<number> {
  const [{ count }] = await db('land_parcels').count<{ count: string }>('* as count');
  return Number(count);
}

export async function countProposals(): Promise<number> {
  const [{ count }] = await db('land_proposals').count<{ count: string }>('* as count');
  return Number(count);
}

// ---------------------------------------------------------------------------
// 9️⃣  Graceful shutdown – close DB pool when process exits.
// ---------------------------------------------------------------------------
process.once('SIGTERM', async () => {
  logger.info('SIGTERM received – closing DB connection');
  await db.destroy();
  process.exit(0);
});
process.once('SIGINT', async () => {
  logger.info('SIGINT received – closing DB connection');
  await db.destroy();
  process.exit(0);
});

/**
 * EXAMPLE EXPRESS ROUTE (to be placed in a router file, e.g. src/routes/gis.ts)
 * ---------------------------------------------------------------------
 * import { Router } from 'express';
 * import { seedAllStatesULPINs } from '../utils/ulpinService';
 * const router = Router();
 *
 * router.post('/api/gis/seed-states', async (req, res) => {
 *   const { countPerState = 200 } = req.body as { countPerState?: number };
 *   try {
 *     await seedAllStatesULPINs(countPerState);
 *     res.json({ ok: true, message: `Seeded ${countPerState} parcels per state.` });
 *   } catch (e) {
 *     console.error(e);
 *     res.status(500).json({ ok: false, error: (e as Error).message });
 *   }
 * });
 *
 * export default router;
 */
