// Ported from the floor-manager.html 3D mockup, trimmed to Phase 1 (viewing
// only -- no drag/rotate/scale editing, no furniture catalog yet). Raw
// Three.js (not react-three-fiber): the mockup's imperative scene graph,
// pointer handling and camera math port far more directly this way, and it
// avoids a second heavy 3D dependency for no benefit here.
import * as THREE from "three";

const DEG = Math.PI / 180;

export type SceneTableStatus = "available" | "soon" | "seated";
export const STATUS_COLOR: Record<SceneTableStatus, string> = {
  available: "#10B981",
  soon: "#F59E0B",
  seated: "#EF4444",
};
export type SceneTable = {
  id: string;
  name: string;
  x: number; // metres
  z: number; // metres
  rotation: number; // degrees
  round: boolean;
  width: number; // metres
  depth: number; // metres
  color: string;
  finish: "wood" | "matte" | "satin" | "gloss" | "metal";
  seats: number;
  status: SceneTableStatus;
  reservationCount: number;
};

const FINISH: Record<SceneTable["finish"], { roughness: number; metalness: number }> = {
  wood: { roughness: 0.62, metalness: 0 },
  matte: { roughness: 0.9, metalness: 0 },
  satin: { roughness: 0.45, metalness: 0.05 },
  gloss: { roughness: 0.12, metalness: 0.1 },
  metal: { roughness: 0.3, metalness: 0.85 },
};

const TABLE_HEIGHT = 0.75;

// ---------- small Three.js builder helpers (direct port) ----------
const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, roughness: number, metalness: number): THREE.MeshStandardMaterial {
  const k = `${color}|${roughness}|${metalness}`;
  let m = matCache.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    matCache.set(k, m);
  }
  return m;
}
const geoCache = new Map<string, THREE.BufferGeometry>();
function G(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}
function box(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, g: THREE.Object3D) {
  const s = new THREE.Mesh(G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), m);
  s.position.set(x, y, z);
  s.castShadow = s.receiveShadow = true;
  g.add(s);
  return s;
}
function cyl(rt: number, rb: number, h: number, m: THREE.Material, x: number, y: number, z: number, g: THREE.Object3D, seg = 40) {
  const s = new THREE.Mesh(G(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), m);
  s.position.set(x, y, z);
  s.castShadow = s.receiveShadow = true;
  g.add(s);
  return s;
}
function sph(r: number, m: THREE.Material, x: number, y: number, z: number, g: THREE.Object3D, sx = 1, sy = 1, sz = 1) {
  const s = new THREE.Mesh(G(`s${r}`, () => new THREE.IcosahedronGeometry(r, 2)), m);
  s.position.set(x, y, z);
  s.scale.set(sx, sy, sz);
  s.castShadow = true;
  g.add(s);
  return s;
}
function darker(hex: string, f: number): string {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return `#${c.getHexString()}`;
}

function chair(color: string, g: THREE.Object3D, x: number, z: number, rot: number) {
  const c = new THREE.Group();
  const m = mat(color, 0.7, 0);
  const d = mat("#2B2B2B", 0.4, 0.6);
  box(0.44, 0.05, 0.44, m, 0, 0.45, 0, c);
  box(0.42, 0.4, 0.04, m, 0, 0.7, -0.2, c);
  [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]].forEach(([px, pz]) => box(0.035, 0.45, 0.035, d, px!, 0.225, pz!, c));
  c.position.set(x, 0, z);
  c.rotation.y = rot;
  g.add(c);
}

