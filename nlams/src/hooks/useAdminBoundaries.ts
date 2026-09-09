import { useQuery } from "@tanstack/react-query";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";

export interface DistrictFeatureProperties {
  distName: string;
}

export interface BlockFeatureProperties {
  blockName: string;
  /** Matches a district feature's `distName` exactly. */
  districtName: string;
}

export type DistrictFeature = Feature<Polygon | MultiPolygon, DistrictFeatureProperties>;
export type BlockFeature = Feature<Polygon | MultiPolygon, BlockFeatureProperties>;

interface NationalDistrictProperties {
  NAME_1?: string;
  NAME_2?: string;
}

/**
 * Static assets under public/geo — served as-is by Vite, fetched directly
 * (not through the API server) and cached indefinitely by react-query since
 * the boundary data never changes at runtime.
 */
async function fetchGeoJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export function useStateDistricts(state: { code: string; slug: string }) {
  return useQuery({
    queryKey: ["geo", "india-districts"],
    queryFn: async () => {
      const source = await fetchGeoJson<
        FeatureCollection<Polygon | MultiPolygon, NationalDistrictProperties>
      >(`/geo/india-districts.geojson`);
      // Filter features belonging to the requested state by matching the state code in properties.
      const filtered = source.features.filter(
        (f) => (f.properties.NAME_1 ?? "").toUpperCase() === state.code,
      );
      return {
        ...source,
        features: filtered.map((feature) => ({
          ...feature,
          properties: { distName: feature.properties.NAME_2 ?? "Unnamed district" },
        })),
      } as FeatureCollection<Polygon | MultiPolygon, DistrictFeatureProperties>;
    },
    retry: 1,
    staleTime: Infinity,
  });
}

export function useStateBlocks(state: { code: string; slug: string }) {
  return useQuery({
    queryKey: ["geo", `${state.slug}-blocks`],
    queryFn: async () => {
      try {
        return await fetchGeoJson<FeatureCollection<Polygon | MultiPolygon, BlockFeatureProperties>>(
          `/geo/${state.slug}-blocks.geojson`
        );
      } catch {
        // If block data is unavailable for the state, return undefined
        return undefined as any;
      }
    },
    retry: false,
    enabled: !!state.slug && !!state.code,
    staleTime: Infinity,
  });
}

export const useWestBengalDistricts = () =>
  useStateDistricts({ code: "WB", slug: "west-bengal" });
export const useWestBengalBlocks = () => useStateBlocks({ code: "WB", slug: "west-bengal" });
