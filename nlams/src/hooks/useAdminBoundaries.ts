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
    queryKey: ["geo", `${state.slug}-districts`],
    queryFn: () =>
      fetchGeoJson<FeatureCollection<Polygon | MultiPolygon, DistrictFeatureProperties>>(
        `/geo/${state.slug}-districts.geojson`,
      ),
    retry: false,
    enabled: state.code === "WB",
    staleTime: Infinity,
  });
}

export function useStateBlocks(state: { code: string; slug: string }) {
  return useQuery({
    queryKey: ["geo", `${state.slug}-blocks`],
    queryFn: () =>
      fetchGeoJson<FeatureCollection<Polygon | MultiPolygon, BlockFeatureProperties>>(
        `/geo/${state.slug}-blocks.geojson`,
      ),
    retry: false,
    enabled: state.code === "WB",
    staleTime: Infinity,
  });
}

export const useWestBengalDistricts = () =>
  useStateDistricts({ code: "WB", slug: "west-bengal" });
export const useWestBengalBlocks = () => useStateBlocks({ code: "WB", slug: "west-bengal" });
