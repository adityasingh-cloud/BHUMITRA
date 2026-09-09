export interface IndiaState {
  code: string;
  name: string;
  slug: string;
  center: [number, number];
  zoom: number;
  kind: "state" | "union-territory";
}

/** National state/UT catalog used by the shared cadastral viewer. */
export const INDIA_STATES: IndiaState[] = [
  ["AP", "Andhra Pradesh", 15.9, 79.7, 7, "state"],
  ["AR", "Arunachal Pradesh", 28.2, 94.7, 7, "state"],
  ["AS", "Assam", 26.2, 92.9, 7, "state"],
  ["BR", "Bihar", 25.9, 85.3, 7, "state"],
  ["CG", "Chhattisgarh", 21.3, 82.0, 7, "state"],
  ["GA", "Goa", 15.4, 74.1, 9, "state"],
  ["GJ", "Gujarat", 22.6, 71.7, 7, "state"],
  ["HR", "Haryana", 29.1, 76.1, 8, "state"],
  ["HP", "Himachal Pradesh", 31.8, 77.2, 7, "state"],
  ["JH", "Jharkhand", 23.6, 85.3, 7, "state"],
  ["KA", "Karnataka", 15.3, 75.7, 7, "state"],
  ["KL", "Kerala", 10.4, 76.3, 8, "state"],
  ["MP", "Madhya Pradesh", 23.5, 78.5, 7, "state"],
  ["MH", "Maharashtra", 19.3, 75.3, 7, "state"],
  ["MN", "Manipur", 24.7, 93.9, 8, "state"],
  ["ML", "Meghalaya", 25.5, 91.4, 8, "state"],
  ["MZ", "Mizoram", 23.2, 92.7, 8, "state"],
  ["NL", "Nagaland", 26.1, 94.6, 8, "state"],
  ["OD", "Odisha", 20.5, 84.4, 7, "state"],
  ["PB", "Punjab", 31.1, 75.3, 8, "state"],
  ["RJ", "Rajasthan", 27.0, 74.2, 7, "state"],
  ["SK", "Sikkim", 27.5, 88.5, 9, "state"],
  ["TN", "Tamil Nadu", 11.1, 78.5, 7, "state"],
  ["TS", "Telangana", 17.9, 79.4, 7, "state"],
  ["TR", "Tripura", 23.8, 91.3, 8, "state"],
  ["UK", "Uttarakhand", 30.1, 79.2, 7, "state"],
  ["UP", "Uttar Pradesh", 26.8, 80.9, 7, "state"],
  ["WB", "West Bengal", 23.0, 87.9, 7, "state"],
  ["AN", "Andaman and Nicobar Islands", 11.7, 92.7, 7, "union-territory"],
  ["CH", "Chandigarh", 30.7, 76.8, 11, "union-territory"],
  ["DL", "Delhi", 28.6, 77.2, 10, "union-territory"],
  ["DN", "Dadra and Nagar Haveli and Daman and Diu", 20.3, 72.9, 9, "union-territory"],
  ["JK", "Jammu and Kashmir", 33.7, 75.3, 7, "union-territory"],
  ["LA", "Ladakh", 34.2, 77.6, 7, "union-territory"],
  ["LD", "Lakshadweep", 10.5, 72.6, 8, "union-territory"],
  ["PY", "Puducherry", 11.9, 79.8, 10, "union-territory"],
].map(([code, name, lat, lng, zoom, kind]) => ({
  code,
  name,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  center: [lat, lng],
  zoom,
  kind,
}));

export const WEST_BENGAL = INDIA_STATES.find((state) => state.code === "WB")!;