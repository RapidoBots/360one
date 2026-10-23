"use client";

// Renders a tiny angled 3D preview of a catalog item to a cached data URL,
// reusing the same builders the real floor plan uses (FURNITURE_BUILDERS /
// buildTableTop) so the library thumbnail always matches what gets placed.
import * as THREE from "three";
import { FURNITURE_BUILDERS, buildTableTop, type SceneFurnitureItem, type SceneTable } from "./scene-engine";
import type { FurnitureCatalogItem, TableCatalogItem } from "./furniture-catalog";

const SIZE = 112;
const cache = new Map<string, string>();

let renderer: THREE.WebGLRenderer | null = null;
function getRenderer(): THREE.WebGLRenderer | null {
  if (typeof document === "undefined") return null;
  if (!renderer) {
    const canvas = document.createElement("canvas");
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
  }
  return renderer;
}

function renderPreview(key: string, span: number, build: (g: THREE.Group) => void): string {
  const cached = cache.get(key);
  if (cached) return cached;
  const r = getRenderer();
  if (!r) return "";

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight("#ffffff", "#b9a98f", 0.95));
  const dir = new THREE.DirectionalLight("#ffffff", 1.3);
  dir.position.set(3, 5, 4);
  scene.add(dir);

  const turntable = new THREE.Group();
  turntable.rotation.y = -35 * (Math.PI / 180);
  scene.add(turntable);
  build(turntable);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  const dist = Math.max(span * 2.1, 1.4);
  camera.position.set(dist * 0.75, dist * 0.68, dist * 0.75);
  camera.lookAt(0, span * 0.15, 0);

  r.setClearColor(0x000000, 0);
  r.render(scene, camera);
  const url = r.domElement.toDataURL("image/png");
  cache.set(key, url);
  return url;
}

export function getFurnitureThumbnail(item: FurnitureCatalogItem): string {
  const sceneItem: SceneFurnitureItem = {
    id: "preview",
    kind: item.kind,
    name: item.name,
    x: 0,
    z: 0,
    rotation: 0,
    width: item.width,
    depth: item.depth,
    height: item.height,
    color: item.color,
    finish: "wood",
    locked: false,
  };
  return renderPreview(`item:${item.id}`, Math.max(item.width, item.depth, item.height), (g) => {
    FURNITURE_BUILDERS[item.kind]?.(sceneItem, g);
  });
}

export function getTableThumbnail(item: TableCatalogItem): string {
  const sceneTable: SceneTable = {
    id: "preview",
    name: "",
    x: 0,
    z: 0,
    rotation: 0,
    round: item.shape === "ROUND",
    width: item.width,
    depth: item.depth,
    color: "#C99A62",
    finish: "wood",
    seats: item.capacity,
    status: "available",
    reservationCount: 0,
  };
  return renderPreview(`table:${item.id}`, Math.max(item.width, item.depth, 1), (g) => {
    buildTableTop(sceneTable, g);
  });
}