const SHIRT = ["#2563EB", "#DC2626", "#059669", "#7C3AED", "#D97706", "#0EA5E9", "#DB2777", "#475569"];
const SKIN = ["#F1C9A5", "#D9A47A", "#B9805A", "#8D5A3B", "#F6D7BC"];
const HAIR = ["#2B1B12", "#4A2E1B", "#111111", "#8B6B3E", "#C9B27C"];
let personSeq = 0;
function person(g: THREE.Object3D, x: number, z: number, rot: number, seatY: number) {
  const i = personSeq++;
  const p = new THREE.Group();
  const sh = mat(SHIRT[i % 8]!, 0.85, 0);
  const sk = mat(SKIN[(i * 3 + 1) % 5]!, 0.7, 0);
  const pn = mat("#1F2937", 0.9, 0);
  const hr = mat(HAIR[(i * 2) % 5]!, 0.9, 0);
  const y = seatY + 0.06;
  box(0.3, 0.12, 0.4, pn, 0, y + 0.06, 0.06, p);
  [-0.09, 0.09].forEach((s) => box(0.11, 0.4, 0.11, pn, s, y - 0.16, 0.24, p));
  box(0.3, 0.5, 0.2, sh, 0, y + 0.4, -0.08, p);
  cyl(0.045, 0.045, 0.07, sk, 0, y + 0.68, -0.08, p, 10);
  sph(0.11, sk, 0, y + 0.8, -0.06, p, 1, 1.08, 1);
  sph(0.115, hr, 0, y + 0.84, -0.09, p, 1, 0.8, 1.02);
  [-0.17, 0.17].forEach((s) => {
    const a = box(0.08, 0.08, 0.34, sh, s, y + 0.5, 0.09, p);
    a.rotation.x = 0.25;
    box(0.07, 0.07, 0.07, sk, s, y + 0.46, 0.27, p);
  });
  p.position.set(x, 0, z);
  p.rotation.y = rot;
  g.add(p);
}

function buildSeats(t: SceneTable, g: THREE.Object3D) {
  const n = t.seats | 0;
  personSeq = 0;
  if (!n) return;
  const gap = 0.27;
  const seatPositions: { x: number; z: number; rot: number }[] = [];
  if (t.round) {
    const rx = t.width / 2 + gap, rz = t.depth / 2 + gap;
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n;
      const px = Math.sin(a) * rx, pz = Math.cos(a) * rz;
      seatPositions.push({ x: px, z: pz, rot: Math.atan2(-px, -pz) });
    }
  } else {
    const sq = Math.abs(t.width - t.depth) < 0.25 && n <= 4;
    if (sq) {
      ([[0, 1], [0, -1], [1, 0], [-1, 0]] as const).slice(0, n).forEach(([sx, sz]) => {
        const px = sx * (t.width / 2 + gap), pz = sz * (t.depth / 2 + gap);
        seatPositions.push({ x: px, z: pz, rot: Math.atan2(-px, -pz) });
      });
    } else {
      const ends = n >= 6 ? 2 : 0;
      const r = n - ends, fr = Math.ceil(r / 2), bk = Math.floor(r / 2);
      const row = (cnt: number, z: number) => {
        for (let i = 0; i < cnt; i++) {
          const px = -t.width / 2 + (i + 0.5) * (t.width / cnt), pz = z;
          seatPositions.push({ x: px, z: pz, rot: Math.atan2(-px, -pz) });
        }
      };
      row(fr, t.depth / 2 + gap);
      row(bk, -t.depth / 2 - gap);
      if (ends) {
        const px1 = t.width / 2 + gap, px2 = -t.width / 2 - gap;
        seatPositions.push({ x: px1, z: 0, rot: Math.atan2(-px1, 0) });
        seatPositions.push({ x: px2, z: 0, rot: Math.atan2(-px2, 0) });
      }
    }
  }
  seatPositions.forEach(({ x, z, rot }) => {
    chair(darker(t.color, 0.8), g, x, z, rot);
    if (t.status === "seated") person(g, x, z, rot, 0.45);
  });
}

