// Static furniture catalog, ported from the floor-manager.html mockup.
// Not database-backed -- every FloorItem just stores a `type` id that
// indexes into this table for its default dims/color and which 3D builder
// (scene-engine's FURNITURE_BUILDERS) renders it.
export type FurnitureCategory = "Tables" | "Bar" | "Seating" | "Structure" | "Decor";

export type FurnitureCatalogItem = {
  id: string;
  name: string;
  category: FurnitureCategory;
  kind: string; // scene-engine builder key
  width: number;
  depth: number;
  height: number;
  color: string;
  seats: number;
};

export const FURNITURE_CATALOG: FurnitureCatalogItem[] = [
  { id: "bartable", name: "High bar table", category: "Bar", kind: "table-bar", width: 0.7, depth: 0.7, height: 1.05, color: "#2F3A4A", seats: 2 },
  { id: "barcounter", name: "Bar counter", category: "Bar", kind: "counter", width: 3.2, depth: 0.75, height: 1.1, color: "#2F3A4A", seats: 5 },
  { id: "counter", name: "Service counter", category: "Bar", kind: "counter", width: 2, depth: 0.7, height: 0.95, color: "#E9E1D3", seats: 0 },
  { id: "backbar", name: "Back bar shelving", category: "Bar", kind: "backbar", width: 3, depth: 0.45, height: 2.1, color: "#4A3427", seats: 0 },
  { id: "chair", name: "Dining chair", category: "Seating", kind: "chair", width: 0.45, depth: 0.45, height: 0.9, color: "#8B5E3C", seats: 0 },
  { id: "stool", name: "Bar stool", category: "Seating", kind: "stool", width: 0.4, depth: 0.4, height: 0.75, color: "#1F2937", seats: 0 },
  { id: "armchair", name: "Lounge armchair", category: "Seating", kind: "armchair", width: 0.85, depth: 0.85, height: 0.8, color: "#0F766E", seats: 0 },
  { id: "sofa", name: "Sofa · 3 seat", category: "Seating", kind: "sofa", width: 2.1, depth: 0.9, height: 0.82, color: "#2F3A4A", seats: 0 },
  { id: "booth", name: "Booth bench", category: "Seating", kind: "booth", width: 1.9, depth: 0.7, height: 1.25, color: "#B91C1C", seats: 0 },
  { id: "corner", name: "Corner booth", category: "Seating", kind: "corner", width: 2.4, depth: 2.4, height: 1.25, color: "#B91C1C", seats: 0 },
  { id: "bench", name: "Bench", category: "Seating", kind: "bench", width: 1.4, depth: 0.4, height: 0.45, color: "#C99A62", seats: 0 },
  { id: "wall", name: "Wall", category: "Structure", kind: "wall", width: 4, depth: 0.2, height: 2.8, color: "#F1EFEA", seats: 0 },
  { id: "glass", name: "Glass partition", category: "Structure", kind: "glass", width: 2, depth: 0.06, height: 1.9, color: "#9CA3AF", seats: 0 },
  { id: "slat", name: "Slat divider", category: "Structure", kind: "slat", width: 1.6, depth: 0.12, height: 1.8, color: "#C99A62", seats: 0 },
  { id: "door", name: "Door", category: "Structure", kind: "door", width: 1, depth: 0.2, height: 2.1, color: "#8B5E3C", seats: 0 },
  { id: "door2", name: "Double door", category: "Structure", kind: "door", width: 2, depth: 0.2, height: 2.1, color: "#2F3A4A", seats: 0 },
  { id: "window", name: "Window", category: "Structure", kind: "window", width: 2, depth: 0.2, height: 2.8, color: "#F1EFEA", seats: 0 },
  { id: "column", name: "Column", category: "Structure", kind: "column", width: 0.45, depth: 0.45, height: 2.8, color: "#E9E1D3", seats: 0 },
  { id: "plant", name: "Potted plant", category: "Decor", kind: "plant", width: 0.6, depth: 0.6, height: 1.3, color: "#4D8B4F", seats: 0 },
  { id: "host", name: "Host stand", category: "Decor", kind: "host", width: 0.65, depth: 0.5, height: 1.1, color: "#4A3427", seats: 0 },
  { id: "rug", name: "Area rug", category: "Decor", kind: "rug", width: 2.6, depth: 1.8, height: 0.02, color: "#9CA3AF", seats: 0 },
  { id: "pendant", name: "Pendant lamp", category: "Decor", kind: "pendant", width: 0.5, depth: 0.5, height: 2.1, color: "#E9E1D3", seats: 0 },
];

export const FURNITURE_CATEGORIES: FurnitureCategory[] = ["Tables", "Bar", "Seating", "Structure", "Decor"];
export const FURNITURE_BY_ID = new Map(FURNITURE_CATALOG.map((c) => [c.id, c]));