function buildTableTop(t: SceneTable, g: THREE.Object3D) {
  const f = FINISH[t.finish];
  const tm = mat(t.color, f.roughness, f.metalness);
  const leg = mat("#2B2B2B", 0.35, 0.7);
  if (t.round) {
    const top = cyl(0.5, 0.5, 0.05, tm, 0, TABLE_HEIGHT - 0.025, 0, g);
    top.scale.set(t.width, 1, t.depth);
    cyl(0.04, 0.04, TABLE_HEIGHT - 0.05, leg, 0, (TABLE_HEIGHT - 0.05) / 2, 0, g, 16);
    const base = cyl(0.5, 0.5, 0.03, leg, 0, 0.015, 0, g);
    base.scale.set(t.width * 0.45, 1, t.depth * 0.45);
  } else {
    box(t.width, 0.05, t.depth, tm, 0, TABLE_HEIGHT - 0.025, 0, g);
    const lx = t.width / 2 - 0.1, lz = t.depth / 2 - 0.1;
    ([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).forEach(([sx, sz]) => box(0.05, TABLE_HEIGHT - 0.05, 0.05, leg, sx * lx, (TABLE_HEIGHT - 0.05) / 2, sz * lz, g));
  }
  buildSeats(t, g);
}

function labelTexture(t: SceneTable): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 320;
  c.height = 120;
  const x = c.getContext("2d")!;
  const color = STATUS_COLOR[t.status];
  function rr(a: number, b: number, w: number, h: number, r: number) {
    x.beginPath();
    x.moveTo(a + r, b);
    x.arcTo(a + w, b, a + w, b + h, r);
    x.arcTo(a + w, b + h, a, b + h, r);
    x.arcTo(a, b + h, a, b, r);
    x.arcTo(a, b, a + w, b, r);
    x.closePath();
  }
  x.shadowColor = "rgba(0,0,0,.35)";
  x.shadowBlur = 10;
  x.shadowOffsetY = 3;
  rr(20, 16, 260, 76, 22);
  x.fillStyle = color;
  x.fill();
  x.shadowColor = "transparent";
  x.fillStyle = "#fff";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.font = '700 30px "Plus Jakarta Sans",sans-serif';
  x.fillText(t.name, 150, 42);
  x.font = '600 22px "Plus Jakarta Sans",sans-serif';
  x.globalAlpha = 0.92;
  x.fillText(`${t.seats} seats`, 150, 72);
  x.globalAlpha = 1;
  if (t.reservationCount > 0) {
    x.beginPath();
    x.arc(272, 26, 22, 0, 7);
    x.fillStyle = "#fff";
    x.fill();
    x.lineWidth = 4;
    x.strokeStyle = color;
    x.stroke();
    x.fillStyle = "#0F172A";
    x.font = '800 26px "Plus Jakarta Sans",sans-serif';
    x.fillText(String(t.reservationCount), 272, 27);
  }
  return new THREE.CanvasTexture(c);
}

// ---------- floor texture ----------
let floorTexCache: THREE.CanvasTexture | null = null;
function floorTexture(): THREE.CanvasTexture {
  if (floorTexCache) return floorTexCache;
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const x = c.getContext("2d")!;
  const cols = ["#C9A57A", "#BF9B70", "#D1AE84", "#B8946A"];
  for (let i = 0; i < 8; i++) {
    x.fillStyle = cols[i % 4]!;
    x.fillRect(0, i * 64, 512, 64);
    for (let k = 0; k < 5; k++) {
      x.fillStyle = `rgba(90,60,30,${0.04 + Math.random() * 0.05})`;
      x.fillRect(Math.random() * 512, i * 64 + Math.random() * 60, 40 + Math.random() * 160, 1.5);
    }
    x.fillStyle = "rgba(60,40,20,.35)";
    x.fillRect(0, i * 64, 512, 1.5);
    x.fillRect((i * 137) % 512, i * 64, 1.5, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  floorTexCache = t;
  return t;
}

// ---------- camera state ----------
type CamState = { tx: number; tz: number; ty: number; dist: number; az: number; pol: number };
type CamGoal = Partial<CamState>;

export type SceneView = "3d" | "top" | "front";
export type SceneLight = "day" | "evening";

export function createFloorScene(canvas: HTMLCanvasElement, container: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);
  const hemi = new THREE.HemisphereLight("#ffffff", "#b9a98f", 0.7);
  scene.add(hemi);
  const dirL = new THREE.DirectionalLight("#ffffff", 1.1);
  dirL.castShadow = true;
  dirL.shadow.mapSize.set(2048, 2048);
  dirL.shadow.bias = -0.0004;
  dirL.shadow.normalBias = 0.03;
  dirL.shadow.radius = 3;
  scene.add(dirL);
  scene.add(dirL.target);

  const world = new THREE.Group();
  scene.add(world);
  const selectionGroup = new THREE.Group();
  scene.add(selectionGroup);

  let floorMesh: THREE.Group | null = null;
  const objGroups = new Map<string, THREE.Group>();
  const hits: THREE.Mesh[] = [];
  const tableById = new Map<string, SceneTable>();
  let floorW = 20, floorD = 14;
  let light: SceneLight = "day";
  let editable = false;
  let selectedId: string | null = null;
  const GRID = 0.25;
  let need = true;
  let D0 = 24;
  const cam: CamState = { tx: 0, tz: 0, ty: 0, dist: D0, az: 0, pol: 0.95 };
  let goal: CamGoal = {};

  function dirty() {
    need = true;
  }

  function fitD0() {
    const a = camera.aspect || 1.5;
    D0 = (Math.max(floorW / a, floorD * 1.25) / (2 * Math.tan((camera.fov * DEG) / 2))) * 1.02;
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fitD0();
    dirty();
  }

  function applyLight() {
    const ev = light === "evening";
    scene.background = new THREE.Color(ev ? "#161B2E" : "#C9D4E3");
    scene.fog = new THREE.Fog(ev ? "#161B2E" : "#C9D4E3", 80, 200);
    hemi.color.set(ev ? "#8FA4D8" : "#ffffff");
    hemi.groundColor.set(ev ? "#2A2230" : "#b9a98f");
    hemi.intensity = ev ? 0.26 : 0.72;
    dirL.color.set(ev ? "#FFB878" : "#FFFFFF");
    dirL.intensity = ev ? 0.4 : 1.1;
    dirL.position.set(ev ? -floorW * 0.5 : floorW * 0.45, ev ? 14 : Math.max(floorW, floorD) * 0.9, ev ? floorD * 0.8 : floorD * 0.55);
    dirL.target.position.set(0, 0, 0);
    renderer.toneMappingExposure = ev ? 1.25 : 1.05;
    dirty();
  }

  function buildRoom() {
    if (floorMesh) {
      scene.remove(floorMesh);
      floorMesh.traverse((m) => {
        if (m instanceof THREE.Mesh) m.geometry.dispose();
      });
    }
    floorMesh = new THREE.Group();
    const tex = floorTexture().clone();
    tex.needsUpdate = true;
    tex.repeat.set(floorW / 2.5, floorD / 2.5);
    const fl = new THREE.Mesh(
      new THREE.BoxGeometry(floorW, 0.2, floorD),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0 })
    );
    fl.position.y = -0.1;
    fl.receiveShadow = true;
    floorMesh.add(fl);
    const gr = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: "#7C8696", roughness: 1 })
    );
    gr.rotation.x = -Math.PI / 2;
    gr.position.y = -0.21;
    gr.receiveShadow = true;
    floorMesh.add(gr);
    scene.add(floorMesh);
    const s = Math.max(floorW, floorD) * 0.75;
    const c = dirL.shadow.camera as THREE.OrthographicCamera;
    c.left = -s; c.right = s; c.top = s; c.bottom = -s; c.near = 1; c.far = 80;
    c.updateProjectionMatrix();
    fitD0();
    applyLight();
    dirty();
  }

  function clearWorld() {
    objGroups.forEach((g) => {
      world.remove(g);
      g.traverse((m) => {
        const mm = m as THREE.Sprite;
        if (mm.isSprite) {
          (mm.material as THREE.SpriteMaterial).map?.dispose();
          mm.material.dispose();
        }
      });
    });
    objGroups.clear();
    hits.length = 0;
  }

  function buildTable(t: SceneTable) {
    const old = objGroups.get(t.id);
    if (old) {
      world.remove(old);
    }
    const g = new THREE.Group();
    const inner = new THREE.Group();
    g.add(inner);
    buildTableTop(t, inner);

    const hw = t.width + 0.7, hd = Math.max(t.depth, 0.3) + 0.7, hh = Math.max(TABLE_HEIGHT, 0.5);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(hw, hh, hd), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(0, hh / 2, 0);
    hit.userData.id = t.id;
    g.add(hit);
    hits.push(hit);

    const disc = new THREE.Mesh(
      G("disc", () => new THREE.CircleGeometry(0.5, 48)),
      new THREE.MeshBasicMaterial({ color: STATUS_COLOR[t.status], transparent: true, opacity: 0.3, depthWrite: false })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.012;
    disc.scale.set(t.width + 1, t.depth + 1, 1);
    inner.add(disc);

    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(t), depthTest: false, transparent: true, sizeAttenuation: false }));
    sp.scale.set(0.07, 0.0263, 1);
    sp.position.y = TABLE_HEIGHT + 0.7;
    sp.renderOrder = 20;
    g.add(sp);

    g.position.set(t.x, 0, t.z);
    g.rotation.y = -t.rotation * DEG;
    world.add(g);
    objGroups.set(t.id, g);
    dirty();
  }

  function setFloor(w: number, d: number) {
    floorW = w;
    floorD = d;
    buildRoom();
  }

  function setTables(tables: SceneTable[]) {
    clearWorld();
    tableById.clear();
    tables.forEach((t) => {
      tableById.set(t.id, t);
      buildTable(t);
    });
    updateSelection();
  }

  function clampToRoom(x: number, z: number): [number, number] {
    return [Math.max(-floorW / 2, Math.min(floorW / 2, x)), Math.max(-floorD / 2, Math.min(floorD / 2, z))];
  }
  function snap(v: number): number {
    return Math.round(v / GRID) * GRID;
  }

  function updateSelection() {
    while (selectionGroup.children.length) {
      const c = selectionGroup.children.pop()!;
      c.traverse((m) => {
        if (m instanceof THREE.Mesh || m instanceof THREE.LineSegments) m.geometry.dispose();
      });
    }
    const t = selectedId ? tableById.get(selectedId) : null;
    if (!t) {
      dirty();
      return;
    }
    const ac = new THREE.Color("#2B50E8");
    const lineMat = new THREE.LineBasicMaterial({ color: ac, depthTest: false, transparent: true });
    const holder = new THREE.Group();
    holder.position.set(t.x, 0, t.z);
    holder.rotation.y = -t.rotation * DEG;
    const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(t.width, 0.78, t.depth)), lineMat);
    box.position.y = 0.39;
    box.renderOrder = 30;
    holder.add(box);
    const fp = new THREE.Mesh(
      new THREE.PlaneGeometry(t.width, t.depth),
      new THREE.MeshBasicMaterial({ color: ac, transparent: true, opacity: 0.14, depthWrite: false })
    );
    fp.rotation.x = -Math.PI / 2;
    fp.position.y = 0.02;
    holder.add(fp);
    selectionGroup.add(holder);
    dirty();
  }

  function select(id: string | null) {
    selectedId = id;
    updateSelection();
  }

  function setEditable(v: boolean) {
    editable = v;
  }

  function camApply() {
    const sp = Math.sin(cam.pol);
    const x = cam.tx + cam.dist * sp * Math.sin(cam.az);
    const z = cam.tz + cam.dist * sp * Math.cos(cam.az);
    const y = cam.ty + cam.dist * Math.cos(cam.pol);
    camera.position.set(x, y, z);
    camera.lookAt(cam.tx, cam.ty, cam.tz);
  }

  function tweenTo(t: CamGoal) {
    goal = t;
    dirty();
  }

  function frame(v: SceneView) {
    const t: CamGoal = { tx: 0, tz: 0, ty: 0, az: 0, dist: D0, pol: 0.95 };
    if (v === "top") {
      t.pol = 0.001;
      t.dist = Math.max((Math.max(floorW / (camera.aspect || 1.6), floorD) * 1.05) / Math.tan(19 * DEG) / 2 * 1.12, floorD * 1.5);
    }
    if (v === "front") {
      t.pol = 1.38;
      t.dist = D0 * 0.95;
    }
    tweenTo(t);
  }

  function zoom(k: number) {
    tweenTo({ dist: Math.min(90, Math.max(2.5, (goal.dist ?? cam.dist) / k)) });
  }

  function zoomPct() {
    return Math.round((D0 / cam.dist) * 100);
  }

  function setLight(l: SceneLight) {
    light = l;
    applyLight();
  }

  // ---------- pointer interaction (orbit / pan / zoom / click / move) ----------
  const ray = new THREE.Raycaster();
  const V = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function ndc(clientX: number, clientY: number) {
    const r = canvas.getBoundingClientRect();
    V.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(V, camera);
  }
  function pickId(clientX: number, clientY: number): string | null {
    ndc(clientX, clientY);
    const h = ray.intersectObjects(hits, false);
    return h.length ? (h[0]!.object.userData.id as string) : null;
  }
  function groundPoint(clientX: number, clientY: number): THREE.Vector3 | null {
    ndc(clientX, clientY);
    const p = new THREE.Vector3();
    return ray.ray.intersectPlane(groundPlane, p) ? p : null;
  }

  let onPickCb: ((id: string | null) => void) | null = null;
  function onPick(cb: (id: string | null) => void) {
    onPickCb = cb;
  }
  let onMoveCb: ((id: string, x: number, z: number) => void) | null = null;
  function onMove(cb: (id: string, x: number, z: number) => void) {
    onMoveCb = cb;
  }

  function panBy(dx: number, dy: number) {
    const k = (cam.dist * Math.tan((camera.fov * DEG) / 2) * 2) / container.clientHeight;
    const sx = Math.sin(cam.az), cz = Math.cos(cam.az), ky = k / Math.max(0.3, Math.cos(cam.pol));
    cam.tx += -dx * k * cz - dy * ky * sx;
    cam.tz += dx * k * sx - dy * ky * cz;
  }

  const ptr = new Map<number, { x: number; y: number }>();
  let drag:
    | { mode: "orbit" | "pan"; sx: number; sy: number; lx: number; ly: number; moved: boolean }
    | { mode: "obj"; id: string; offX: number; offZ: number; sx: number; sy: number; moved: boolean }
    | null = null;

  function onPointerDown(e: PointerEvent) {
    canvas.setPointerCapture(e.pointerId);
    ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptr.size > 1) return;
    if (editable && e.button === 0 && !e.shiftKey) {
      const id = pickId(e.clientX, e.clientY);
      if (id) {
        const t = tableById.get(id)!;
        const gp = groundPoint(e.clientX, e.clientY);
        drag = { mode: "obj", id, offX: gp ? t.x - gp.x : 0, offZ: gp ? t.z - gp.z : 0, sx: e.clientX, sy: e.clientY, moved: false };
        return;
      }
    }
    const mode = e.button === 2 || (e.shiftKey && e.button === 0) ? "pan" : "orbit";
    drag = { mode, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, moved: false };
  }
  function onPointerMove(e: PointerEvent) {
    const p = ptr.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (!drag) return;
    if (drag.mode === "obj") {
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
      drag.moved = true;
      const gp = groundPoint(e.clientX, e.clientY);
      if (!gp) return;
      const [x, z] = clampToRoom(snap(gp.x + drag.offX), snap(gp.z + drag.offZ));
      const g = objGroups.get(drag.id);
      const t = tableById.get(drag.id);
      if (g && t) {
        g.position.set(x, 0, z);
        t.x = x;
        t.z = z;
        if (selectedId === drag.id) updateSelection();
        dirty();
      }
      return;
    }
    const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
    drag.moved = true;
    drag.lx = e.clientX;
    drag.ly = e.clientY;
    if (drag.mode === "orbit") {
      goal = {};
      cam.az -= dx * 0.0055;
      cam.pol = Math.min(1.5, Math.max(0.001, cam.pol - dy * 0.0055));
      dirty();
    } else {
      goal = {};
      panBy(dx, dy);
      dirty();
    }
  }
  function onPointerUp(e: PointerEvent) {
    ptr.delete(e.pointerId);
    if (drag && ptr.size === 0) {
      if (drag.mode === "obj") {
        const t = tableById.get(drag.id);
        if (t) {
          select(drag.id);
          onPickCb?.(drag.id);
          if (drag.moved) onMoveCb?.(drag.id, t.x, t.z);
        }
      } else if (!drag.moved) {
        const id = pickId(e.clientX, e.clientY);
        onPickCb?.(id);
      }
      drag = null;
    }
  }
  function onWheel(e: WheelEvent) {
    e.preventDefault();
    goal = {};
    const k = Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0012));
    cam.dist = Math.min(90, Math.max(2.5, cam.dist * k));
    dirty();
  }
  function onContextMenu(e: Event) {
    e.preventDefault();
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", onContextMenu);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  let raf = 0;
  function loop() {
    raf = requestAnimationFrame(loop);
    const keys = Object.keys(goal) as (keyof CamState)[];
    if (keys.length) {
      let done = true;
      for (const k of keys) {
        const d = goal[k]! - cam[k];
        if (Math.abs(d) > 0.0008) {
          cam[k] += d * 0.16;
          done = false;
        } else {
          cam[k] = goal[k]!;
          delete goal[k];
        }
      }
      if (!done) need = true;
    }
    if (!need) return;
    need = false;
    camApply();
    renderer.render(scene, camera);
  }

  resize();
  buildRoom();
  loop();

  function destroy() {
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("contextmenu", onContextMenu);
    clearWorld();
    select(null);
    renderer.dispose();
  }

  return {
    setFloor, setTables, onPick, onMove, select, setEditable,
    frame, zoom, zoomPct, setLight, resize, destroy,
  };
}
