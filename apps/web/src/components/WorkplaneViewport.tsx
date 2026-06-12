"use client";

import { Box, Check, ChevronDown, ChevronUp, Expand, Home, LockKeyhole, LockKeyholeOpen, Minus, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type DragEvent, type MutableRefObject, type PointerEvent as ReactPointerEvent, type SetStateAction } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { FontLoader, type Font, type FontData } from "three/examples/jsm/loaders/FontLoader.js";
import droidMonoFontJson from "three/examples/fonts/droid/droid_sans_mono_regular.typeface.json";
import droidSansBoldFontJson from "three/examples/fonts/droid/droid_sans_bold.typeface.json";
import droidSerifBoldFontJson from "three/examples/fonts/droid/droid_serif_bold.typeface.json";
import gentilisBoldFontJson from "three/examples/fonts/gentilis_bold.typeface.json";
import helvetikerBoldFontJson from "three/examples/fonts/helvetiker_bold.typeface.json";
import optimerBoldFontJson from "three/examples/fonts/optimer_bold.typeface.json";
import { ToolbarHideSelectedIcon } from "@/components/icons";
import type { AlignAxis, AlignHandleStatus, AlignTarget, GridSize, ShapeAsset, WorkplaneShape } from "@/types/sketchforge";

const gridSizes: GridSize[] = ["Off", "0.1 mm", "0.25 mm", "0.5 mm", "1.0 mm", "2.0 mm", "5.0 mm", "Brick"];
const WORKPLANE_WIDTH = 200;
const WORKPLANE_DEPTH = 140;
const MIN_WORKSPACE_SIZE = 60;
const MAX_WORKSPACE_SIZE = 2000;
const MIN_GRID_BLOCK_SIZE = 1;
const MAX_GRID_BLOCK_SIZE = 200;
const DEFAULT_WORKSPACE = {
  width: 200,
  depth: 200,
  sizePreset: "200 x 200 mm",
  gridBlockSize: 5,
  gridBlockPreset: "5 mm",
  background: "#f8fbfc",
  showShadows: true,
  showGrid: true,
  cruiseShapes: true,
  zoomSpeed: 5,
  units: "Metric (Default)",
  scale: "1:1 (millimeters)",
};
const workspaceSizePresets = [
  { label: "200 x 200 mm", width: 200, depth: 200 },
  { label: "300 x 300 mm", width: 300, depth: 300 },
  { label: "500 x 500 mm", width: 500, depth: 500 },
  { label: "1000 x 1000 mm", width: 1000, depth: 1000 },
  { label: "2000 x 2000 mm", width: 2000, depth: 2000 },
  { label: "Custom", width: 200, depth: 200 },
];
const gridBlockPresets = ["1 mm", "2.5 mm", "5 mm", "10 mm", "20 mm", "50 mm", "100 mm", "Custom"] as const;
const CAMERA_HOME = new THREE.Vector3(118, 96, 118);
const CAMERA_TARGET = new THREE.Vector3(0, 0, 0);
const MIN_SHAPE_SIZE = 0.01;
const MIN_ELEVATION = -180;
const MAX_ELEVATION = 220;
const CAMERA_MIN_TARGET_Y = -70;
const CAMERA_MAX_TARGET_Y = 120;
const solidColors = [
  "#d41721",
  "#ff4b4b",
  "#ff7a1a",
  "#d97813",
  "#f6a21a",
  "#f2cf10",
  "#f7e65a",
  "#a8d642",
  "#33983d",
  "#1fb66d",
  "#18b99a",
  "#0098c7",
  "#49c7ef",
  "#3b82f6",
  "#294c93",
  "#5b5ce2",
  "#6e2786",
  "#9b3bd2",
  "#c9009a",
  "#f062b6",
  "#8a5a2b",
  "#b98254",
  "#f2caa0",
  "#ffffff",
  "#cfd8df",
  "#8a98a6",
  "#4b5563",
  "#111111",
];
const textFontOptions = ["Multilanguage", "Sans", "Serif", "Script", "Monospace", "Rounded", "Stencil"];
const fontLoader = new FontLoader();
const textFonts: Record<string, Font> = {
  Multilanguage: fontLoader.parse(helvetikerBoldFontJson as FontData),
  Sans: fontLoader.parse(droidSansBoldFontJson as FontData),
  Serif: fontLoader.parse(droidSerifBoldFontJson as FontData),
  Script: fontLoader.parse(gentilisBoldFontJson as FontData),
  Monospace: fontLoader.parse(droidMonoFontJson as FontData),
  Rounded: fontLoader.parse(optimerBoldFontJson as FontData),
  Stencil: fontLoader.parse(helvetikerBoldFontJson as FontData),
};
const importedGeometryCache = new WeakMap<
  NonNullable<WorkplaneShape["importedMesh"]>,
  { geometry: THREE.BufferGeometry; edges: Map<number, THREE.EdgesGeometry> }
>();
const imageTextureLoader = new THREE.TextureLoader();
const IMPORTED_SELECTED_EDGE_TRIANGLE_LIMIT = 40000;

type WorkplaneViewportProps = {
  shapes: WorkplaneShape[];
  selectedIds: string[];
  alignMode: boolean;
  alignAnchorId: string | null;
  alignHandles: AlignHandleStatus[];
  alignReferenceShapes: WorkplaneShape[];
  mirrorMode: boolean;
  mirrorReferenceShapes: WorkplaneShape[];
  placementElevation: number;
  workplaneMode: boolean;
  onAddShape: (shape: ShapeAsset, point?: { x: number; z: number; elevation?: number }) => void;
  onAlignAnchorChange: (id: string) => void;
  onAlignPreview: (axis: AlignAxis, target: AlignTarget) => void;
  onAlignPreviewClear: () => void;
  onAlignSelection: (axis: AlignAxis, target: AlignTarget) => void;
  onMirrorPreview: (axis: AlignAxis) => void;
  onMirrorPreviewClear: () => void;
  onMirrorSelection: (axis: AlignAxis) => void;
  onSelectShape: (id: string | string[] | null, mode?: "replace" | "toggle") => void;
  onSetPlacementElevation: (elevation: number, source: "shape" | "base") => void;
  onInteractionActiveChange?: (active: boolean) => void;
  onUpdateShape: (id: string, patch: ShapeUpdatePatch) => void;
  onWorkplaneModeChange: (active: boolean) => void;
};

type WorkspaceSettings = typeof DEFAULT_WORKSPACE;

type ThreeState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  workplaneLayer: THREE.Group;
  shapeLayer: THREE.Group;
  helperLayer: THREE.Group;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  dragPlane: THREE.Plane;
  animationId: number;
  needsRender: boolean;
  wasCameraMoving: boolean;
  lastOverlaySync: number;
  lastViewCubeSync: number;
  rotationHandleSides: RotationHandleSides | null;
  disposeInteractionListeners: () => void;
  resize: () => void;
};

type ViewportPerfStats = {
  fps: number;
  frameMs: number;
  maxFrameMs: number;
  drawCalls: number;
  triangles: number;
  points: number;
  lines: number;
  shapeCount: number;
};

declare global {
  interface Window {
    sketchforgePerf?: {
      get: () => ViewportPerfStats;
    };
    sketchforgeCaptureCanvas?: () => string;
  }
}

type DragState = {
  primaryId: string;
  offsetX: number;
  offsetZ: number;
  planeY: number;
  pointerId: number;
  primaryStartX: number;
  primaryStartZ: number;
  items: DragItem[];
};

type MarqueeState = {
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  additive: boolean;
  hasMoved: boolean;
};

type TransformHandleKind = "scale" | "height" | "lift" | "rotate";
type RotationAxis = "x" | "y" | "z";
type RotationHandleSide = "near" | "right" | "far" | "left";
type RotationHandleSides = Record<RotationAxis, RotationHandleSide>;
type ShapeUpdatePatch = Partial<WorkplaneShape> & { bakeTransform?: boolean };
type ResizeSigns = { x: number; z: number };
type TransformDragState = {
  id: string;
  ids: string[];
  kind: TransformHandleKind;
  handleKey: string;
  rotationAxis: RotationAxis;
  pointerId: number;
  startShape: WorkplaneShape;
  items: TransformDragItem[];
  selectionFrame: SelectionFrame;
  startScreenAngle: number;
  startClientX: number;
  startClientY: number;
  startScreenY: number;
  startWorldY: number;
  handleWorldOffset: number;
  screenYPerWorldUnit: number;
  scalePlaneY: number;
  scalePlane?: THREE.Plane;
  scaleSigns?: ResizeSigns;
  scaleAnchorPoint?: THREE.Vector3;
  scaleStartPoint?: THREE.Vector3;
  rotationAxisVector?: THREE.Vector3;
  rotationPivot?: THREE.Vector3;
  rotationPlaneCenter?: THREE.Vector3;
  rotationStartVector?: THREE.Vector3;
  rotationScreenCenter?: { x: number; y: number };
  rotationScreenSign?: number;
  rotationStartQuaternion?: THREE.Quaternion;
  wheelCenter?: { x: number; y: number; radius: number };
  hasMoved?: boolean;
};

type TransformDragItem = {
  id: string;
  startShape: WorkplaneShape;
  startCenter: THREE.Vector3;
  startQuaternion: THREE.Quaternion;
};

type TransformOverlayState = {
  id: string;
  width: number;
  height: number;
  guides: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  handles: Array<{ key: string; className: string; kind: TransformHandleKind; x: number; y: number; title: string }>;
  rotateHandles: Array<{ key: string; className: string; x: number; y: number; angle: number }>;
  dimensions: Record<string, DimensionMark[]>;
  rotationWheel: { x: number; y: number; radius: number } | null;
  rotationWheels: Record<RotationAxis, { x: number; y: number; radius: number }>;
  rotationPlaneCenters: Record<RotationAxis, { x: number; y: number; z: number }>;
  rotationPlanes: Record<RotationAxis, RotationPlaneView>;
};

type AlignOverlayState = {
  guides: Array<{ key: string; x1: number; y1: number; x2: number; y2: number }>;
  handles: Array<AlignHandleStatus & { key: string; x: number; y: number }>;
};

type MirrorOverlayState = {
  guides: Array<{ key: string; x1: number; y1: number; x2: number; y2: number }>;
  handles: Array<{ axis: AlignAxis; key: string; x: number; y: number; angle: number; title: string }>;
};

type RotationPlaneView = {
  x: number;
  y: number;
  a: number;
  b: number;
  c: number;
  d: number;
};

type SelectionFrame = {
  ids: string[];
  center: THREE.Vector3;
  quaternion: THREE.Quaternion;
  xAxis: THREE.Vector3;
  yAxis: THREE.Vector3;
  zAxis: THREE.Vector3;
  width: number;
  height: number;
  depth: number;
  min: THREE.Vector3;
  max: THREE.Vector3;
  singleShape: WorkplaneShape | null;
};

type DimensionMark = {
  key: string;
  handleKey: string;
  axis: "width" | "depth" | "height" | "elevation";
  label: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  e1x1: number;
  e1y1: number;
  e1x2: number;
  e1y2: number;
  e2x1: number;
  e2y1: number;
  e2x2: number;
  e2y2: number;
  labelX: number;
  labelY: number;
};

type RotationReadout = {
  x: number;
  y: number;
  text: string;
  angle?: number;
} | null;

type EditingDimension = {
  key: string;
  axis: "width" | "depth" | "height" | "elevation";
  x: number;
  y: number;
  value: string;
} | null;

type EditingRotation = {
  axis: RotationAxis;
  handleKey: string;
  x: number;
  y: number;
  value: string;
} | null;

type DragItem = {
  id: string;
  startX: number;
  startZ: number;
  nextX: number;
  nextZ: number;
  visual: THREE.Object3D | null;
  helper: THREE.Box3Helper | null;
  helperBox: THREE.Box3 | null;
  hadPreviewSimplified: boolean;
};

function isVerticalMeasureHandleKind(kind: TransformHandleKind) {
  return kind === "height" || kind === "lift";
}

function getElevationMeasureKey(overlay: TransformOverlayState | null) {
  return (
    Object.values(overlay?.dimensions ?? {})
      .flat()
      .find((mark) => mark.axis === "elevation")?.handleKey ?? null
  );
}

function measureKeyForHandle(kind: TransformHandleKind, handleKey: string, overlay: TransformOverlayState | null) {
  if (kind === "lift") {
    return getElevationMeasureKey(overlay) ?? handleKey;
  }
  return handleKey;
}

function previewShapesForDrag(shapes: WorkplaneShape[], drag: DragState | null) {
  if (!drag) {
    return shapes;
  }
  const previewById = new Map(drag.items.map((item) => [item.id, item]));
  return shapes.map((shape) => {
    const preview = previewById.get(shape.id);
    return preview ? { ...shape, x: preview.nextX, z: preview.nextZ } : shape;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function snapStep(size: GridSize) {
  if (size === "Off") {
    return 0;
  }
  if (size === "Brick") {
    return 8;
  }
  return Number.parseFloat(size) || 1;
}

function snapValue(value: number, step: number) {
  return step > 0 ? Math.round(value / step) * step : value;
}

function snapDimension(value: number, step: number, min = MIN_SHAPE_SIZE, max = 220) {
  const snapped = step > 0 ? snapValue(value, step) : value;
  const effectiveMin = step > 0 ? Math.max(min, Math.min(step, max)) : min;
  return clamp(snapped, effectiveMin, max);
}

function snapPositionValue(value: number, step: number, min: number, max: number) {
  return clamp(step > 0 ? snapValue(value, step) : value, min, max);
}

function gridBlockSizeForPreset(preset: string, fallback: number) {
  if (preset === "Custom") {
    return clamp(fallback, MIN_GRID_BLOCK_SIZE, MAX_GRID_BLOCK_SIZE);
  }
  return clamp(Number.parseFloat(preset) || DEFAULT_WORKSPACE.gridBlockSize, MIN_GRID_BLOCK_SIZE, MAX_GRID_BLOCK_SIZE);
}

function projectedScreenY(state: ThreeState, shape: WorkplaneShape, y: number) {
  return projectedScreenYAt(state, shape.x, shape.z, y);
}

function projectedScreenYAt(state: ThreeState, x: number, z: number, y: number) {
  const rect = state.renderer.domElement.getBoundingClientRect();
  state.camera.updateMatrixWorld();
  const projected = new THREE.Vector3(x, y, z).project(state.camera);
  return ((1 - projected.y) / 2) * rect.height;
}

function projectedScreenYPerWorldUnit(state: ThreeState, shape: WorkplaneShape, y: number) {
  return projectedScreenYPerWorldUnitAt(state, shape.x, shape.z, y);
}

function projectedScreenYPerWorldUnitAt(state: ThreeState, x: number, z: number, y: number) {
  const sample = 8;
  const start = projectedScreenYAt(state, x, z, y);
  const end = projectedScreenYAt(state, x, z, y + sample);
  const slope = (end - start) / sample;
  return Math.abs(slope) > 0.01 ? slope : -3.2;
}

function screenAngle(clientX: number, clientY: number, center: { x: number; y: number }) {
  return Math.atan2(clientY - center.y, clientX - center.x);
}

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function cleanRotationDegrees(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const normalized = normalizeDegrees(value);
  const rounded = Number(normalized.toFixed(1));
  return rounded < 0.5 || rounded >= 359.5 || Object.is(rounded, -0) ? 0 : rounded;
}

function unwrapRadians(value: number) {
  if (value > Math.PI) {
    return value - Math.PI * 2;
  }
  if (value < -Math.PI) {
    return value + Math.PI * 2;
  }
  return value;
}

function rotationAxisForHandle(handleKey: string): RotationAxis {
  if (handleKey.endsWith("-x") || handleKey === "rotate-left") {
    return "x";
  }
  if (handleKey.endsWith("-z") || handleKey === "rotate-right") {
    return "z";
  }
  return "y";
}

function rotationValueForAxis(shape: WorkplaneShape, axis: RotationAxis) {
  if (axis === "x") {
    return shape.rotationX ?? 0;
  }
  if (axis === "z") {
    return shape.rotationZ ?? 0;
  }
  return shape.rotation;
}

function rotationPatchForAxis(axis: RotationAxis, value: number): Partial<WorkplaneShape> {
  const normalized = cleanRotationDegrees(value);
  if (axis === "x") {
    return { rotationX: normalized };
  }
  if (axis === "z") {
    return { rotationZ: normalized };
  }
  return { rotation: normalized };
}

function rotationAxisVector(axis: RotationAxis) {
  if (axis === "x") {
    return new THREE.Vector3(1, 0, 0);
  }
  if (axis === "z") {
    return new THREE.Vector3(0, 0, 1);
  }
  return new THREE.Vector3(0, 1, 0);
}

function quaternionForShape(shape: WorkplaneShape) {
  return new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      THREE.MathUtils.degToRad(shape.rotationX ?? 0),
      THREE.MathUtils.degToRad(shape.rotation),
      THREE.MathUtils.degToRad(shape.rotationZ ?? 0),
      "XYZ",
    ),
  );
}

function rotationPatchFromQuaternion(quaternion: THREE.Quaternion): Partial<WorkplaneShape> {
  const euler = new THREE.Euler().setFromQuaternion(quaternion, "XYZ");
  return {
    rotationX: cleanRotationDegrees(THREE.MathUtils.radToDeg(euler.x)),
    rotation: cleanRotationDegrees(THREE.MathUtils.radToDeg(euler.y)),
    rotationZ: cleanRotationDegrees(THREE.MathUtils.radToDeg(euler.z)),
  };
}

function shouldPreserveDrawingBufferForLocalAutomation() {
  return typeof window !== "undefined";
}

function rotationScreenSign(axisVector: THREE.Vector3, camera: THREE.Camera) {
  const cameraForward = camera.getWorldDirection(new THREE.Vector3());
  return axisVector.dot(cameraForward) >= 0 ? 1 : -1;
}

function projectToScreen(point: THREE.Vector3, state: ThreeState) {
  const rect = state.renderer.domElement.getBoundingClientRect();
  state.camera.updateMatrixWorld();
  const projected = point.clone().project(state.camera);
  return {
    x: ((projected.x + 1) / 2) * rect.width,
    y: ((1 - projected.y) / 2) * rect.height,
  };
}

function shapeCenter(shape: WorkplaneShape) {
  return new THREE.Vector3(shape.x, (shape.elevation ?? 0) + shape.height / 2, shape.z);
}

function shapeLocalExtents(shape: WorkplaneShape) {
  return {
    x: shapeWidth(shape) / 2,
    y: shape.height / 2,
    z: shapeDepth(shape) / 2,
  };
}

function selectionFrameForShapes(shapes: WorkplaneShape[], selectedIds: string[]): SelectionFrame | null {
  const selected = selectedIds.map((id) => shapes.find((shape) => shape.id === id)).filter((shape): shape is WorkplaneShape => Boolean(shape && !shape.hidden));
  if (selected.length === 0) {
    return null;
  }

  const singleShape = selected.length === 1 ? selected[0] : null;
  const quaternion = singleShape ? quaternionForShape(singleShape) : new THREE.Quaternion();
  const inverse = quaternion.clone().invert();
  const localMin = new THREE.Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  const localMax = new THREE.Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
  const origin = singleShape ? shapeCenter(singleShape) : new THREE.Vector3();

  if (!singleShape) {
    selected.forEach((shape) => origin.add(shapeCenter(shape)));
    origin.multiplyScalar(1 / selected.length);
  }

  selected.forEach((shape) => {
    const center = shapeCenter(shape);
    const extents = shapeLocalExtents(shape);
    const shapeQuaternion = quaternionForShape(shape);
    [-1, 1].forEach((xSign) => {
      [-1, 1].forEach((ySign) => {
        [-1, 1].forEach((zSign) => {
          const point = new THREE.Vector3(xSign * extents.x, ySign * extents.y, zSign * extents.z).applyQuaternion(shapeQuaternion).add(center);
          const local = point.sub(origin).applyQuaternion(inverse);
          localMin.min(local);
          localMax.max(local);
        });
      });
    });
  });

  const localCenter = localMin.clone().add(localMax).multiplyScalar(0.5);
  const center = origin.clone().add(localCenter.clone().applyQuaternion(quaternion));
  const width = Math.max(MIN_SHAPE_SIZE, localMax.x - localMin.x);
  const height = Math.max(MIN_SHAPE_SIZE, localMax.y - localMin.y);
  const depth = Math.max(MIN_SHAPE_SIZE, localMax.z - localMin.z);
  const xAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion).normalize();
  const yAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion).normalize();
  const zAxis = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion).normalize();

  return {
    ids: selected.map((shape) => shape.id),
    center,
    quaternion,
    xAxis,
    yAxis,
    zAxis,
    width,
    height,
    depth,
    min: new THREE.Vector3(-width / 2, -height / 2, -depth / 2),
    max: new THREE.Vector3(width / 2, height / 2, depth / 2),
    singleShape,
  };
}

function framePoint(frame: SelectionFrame, x: number, y: number, z: number) {
  return frame.center
    .clone()
    .add(frame.xAxis.clone().multiplyScalar(x))
    .add(frame.yAxis.clone().multiplyScalar(y))
    .add(frame.zAxis.clone().multiplyScalar(z));
}

function frameLocalPoint(frame: SelectionFrame, point: THREE.Vector3) {
  const offset = point.clone().sub(frame.center);
  return new THREE.Vector3(offset.dot(frame.xAxis), offset.dot(frame.yAxis), offset.dot(frame.zAxis));
}

function frameLocalDelta(frame: SelectionFrame, start: THREE.Vector3, current: THREE.Vector3) {
  const offset = current.clone().sub(start);
  return new THREE.Vector3(offset.dot(frame.xAxis), offset.dot(frame.yAxis), offset.dot(frame.zAxis));
}

function selectionFrameCorners(frame: SelectionFrame) {
  const corners: THREE.Vector3[] = [];
  [-1, 1].forEach((xSign) => {
    [-1, 1].forEach((ySign) => {
      [-1, 1].forEach((zSign) => {
        corners.push(framePoint(frame, (xSign * frame.width) / 2, (ySign * frame.height) / 2, (zSign * frame.depth) / 2));
      });
    });
  });
  return corners;
}

function cleanNearZero(value: number, epsilon = 0.005) {
  return Math.abs(value) < epsilon ? 0 : value;
}

function selectionWorldYBounds(frame: SelectionFrame) {
  const corners = selectionFrameCorners(frame);
  const min = cleanNearZero(Math.min(...corners.map((corner) => corner.y)));
  const max = cleanNearZero(Math.max(...corners.map((corner) => corner.y)));
  return { min, max, height: Math.max(MIN_SHAPE_SIZE, max - min) };
}

function localResizePlaneForFrame(frame: SelectionFrame) {
  return new THREE.Plane().setFromNormalAndCoplanarPoint(
    frame.yAxis.clone().normalize(),
    framePoint(frame, 0, frame.min.y, 0),
  );
}

function resizeSignsForHandle(handleKey: string): ResizeSigns {
  const key = handleKey.toLowerCase();
  return {
    x: key.includes("right") ? 1 : key.includes("left") ? -1 : 0,
    z: key.includes("near") ? 1 : key.includes("far") ? -1 : 0,
  };
}

function resizeAnchorPointForFrame(frame: SelectionFrame, signs: ResizeSigns) {
  return framePoint(
    frame,
    signs.x ? (-signs.x * frame.width) / 2 : 0,
    frame.min.y,
    signs.z ? (-signs.z * frame.depth) / 2 : 0,
  );
}

function resizeCenterFromAnchor(frame: SelectionFrame, anchor: THREE.Vector3, signs: ResizeSigns, width: number, depth: number) {
  return anchor
    .clone()
    .add(frame.yAxis.clone().multiplyScalar(frame.height / 2))
    .add(frame.xAxis.clone().multiplyScalar(signs.x ? (signs.x * width) / 2 : 0))
    .add(frame.zAxis.clone().multiplyScalar(signs.z ? (signs.z * depth) / 2 : 0));
}

function shapeScreenBounds(state: ThreeState, shape: WorkplaneShape) {
  const frame = selectionFrameForShapes([shape], [shape.id]);
  if (!frame) {
    return null;
  }
  const points = selectionFrameCorners(frame).map((corner) => projectToScreen(corner, state));
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function boundsIntersectRect(bounds: NonNullable<ReturnType<typeof shapeScreenBounds>>, rect: { left: number; top: number; right: number; bottom: number }) {
  return bounds.maxX >= rect.left && bounds.minX <= rect.right && bounds.maxY >= rect.top && bounds.minY <= rect.bottom;
}

function rotationAxisVectorForFrame(handleKey: string, frame: SelectionFrame) {
  const axis = rotationAxisForHandle(handleKey);
  void frame;
  return rotationAxisVector(axis);
}

function rayPointOnRotationPlane(state: ThreeState, clientX: number, clientY: number, pivot: THREE.Vector3, axis: THREE.Vector3) {
  const rect = state.renderer.domElement.getBoundingClientRect();
  state.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  state.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  state.raycaster.setFromCamera(state.pointer, state.camera);
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(axis.clone().normalize(), pivot);
  return state.raycaster.ray.intersectPlane(plane, new THREE.Vector3());
}

function signedAngleAroundAxis(start: THREE.Vector3, current: THREE.Vector3, axis: THREE.Vector3) {
  const a = start.clone().normalize();
  const b = current.clone().normalize();
  return Math.atan2(axis.clone().normalize().dot(a.clone().cross(b)), clamp(a.dot(b), -1, 1));
}

const ROTATION_HANDLE_SIDE_HYSTERESIS = 0.22;
const ROTATION_HANDLE_DOMINANCE_HYSTERESIS = 0.18;
const ROTATION_UPPER_HANDLE_ICON_ANGLE = 0;
const ROTATION_BOTTOM_HANDLE_ICON_ANGLE = 0;

function signedRotationSide(value: number, previous: RotationHandleSide | undefined, positiveSide: RotationHandleSide, negativeSide: RotationHandleSide) {
  if (previous === positiveSide && value > -ROTATION_HANDLE_SIDE_HYSTERESIS) {
    return previous;
  }
  if (previous === negativeSide && value < ROTATION_HANDLE_SIDE_HYSTERESIS) {
    return previous;
  }
  return value >= 0 ? positiveSide : negativeSide;
}

function rotationSideScore(side: RotationHandleSide, viewX: number, viewZ: number) {
  if (side === "right") {
    return viewX;
  }
  if (side === "left") {
    return -viewX;
  }
  if (side === "near") {
    return viewZ;
  }
  return -viewZ;
}

function dominantRotationSide(viewX: number, viewZ: number, previous: RotationHandleSide | undefined) {
  const sides: RotationHandleSide[] = ["near", "right", "far", "left"];
  const best = sides.reduce(
    (current, side) => {
      const score = rotationSideScore(side, viewX, viewZ);
      return score > current.score ? { side, score } : current;
    },
    { side: "near" as RotationHandleSide, score: Number.NEGATIVE_INFINITY },
  );

  if (previous && rotationSideScore(previous, viewX, viewZ) >= best.score - ROTATION_HANDLE_DOMINANCE_HYSTERESIS) {
    return previous;
  }
  return best.side;
}

function rotationHandleSidesForCamera(state: ThreeState, center: THREE.Vector3) {
  const view = state.camera.position.clone().sub(center);
  view.y = 0;
  const length = view.length();
  if (length < 0.0001) {
    return state.rotationHandleSides ?? { x: "right", y: "near", z: "near" };
  }

  const viewX = view.x / length;
  const viewZ = view.z / length;
  const previous = state.rotationHandleSides ?? undefined;
  const next: RotationHandleSides = {
    x: signedRotationSide(viewX, previous?.x, "right", "left"),
    y: dominantRotationSide(viewX, viewZ, previous?.y),
    z: signedRotationSide(viewZ, previous?.z, "near", "far"),
  };
  state.rotationHandleSides = next;
  return next;
}

function projectedWorldYForScreenY(state: ThreeState, shape: WorkplaneShape, targetScreenY: number, startWorldY: number) {
  let nextWorldY = startWorldY;
  for (let index = 0; index < 8; index += 1) {
    const currentScreenY = projectedScreenY(state, shape, nextWorldY);
    const screenSlope = projectedScreenYPerWorldUnit(state, shape, nextWorldY);
    if (Math.abs(screenSlope) < 0.01) {
      break;
    }
    nextWorldY = clamp(nextWorldY - (currentScreenY - targetScreenY) / screenSlope, MIN_ELEVATION - 80, MAX_ELEVATION + 80);
  }
  return nextWorldY;
}

function patchWithPreservedWorldBottom(shape: WorkplaneShape, patch: Partial<WorkplaneShape>) {
  const startFrame = selectionFrameForShapes([shape], [shape.id]);
  if (!startFrame) {
    return patch;
  }
  const startBounds = selectionWorldYBounds(startFrame);
  const draftShape = { ...shape, ...patch };
  const draftFrame = selectionFrameForShapes([draftShape], [shape.id]);
  if (!draftFrame) {
    return patch;
  }
  const draftBounds = selectionWorldYBounds(draftFrame);
  return {
    ...patch,
    elevation: cleanNearZero(clamp((draftShape.elevation ?? 0) + startBounds.min - draftBounds.min, MIN_ELEVATION, MAX_ELEVATION), 0.0005),
  };
}

function resizeShapeFromFrameHandle(
  transform: TransformDragState,
  point: THREE.Vector3,
  handleKey: string,
  shiftKey: boolean,
  altKey: boolean,
  step: number,
): Partial<WorkplaneShape> {
  const shape = transform.startShape;
  const frame = transform.selectionFrame;
  const width = frame.width;
  const depth = frame.depth;
  const localDelta = transform.scaleStartPoint ? frameLocalDelta(frame, transform.scaleStartPoint, point) : new THREE.Vector3();

  const signs = transform.scaleSigns ?? resizeSignsForHandle(handleKey);
  const maxSize = 220;

  const axisResize = (current: number, delta: number, sign: number) => {
    if (!sign) {
      return current;
    }
    const signedDelta = sign * delta;
    if (altKey) {
      return snapDimension(current + signedDelta * 2, step, MIN_SHAPE_SIZE, maxSize);
    }
    return snapDimension(current + signedDelta, step, MIN_SHAPE_SIZE, maxSize);
  };

  let nextWidth = axisResize(width, localDelta.x, signs.x);
  let nextDepth = axisResize(depth, localDelta.z, signs.z);

  if (shiftKey && signs.x && signs.z) {
    const uniform = Math.max(nextWidth, nextDepth);
    nextWidth = uniform;
    nextDepth = uniform;
  }

  const nextCenter = altKey
    ? frame.center.clone()
    : resizeCenterFromAnchor(frame, transform.scaleAnchorPoint ?? resizeAnchorPointForFrame(frame, signs), signs, nextWidth, nextDepth);
  return {
    x: nextCenter.x,
    z: nextCenter.z,
    elevation: cleanNearZero(nextCenter.y - shape.height / 2, 0.0005),
    width: nextWidth,
    depth: nextDepth,
    size: (nextWidth + nextDepth) / 2,
  };
}

function resizeSelectionFromHandle(
  transform: TransformDragState,
  point: THREE.Vector3,
  handleKey: string,
  shiftKey: boolean,
  altKey: boolean,
  step: number,
) {
  const frame = transform.selectionFrame;
  const localDelta = transform.scaleStartPoint ? frameLocalDelta(frame, transform.scaleStartPoint, point) : new THREE.Vector3();
  const signs = transform.scaleSigns ?? resizeSignsForHandle(handleKey);
  const axisResize = (current: number, delta: number, sign: number) => {
    if (!sign) {
      return { size: current, scale: 1 };
    }
    const signedDelta = sign * delta;
    if (altKey) {
      const size = snapDimension(current + signedDelta * 2, step, MIN_SHAPE_SIZE, 260);
      return { size, scale: size / Math.max(MIN_SHAPE_SIZE, current) };
    }
    const rawSize = current + signedDelta;
    const size = snapDimension(rawSize, step, MIN_SHAPE_SIZE, 260);
    return {
      size,
      scale: size / Math.max(MIN_SHAPE_SIZE, current),
    };
  };

  let nextX = axisResize(frame.width, localDelta.x, signs.x);
  let nextZ = axisResize(frame.depth, localDelta.z, signs.z);
  if (shiftKey && signs.x && signs.z) {
    const uniform = Math.max(nextX.size, nextZ.size);
    nextX = {
      size: uniform,
      scale: uniform / Math.max(MIN_SHAPE_SIZE, frame.width),
    };
    nextZ = {
      size: uniform,
      scale: uniform / Math.max(MIN_SHAPE_SIZE, frame.depth),
    };
  }

  const nextCenter = altKey
    ? frame.center.clone()
    : resizeCenterFromAnchor(frame, transform.scaleAnchorPoint ?? resizeAnchorPointForFrame(frame, signs), signs, nextX.size, nextZ.size);

  return transform.items.map((item) => {
    const localCenter = frameLocalPoint(frame, item.startCenter);
    const nextItemCenter = nextCenter
      .clone()
      .add(frame.xAxis.clone().multiplyScalar(localCenter.x * nextX.scale))
      .add(frame.yAxis.clone().multiplyScalar(localCenter.y))
      .add(frame.zAxis.clone().multiplyScalar(localCenter.z * nextZ.scale));
    const width = snapDimension(shapeWidth(item.startShape) * nextX.scale, step, MIN_SHAPE_SIZE, 260);
    const depth = snapDimension(shapeDepth(item.startShape) * nextZ.scale, step, MIN_SHAPE_SIZE, 260);
    const patch = {
      x: nextItemCenter.x,
      z: nextItemCenter.z,
      elevation: cleanNearZero(nextItemCenter.y - item.startShape.height / 2, 0.0005),
      width,
      depth,
      size: (width + depth) / 2,
    } satisfies Partial<WorkplaneShape>;
    return {
      id: item.id,
      patch,
    };
  });
}

export function WorkplaneViewport({
  shapes,
  selectedIds,
  alignMode,
  alignAnchorId,
  alignHandles,
  alignReferenceShapes,
  mirrorMode,
  mirrorReferenceShapes,
  placementElevation,
  workplaneMode,
  onAddShape,
  onAlignAnchorChange,
  onAlignPreview,
  onAlignPreviewClear,
  onAlignSelection,
  onMirrorPreview,
  onMirrorPreviewClear,
  onMirrorSelection,
  onSelectShape,
  onSetPlacementElevation,
  onInteractionActiveChange,
  onUpdateShape,
  onWorkplaneModeChange,
}: WorkplaneViewportProps) {
  const [snapOpen, setSnapOpen] = useState(false);
  const [snap, setSnap] = useState<GridSize>("1.0 mm");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceSettings>(DEFAULT_WORKSPACE);
  const [transformOverlay, setTransformOverlay] = useState<TransformOverlayState | null>(null);
  const [alignOverlay, setAlignOverlay] = useState<AlignOverlayState | null>(null);
  const [mirrorOverlay, setMirrorOverlay] = useState<MirrorOverlayState | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [hoverMeasureKey, setHoverMeasureKey] = useState<string | null>(null);
  const [pinnedMeasureKey, setPinnedMeasureKey] = useState<string | null>(null);
  const [rotationReadout, setRotationReadout] = useState<RotationReadout>(null);
  const [activeRotationWheel, setActiveRotationWheel] = useState(false);
  const [activeTransformKind, setActiveTransformKind] = useState<TransformHandleKind | null>(null);
  const [rotationWheelAxis, setRotationWheelAxis] = useState<RotationAxis>("y");
  const [editingDimension, setEditingDimension] = useState<EditingDimension>(null);
  const [editingRotation, setEditingRotation] = useState<EditingRotation>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const threeRef = useRef<ThreeState | null>(null);
  const shapesRef = useRef(shapes);
  const alignReferenceShapesRef = useRef(alignReferenceShapes);
  const mirrorReferenceShapesRef = useRef(mirrorReferenceShapes);
  const selectedIdsRef = useRef(selectedIds);
  const dragRef = useRef<DragState | null>(null);
  const marqueeRef = useRef<MarqueeState | null>(null);
  const transformRef = useRef<TransformDragState | null>(null);
  const suppressNextLiftEditRef = useRef(false);
  const snapRef = useRef(snap);
  const workspaceRef = useRef(workspace);
  const viewCubeRef = useRef<HTMLDivElement | null>(null);
  const transformOverlayRef = useRef<TransformOverlayState | null>(null);
  const alignOverlayRef = useRef<AlignOverlayState | null>(null);
  const mirrorOverlayRef = useRef<MirrorOverlayState | null>(null);
  const alignModeRef = useRef(alignMode);
  const alignAnchorIdRef = useRef(alignAnchorId);
  const alignHandlesRef = useRef(alignHandles);
  const mirrorModeRef = useRef(mirrorMode);
  const selectedIdsKeyRef = useRef(selectedIds.join("|"));
  const perfRef = useRef({
    fps: 0,
    frameMs: 0,
    maxFrameMs: 0,
    frames: 0,
    lastSample: 0,
  });

  const selectedShape = useMemo(() => (selectedIds.length === 1 ? shapes.find((shape) => shape.id === selectedIds[0]) ?? null : null), [selectedIds, shapes]);

  const placementElevationRef = useRef(placementElevation);
  const workplaneModeRef = useRef(workplaneMode);

  useEffect(() => {
    const openWorkspaceSettings = () => setSettingsOpen(true);
    window.addEventListener("sketchforge:open-workspace-settings", openWorkspaceSettings);
    return () => window.removeEventListener("sketchforge:open-workspace-settings", openWorkspaceSettings);
  }, []);

  useEffect(() => {
    shapesRef.current = shapes;
    rebuildShapes(threeRef.current, shapes, selectedIdsRef.current);
    if (threeRef.current) {
      syncTransformOverlay(threeRef.current, shapes, selectedIdsRef.current, transformOverlayRef, setTransformOverlay, Boolean(transformRef.current || dragRef.current));
      syncAlignOverlay(threeRef.current, alignReferenceShapesRef.current, selectedIdsRef.current, alignModeRef.current, alignAnchorIdRef.current, alignHandlesRef.current, alignOverlayRef, setAlignOverlay);
      syncMirrorOverlay(threeRef.current, mirrorReferenceShapesRef.current, selectedIdsRef.current, mirrorModeRef.current, mirrorOverlayRef, setMirrorOverlay);
      threeRef.current.needsRender = true;
    }
  }, [shapes]);

  useEffect(() => {
    alignReferenceShapesRef.current = alignReferenceShapes;
    if (threeRef.current) {
      syncAlignOverlay(threeRef.current, alignReferenceShapes, selectedIdsRef.current, alignModeRef.current, alignAnchorIdRef.current, alignHandlesRef.current, alignOverlayRef, setAlignOverlay);
      threeRef.current.needsRender = true;
    }
  }, [alignReferenceShapes]);

  useEffect(() => {
    mirrorReferenceShapesRef.current = mirrorReferenceShapes;
    if (threeRef.current) {
      syncMirrorOverlay(threeRef.current, mirrorReferenceShapes, selectedIdsRef.current, mirrorModeRef.current, mirrorOverlayRef, setMirrorOverlay);
      threeRef.current.needsRender = true;
    }
  }, [mirrorReferenceShapes]);

  useEffect(() => {
    const nextSelectedIdsKey = selectedIds.join("|");
    if (nextSelectedIdsKey !== selectedIdsKeyRef.current) {
      selectedIdsKeyRef.current = nextSelectedIdsKey;
      setHoverMeasureKey(null);
      setPinnedMeasureKey(null);
      setEditingDimension(null);
      setEditingRotation(null);
      setRotationReadout(null);
      setActiveRotationWheel(false);
      setActiveTransformKind(null);
    }
    selectedIdsRef.current = selectedIds;
    rebuildShapes(threeRef.current, shapesRef.current, selectedIds);
    if (threeRef.current) {
      syncTransformOverlay(threeRef.current, shapesRef.current, selectedIds, transformOverlayRef, setTransformOverlay, Boolean(transformRef.current || dragRef.current));
      syncAlignOverlay(threeRef.current, alignReferenceShapesRef.current, selectedIds, alignModeRef.current, alignAnchorIdRef.current, alignHandlesRef.current, alignOverlayRef, setAlignOverlay);
      syncMirrorOverlay(threeRef.current, mirrorReferenceShapesRef.current, selectedIds, mirrorModeRef.current, mirrorOverlayRef, setMirrorOverlay);
      threeRef.current.needsRender = true;
    }
  }, [selectedIds]);

  useEffect(() => {
    alignModeRef.current = alignMode;
    alignAnchorIdRef.current = alignAnchorId;
    alignHandlesRef.current = alignHandles;
    if (threeRef.current) {
      syncAlignOverlay(threeRef.current, alignReferenceShapesRef.current, selectedIdsRef.current, alignMode, alignAnchorId, alignHandles, alignOverlayRef, setAlignOverlay);
      threeRef.current.needsRender = true;
    }
  }, [alignAnchorId, alignHandles, alignMode]);

  useEffect(() => {
    mirrorModeRef.current = mirrorMode;
    if (threeRef.current) {
      syncMirrorOverlay(threeRef.current, mirrorReferenceShapesRef.current, selectedIdsRef.current, mirrorMode, mirrorOverlayRef, setMirrorOverlay);
      threeRef.current.needsRender = true;
    }
  }, [mirrorMode]);

  useEffect(() => {
    snapRef.current = snap;
  }, [snap]);

  useEffect(() => {
    placementElevationRef.current = placementElevation;
  }, [placementElevation]);

  useEffect(() => {
    workplaneModeRef.current = workplaneMode;
  }, [workplaneMode]);

  useEffect(() => {
    workspaceRef.current = workspace;
    rebuildWorkplane(threeRef.current, workspace);
    if (threeRef.current) {
      threeRef.current.needsRender = true;
    }
  }, [workspace]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const state = createThreeScene(host);
    threeRef.current = state;
    window.sketchforgeCaptureCanvas = () => {
      state.camera.updateMatrixWorld();
      state.renderer.render(state.scene, state.camera);
      return state.renderer.domElement.toDataURL("image/png");
    };
    perfRef.current.lastSample = performance.now();
    resetCamera(state);
    rebuildShapes(state, shapesRef.current, selectedIdsRef.current);

    const animate = () => {
      state.animationId = window.requestAnimationFrame(animate);
      const now = performance.now();
      const controlsChanged = state.controls.update();
      const cameraSettled = state.wasCameraMoving && !controlsChanged;
      if (!controlsChanged && !state.needsRender && !cameraSettled) {
        return;
      }
      constrainCamera(state, workspaceRef.current);
      // Future edits: keep this before any view cube or transform-overlay projection.
      // OrbitControls changes camera position/quaternion, but manual Vector3.project()
      // can read the previous matrix unless we force the matrix world current here.
      // Removing this brings back the one-frame-late handle/line lag during camera motion.
      state.camera.updateMatrixWorld();
      if (now - state.lastViewCubeSync > 48 || cameraSettled || state.needsRender) {
        syncViewCube(state, viewCubeRef.current);
        state.lastViewCubeSync = now;
      }
      if (controlsChanged || cameraSettled || state.needsRender || now - state.lastOverlaySync > 96) {
        const previewShapes = previewShapesForDrag(shapesRef.current, dragRef.current);
        syncTransformOverlay(
          state,
          previewShapes,
          selectedIdsRef.current,
          transformOverlayRef,
          setTransformOverlay,
          Boolean(transformRef.current || dragRef.current),
        );
        syncAlignOverlay(state, alignReferenceShapesRef.current, selectedIdsRef.current, alignModeRef.current, alignAnchorIdRef.current, alignHandlesRef.current, alignOverlayRef, setAlignOverlay);
        syncMirrorOverlay(state, mirrorReferenceShapesRef.current, selectedIdsRef.current, mirrorModeRef.current, mirrorOverlayRef, setMirrorOverlay);
        state.lastOverlaySync = now;
      }
      const renderStart = performance.now();
      state.renderer.render(state.scene, state.camera);
      const frameMs = performance.now() - renderStart;
      const perf = perfRef.current;
      perf.frameMs = frameMs;
      perf.maxFrameMs = Math.max(perf.maxFrameMs, frameMs);
      perf.frames += 1;
      if (now - perf.lastSample >= 1000) {
        perf.fps = (perf.frames * 1000) / Math.max(1, now - perf.lastSample);
        perf.frames = 0;
        perf.lastSample = now;
        perf.maxFrameMs = frameMs;
      }
      state.wasCameraMoving = controlsChanged;
      state.needsRender = false;
    };

    animate();
    window.addEventListener("resize", state.resize);

    return () => {
      window.cancelAnimationFrame(state.animationId);
      window.removeEventListener("resize", state.resize);
      state.disposeInteractionListeners();
      state.controls.dispose();
      disposeChildren(state.workplaneLayer);
      disposeChildren(state.shapeLayer);
      disposeChildren(state.helperLayer);
      state.renderer.dispose();
      host.replaceChildren();
      if (window.sketchforgeCaptureCanvas) {
        delete window.sketchforgeCaptureCanvas;
      }
      threeRef.current = null;
    };
  }, []);

  useEffect(() => {
    window.sketchforgePerf = {
      get: () => {
        const state = threeRef.current;
        const info = state?.renderer.info.render;
        return {
          fps: Number(perfRef.current.fps.toFixed(1)),
          frameMs: Number(perfRef.current.frameMs.toFixed(2)),
          maxFrameMs: Number(perfRef.current.maxFrameMs.toFixed(2)),
          drawCalls: info?.calls ?? 0,
          triangles: info?.triangles ?? 0,
          points: info?.points ?? 0,
          lines: info?.lines ?? 0,
          shapeCount: shapesRef.current.filter((shape) => !shape.hidden).length,
        };
      },
    };
    return () => {
      delete window.sketchforgePerf;
    };
  }, []);

  const toRawPlanePoint = useCallback((clientX: number, clientY: number, plane: THREE.Plane) => {
    const state = threeRef.current;
    if (!state) {
      return null;
    }

    const rect = state.renderer.domElement.getBoundingClientRect();
    state.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    state.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    state.raycaster.setFromCamera(state.pointer, state.camera);

    const hit = new THREE.Vector3();
    if (!state.raycaster.ray.intersectPlane(plane, hit)) {
      return null;
    }

    return hit;
  }, []);

  const toPlanePointAtY = useCallback((clientX: number, clientY: number, planeY = 0) => {
    const state = threeRef.current;
    const hit = toRawPlanePoint(clientX, clientY, planeY === 0 ? state?.dragPlane ?? new THREE.Plane(new THREE.Vector3(0, 1, 0), 0) : new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY));
    if (!state || !hit) {
      return null;
    }

    const step = snapStep(snapRef.current);
    const bounds = workspaceRef.current;
    return {
      x: clamp(snapValue(hit.x, step), -bounds.width / 2 + 6, bounds.width / 2 - 6),
      z: clamp(snapValue(hit.z, step), -bounds.depth / 2 + 6, bounds.depth / 2 - 6),
    };
  }, [toRawPlanePoint]);
  const toPlanePoint = useCallback((clientX: number, clientY: number) => toPlanePointAtY(clientX, clientY, 0), [toPlanePointAtY]);

  const setMarqueeFromState = useCallback((marquee: MarqueeState | null) => {
    if (!marquee) {
      setMarqueeRect(null);
      return;
    }
    const left = Math.min(marquee.startX, marquee.currentX);
    const top = Math.min(marquee.startY, marquee.currentY);
    setMarqueeRect({
      left,
      top,
      width: Math.abs(marquee.currentX - marquee.startX),
      height: Math.abs(marquee.currentY - marquee.startY),
    });
  }, []);

  const shapesInMarquee = useCallback((rect: { left: number; top: number; right: number; bottom: number }) => {
    const state = threeRef.current;
    if (!state) {
      return [];
    }
    return shapesRef.current
      .filter((shape) => !shape.hidden)
      .filter((shape) => {
        const bounds = shapeScreenBounds(state, shape);
        return bounds ? boundsIntersectRect(bounds, rect) : false;
      })
      .map((shape) => shape.id);
  }, []);

  const beginTransform = useCallback(
    (kind: TransformHandleKind, handleKey: string, event: ReactPointerEvent<Element>) => {
      const ids = selectedIdsRef.current;
      const frame = selectionFrameForShapes(shapesRef.current, ids);
      const shape = frame?.singleShape ?? shapesRef.current.find((entry) => entry.id === ids[0]);
      if (!frame || !shape || ids.length === 0 || ids.some((id) => shapesRef.current.find((entry) => entry.id === id)?.locked)) {
        return;
      }

      const rotationAxis = rotationAxisForHandle(handleKey);
      const resizeHandleKey = handleKey;
      const state = threeRef.current;
      const yBounds = selectionWorldYBounds(frame);
      const handlesLowerSide = handleKey === "bottom-height" || handleKey === "lower-shape";
      const yStart = handlesLowerSide ? yBounds.min : yBounds.max;
      const liftOffset = kind === "lift" ? Math.max(2, yBounds.height * 0.08) * (handlesLowerSide ? -1 : 1) : 0;
      const startWorldY = yStart + liftOffset;
      const overlay = transformOverlayRef.current;
      const wheel = kind === "rotate" ? (overlay?.rotationWheels[rotationAxis] ?? overlay?.rotationWheel ?? undefined) : undefined;
      const rotationPlaneCenterData = kind === "rotate" ? overlay?.rotationPlaneCenters[rotationAxis] : undefined;
      const rotationPlaneCenter = rotationPlaneCenterData
        ? new THREE.Vector3(rotationPlaneCenterData.x, rotationPlaneCenterData.y, rotationPlaneCenterData.z)
        : frame.center.clone();
      const rect = state?.renderer.domElement.getBoundingClientRect();
      const localClientX = rect ? event.clientX - rect.left : event.clientX;
      const localClientY = rect ? event.clientY - rect.top : event.clientY;
      const axisVector = rotationAxisVectorForFrame(handleKey, frame);
      const pivot = frame.center.clone();
      const rotationCenter = kind === "rotate" ? wheel ?? (state ? projectToScreen(pivot, state) : { x: localClientX, y: localClientY }) : undefined;
      const rotationStartPoint = kind === "rotate" && state ? rayPointOnRotationPlane(state, event.clientX, event.clientY, rotationPlaneCenter, axisVector) : null;
      const rotationStartVector = rotationStartPoint ? rotationStartPoint.sub(rotationPlaneCenter) : undefined;
      const scalePlane = kind === "scale" ? localResizePlaneForFrame(frame) : undefined;
      const scaleStartPoint = scalePlane ? toRawPlanePoint(event.clientX, event.clientY, scalePlane) ?? undefined : undefined;
      const scaleSigns = kind === "scale" ? resizeSignsForHandle(resizeHandleKey) : undefined;
      const scaleAnchorPoint = kind === "scale" && scaleSigns ? resizeAnchorPointForFrame(frame, scaleSigns) : undefined;
      if (kind === "scale" && !scaleStartPoint) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      setEditingRotation(null);
      setPinnedMeasureKey(measureKeyForHandle(kind, handleKey, transformOverlayRef.current));
      if (kind === "height") {
        setHoverMeasureKey(null);
      }
      setActiveRotationWheel(kind === "rotate");
      setActiveTransformKind(kind);
      if (kind === "rotate") {
        setRotationWheelAxis(rotationAxis);
      }
      transformRef.current = {
        id: shape.id,
        ids: frame.ids,
        kind,
        handleKey: resizeHandleKey,
        rotationAxis,
        pointerId: event.pointerId,
        startShape: { ...shape },
        items: frame.ids
          .map((id) => shapesRef.current.find((entry) => entry.id === id))
          .filter((entry): entry is WorkplaneShape => Boolean(entry))
          .map((entry) => ({
            id: entry.id,
            startShape: { ...entry },
            startCenter: shapeCenter(entry),
            startQuaternion: quaternionForShape(entry),
          })),
        selectionFrame: frame,
        startScreenAngle: rotationCenter ? screenAngle(localClientX, localClientY, rotationCenter) : 0,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startScreenY: state ? projectedScreenYAt(state, frame.center.x, frame.center.z, startWorldY) : event.clientY,
        startWorldY,
        handleWorldOffset: liftOffset,
        screenYPerWorldUnit: state ? projectedScreenYPerWorldUnitAt(state, frame.center.x, frame.center.z, startWorldY) : -3.2,
        scalePlaneY: kind === "scale" ? yBounds.min : 0,
        scalePlane,
        scaleSigns,
        scaleAnchorPoint,
        scaleStartPoint,
        rotationAxisVector: kind === "rotate" ? axisVector : undefined,
        rotationPivot: kind === "rotate" ? pivot : undefined,
        rotationPlaneCenter: kind === "rotate" ? rotationPlaneCenter : undefined,
        rotationStartVector: kind === "rotate" ? rotationStartVector : undefined,
        rotationScreenCenter: rotationCenter,
        rotationScreenSign: kind === "rotate" && state ? rotationScreenSign(axisVector, state.camera) : 1,
        rotationStartQuaternion: kind === "rotate" ? quaternionForShape(shape) : undefined,
        wheelCenter: wheel,
      };
      if (kind === "rotate" && state) {
        const renderRect = state.renderer.domElement.getBoundingClientRect();
        setRotationReadout({
          x: event.clientX - renderRect.left + 18,
          y: event.clientY - renderRect.top - 18,
          text: `${Math.round(rotationValueForAxis(shape, rotationAxis))}°`,
          angle: 0,
        });
      } else if (kind === "lift" && state) {
        const renderRect = state.renderer.domElement.getBoundingClientRect();
        setRotationReadout({
          x: event.clientX - renderRect.left + 22,
          y: event.clientY - renderRect.top - 34,
          text: formatMeasure(yBounds.min),
        });
      } else {
        setRotationReadout(null);
      }
      if (state) {
        state.controls.enabled = false;
      }
      onInteractionActiveChange?.(true);
    },
    [onInteractionActiveChange, toRawPlanePoint],
  );

  const updateTransform = useCallback(
    (clientX: number, clientY: number, shiftKey = false, altKey = false) => {
      const transform = transformRef.current;
      if (!transform) {
        return false;
      }
      if (Math.hypot(clientX - transform.startClientX, clientY - transform.startClientY) > 3) {
        transform.hasMoved = true;
      }

      const shape = transform.startShape;
      const step = snapStep(snapRef.current);
      if (transform.kind === "height") {
        const state = threeRef.current;
        const yBounds = selectionWorldYBounds(transform.selectionFrame);
        const draggedWorldY = state
          ? projectedWorldYForScreenY(state, shape, transform.startScreenY + clientY - transform.startClientY, transform.startWorldY)
          : transform.startWorldY + (clientY - transform.startClientY) / transform.screenYPerWorldUnit;
        const resizingFromBottom = transform.handleKey === "bottom-height";
        const rawWorldHeight = resizingFromBottom ? yBounds.max - draggedWorldY : draggedWorldY - yBounds.min;
        const nextWorldHeight = clamp(yBounds.height + snapValue(rawWorldHeight - yBounds.height, step), MIN_SHAPE_SIZE, 180);
        const scaleY = nextWorldHeight / Math.max(MIN_SHAPE_SIZE, yBounds.height);
        transform.items.forEach((item) => {
          const localCenter = frameLocalPoint(transform.selectionFrame, item.startCenter);
          const nextCenterY = resizingFromBottom
            ? transform.selectionFrame.center.y + transform.selectionFrame.height / 2 - (transform.selectionFrame.height / 2 - localCenter.y) * scaleY
            : transform.selectionFrame.center.y - transform.selectionFrame.height / 2 + (localCenter.y + transform.selectionFrame.height / 2) * scaleY;
          const height = clamp(item.startShape.height * scaleY, MIN_SHAPE_SIZE, 180);
          let elevation = nextCenterY - height / 2;
          if (transform.items.length === 1) {
            const draftShape = { ...item.startShape, height, elevation };
            const draftFrame = selectionFrameForShapes([draftShape], [item.id]);
            if (draftFrame) {
              const draftBounds = selectionWorldYBounds(draftFrame);
              elevation += resizingFromBottom ? yBounds.max - draftBounds.max : yBounds.min - draftBounds.min;
            }
          }
          onUpdateShape(item.id, {
            height,
            elevation: cleanNearZero(clamp(elevation, MIN_ELEVATION, MAX_ELEVATION), 0.0005),
          });
        });
        return true;
      }

      if (transform.kind === "lift") {
        const state = threeRef.current;
        const yBounds = selectionWorldYBounds(transform.selectionFrame);
        const handleWorldY = state
          ? projectedWorldYForScreenY(state, shape, transform.startScreenY + clientY - transform.startClientY, transform.startWorldY)
          : transform.startWorldY + (clientY - transform.startClientY) / transform.screenYPerWorldUnit;
        const handlesLowerSide = transform.handleKey === "lower-shape";
        const rawBottom = handlesLowerSide ? handleWorldY - transform.handleWorldOffset : handleWorldY - yBounds.height - transform.handleWorldOffset;
        const nextBottom = cleanNearZero(
          clamp(yBounds.min + snapValue(rawBottom - yBounds.min, step), MIN_ELEVATION, MAX_ELEVATION),
          0.0005,
        );
        const delta = nextBottom - yBounds.min;
        transform.items.forEach((item) =>
          onUpdateShape(item.id, {
            elevation: cleanNearZero(
              clamp((item.startShape.elevation ?? 0) + delta, MIN_ELEVATION, MAX_ELEVATION),
              0.0005,
            ),
          }),
        );
        if (state) {
          const readoutPoint = projectToScreen(new THREE.Vector3(transform.selectionFrame.center.x, handleWorldY, transform.selectionFrame.center.z), state);
          setRotationReadout({
            x: readoutPoint.x + 28,
            y: readoutPoint.y - 30,
            text: formatMeasure(nextBottom),
          });
        }
        return true;
      }

      if (transform.kind === "scale") {
        const worldPoint = transform.scalePlane ? toRawPlanePoint(clientX, clientY, transform.scalePlane) : null;
        if (!worldPoint) {
          return true;
        }
        if (transform.items.length === 1) {
          const next = resizeShapeFromFrameHandle(transform, worldPoint, transform.handleKey, shiftKey, altKey, step);
          onUpdateShape(transform.id, next);
        } else {
          resizeSelectionFromHandle(transform, worldPoint, transform.handleKey, shiftKey, altKey, step).forEach(({ id, patch }) => onUpdateShape(id, patch));
        }
        return true;
      }

      const point = toPlanePoint(clientX, clientY);
      if (!point && transform.kind !== "rotate") {
        return true;
      }

      const state = threeRef.current;
      const rotationCenter = transform.rotationScreenCenter ?? transform.wheelCenter;
      if (!state || !rotationCenter) {
        return true;
      }
      const rect = state.renderer.domElement.getBoundingClientRect();
      const localClientX = clientX - rect.left;
      const localClientY = clientY - rect.top;
      const axisVector = (transform.rotationAxisVector ?? rotationAxisVectorForFrame(transform.handleKey, transform.selectionFrame)).clone().normalize();
      const pivot = transform.rotationPivot ?? transform.selectionFrame.center;
      const planeCenter = transform.rotationPlaneCenter ?? pivot;
      const currentPoint = rayPointOnRotationPlane(state, clientX, clientY, planeCenter, axisVector);
      const rawDelta =
        currentPoint && transform.rotationStartVector && transform.rotationStartVector.lengthSq() > 0.000001
          ? THREE.MathUtils.radToDeg(signedAngleAroundAxis(transform.rotationStartVector, currentPoint.sub(planeCenter), axisVector))
          : THREE.MathUtils.radToDeg(unwrapRadians(screenAngle(localClientX, localClientY, rotationCenter) - transform.startScreenAngle)) * (transform.rotationScreenSign ?? 1);
      const distance = transform.wheelCenter ? Math.hypot(localClientX - transform.wheelCenter.x, localClientY - transform.wheelCenter.y) : Number.POSITIVE_INFINITY;
      let delta: number;
      if (shiftKey) {
        delta = Math.round(rawDelta / 45) * 45;
      } else if (transform.wheelCenter && distance <= transform.wheelCenter.radius) {
        delta = Math.round(rawDelta / 22.5) * 22.5;
      } else {
        delta = Math.round(rawDelta);
      }

      const deltaQuaternion = new THREE.Quaternion().setFromAxisAngle(axisVector, THREE.MathUtils.degToRad(delta));
      const rotationDelta = deltaQuaternion.clone();
      if (state) {
        setRotationReadout({
          x: transform.wheelCenter ? transform.wheelCenter.x : localClientX + 18,
          y: transform.wheelCenter ? transform.wheelCenter.y - 92 : localClientY - 18,
          text: `${Number(delta.toFixed(1))}°`,
          angle: delta,
        });
      }
      transform.items.forEach((item) => {
        const nextQuaternion = rotationDelta.clone().multiply(item.startQuaternion);
        const patch: Partial<WorkplaneShape> = rotationPatchFromQuaternion(nextQuaternion);
        if (transform.items.length > 1) {
          const nextCenter = pivot.clone().add(item.startCenter.clone().sub(pivot).applyQuaternion(rotationDelta));
          patch.x = snapPositionValue(nextCenter.x, step, -workspaceRef.current.width / 2 + 6, workspaceRef.current.width / 2 - 6);
          patch.z = snapPositionValue(nextCenter.z, step, -workspaceRef.current.depth / 2 + 6, workspaceRef.current.depth / 2 - 6);
          patch.elevation = snapPositionValue(nextCenter.y - item.startShape.height / 2, step, MIN_ELEVATION, MAX_ELEVATION);
        }
        onUpdateShape(item.id, patch);
      });
      return true;
    },
    [onUpdateShape, toPlanePoint, toRawPlanePoint],
  );

  const suppressLiftEditAfterDrag = useCallback(() => {
    suppressNextLiftEditRef.current = true;
    window.setTimeout(() => {
      suppressNextLiftEditRef.current = false;
    }, 250);
  }, []);

  const finishTransform = useCallback((event: ReactPointerEvent<Element>) => {
    const transform = transformRef.current;
    if (!transform) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(transform.pointerId)) {
      event.currentTarget.releasePointerCapture(transform.pointerId);
    }
    const bakeRotatedShapes = transform.kind === "rotate" && transform.hasMoved ? transform.ids : [];
    if (transform.kind === "lift") {
      setPinnedMeasureKey(getElevationMeasureKey(transformOverlayRef.current));
    }
    if (transform.kind === "lift" && transform.hasMoved) {
      suppressLiftEditAfterDrag();
    }
    transformRef.current = null;
    setActiveRotationWheel(false);
    setActiveTransformKind(null);
    setRotationReadout(null);
    if (threeRef.current) {
      threeRef.current.controls.enabled = true;
    }
    onInteractionActiveChange?.(false);
    bakeRotatedShapes.forEach((id) => onUpdateShape(id, { bakeTransform: true }));
  }, [onInteractionActiveChange, onUpdateShape, suppressLiftEditAfterDrag]);

  const beginDimensionEdit = useCallback((mark: DimensionMark) => {
    setPinnedMeasureKey(mark.handleKey);
    setEditingDimension({ key: mark.key, axis: mark.axis, x: mark.labelX, y: mark.labelY, value: mark.label });
  }, []);

  const beginLiftEdit = useCallback((handleKey: string, x: number, y: number) => {
    if (suppressNextLiftEditRef.current) {
      suppressNextLiftEditRef.current = false;
      return;
    }
    const frame = selectionFrameForShapes(shapesRef.current, selectedIdsRef.current);
    if (!frame) {
      return;
    }
    const yBounds = selectionWorldYBounds(frame);
    const elevationMark = Object.values(transformOverlayRef.current?.dimensions ?? {})
      .flat()
      .find((entry) => entry.axis === "elevation");
    const editX = elevationMark?.labelX ?? x;
    const editY = elevationMark?.labelY ?? y;
    setPinnedMeasureKey(elevationMark?.handleKey ?? handleKey);
    setActiveRotationWheel(false);
    setRotationReadout(null);
    setEditingDimension({
      key: "elevation",
      axis: "elevation",
      x: clamp(editX, 44, Math.max(44, (transformOverlayRef.current?.width ?? 900) - 44)),
      y: clamp(editY, 34, Math.max(34, (transformOverlayRef.current?.height ?? 600) - 34)),
      value: formatMeasure(yBounds.min),
    });
  }, []);

  const commitDimensionEdit = useCallback(() => {
    const edit = editingDimension;
    const id = selectedIdsRef.current[0];
    const shape = shapesRef.current.find((entry) => entry.id === id);
    if (!edit || !shape) {
      setEditingDimension(null);
      return;
    }
    const value = Number.parseFloat(edit.value);
    if (edit.axis === "elevation") {
      if (Number.isFinite(value)) {
        const frame = selectionFrameForShapes(shapesRef.current, selectedIdsRef.current);
        const currentMin = frame ? selectionWorldYBounds(frame).min : shape.elevation ?? 0;
        const targetMin = cleanNearZero(clamp(value, MIN_ELEVATION, MAX_ELEVATION), 0.0005);
        const delta = targetMin - currentMin;
        selectedIdsRef.current.forEach((selectedId) => {
          const selectedShape = shapesRef.current.find((entry) => entry.id === selectedId);
          if (selectedShape) {
            onUpdateShape(selectedId, { elevation: cleanNearZero(clamp((selectedShape.elevation ?? 0) + delta, MIN_ELEVATION, MAX_ELEVATION), 0.0005) });
          }
        });
      }
      setEditingDimension(null);
      return;
    }
    if (Number.isFinite(value) && value > 0) {
      const nextValue = Math.max(MIN_SHAPE_SIZE, value);
      if (edit.axis === "width") {
        onUpdateShape(id, patchWithPreservedWorldBottom(shape, { width: nextValue, size: (nextValue + shapeDepth(shape)) / 2 }));
      } else if (edit.axis === "depth") {
        onUpdateShape(id, patchWithPreservedWorldBottom(shape, { depth: nextValue, size: (shapeWidth(shape) + nextValue) / 2 }));
      } else {
        onUpdateShape(id, patchWithPreservedWorldBottom(shape, { height: nextValue }));
      }
    }
    setEditingDimension(null);
  }, [editingDimension, onUpdateShape]);

  const cancelDimensionEdit = useCallback(() => {
    setEditingDimension(null);
  }, []);

  const beginRotationEdit = useCallback((handleKey: string, x: number, y: number) => {
    const axis = rotationAxisForHandle(handleKey);
    const shape = selectedIdsRef.current.length === 1 ? shapesRef.current.find((entry) => entry.id === selectedIdsRef.current[0]) : null;
    const currentValue = shape ? rotationValueForAxis(shape, axis) : 0;
    setPinnedMeasureKey(handleKey);
    setActiveRotationWheel(true);
    setRotationWheelAxis(axis);
    setRotationReadout(null);
    setEditingRotation({
      axis,
      handleKey,
      x: clamp(x, 38, Math.max(38, (transformOverlayRef.current?.width ?? 900) - 38)),
      y: clamp(y, 38, Math.max(38, (transformOverlayRef.current?.height ?? 600) - 38)),
      value: String(Number(currentValue.toFixed(1))),
    });
  }, []);

  const commitRotationEdit = useCallback(() => {
    const edit = editingRotation;
    if (!edit) {
      return;
    }
    const value = Number.parseFloat(edit.value);
    if (Number.isFinite(value)) {
      selectedIdsRef.current.forEach((id) => onUpdateShape(id, { ...rotationPatchForAxis(edit.axis, value), bakeTransform: true }));
    }
    setEditingRotation(null);
    setActiveRotationWheel(false);
  }, [editingRotation, onUpdateShape]);

  const cancelRotationEdit = useCallback(() => {
    setEditingRotation(null);
    setActiveRotationWheel(false);
  }, []);

  const pickShape = useCallback((clientX: number, clientY: number) => {
    const state = threeRef.current;
    if (!state) {
      return null;
    }

    const rect = state.renderer.domElement.getBoundingClientRect();
    state.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    state.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    state.raycaster.setFromCamera(state.pointer, state.camera);

    const intersections = state.raycaster.intersectObjects(state.shapeLayer.children, true);
    const hit = intersections.find((entry) => typeof entry.object.userData.shapeId === "string");
    if (hit) {
      return hit.object.userData.shapeId as string;
    }

    let nearestId: string | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    shapesRef.current.forEach((shape) => {
      const center = new THREE.Vector3(shape.x, (shape.elevation ?? 0) + shape.height / 2, shape.z).project(state.camera);
      const screenX = rect.left + ((center.x + 1) / 2) * rect.width;
      const screenY = rect.top + ((1 - center.y) / 2) * rect.height;
      const distance = Math.hypot(clientX - screenX, clientY - screenY);
      const hitRadius = clamp(Math.max(shapeWidth(shape), shapeDepth(shape)) * 2.6, 48, 112);
      if (distance <= hitRadius && distance < nearestDistance) {
        nearestId = shape.id;
        nearestDistance = distance;
      }
    });

    return nearestId;
  }, []);

  const pickTransformHandle = useCallback((clientX: number, clientY: number) => {
    const state = threeRef.current;
    if (!state || selectedIdsRef.current.length !== 1) {
      return null;
    }

    const rect = state.renderer.domElement.getBoundingClientRect();
    state.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    state.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    state.raycaster.setFromCamera(state.pointer, state.camera);

    const intersections = state.raycaster.intersectObjects(state.helperLayer.children, true);
    const hit = intersections.find((entry) => typeof entry.object.userData.transformHandle === "string");
    if (!hit) {
      return null;
    }

    return {
      id: hit.object.userData.shapeId as string,
      kind: hit.object.userData.transformHandle as TransformHandleKind,
      handleKey: (hit.object.userData.transformHandleKey as string | undefined) ?? (hit.object.userData.transformHandle as string),
      planeY: typeof hit.object.userData.transformPlaneY === "number" ? (hit.object.userData.transformPlaneY as number) : 0,
    };
  }, []);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = threeRef.current;
      if (!state) {
        return;
      }
      if (event.button !== 0 || event.ctrlKey || event.metaKey) {
        return;
      }
      const rect = state.renderer.domElement.getBoundingClientRect();

      if (workplaneModeRef.current) {
        event.preventDefault();
        const id = pickShape(event.clientX, event.clientY);
        if (id) {
          const frame = selectionFrameForShapes(shapesRef.current, [id]);
          const top = frame ? selectionWorldYBounds(frame).max : 0;
          onSetPlacementElevation(snapPositionValue(top, snapStep(snapRef.current), MIN_ELEVATION, MAX_ELEVATION), "shape");
          onSelectShape(id);
        } else {
          onSetPlacementElevation(0, "base");
        }
        onWorkplaneModeChange(false);
        return;
      }

      const handle = pickTransformHandle(event.clientX, event.clientY);
      if (handle) {
        const shape = shapesRef.current.find((entry) => entry.id === handle.id);
        const frame = selectionFrameForShapes(shapesRef.current, selectedIdsRef.current);
        const scalePlane = handle.kind === "scale" && frame ? localResizePlaneForFrame(frame) : undefined;
        const scaleStartPoint = scalePlane ? toRawPlanePoint(event.clientX, event.clientY, scalePlane) ?? undefined : undefined;
        const point = scalePlane ? scaleStartPoint : toPlanePoint(event.clientX, event.clientY);
        if (!shape || !frame || shape.locked || (!point && handle.kind !== "height" && handle.kind !== "lift" && handle.kind !== "rotate")) {
          return;
        }
        const yBounds = selectionWorldYBounds(frame);
        const handlesLowerSide = handle.handleKey === "bottom-height" || handle.handleKey === "lower-shape";
        const yStart = handlesLowerSide ? yBounds.min : yBounds.max;
        const liftOffset = handle.kind === "lift" ? Math.max(2, yBounds.height * 0.08) * (handlesLowerSide ? -1 : 1) : 0;
        const startWorldY = yStart + liftOffset;
        const overlay = transformOverlayRef.current;
        const rotationAxis = rotationAxisForHandle(handle.handleKey);
        const resizeHandleKey = handle.handleKey;
        const scaleSigns = handle.kind === "scale" ? resizeSignsForHandle(resizeHandleKey) : undefined;
        const scaleAnchorPoint = handle.kind === "scale" && scaleSigns ? resizeAnchorPointForFrame(frame, scaleSigns) : undefined;
        const wheel = handle.kind === "rotate" ? (overlay?.rotationWheels[rotationAxis] ?? overlay?.rotationWheel ?? undefined) : undefined;
        const rotationPlaneCenterData = handle.kind === "rotate" ? overlay?.rotationPlaneCenters[rotationAxis] : undefined;
        const rotationPlaneCenter = rotationPlaneCenterData
          ? new THREE.Vector3(rotationPlaneCenterData.x, rotationPlaneCenterData.y, rotationPlaneCenterData.z)
          : frame.center.clone();
        const localClientX = event.clientX - rect.left;
        const localClientY = event.clientY - rect.top;
        const axisVector = rotationAxisVectorForFrame(handle.handleKey, frame);
        const pivot = frame.center.clone();
        const rotationCenter = handle.kind === "rotate" ? wheel ?? projectToScreen(pivot, state) : undefined;
        const rotationStartPoint = handle.kind === "rotate" ? rayPointOnRotationPlane(state, event.clientX, event.clientY, rotationPlaneCenter, axisVector) : null;
        const rotationStartVector = rotationStartPoint ? rotationStartPoint.sub(rotationPlaneCenter) : undefined;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setEditingRotation(null);
        setPinnedMeasureKey(measureKeyForHandle(handle.kind, handle.handleKey, transformOverlayRef.current));
        if (handle.kind === "height") {
          setHoverMeasureKey(null);
        }
        setActiveRotationWheel(handle.kind === "rotate");
        setActiveTransformKind(handle.kind);
        if (handle.kind === "rotate") {
          setRotationWheelAxis(rotationAxis);
        }
        transformRef.current = {
          id: handle.id,
          ids: frame.ids,
          kind: handle.kind,
          handleKey: resizeHandleKey,
          rotationAxis,
          pointerId: event.pointerId,
          startShape: { ...shape },
          items: frame.ids
            .map((id) => shapesRef.current.find((entry) => entry.id === id))
            .filter((entry): entry is WorkplaneShape => Boolean(entry))
            .map((entry) => ({
              id: entry.id,
              startShape: { ...entry },
              startCenter: shapeCenter(entry),
              startQuaternion: quaternionForShape(entry),
            })),
          selectionFrame: frame,
          startScreenAngle: rotationCenter ? screenAngle(localClientX, localClientY, rotationCenter) : 0,
          startClientX: event.clientX,
          startClientY: event.clientY,
          startScreenY: projectedScreenYAt(state, frame.center.x, frame.center.z, startWorldY),
          startWorldY,
          handleWorldOffset: liftOffset,
          screenYPerWorldUnit: projectedScreenYPerWorldUnitAt(state, frame.center.x, frame.center.z, startWorldY),
          scalePlaneY: handle.kind === "scale" ? handle.planeY : 0,
          scalePlane,
          scaleSigns,
          scaleAnchorPoint,
          scaleStartPoint,
          rotationAxisVector: handle.kind === "rotate" ? axisVector : undefined,
          rotationPivot: handle.kind === "rotate" ? pivot : undefined,
          rotationPlaneCenter: handle.kind === "rotate" ? rotationPlaneCenter : undefined,
          rotationStartVector: handle.kind === "rotate" ? rotationStartVector : undefined,
          rotationScreenCenter: rotationCenter,
          rotationScreenSign: handle.kind === "rotate" ? rotationScreenSign(axisVector, state.camera) : 1,
          rotationStartQuaternion: handle.kind === "rotate" ? quaternionForShape(shape) : undefined,
          wheelCenter: wheel,
        };
        if (handle.kind === "rotate") {
          setRotationReadout({
            x: event.clientX - rect.left + 18,
            y: event.clientY - rect.top - 18,
            text: `${Math.round(rotationValueForAxis(shape, rotationAxis))}°`,
            angle: 0,
          });
        } else if (handle.kind === "lift") {
          setRotationReadout({
            x: event.clientX - rect.left + 22,
            y: event.clientY - rect.top - 34,
            text: formatMeasure(yBounds.min),
          });
        } else {
          setRotationReadout(null);
        }
        state.controls.enabled = false;
        onInteractionActiveChange?.(true);
        return;
      }

      const id = pickShape(event.clientX, event.clientY);
      const additive = event.shiftKey;
      if (!id) {
        const startX = event.clientX - rect.left;
        const startY = event.clientY - rect.top;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        marqueeRef.current = {
          pointerId: event.pointerId,
          startX,
          startY,
          currentX: startX,
          currentY: startY,
          additive,
          hasMoved: false,
        };
        setMarqueeFromState(marqueeRef.current);
        state.controls.enabled = false;
        onInteractionActiveChange?.(true);
        return;
      }

      const shape = shapesRef.current.find((entry) => entry.id === id);
      const selectedIdsSnapshot = selectedIdsRef.current;
      if (alignModeRef.current && selectedIdsSnapshot.includes(id)) {
        event.preventDefault();
        onAlignAnchorChange(id);
        return;
      }
      const dragPlaneY = shape ? shape.elevation ?? 0 : 0;
      const point = toPlanePointAtY(event.clientX, event.clientY, dragPlaneY);
      if (!point || !shape) {
        return;
      }

      event.preventDefault();
      const alreadySelected = selectedIdsSnapshot.includes(id);
      if (additive) {
        onSelectShape(id, "toggle");
        return;
      }
      if (!alreadySelected) {
        onSelectShape(id);
      }
      if (shape.locked) {
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      const dragIds = alreadySelected && selectedIdsSnapshot.length > 1 ? selectedIdsSnapshot : [id];
      const items = dragIds
        .map((dragId) => {
          const dragShape = shapesRef.current.find((entry) => entry.id === dragId);
          if (!dragShape || dragShape.locked) {
            return null;
          }
          const helper = findSelectionHelper(state, dragId);
          return {
            id: dragId,
            startX: dragShape.x,
            startZ: dragShape.z,
            nextX: dragShape.x,
            nextZ: dragShape.z,
            visual: findShapeObject(state, dragId),
            helper,
            helperBox: helper ? helper.box.clone() : null,
            hadPreviewSimplified: false,
          };
        })
        .filter((item): item is DragItem => Boolean(item));
      if (items.length === 0) {
        return;
      }
      dragRef.current = {
        primaryId: id,
        offsetX: shape.x - point.x,
        offsetZ: shape.z - point.z,
        planeY: dragPlaneY,
        pointerId: event.pointerId,
        primaryStartX: shape.x,
        primaryStartZ: shape.z,
        items,
      };
      state.controls.enabled = false;
      onInteractionActiveChange?.(true);
    },
    [
      onAlignAnchorChange,
      onInteractionActiveChange,
      onSelectShape,
      onSetPlacementElevation,
      onWorkplaneModeChange,
      pickShape,
      pickTransformHandle,
      setMarqueeFromState,
      toPlanePoint,
      toPlanePointAtY,
      toRawPlanePoint,
    ],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const transform = transformRef.current;
      if (transform) {
        updateTransform(event.clientX, event.clientY, event.shiftKey, event.altKey);
        if (threeRef.current) {
          threeRef.current.needsRender = true;
        }
        return;
      }

      const marquee = marqueeRef.current;
      if (marquee) {
        const state = threeRef.current;
        if (!state) {
          return;
        }
        const rect = state.renderer.domElement.getBoundingClientRect();
        marquee.currentX = event.clientX - rect.left;
        marquee.currentY = event.clientY - rect.top;
        marquee.hasMoved = marquee.hasMoved || Math.hypot(marquee.currentX - marquee.startX, marquee.currentY - marquee.startY) > 5;
        setMarqueeFromState(marquee);
        return;
      }

      const drag = dragRef.current;
      if (!drag) {
        return;
      }

      const point = toPlanePointAtY(event.clientX, event.clientY, drag.planeY);
      if (!point) {
        return;
      }

      const primaryNextX = clamp(point.x + drag.offsetX, -workspaceRef.current.width / 2 + 6, workspaceRef.current.width / 2 - 6);
      const primaryNextZ = clamp(point.z + drag.offsetZ, -workspaceRef.current.depth / 2 + 6, workspaceRef.current.depth / 2 - 6);
      const deltaX = primaryNextX - drag.primaryStartX;
      const deltaZ = primaryNextZ - drag.primaryStartZ;

      drag.items.forEach((item) => {
        item.nextX = clamp(item.startX + deltaX, -workspaceRef.current.width / 2 + 6, workspaceRef.current.width / 2 - 6);
        item.nextZ = clamp(item.startZ + deltaZ, -workspaceRef.current.depth / 2 + 6, workspaceRef.current.depth / 2 - 6);

        if (item.visual) {
          if (!item.hadPreviewSimplified) {
            setComplexEdgeVisibility(item.visual, false);
            item.hadPreviewSimplified = true;
          }
          item.visual.position.x = item.nextX;
          item.visual.position.z = item.nextZ;
        }

        if (item.helper && item.helperBox) {
          item.helper.box.copy(item.helperBox);
          item.helper.box.translate(new THREE.Vector3(item.nextX - item.startX, 0, item.nextZ - item.startZ));
          item.helper.updateMatrixWorld(true);
        }
      });
      if (threeRef.current) {
        const previewShapes = previewShapesForDrag(shapesRef.current, drag);
        updateSelectedGroundFootprintPreviews(threeRef.current, drag);
        syncTransformOverlay(threeRef.current, previewShapes, selectedIdsRef.current, transformOverlayRef, setTransformOverlay, true);
        threeRef.current.lastOverlaySync = performance.now();
        threeRef.current.needsRender = true;
      }
    },
    [setMarqueeFromState, toPlanePoint, updateTransform],
  );

  const finishDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = threeRef.current;
      const transform = transformRef.current;
      if (transform) {
        if (event.currentTarget.hasPointerCapture(transform.pointerId)) {
          event.currentTarget.releasePointerCapture(transform.pointerId);
        }
        if (transform.kind === "lift") {
          setPinnedMeasureKey(getElevationMeasureKey(transformOverlayRef.current));
        } else if (transform.kind === "height") {
          setPinnedMeasureKey(null);
          setHoverMeasureKey(null);
        }
        if (transform.kind === "lift" && transform.hasMoved) {
          suppressLiftEditAfterDrag();
        }
        transformRef.current = null;
        setActiveRotationWheel(false);
        setActiveTransformKind(null);
        setRotationReadout(null);
        if (state) {
          state.controls.enabled = true;
        }
        onInteractionActiveChange?.(false);
        return;
      }

      const marquee = marqueeRef.current;
      if (marquee) {
        if (event.currentTarget.hasPointerCapture(marquee.pointerId)) {
          event.currentTarget.releasePointerCapture(marquee.pointerId);
        }
        marqueeRef.current = null;
        setMarqueeFromState(null);
        if (marquee.hasMoved) {
          const rect = {
            left: Math.min(marquee.startX, marquee.currentX),
            right: Math.max(marquee.startX, marquee.currentX),
            top: Math.min(marquee.startY, marquee.currentY),
            bottom: Math.max(marquee.startY, marquee.currentY),
          };
          const selected = shapesInMarquee(rect);
          if (marquee.additive) {
            const merged = [...selectedIdsRef.current];
            selected.forEach((id) => {
              if (!merged.includes(id)) {
                merged.push(id);
              }
            });
            onSelectShape(merged);
          } else {
            onSelectShape(selected);
          }
        } else if (!marquee.additive) {
          onSelectShape(null);
        }
        if (state) {
          state.controls.enabled = true;
        }
        onInteractionActiveChange?.(false);
        return;
      }

      const drag = dragRef.current;
      if (!drag) {
        return;
      }

      if (event.currentTarget.hasPointerCapture(drag.pointerId)) {
        event.currentTarget.releasePointerCapture(drag.pointerId);
      }

      drag.items.forEach((item) => {
        if (item.visual && item.hadPreviewSimplified) {
          setComplexEdgeVisibility(item.visual, true);
        }
        const shape = shapesRef.current.find((entry) => entry.id === item.id);
        if (shape && (shape.x !== item.nextX || shape.z !== item.nextZ)) {
          onUpdateShape(item.id, { x: item.nextX, z: item.nextZ });
        }
      });

      dragRef.current = null;
      if (state) {
        state.controls.enabled = true;
      }
      onInteractionActiveChange?.(false);
    },
    [onInteractionActiveChange, onSelectShape, onUpdateShape, setMarqueeFromState, shapesInMarquee, suppressLiftEditAfterDrag],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData("application/x-sketchforge-shape");
      if (!raw) {
        return;
      }

      const asset = JSON.parse(raw) as ShapeAsset;
      const point = toPlanePoint(event.clientX, event.clientY);
      onAddShape(asset, point ? { ...point, elevation: placementElevationRef.current } : { x: 0, z: 0, elevation: placementElevationRef.current });
    },
    [onAddShape, toPlanePoint],
  );

  const resetView = useCallback(() => {
    const state = threeRef.current;
    if (state) {
      resetCamera(state);
      state.needsRender = true;
    }
  }, []);

  const zoomCamera = useCallback((scale: number) => {
    const state = threeRef.current;
    if (!state) {
      return;
    }

    const offset = state.camera.position.clone().sub(state.controls.target);
    const distance = clamp(offset.length() * scale, 22, 4200);
    offset.setLength(distance);
    state.camera.position.copy(state.controls.target).add(offset);
    state.camera.updateProjectionMatrix();
    state.controls.update();
    state.needsRender = true;
  }, []);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "f" || event.key === "Home") {
        event.preventDefault();
        resetView();
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomCamera(0.72);
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        zoomCamera(1.28);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [resetView, zoomCamera]);

  return (
    <main className="workplane-stage">
      <div className="view-cube" aria-hidden="true">
          <div className="view-cube-inner" ref={viewCubeRef}>
          <div className="cube-face cube-top">TOP</div>
          <div className="cube-face cube-bottom">BOTTOM</div>
          <div className="cube-face cube-front">FRONT</div>
          <div className="cube-face cube-back">BACK</div>
          <div className="cube-face cube-right">RIGHT</div>
          <div className="cube-face cube-left">LEFT</div>
        </div>
      </div>

      <div className="camera-controls" aria-label="Camera controls">
        <button aria-label="Home" onClick={resetView}>
          <Home size={28} />
        </button>
        <button aria-label="Fit view" onClick={resetView}>
          <Expand size={24} />
        </button>
        <button aria-label="Zoom in" onClick={() => zoomCamera(0.7)}>
          <Plus size={33} />
        </button>
        <button aria-label="Zoom out" onClick={() => zoomCamera(1.35)}>
          <Minus size={33} />
        </button>
        <button aria-label="Camera mode" onClick={resetView}>
          <Box size={27} />
        </button>
      </div>

      <section className={`workplane-wrap ${workplaneMode ? "placing-workplane" : ""}`} aria-label="Workplane">
        <div className="workplane-plane">
          <div
            className="three-workplane-host"
            ref={hostRef}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDrop={handleDrop}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
          />
          {marqueeRect ? <div className="selection-marquee" style={marqueeRect} /> : null}
          {transformOverlay && !alignMode && !mirrorMode ? (
            <TransformOverlay
              box={transformOverlay}
              measureKey={pinnedMeasureKey ?? hoverMeasureKey}
              editingDimension={editingDimension}
              editingRotation={editingRotation}
              rotationReadout={rotationReadout}
              showRotationWheel={activeRotationWheel}
              hideDimensionMarks={activeTransformKind === "scale"}
              rotationWheelAxis={rotationWheelAxis}
              onBeginTransform={beginTransform}
              onMoveTransform={updateTransform}
              onFinishTransform={finishTransform}
              onHoverMeasure={setHoverMeasureKey}
              onPinMeasure={setPinnedMeasureKey}
              onBeginDimensionEdit={beginDimensionEdit}
              onBeginLiftEdit={beginLiftEdit}
              onEditingDimensionChange={(value) => setEditingDimension((current) => (current ? { ...current, value } : current))}
              onCommitDimensionEdit={commitDimensionEdit}
              onCancelDimensionEdit={cancelDimensionEdit}
              onBeginRotationEdit={beginRotationEdit}
              onEditingRotationChange={(value) => setEditingRotation((current) => (current ? { ...current, value } : current))}
              onCommitRotationEdit={commitRotationEdit}
              onCancelRotationEdit={cancelRotationEdit}
            />
          ) : null}
          {alignOverlay ? <AlignOverlay overlay={alignOverlay} onAlign={onAlignSelection} onPreview={onAlignPreview} onPreviewClear={onAlignPreviewClear} /> : null}
          {mirrorOverlay ? <MirrorOverlay overlay={mirrorOverlay} onMirror={onMirrorSelection} onPreview={onMirrorPreview} onPreviewClear={onMirrorPreviewClear} /> : null}
        </div>
      </section>

      {selectedShape ? (
        <ShapeInspector
          shape={selectedShape}
          snap={snap}
          snapOpen={snapOpen}
          onUpdate={(patch) => onUpdateShape(selectedShape.id, patch)}
          onClose={() => onSelectShape(null)}
          onSnapChange={setSnap}
          onSnapOpenChange={setSnapOpen}
        />
      ) : null}

      {!selectedShape ? (
        <div className="grid-settings">
          <SnapGridControl snap={snap} snapOpen={snapOpen} onSnapChange={setSnap} onSnapOpenChange={setSnapOpen} />
        </div>
      ) : null}

      {settingsOpen ? (
        <WorkspaceSettingsModal
          workspace={workspace}
          snap={snap}
          onWorkspaceChange={setWorkspace}
          onSnapChange={setSnap}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </main>
  );
}

function ShapeInspector({
  shape,
  snap,
  snapOpen,
  onUpdate,
  onClose,
  onSnapChange,
  onSnapOpenChange,
}: {
  shape: WorkplaneShape;
  snap: GridSize;
  snapOpen: boolean;
  onUpdate: (patch: Partial<WorkplaneShape>) => void;
  onClose: () => void;
  onSnapChange: Dispatch<SetStateAction<GridSize>>;
  onSnapOpenChange: Dispatch<SetStateAction<boolean>>;
}) {
  const solidColor = shape.hole ? fallbackSolidColor(shape) : shape.color;
  const locked = Boolean(shape.locked);
  const properties = getShapeProperties(shape, onUpdate);
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [colorOpen, setColorOpen] = useState(false);

  return (
    <aside className="shape-inspector" aria-label={`${shape.name} shape settings`} onPointerDown={(event) => event.stopPropagation()}>
      <div className="shape-inspector-header">
        <button className="inspector-header-icon" aria-label="Close shape settings" onClick={onClose}>
          <ChevronUp size={26} strokeWidth={2.8} />
        </button>
        <strong>{shape.name}</strong>
        <div className="inspector-header-actions">
          <button className={locked ? "inspector-header-icon active" : "inspector-header-icon"} aria-label={locked ? "Unlock shape" : "Lock shape"} onClick={() => onUpdate({ locked: !locked })}>
            {locked ? <LockKeyhole size={31} strokeWidth={2.4} /> : <LockKeyholeOpen size={31} strokeWidth={2.4} />}
          </button>
          <button className={shape.hidden ? "inspector-header-icon active" : "inspector-header-icon"} aria-label={shape.hidden ? "Show shape" : "Hide shape"} onClick={() => onUpdate({ hidden: !shape.hidden })}>
            <ToolbarHideSelectedIcon />
          </button>
        </div>
      </div>

      <div className="shape-state-card" role="group" aria-label="Shape mode">
        <button
          className={!shape.hole ? "active solid-choice" : "solid-choice"}
          onClick={() => {
            const wasHole = Boolean(shape.hole);
            onUpdate({ hole: false, color: solidColor });
            setColorOpen((open) => (wasHole ? false : !open));
          }}
          disabled={locked}
          aria-pressed={!shape.hole}
          aria-expanded={colorOpen}
        >
          <span className="large-solid-swatch" style={{ "--swatch": solidColor } as CSSProperties} />
          <span>Solid</span>
        </button>
        <button
          className={shape.hole ? "active hole-choice" : "hole-choice"}
          onClick={() => {
            onUpdate({ hole: true, color: "#b8c2cc" });
            setColorOpen(false);
          }}
          disabled={locked}
          aria-pressed={shape.hole}
        >
          <span className="large-hole-swatch" />
          <span>Hole</span>
        </button>
      </div>

      {colorOpen ? (
      <div className="color-card" aria-label="Shape color">
        <div className="color-card-header">
          <span>Color</span>
          <span className="color-value">{solidColor.toUpperCase()}</span>
        </div>
        <div className="color-grid">
          {solidColors.map((color) => (
            <button
              key={color}
              className={solidColor.toLowerCase() === color.toLowerCase() && !shape.hole ? "selected" : ""}
              type="button"
              style={{ "--shape-swatch": color } as CSSProperties}
              title={color.toUpperCase()}
              aria-label={`Set color ${color}`}
              disabled={locked}
              onClick={() => {
                onUpdate({ color, hole: false });
                setColorOpen(false);
              }}
            />
          ))}
          <label className={locked ? "custom-color disabled" : "custom-color"} title="Custom color">
            <input
              type="color"
              value={solidColor}
              disabled={locked}
              onChange={(event) => {
                onUpdate({ color: event.target.value, hole: false });
                setColorOpen(false);
              }}
            />
            <span>Custom</span>
          </label>
        </div>
      </div>
      ) : null}

      <div className="property-card">
        <button
          className="property-card-header"
          type="button"
          aria-expanded={propertiesOpen}
          aria-controls={`properties-${shape.id}`}
          onClick={() => setPropertiesOpen((open) => !open)}
        >
          <span>Properties</span>
          <ChevronUp className={propertiesOpen ? "" : "collapsed"} size={25} strokeWidth={2.8} />
        </button>
        {propertiesOpen ? (
          <div className="property-list" id={`properties-${shape.id}`}>
            {properties.map((property) => {
              if (property.type === "text") {
                return <TextProperty key={property.label} {...property} disabled={locked} />;
              }
              if (property.type === "select") {
                return <SelectProperty key={property.label} {...property} disabled={locked} />;
              }
              return <RangeProperty key={property.label} {...property} disabled={locked} />;
            })}
          </div>
        ) : null}
      </div>
      <div className="inspector-snap-dock">
        <SnapGridControl snap={snap} snapOpen={snapOpen} onSnapChange={onSnapChange} onSnapOpenChange={onSnapOpenChange} />
      </div>
    </aside>
  );
}

function SnapGridControl({
  snap,
  snapOpen,
  onSnapChange,
  onSnapOpenChange,
}: {
  snap: GridSize;
  snapOpen: boolean;
  onSnapChange: Dispatch<SetStateAction<GridSize>>;
  onSnapOpenChange: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <div className="snap-row">
      <span>Snap Grid</span>
      <button className="snap-select" onClick={() => onSnapOpenChange((value) => !value)}>
        {snap}
        <ChevronDown size={12} fill="currentColor" />
      </button>
      {snapOpen ? (
        <div className="snap-menu">
          {gridSizes.map((size) => (
            <button
              key={size}
              className={size === snap ? "selected" : ""}
              onClick={() => {
                onSnapChange(size);
                onSnapOpenChange(false);
              }}
            >
              {size}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AlignOverlay({
  overlay,
  onAlign,
  onPreview,
  onPreviewClear,
}: {
  overlay: AlignOverlayState;
  onAlign: (axis: AlignAxis, target: AlignTarget) => void;
  onPreview: (axis: AlignAxis, target: AlignTarget) => void;
  onPreviewClear: () => void;
}) {
  return (
    <div className="align-overlay" aria-label="Alignment handles">
      <svg className="align-guides" width="100%" height="100%" aria-hidden="true">
        {overlay.guides.map((guide) => (
          <line key={guide.key} x1={guide.x1} y1={guide.y1} x2={guide.x2} y2={guide.y2} />
        ))}
      </svg>
      {overlay.handles.map((handle) => (
        <button
          key={handle.key}
          className={`align-dot axis-${handle.axis} target-${handle.target} ${handle.disabled ? "disabled" : ""} ${handle.aligned ? "aligned" : ""}`}
          style={{ left: handle.x, top: handle.y }}
          aria-label={handle.title}
          title={handle.title}
          disabled={handle.disabled}
          onMouseEnter={() => {
            if (!handle.disabled) {
              onPreview(handle.axis, handle.target);
            }
          }}
          onMouseLeave={onPreviewClear}
          onFocus={() => {
            if (!handle.disabled) {
              onPreview(handle.axis, handle.target);
            }
          }}
          onBlur={onPreviewClear}
          onClick={(event) => {
            event.stopPropagation();
            onPreviewClear();
            onAlign(handle.axis, handle.target);
          }}
        />
      ))}
    </div>
  );
}

function MirrorOverlay({
  overlay,
  onMirror,
  onPreview,
  onPreviewClear,
}: {
  overlay: MirrorOverlayState;
  onMirror: (axis: AlignAxis) => void;
  onPreview: (axis: AlignAxis) => void;
  onPreviewClear: () => void;
}) {
  return (
    <div className="mirror-overlay" aria-label="Mirror handles">
      <svg className="mirror-guides" width="100%" height="100%" aria-hidden="true">
        {overlay.guides.map((guide) => (
          <line key={guide.key} x1={guide.x1} y1={guide.y1} x2={guide.x2} y2={guide.y2} />
        ))}
      </svg>
      {overlay.handles.map((handle) => (
        <button
          key={handle.key}
          className={`mirror-handle axis-${handle.axis}`}
          style={{ left: handle.x, top: handle.y, "--mirror-angle": `${handle.angle}deg` } as CSSProperties}
          aria-label={handle.title}
          title={handle.title}
          onMouseEnter={() => onPreview(handle.axis)}
          onMouseLeave={onPreviewClear}
          onFocus={() => onPreview(handle.axis)}
          onBlur={onPreviewClear}
          onClick={(event) => {
            event.stopPropagation();
            onPreviewClear();
            onMirror(handle.axis);
          }}
        >
          <svg className="mirror-handle-icon" viewBox="0 0 64 24" aria-hidden="true">
            <path d="M11 12h42" />
            <path d="m19 4-8 8 8 8" />
            <path d="m45 4 8 8-8 8" />
          </svg>
        </button>
      ))}
    </div>
  );
}

function TransformOverlay({
  box,
  measureKey,
  editingDimension,
  editingRotation,
  rotationReadout,
  showRotationWheel,
  hideDimensionMarks,
  rotationWheelAxis,
  onBeginTransform,
  onMoveTransform,
  onFinishTransform,
  onHoverMeasure,
  onPinMeasure,
  onBeginDimensionEdit,
  onBeginLiftEdit,
  onEditingDimensionChange,
  onCommitDimensionEdit,
  onCancelDimensionEdit,
  onBeginRotationEdit,
  onEditingRotationChange,
  onCommitRotationEdit,
  onCancelRotationEdit,
}: {
  box: TransformOverlayState;
  measureKey: string | null;
  editingDimension: EditingDimension;
  editingRotation: EditingRotation;
  rotationReadout: RotationReadout;
  showRotationWheel: boolean;
  hideDimensionMarks: boolean;
  rotationWheelAxis: RotationAxis;
  onBeginTransform: (kind: TransformHandleKind, handleKey: string, event: ReactPointerEvent<Element>) => void;
  onMoveTransform: (clientX: number, clientY: number, shiftKey?: boolean, altKey?: boolean) => boolean;
  onFinishTransform: (event: ReactPointerEvent<Element>) => void;
  onHoverMeasure: (key: string | null) => void;
  onPinMeasure: (key: string | null) => void;
  onBeginDimensionEdit: (mark: DimensionMark) => void;
  onBeginLiftEdit: (handleKey: string, x: number, y: number) => void;
  onEditingDimensionChange: (value: string) => void;
  onCommitDimensionEdit: () => void;
  onCancelDimensionEdit: () => void;
  onBeginRotationEdit: (handleKey: string, x: number, y: number) => void;
  onEditingRotationChange: (value: string) => void;
  onCommitRotationEdit: () => void;
  onCancelRotationEdit: () => void;
}) {
  const marks = measureKey ? (box.dimensions[measureKey] ?? []) : [];
  const visibleMarks = (hideDimensionMarks ? [] : marks).filter((mark) => mark.key !== editingDimension?.key);
  const handleMeasureKey = (handle: TransformOverlayState["handles"][number]) => measureKeyForHandle(handle.kind, handle.key, box);
  const protractorTicks = Array.from({ length: 16 }, (_, index) => {
    const degrees = index * 22.5 - 90;
    const radians = THREE.MathUtils.degToRad(degrees);
    const major = index % 2 === 0;
    const outer = 94;
    const inner = major ? 80 : 86;
    return {
      key: `tick-${index}`,
      major,
      x1: Math.cos(radians) * inner,
      y1: Math.sin(radians) * inner,
      x2: Math.cos(radians) * outer,
      y2: Math.sin(radians) * outer,
    };
  });
  const activeAngle = rotationReadout?.angle ?? 0;
  const activeRadians = THREE.MathUtils.degToRad(activeAngle - 90);
  const activeLine = {
    x: Math.cos(activeRadians) * 92,
    y: Math.sin(activeRadians) * 92,
  };
  const plane = box.rotationPlanes[rotationWheelAxis];
  const wheel = box.rotationWheels[rotationWheelAxis] ?? box.rotationWheel;
  return (
    <div className="transform-overlay" aria-hidden="true">
      {showRotationWheel && wheel && plane ? (
        <svg
          className={`rotation-protractor-plane axis-${rotationWheelAxis}`}
          viewBox={`0 0 ${box.width} ${box.height}`}
          preserveAspectRatio="none"
          onPointerDown={(event) => onBeginTransform("rotate", `rotate-wheel-${rotationWheelAxis}`, event)}
          onPointerMove={(event) => onMoveTransform(event.clientX, event.clientY, event.shiftKey, event.altKey)}
          onPointerUp={onFinishTransform}
          onPointerCancel={onFinishTransform}
        >
          <g transform={`matrix(${plane.a} ${plane.b} ${plane.c} ${plane.d} ${plane.x} ${plane.y})`}>
            <circle className="rotation-protractor-outer" cx="0" cy="0" r="94" />
            <circle className="rotation-protractor-inner" cx="0" cy="0" r="68" />
            {protractorTicks.map((tick) => (
              <line
                key={tick.key}
                className={tick.major ? "rotation-tick major" : "rotation-tick"}
                x1={tick.x1}
                y1={tick.y1}
                x2={tick.x2}
                y2={tick.y2}
              />
            ))}
            <line className="rotation-zero-line" x1="0" y1="0" x2="0" y2="-92" />
            <line className="rotation-current-line" x1="0" y1="0" x2={activeLine.x} y2={activeLine.y} />
            <text className="rotation-zero-label" x="0" y="-75">
              0°
            </text>
          </g>
        </svg>
      ) : null}
      <svg className="transform-guides" viewBox={`0 0 ${box.width} ${box.height}`} preserveAspectRatio="none">
        <defs>
          <marker id="dimension-arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="strokeWidth">
            <path d="M0 4 L8 0 L5.2 4 L8 8 Z" />
          </marker>
        </defs>
        {box.guides.map((line, index) => (
          <line key={`guide-${index}`} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
        ))}
        {visibleMarks.map((mark) => (
          <g key={mark.key} className="dimension-mark">
            <line className="dimension-extension" x1={mark.e1x1} y1={mark.e1y1} x2={mark.e1x2} y2={mark.e1y2} />
            <line className="dimension-extension" x1={mark.e2x1} y1={mark.e2y1} x2={mark.e2x2} y2={mark.e2y2} />
            <line className="dimension-line" x1={mark.x1} y1={mark.y1} x2={mark.x2} y2={mark.y2} />
          </g>
        ))}
      </svg>
      {visibleMarks.map((mark) => (
        <button
          key={`${mark.key}-label`}
          className="dimension-label"
          type="button"
          style={{ "--overlay-x": `${mark.labelX}px`, "--overlay-y": `${mark.labelY}px` } as CSSProperties}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onBeginDimensionEdit(mark)}
        >
          {mark.label}
        </button>
      ))}
      {editingDimension ? (
        <input
          className="dimension-input"
          style={{ "--overlay-x": `${editingDimension.x}px`, "--overlay-y": `${editingDimension.y}px` } as CSSProperties}
          value={editingDimension.value}
          autoFocus
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => onEditingDimensionChange(event.target.value)}
          onBlur={onCommitDimensionEdit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onCommitDimensionEdit();
            }
            if (event.key === "Escape") {
              onCancelDimensionEdit();
            }
          }}
        />
      ) : null}
      {editingRotation ? (
        <label className="rotation-edit" style={{ "--overlay-x": `${editingRotation.x}px`, "--overlay-y": `${editingRotation.y}px` } as CSSProperties}>
          <input
            value={editingRotation.value}
            autoFocus
            inputMode="decimal"
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) => onEditingRotationChange(event.target.value)}
            onBlur={onCommitRotationEdit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onCommitRotationEdit();
              }
              if (event.key === "Escape") {
                onCancelRotationEdit();
              }
            }}
          />
          <span>°</span>
        </label>
      ) : null}
      {box.handles.map((handle) => (
        <button
          key={handle.key}
          className={`transform-handle ${handle.className}`}
          style={{ "--overlay-x": `${handle.x}px`, "--overlay-y": `${handle.y}px` } as CSSProperties}
          title={handle.title}
          onPointerEnter={() => onHoverMeasure(handle.kind === "lift" ? null : handleMeasureKey(handle))}
          onPointerLeave={() => onHoverMeasure(null)}
          onPointerDown={(event) => {
            onPinMeasure(handleMeasureKey(handle));
            onBeginTransform(handle.kind, handle.key, event);
          }}
          onPointerMove={(event) => onMoveTransform(event.clientX, event.clientY, event.shiftKey, event.altKey)}
          onPointerUp={onFinishTransform}
          onPointerCancel={onFinishTransform}
          onClick={(event) => {
            if (handle.kind === "lift") {
              event.stopPropagation();
              onBeginLiftEdit(handle.key, handle.x + 42, handle.y - 32);
            }
          }}
        />
      ))}
      {box.rotateHandles.map((handle) => (
        <button
          key={handle.key}
          className={`rotate-handle ${handle.className}`}
          style={{ "--overlay-x": `${handle.x}px`, "--overlay-y": `${handle.y}px`, "--rotate-handle-angle": `${handle.angle}deg` } as CSSProperties}
          title="Rotate"
          onPointerDown={(event) => onBeginTransform("rotate", handle.key, event)}
          onPointerMove={(event) => onMoveTransform(event.clientX, event.clientY, event.shiftKey, event.altKey)}
          onPointerUp={onFinishTransform}
          onPointerCancel={onFinishTransform}
          onClick={(event) => {
            event.stopPropagation();
            onBeginRotationEdit(handle.key, handle.x + 34, handle.y - 28);
          }}
        >
          <span className="rotate-handle-icon" aria-hidden="true">
            <svg viewBox="0 0 150 150" focusable="false">
              <path d="m145.4 67.6-12.1 7.7c-6.6-10.8-22.1-27.4-43.6-31.5-3.7-0.7-8-1.3-14.1-1.3-21.5 0-41.5 9.8-55.1 28.9l-3.3 4.1-12.4-7.9c-1.3-0.7-3 0.1-2.9 1.8l1.1 36.1c0.3 1.7 2 2.5 3.1 1.7l30.2-17.6c1.4-0.6 1.4-2.9 0-3.5l-12.1-6.7c9.7-14.8 26.4-28.5 51.2-28.6 20.5-0.1 37.4 9.8 50.7 28.6l-12 6.5c-1.6 0.6-1.5 3.3 0 3.8l30.2 17.4c1.4 0.7 3 0 3-1.7l0.8-36c0-1.5-1.5-2.6-2.7-1.8z" />
            </svg>
          </span>
        </button>
      ))}
      {!hideDimensionMarks && rotationReadout ? (
        <div className="rotation-readout" style={{ "--overlay-x": `${rotationReadout.x}px`, "--overlay-y": `${rotationReadout.y}px` } as CSSProperties}>
          {rotationReadout.text}
        </div>
      ) : null}
    </div>
  );
}

type RangePropertyConfig = {
  type?: "range";
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
};

type TextPropertyConfig = {
  type: "text";
  label: string;
  value: string;
  onChange: (value: string) => void;
};

type SelectPropertyConfig = {
  type: "select";
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
};

type ShapePropertyConfig = RangePropertyConfig | TextPropertyConfig | SelectPropertyConfig;

function fallbackSolidColor(shape: WorkplaneShape) {
  if (shape.kind === "cylinder") return "#d97813";
  if (shape.kind === "sphere") return "#0098c7";
  if (shape.kind === "cone") return "#6e2786";
  if (shape.kind === "pyramid") return "#f2cf10";
  return "#d41721";
}

function formatPanelNumber(value: number) {
  return (Math.abs(value) < 0.005 ? 0 : value).toFixed(2);
}

function getShapeProperties(shape: WorkplaneShape, onUpdate: (patch: Partial<WorkplaneShape>) => void): ShapePropertyConfig[] {
  const width = shapeWidth(shape);
  const depth = shapeDepth(shape);
  const setWidth = (value: number) => onUpdate({ width: value, size: (value + depth) / 2 });
  const setDepth = (value: number) => onUpdate({ depth: value, size: (width + value) / 2 });
  const setBaseRadius = (value: number) => onUpdate({ baseRadius: value, width: value * 2, depth: value * 2, size: value * 2 });

  if (shape.kind === "box") {
    return [
      { label: "Radius", value: shape.radius ?? 0, min: 0, max: 10, onChange: (radius) => onUpdate({ radius }) },
      { label: "Steps", value: shape.steps ?? 10, min: 1, max: 64, step: 1, onChange: (steps) => onUpdate({ steps: Math.round(steps) }) },
      { label: "Length", value: depth, min: MIN_SHAPE_SIZE, max: 160, onChange: setDepth },
      { label: "Width", value: width, min: MIN_SHAPE_SIZE, max: 160, onChange: setWidth },
      { label: "Height", value: shape.height, min: MIN_SHAPE_SIZE, max: 160, onChange: (height) => onUpdate({ height }) },
    ];
  }

  if (shape.kind === "cylinder") {
    return [
      { label: "Sides", value: shape.sides ?? 96, min: 3, max: 128, step: 1, onChange: (sides) => onUpdate({ sides: Math.round(sides) }) },
      { label: "Bevel", value: shape.bevel ?? 0, min: 0, max: 10, onChange: (bevel) => onUpdate({ bevel }) },
      { label: "Segments", value: shape.segments ?? 1, min: 1, max: 24, step: 1, onChange: (segments) => onUpdate({ segments: Math.round(segments) }) },
    ];
  }

  if (shape.kind === "sphere") {
    return [{ label: "Steps", value: shape.steps ?? 24, min: 6, max: 64, step: 1, onChange: (steps) => onUpdate({ steps: Math.round(steps) }) }];
  }

  if (shape.kind === "halfSphere") {
    return [
      { label: "Steps", value: shape.steps ?? 32, min: 6, max: 64, step: 1, onChange: (steps) => onUpdate({ steps: Math.round(steps) }) },
      { label: "Length", value: depth, min: MIN_SHAPE_SIZE, max: 160, onChange: setDepth },
      { label: "Width", value: width, min: MIN_SHAPE_SIZE, max: 160, onChange: setWidth },
      { label: "Height", value: shape.height, min: MIN_SHAPE_SIZE, max: 160, onChange: (height) => onUpdate({ height }) },
    ];
  }

  if (shape.kind === "cone") {
    return [
      { label: "Top Radius", value: shape.topRadius ?? 0, min: 0, max: 40, onChange: (topRadius) => onUpdate({ topRadius }) },
      { label: "Base Radius", value: shape.baseRadius ?? width / 2, min: MIN_SHAPE_SIZE, max: 80, onChange: setBaseRadius },
      { label: "Height", value: shape.height, min: MIN_SHAPE_SIZE, max: 160, onChange: (height) => onUpdate({ height }) },
      { label: "Sides", value: shape.sides ?? 96, min: 3, max: 128, step: 1, onChange: (sides) => onUpdate({ sides: Math.round(sides) }) },
    ];
  }

  if (shape.kind === "pyramid") {
    return [{ label: "Sides", value: shape.sides ?? 4, min: 3, max: 24, step: 1, onChange: (sides) => onUpdate({ sides: Math.round(sides) }) }];
  }

  if (shape.kind === "roundRoof") {
    return [
      { label: "Sides", value: shape.sides ?? 64, min: 4, max: 128, step: 1, onChange: (sides) => onUpdate({ sides: Math.round(sides) }) },
      { label: "Length", value: depth, min: MIN_SHAPE_SIZE, max: 160, onChange: setDepth },
      { label: "Width", value: width, min: MIN_SHAPE_SIZE, max: 160, onChange: setWidth },
      { label: "Height", value: shape.height, min: MIN_SHAPE_SIZE, max: 160, onChange: (height) => onUpdate({ height }) },
    ];
  }

  if (shape.kind === "tube" || shape.kind === "ring") {
    return [
      { label: "Thickness", value: shape.bevel ?? 4, min: 0.5, max: 20, onChange: (bevel) => onUpdate({ bevel }) },
      { label: "Length", value: depth, min: MIN_SHAPE_SIZE, max: 160, onChange: setDepth },
      { label: "Width", value: width, min: MIN_SHAPE_SIZE, max: 160, onChange: setWidth },
      { label: "Height", value: shape.height, min: MIN_SHAPE_SIZE, max: 160, onChange: (height) => onUpdate({ height }) },
    ];
  }

  if (shape.kind === "text") {
    return [
      {
        type: "text",
        label: "Text",
        value: shape.text ?? "TEXT",
        onChange: (text) => {
          const nextText = text.slice(0, 24) || " ";
          const nextWidth = clamp(Math.max(46, nextText.length * 19), 46, 260);
          onUpdate({ text: nextText, width: nextWidth, size: nextWidth });
        },
      },
      { type: "select", label: "Font", value: shape.font ?? "Multilanguage", options: textFontOptions, onChange: (font) => onUpdate({ font }) },
      { label: "Height", value: shape.height, min: MIN_SHAPE_SIZE, max: 40, onChange: (height) => onUpdate({ height }) },
      { label: "Bevel", value: shape.bevel ?? 0, min: 0, max: 8, onChange: (bevel) => onUpdate({ bevel }) },
      { label: "Segments", value: shape.segments ?? 0, min: 0, max: 24, step: 1, onChange: (segments) => onUpdate({ segments: Math.round(segments) }) },
    ];
  }

  return [
    { label: "Length", value: depth, min: MIN_SHAPE_SIZE, max: 160, onChange: setDepth },
    { label: "Width", value: width, min: MIN_SHAPE_SIZE, max: 160, onChange: setWidth },
    { label: "Height", value: shape.height, min: MIN_SHAPE_SIZE, max: 160, onChange: (height) => onUpdate({ height }) },
  ];
}

function RangeProperty({ label, value, min, max, step = 0.01, disabled, onChange }: RangePropertyConfig & { disabled?: boolean }) {
  const safeValue = clamp(value, min, max);
  const position = ((safeValue - min) / Math.max(1, max - min)) * 100;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(formatPanelNumber(safeValue));
  const commitDraft = () => {
    const next = Number(draft);
    onChange(clamp(Number.isFinite(next) ? next : safeValue, min, max));
    setEditing(false);
  };
  return (
    <label className="range-property" style={{ "--slider-pos": `${position}%` } as CSSProperties}>
      <span>{label}</span>
      <div className="range-control">
        {editing ? (
          <input
            className="range-value-input"
            type="number"
            min={min}
            max={max}
            step={step}
            value={draft}
            autoFocus
            onChange={(event) => setDraft(event.currentTarget.value)}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              } else if (event.key === "Escape") {
                setDraft(formatPanelNumber(safeValue));
                setEditing(false);
              }
            }}
          />
        ) : (
          <output
            onDoubleClick={(event) => {
              if (disabled) {
                return;
              }
              event.preventDefault();
              setDraft(formatPanelNumber(safeValue));
              setEditing(true);
            }}
          >
            {formatPanelNumber(safeValue)}
          </output>
        )}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={safeValue}
          disabled={disabled}
          onChange={(event) => {
            const next = Number(event.currentTarget.value);
            onChange(clamp(Number.isFinite(next) ? next : min, min, max));
          }}
        />
      </div>
    </label>
  );
}

function TextProperty({ label, value, disabled, onChange }: TextPropertyConfig & { disabled?: boolean }) {
  return (
    <label className="text-property">
      <span>{label}</span>
      <input
        type="text"
        value={value}
        disabled={disabled}
        maxLength={24}
        spellCheck={false}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}

function SelectProperty({ label, value, options, disabled, onChange }: SelectPropertyConfig & { disabled?: boolean }) {
  return (
    <label className="select-property">
      <span>{label}</span>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.currentTarget.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function DimensionInput({
  label,
  value,
  min,
  max,
  step = 0.01,
  unit = "mm",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="dimension-input">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={formatPanelNumber(value)}
        onChange={(event) => {
          const next = Number(event.currentTarget.value);
          onChange(clamp(Number.isFinite(next) ? next : min, min, max));
        }}
      />
      <span>{unit}</span>
    </label>
  );
}

function WorkspaceSettingsModal({
  workspace,
  snap,
  onWorkspaceChange,
  onSnapChange,
  onClose,
}: {
  workspace: WorkspaceSettings;
  snap: GridSize;
  onWorkspaceChange: (next: WorkspaceSettings) => void;
  onSnapChange: (next: GridSize) => void;
  onClose: () => void;
}) {
  const patchWorkspace = (patch: Partial<WorkspaceSettings>) => onWorkspaceChange({ ...workspace, ...patch });
  const setDimension = (key: "width" | "depth", value: string) => {
    const next = clamp(Number.parseFloat(value) || DEFAULT_WORKSPACE[key], MIN_WORKSPACE_SIZE, MAX_WORKSPACE_SIZE);
    patchWorkspace({ [key]: next, sizePreset: "Custom" } as Partial<WorkspaceSettings>);
  };
  const setWorkspaceSizePreset = (sizePreset: string) => {
    const preset = workspaceSizePresets.find((entry) => entry.label === sizePreset);
    if (!preset || sizePreset === "Custom") {
      patchWorkspace({ sizePreset: "Custom" });
      return;
    }
    patchWorkspace({ sizePreset, width: preset.width, depth: preset.depth });
  };
  const setGridBlockPreset = (gridBlockPreset: string) => {
    patchWorkspace({ gridBlockPreset, gridBlockSize: gridBlockSizeForPreset(gridBlockPreset, workspace.gridBlockSize) });
  };
  const setGridBlockSize = (value: string) => {
    const next = clamp(Number.parseFloat(value) || DEFAULT_WORKSPACE.gridBlockSize, MIN_GRID_BLOCK_SIZE, MAX_GRID_BLOCK_SIZE);
    patchWorkspace({ gridBlockPreset: "Custom", gridBlockSize: next });
  };

  return (
    <div className="workspace-modal" role="dialog" aria-modal="true" aria-label="Workspace settings">
      <div className="workspace-modal-card" onPointerDown={(event) => event.stopPropagation()}>
        <header className="workspace-modal-header">
          <strong>Workspace settings</strong>
          <button aria-label="Close settings" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="workspace-modal-body">
          <div className="workspace-row">
            <span>Background color</span>
            <button
              className="workspace-color-button"
              style={{ "--workspace-bg": workspace.background } as CSSProperties}
              aria-label="Background color"
              onClick={() => patchWorkspace({ background: workspace.background === "#f8fbfc" ? "#eaf7fb" : "#f8fbfc" })}
            />
          </div>
          <WorkspaceToggle label="Show shadows" checked={workspace.showShadows} onChange={(showShadows) => patchWorkspace({ showShadows })} />
          <WorkspaceToggle label="Show grid" checked={workspace.showGrid} onChange={(showGrid) => patchWorkspace({ showGrid })} />
          <WorkspaceToggle
            label="Cruise when adding new shapes"
            checked={workspace.cruiseShapes}
            onChange={(cruiseShapes) => patchWorkspace({ cruiseShapes })}
          />

          <label className="workspace-range">
            <span>Zoom speed</span>
            <input
              type="range"
              min={1}
              max={10}
              value={workspace.zoomSpeed}
              onChange={(event) => patchWorkspace({ zoomSpeed: Number(event.currentTarget.value) })}
            />
            <small>
              <span>Slow</span>
              <span>Fast</span>
            </small>
          </label>

          <WorkspaceSelect
            label="Units"
            value={workspace.units}
            options={["Metric (Default)", "Imperial", "Bricks"]}
            onChange={(units) => patchWorkspace({ units })}
          />
          <WorkspaceSelect
            label="Scale"
            value={workspace.scale}
            options={["1:1 (millimeters)", "1:10 (centimeters)", "1:100 (meters)", "1:1000 (meters)"]}
            onChange={(scale) => patchWorkspace({ scale })}
          />
          <WorkspaceSelect label="Snap Grid" value={snap} options={gridSizes} onChange={(next) => onSnapChange(next as GridSize)} />
          <WorkspaceSelect
            label="Workplane size"
            value={workspace.sizePreset}
            options={workspaceSizePresets.map((preset) => preset.label)}
            onChange={setWorkspaceSizePreset}
          />

          <div className="workspace-dimensions">
            <label>
              <span>Width</span>
              <input
                type="number"
                value={workspace.width.toFixed(2)}
                min={MIN_WORKSPACE_SIZE}
                max={MAX_WORKSPACE_SIZE}
                step={1}
                onChange={(event) => setDimension("width", event.currentTarget.value)}
              />
            </label>
            <label>
              <span>Length</span>
              <input
                type="number"
                value={workspace.depth.toFixed(2)}
                min={MIN_WORKSPACE_SIZE}
                max={MAX_WORKSPACE_SIZE}
                step={1}
                onChange={(event) => setDimension("depth", event.currentTarget.value)}
              />
            </label>
          </div>
          <WorkspaceSelect label="Grid block size" value={workspace.gridBlockPreset} options={gridBlockPresets} onChange={setGridBlockPreset} />
          {workspace.gridBlockPreset === "Custom" ? (
            <div className="workspace-dimensions workspace-grid-dimensions">
              <label>
                <span>Block size</span>
                <input
                  type="number"
                  value={workspace.gridBlockSize.toFixed(2)}
                  min={MIN_GRID_BLOCK_SIZE}
                  max={MAX_GRID_BLOCK_SIZE}
                  step={0.5}
                  onChange={(event) => setGridBlockSize(event.currentTarget.value)}
                />
              </label>
            </div>
          ) : null}

          <button className="make-default-button" onClick={() => onWorkspaceChange(DEFAULT_WORKSPACE)}>
            Make default
          </button>
        </div>
      </div>
      <button className="workspace-modal-backdrop" aria-label="Close settings" onClick={onClose} />
    </div>
  );
}

function WorkspaceToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="workspace-toggle">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} />
    </label>
  );
}

function WorkspaceSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="workspace-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.currentTarget.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function createThreeScene(host: HTMLDivElement): ThreeState {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: shouldPreserveDrawingBufferForLocalAutomation() });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = DEFAULT_WORKSPACE.showShadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f8fbfc");

  const camera = new THREE.PerspectiveCamera(38, host.clientWidth / Math.max(1, host.clientHeight), 0.1, 6000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.58;
  controls.zoomSpeed = 0.72;
  controls.panSpeed = 0.65;
  controls.screenSpacePanning = true;
  controls.zoomToCursor = true;
  controls.mouseButtons = {
    LEFT: null,
    MIDDLE: THREE.MOUSE.PAN,
    RIGHT: THREE.MOUSE.ROTATE,
  };
  controls.minDistance = 18;
  controls.maxDistance = 4200;
  controls.minPolarAngle = 0.06;
  controls.maxPolarAngle = Math.PI * 0.68;
  controls.target.copy(CAMERA_TARGET);

  const ambient = new THREE.HemisphereLight("#ffffff", "#d6edf5", 2.1);
  scene.add(ambient);

  const key = new THREE.DirectionalLight("#ffffff", 3.1);
  key.position.set(70, 130, 75);
  key.castShadow = true;
  key.shadow.camera.left = -130;
  key.shadow.camera.right = 130;
  key.shadow.camera.top = 130;
  key.shadow.camera.bottom = -130;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.00008;
  key.shadow.normalBias = 0.045;
  scene.add(key);

  const fill = new THREE.DirectionalLight("#c8f4ff", 1.2);
  fill.position.set(-95, 45, -60);
  scene.add(fill);

  const workplaneLayer = new THREE.Group();
  workplaneLayer.name = "Workplane";
  const shapeLayer = new THREE.Group();
  shapeLayer.name = "Shapes";
  const helperLayer = new THREE.Group();
  helperLayer.name = "SelectionHelpers";
  scene.add(workplaneLayer, shapeLayer, helperLayer);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  const resize = () => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    state.needsRender = true;
  };

  const state = {
    renderer,
    scene,
    camera,
    controls,
    workplaneLayer,
    shapeLayer,
    helperLayer,
    raycaster,
    pointer,
    dragPlane,
    animationId: 0,
    needsRender: true,
    wasCameraMoving: false,
    lastOverlaySync: 0,
    lastViewCubeSync: 0,
    rotationHandleSides: null,
    disposeInteractionListeners: () => {},
    resize,
  };
  const requestRender = () => {
    state.needsRender = true;
  };
  const configureSketchForgeMouseButtons = (event: PointerEvent) => {
    controls.mouseButtons.LEFT = event.button === 0 && (event.ctrlKey || event.metaKey) ? THREE.MOUSE.PAN : null;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
  };
  const resetSketchForgeMouseButtons = () => {
    controls.mouseButtons.LEFT = null;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
  };
  const preventContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };
  controls.addEventListener("change", requestRender);
  renderer.domElement.addEventListener("pointerdown", configureSketchForgeMouseButtons, { capture: true });
  renderer.domElement.addEventListener("pointerup", resetSketchForgeMouseButtons);
  renderer.domElement.addEventListener("pointercancel", resetSketchForgeMouseButtons);
  renderer.domElement.addEventListener("contextmenu", preventContextMenu);
  renderer.domElement.addEventListener("wheel", requestRender, { passive: true });
  renderer.domElement.addEventListener("pointerdown", requestRender);
  state.disposeInteractionListeners = () => {
    controls.removeEventListener("change", requestRender);
    renderer.domElement.removeEventListener("pointerdown", configureSketchForgeMouseButtons, { capture: true });
    renderer.domElement.removeEventListener("pointerup", resetSketchForgeMouseButtons);
    renderer.domElement.removeEventListener("pointercancel", resetSketchForgeMouseButtons);
    renderer.domElement.removeEventListener("contextmenu", preventContextMenu);
    renderer.domElement.removeEventListener("wheel", requestRender);
    renderer.domElement.removeEventListener("pointerdown", requestRender);
  };
  rebuildWorkplane(state, DEFAULT_WORKSPACE);
  return state;
}

function resetCamera(state: ThreeState) {
  state.camera.position.copy(CAMERA_HOME);
  state.controls.target.copy(CAMERA_TARGET);
  state.camera.lookAt(CAMERA_TARGET);
  state.camera.updateProjectionMatrix();
  state.controls.update();
}

function constrainCamera(state: ThreeState, workspace: WorkspaceSettings) {
  const target = state.controls.target;
  const previousTarget = target.clone();
  target.x = clamp(target.x, -workspace.width / 2, workspace.width / 2);
  target.y = clamp(target.y, CAMERA_MIN_TARGET_Y, CAMERA_MAX_TARGET_Y);
  target.z = clamp(target.z, -workspace.depth / 2, workspace.depth / 2);

  const targetShift = target.clone().sub(previousTarget);
  if (targetShift.lengthSq() > 0) {
    state.camera.position.add(targetShift);
    state.camera.updateProjectionMatrix();
  }
}

function syncViewCube(state: ThreeState, cube: HTMLDivElement | null) {
  if (!cube) {
    return;
  }

  const offset = state.camera.position.clone().sub(state.controls.target);
  const horizontalDistance = Math.max(0.001, Math.hypot(offset.x, offset.z));
  const pitch = THREE.MathUtils.radToDeg(Math.atan2(offset.y, horizontalDistance));
  const yaw = THREE.MathUtils.radToDeg(Math.atan2(offset.x, offset.z));
  cube.style.transform = `rotateX(${pitch}deg) rotateY(${-yaw}deg)`;
}

function rebuildWorkplane(state: ThreeState | null, workspace: WorkspaceSettings) {
  if (!state) {
    return;
  }

  disposeChildren(state.workplaneLayer);
  state.scene.background = new THREE.Color(workspace.background);
  state.renderer.shadowMap.enabled = workspace.showShadows;
  state.controls.zoomSpeed = 0.28 + workspace.zoomSpeed * 0.09;

  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(workspace.width, workspace.depth),
    new THREE.MeshStandardMaterial({
      color: "#ddf8ff",
      transparent: true,
      opacity: 0.68,
      roughness: 0.92,
      side: THREE.FrontSide,
    }),
  );
  base.name = "WorkplaneBase";
  base.rotation.x = -Math.PI / 2;
  base.receiveShadow = workspace.showShadows;
  state.workplaneLayer.add(base);

  if (workspace.showGrid) {
    state.workplaneLayer.add(createGridLines(workspace.width, workspace.depth, workspace.gridBlockSize));
  }
}

function createGridLines(width = WORKPLANE_WIDTH, depth = WORKPLANE_DEPTH, blockSize = DEFAULT_WORKSPACE.gridBlockSize) {
  const group = new THREE.Group();
  const minor = new THREE.LineBasicMaterial({ color: "#91dff0", transparent: true, opacity: 0.55 });
  const major = new THREE.LineBasicMaterial({ color: "#4bbddf", transparent: true, opacity: 0.7 });
  const axis = new THREE.LineBasicMaterial({ color: "#34aad2", transparent: true, opacity: 0.88 });
  const minorPoints: number[] = [];
  const majorPoints: number[] = [];
  const axisPoints: number[] = [];
  const borderPoints: number[] = [];
  const pushLine = (points: number[], from: [number, number, number], to: [number, number, number]) => {
    points.push(...from, ...to);
  };
  const step = clamp(blockSize, MIN_GRID_BLOCK_SIZE, MAX_GRID_BLOCK_SIZE);
  const majorEvery = 4;
  const xCount = Math.floor(width / step);
  const zCount = Math.floor(depth / step);

  for (let index = 0; index <= xCount; index += 1) {
    const x = -width / 2 + index * step;
    const centeredX = Math.abs(x) < 0.0001 ? 0 : x;
    const points = centeredX === 0 ? axisPoints : index % majorEvery === 0 ? majorPoints : minorPoints;
    pushLine(points, [centeredX, 0.04, -depth / 2], [centeredX, 0.04, depth / 2]);
  }

  for (let index = 0; index <= zCount; index += 1) {
    const z = -depth / 2 + index * step;
    const centeredZ = Math.abs(z) < 0.0001 ? 0 : z;
    const points = centeredZ === 0 ? axisPoints : index % majorEvery === 0 ? majorPoints : minorPoints;
    pushLine(points, [-width / 2, 0.04, centeredZ], [width / 2, 0.04, centeredZ]);
  }

  const border = new THREE.LineBasicMaterial({ color: "#58c5e6", transparent: true, opacity: 0.9 });
  pushLine(borderPoints, [-width / 2, 0.08, -depth / 2], [width / 2, 0.08, -depth / 2]);
  pushLine(borderPoints, [width / 2, 0.08, -depth / 2], [width / 2, 0.08, depth / 2]);
  pushLine(borderPoints, [width / 2, 0.08, depth / 2], [-width / 2, 0.08, depth / 2]);
  pushLine(borderPoints, [-width / 2, 0.08, depth / 2], [-width / 2, 0.08, -depth / 2]);

  group.add(linesFromPoints(minorPoints, minor));
  group.add(linesFromPoints(majorPoints, major));
  group.add(linesFromPoints(axisPoints, axis));
  group.add(linesFromPoints(borderPoints, border));

  return group;
}

function linesFromPoints(points: number[], material: THREE.LineBasicMaterial) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  return new THREE.LineSegments(geometry, material);
}

function rebuildShapes(state: ThreeState | null, shapes: WorkplaneShape[], selectedIds: string[]) {
  if (!state) {
    return;
  }

  disposeChildren(state.shapeLayer);

  const selected = new Set(selectedIds);
  shapes.forEach((shape) => {
    if (shape.hidden) {
      return;
    }
    const object = createShapeObject(shape, selected.has(shape.id), () => {
      state.needsRender = true;
    });
    state.shapeLayer.add(object);

  });

  rebuildSelectionHelpers(state, shapes, selectedIds);
}

function rebuildSelectionHelpers(state: ThreeState | null, shapes: WorkplaneShape[], selectedIds: string[]) {
  if (!state) {
    return;
  }

  disposeChildren(state.helperLayer);
  selectedIds.forEach((id) => {
    const shape = shapes.find((entry) => entry.id === id && !entry.hidden);
    if (!shape) {
      return;
    }
    const shadow = createSelectedGroundFootprint(shape);
    if (shadow) {
      state.helperLayer.add(shadow);
    }
  });
}

function formatMeasure(value: number) {
  return cleanNearZero(value).toFixed(2);
}

function makeDimensionMark(
  key: string,
  handleKey: string,
  axis: DimensionMark["axis"],
  label: string,
  fromWorld: THREE.Vector3,
  toWorld: THREE.Vector3,
  outwardWorld: THREE.Vector3,
  project: (point: THREE.Vector3) => { x: number; y: number },
): DimensionMark {
  const from = project(fromWorld);
  const to = project(toWorld);
  const outwardAxis = outwardWorld.clone();
  outwardAxis.normalize();

  const railOffset = 5.8;
  const extensionOverrun = 1.4;
  const labelOffset = 3.2;
  const railFrom = project(fromWorld.clone().add(outwardAxis.clone().multiplyScalar(railOffset)));
  const railTo = project(toWorld.clone().add(outwardAxis.clone().multiplyScalar(railOffset)));
  const extensionFrom = project(fromWorld.clone().add(outwardAxis.clone().multiplyScalar(railOffset + extensionOverrun)));
  const extensionTo = project(toWorld.clone().add(outwardAxis.clone().multiplyScalar(railOffset + extensionOverrun)));
  const labelPoint = project(
    fromWorld
      .clone()
      .lerp(toWorld, 0.5)
      .add(outwardAxis.clone().multiplyScalar(railOffset + labelOffset)),
  );

  return {
    key,
    handleKey,
    axis,
    label,
    x1: railFrom.x,
    y1: railFrom.y,
    x2: railTo.x,
    y2: railTo.y,
    e1x1: from.x,
    e1y1: from.y,
    e1x2: extensionFrom.x,
    e1y2: extensionFrom.y,
    e2x1: to.x,
    e2y1: to.y,
    e2x2: extensionTo.x,
    e2y2: extensionTo.y,
    labelX: labelPoint.x,
    labelY: labelPoint.y,
  };
}

function updateTransformOverlayIfChanged(
  overlayRef: MutableRefObject<TransformOverlayState | null>,
  setOverlay: Dispatch<SetStateAction<TransformOverlayState | null>>,
  next: TransformOverlayState,
) {
  if (overlayRef.current && JSON.stringify(overlayRef.current) === JSON.stringify(next)) {
    return;
  }
  overlayRef.current = next;
  setOverlay(next);
}

function syncTransformOverlay(
  state: ThreeState,
  shapes: WorkplaneShape[],
  selectedIds: string[],
  overlayRef: MutableRefObject<TransformOverlayState | null>,
  setOverlay: Dispatch<SetStateAction<TransformOverlayState | null>>,
  keepVisibleDuringInteraction = false,
) {
  if (selectedIds.length < 1) {
    if (overlayRef.current) {
      overlayRef.current = null;
      setOverlay(null);
    }
    return;
  }

  const frame = selectionFrameForShapes(shapes, selectedIds);
  if (!frame) {
    if (overlayRef.current) {
      overlayRef.current = null;
      setOverlay(null);
    }
    return;
  }

  const rect = state.renderer.domElement.getBoundingClientRect();
  // Future edits: do not remove this. The transform overlay is projected with
  // Vector3.project(), outside Three's renderer. With OrbitControls damping, the
  // camera matrix can otherwise be one frame stale, making handles/lines trail.
  state.camera.updateMatrixWorld();
  const corners = selectionFrameCorners(frame);
  const projectedCorners = corners.map((corner) => {
    const cameraSpace = corner.clone().applyMatrix4(state.camera.matrixWorldInverse);
    const projected = corner.clone().project(state.camera);
    return { cameraSpace, projected };
  });
  const nearPlane = state.camera instanceof THREE.PerspectiveCamera ? state.camera.near : 0.1;
  const selectionRadius = Math.max(MIN_SHAPE_SIZE, Math.sqrt(frame.width ** 2 + frame.height ** 2 + frame.depth ** 2) / 2);
  const cameraDistance = state.camera.position.distanceTo(frame.center);
  // When zoomed into/through a selected object, the projected overlay can span
  // thousands of pixels even before any corner crosses the near plane. Hide it
  // at that depth instead of drawing misleading dashed lines across the scene.
  const cameraInsideSelection = cameraDistance < selectionRadius * 1.12;
  const projectionInvalid = projectedCorners.some(({ cameraSpace, projected }) => cameraSpace.z > -nearPlane * 1.5 || !Number.isFinite(projected.x) || !Number.isFinite(projected.y));
  const projectedSpanTooLarge = (() => {
    const xs = projectedCorners.map(({ projected }) => ((projected.x + 1) / 2) * rect.width);
    const ys = projectedCorners.map(({ projected }) => ((1 - projected.y) / 2) * rect.height);
    return Math.max(...xs) - Math.min(...xs) > rect.width * 4 || Math.max(...ys) - Math.min(...ys) > rect.height * 4;
  })();
  const overlayTooClose = projectionInvalid || (!keepVisibleDuringInteraction && (cameraInsideSelection || projectedSpanTooLarge));
  if (overlayTooClose) {
    if (overlayRef.current) {
      overlayRef.current = null;
      setOverlay(null);
    }
    return;
  }
  const project = (point: THREE.Vector3) => {
    const projected = point.clone().project(state.camera);
    return {
      x: ((projected.x + 1) / 2) * rect.width,
      y: ((1 - projected.y) / 2) * rect.height,
    };
  };

  const worldMinY = Math.min(...corners.map((corner) => corner.y));
  const worldMaxY = Math.max(...corners.map((corner) => corner.y));
  const worldMinX = Math.min(...corners.map((corner) => corner.x));
  const worldMaxX = Math.max(...corners.map((corner) => corner.x));
  const worldMinZ = Math.min(...corners.map((corner) => corner.z));
  const worldMaxZ = Math.max(...corners.map((corner) => corner.z));
  const worldCenterX = (worldMinX + worldMaxX) / 2;
  const worldCenterY = (worldMinY + worldMaxY) / 2;
  const worldCenterZ = (worldMinZ + worldMaxZ) / 2;
  const worldCenter = new THREE.Vector3(worldCenterX, worldCenterY, worldCenterZ);
  const worldHeight = Math.max(MIN_SHAPE_SIZE, worldMaxY - worldMinY);
  const liftOffset = Math.max(2, worldHeight * 0.08);
  const verticalBase = new THREE.Vector3(worldCenterX, worldMinY, worldCenterZ);
  const verticalTop = new THREE.Vector3(worldCenterX, worldMaxY, worldCenterZ);
  const showLowerHandles = state.camera.position.y < frame.center.y;
  const liftHandle = new THREE.Vector3(worldCenterX, showLowerHandles ? worldMinY - liftOffset : worldMaxY + liftOffset, worldCenterZ);
  const xFootAxis = frame.xAxis.clone().normalize();
  const yFootAxis = frame.yAxis.clone().normalize();
  const zFootAxis = frame.zAxis.clone().normalize();
  const localBottomY = frame.min.y;
  const localTopY = frame.max.y;
  const footprintWorld = {
    nearLeft: framePoint(frame, frame.min.x, localBottomY, frame.max.z),
    nearRight: framePoint(frame, frame.max.x, localBottomY, frame.max.z),
    farRight: framePoint(frame, frame.max.x, localBottomY, frame.min.z),
    farLeft: framePoint(frame, frame.min.x, localBottomY, frame.min.z),
    near: framePoint(frame, 0, localBottomY, frame.max.z),
    right: framePoint(frame, frame.max.x, localBottomY, 0),
    far: framePoint(frame, 0, localBottomY, frame.min.z),
    left: framePoint(frame, frame.min.x, localBottomY, 0),
  };
  const bottomCenterWorld = framePoint(frame, 0, localBottomY, 0);
  const topCenterWorld = framePoint(frame, 0, localTopY, 0);
  const bottom = {
    nearLeft: project(footprintWorld.nearLeft),
    nearRight: project(footprintWorld.nearRight),
    farRight: project(footprintWorld.farRight),
    farLeft: project(footprintWorld.farLeft),
  };
  const mid = {
    near: project(footprintWorld.near),
    right: project(footprintWorld.right),
    far: project(footprintWorld.far),
    left: project(footprintWorld.left),
  };
  const bottomCenterPoint = project(bottomCenterWorld);
  const topPoint = project(topCenterWorld);
  const heightPoint = project(showLowerHandles ? bottomCenterWorld : topCenterWorld);
  const liftPoint = project(liftHandle);
  const centerPoint = project(frame.center);
  const footprintGuides = [
    { x1: bottom.nearLeft.x, y1: bottom.nearLeft.y, x2: bottom.nearRight.x, y2: bottom.nearRight.y },
    { x1: bottom.nearRight.x, y1: bottom.nearRight.y, x2: bottom.farRight.x, y2: bottom.farRight.y },
    { x1: bottom.farRight.x, y1: bottom.farRight.y, x2: bottom.farLeft.x, y2: bottom.farLeft.y },
    { x1: bottom.farLeft.x, y1: bottom.farLeft.y, x2: bottom.nearLeft.x, y2: bottom.nearLeft.y },
  ];
  const widthLabel = formatMeasure(frame.width);
  const depthLabel = formatMeasure(frame.depth);
  const heightLabel = formatMeasure(frame.height);
  const nearOut = zFootAxis;
  const farOut = zFootAxis.clone().multiplyScalar(-1);
  const rightOut = xFootAxis;
  const leftOut = xFootAxis.clone().multiplyScalar(-1);
  const heightHandleKey = showLowerHandles ? "bottom-height" : "top-height";
  const liftHandleKey = showLowerHandles ? "lower-shape" : "lift-shape";
  const workplaneAnchor = new THREE.Vector3(worldCenterX, 0, worldCenterZ);
  const liftLabel = formatMeasure(worldMinY);
  const makeFootprintDimensionMark = (handleKey: string, axis: "width" | "depth") => {
    if (axis === "width") {
      const useFarSide = handleKey.includes("far") || handleKey.includes("left");
      return makeDimensionMark(
        `${handleKey}-width`,
        handleKey,
        "width",
        widthLabel,
        useFarSide ? footprintWorld.farLeft : footprintWorld.nearLeft,
        useFarSide ? footprintWorld.farRight : footprintWorld.nearRight,
        useFarSide ? farOut : nearOut,
        project,
      );
    }
    const useLeftSide = handleKey.includes("left") || handleKey.includes("far");
    return makeDimensionMark(
      `${handleKey}-depth`,
      handleKey,
      "depth",
      depthLabel,
      useLeftSide ? footprintWorld.nearLeft : footprintWorld.nearRight,
      useLeftSide ? footprintWorld.farLeft : footprintWorld.farRight,
      useLeftSide ? leftOut : rightOut,
      project,
    );
  };
  const footprintHandleKeys = ["near-left", "near-right", "far-right", "far-left", "near-mid", "right-mid", "far-mid", "left-mid"];
  const footprintDimensionMarks = Object.fromEntries(
    footprintHandleKeys.map((handleKey) => {
      const axes = new Set<"width" | "depth">();
      if (handleKey.includes("left") || handleKey.includes("right")) {
        axes.add("width");
      }
      if (handleKey.includes("near") || handleKey.includes("far")) {
        axes.add("depth");
      }
      return [handleKey, Array.from(axes).map((axis) => makeFootprintDimensionMark(handleKey, axis))];
    }),
  );
  const dimensionMarks = {
    ...footprintDimensionMarks,
    [heightHandleKey]: [makeDimensionMark("height", heightHandleKey, "height", heightLabel, bottomCenterWorld, topCenterWorld, rightOut, project)],
    [liftHandleKey]: [makeDimensionMark("elevation", liftHandleKey, "elevation", liftLabel, workplaneAnchor, verticalBase, rightOut, project)],
  };
  const screenOffsetFromCenter = (point: { x: number; y: number }, distance: number) => {
    const dx = point.x - centerPoint.x;
    const dy = point.y - centerPoint.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    return {
      x: point.x + (dx / length) * distance,
      y: point.y + (dy / length) * distance,
    };
  };
  const rotationSides = rotationHandleSidesForCamera(state, worldCenter);
  const sidePoint = (side: RotationHandleSide, y: number) => {
    if (side === "right") {
      return new THREE.Vector3(worldMaxX, y, worldCenterZ);
    }
    if (side === "left") {
      return new THREE.Vector3(worldMinX, y, worldCenterZ);
    }
    if (side === "near") {
      return new THREE.Vector3(worldCenterX, y, worldMaxZ);
    }
    return new THREE.Vector3(worldCenterX, y, worldMinZ);
  };
  const rotateLeft = screenOffsetFromCenter(project(sidePoint(rotationSides.x, worldMaxY)), 24);
  const rotateRight = screenOffsetFromCenter(project(sidePoint(rotationSides.z, worldMaxY)), 28);
  const rotateBottom = screenOffsetFromCenter(project(sidePoint(rotationSides.y, worldMinY)), 34);
  const xFaceCenter = sidePoint(rotationSides.x, worldCenterY);
  const zFaceCenter = sidePoint(rotationSides.z, worldCenterY);
  const yFaceCenter = verticalBase;
  const planeRadius = 154;
  const planeWorldStep = Math.max(12, Math.max(frame.width, frame.depth, frame.height) * 0.78);
  const makePlaneView = (centerWorld: THREE.Vector3, uAxis: THREE.Vector3, vAxis: THREE.Vector3): RotationPlaneView => {
    const screenCenter = project(centerWorld);
    const u = project(centerWorld.clone().add(uAxis.clone().multiplyScalar(planeWorldStep)));
    const v = project(centerWorld.clone().add(vAxis.clone().multiplyScalar(planeWorldStep)));
    const du = { x: u.x - screenCenter.x, y: u.y - screenCenter.y };
    const dv = { x: v.x - screenCenter.x, y: v.y - screenCenter.y };
    const longest = Math.max(12, Math.hypot(du.x, du.y), Math.hypot(dv.x, dv.y));
    const scale = planeRadius / longest / 100;
    return {
      x: screenCenter.x,
      y: screenCenter.y,
      a: du.x * scale,
      b: du.y * scale,
      c: dv.x * scale,
      d: dv.y * scale,
    };
  };
  const makeWheel = (centerWorld: THREE.Vector3) => {
    const screenCenter = project(centerWorld);
    return { x: screenCenter.x, y: screenCenter.y, radius: planeRadius };
  };
  const makeWorldPoint = (point: THREE.Vector3) => ({ x: point.x, y: point.y, z: point.z });
  const rotationWheels: Record<RotationAxis, { x: number; y: number; radius: number }> = {
    x: makeWheel(xFaceCenter),
    y: makeWheel(yFaceCenter),
    z: makeWheel(zFaceCenter),
  };
  const rotationPlaneCenters: Record<RotationAxis, { x: number; y: number; z: number }> = {
    x: makeWorldPoint(xFaceCenter),
    y: makeWorldPoint(yFaceCenter),
    z: makeWorldPoint(zFaceCenter),
  };
  const rotationPlanes: Record<RotationAxis, RotationPlaneView> = {
    x: makePlaneView(xFaceCenter, zFootAxis, yFootAxis),
    y: makePlaneView(yFaceCenter, xFootAxis, zFootAxis),
    z: makePlaneView(zFaceCenter, xFootAxis, yFootAxis),
  };

  const next = {
    id: frame.ids.join("|"),
    width: rect.width,
    height: rect.height,
    guides: [
      { x1: topPoint.x, y1: topPoint.y, x2: bottomCenterPoint.x, y2: bottomCenterPoint.y },
      ...footprintGuides,
    ],
    handles: [
      { key: "near-left", className: "corner", kind: "scale" as const, x: bottom.nearLeft.x, y: bottom.nearLeft.y, title: "Resize" },
      { key: "near-right", className: "corner", kind: "scale" as const, x: bottom.nearRight.x, y: bottom.nearRight.y, title: "Resize" },
      { key: "far-right", className: "corner", kind: "scale" as const, x: bottom.farRight.x, y: bottom.farRight.y, title: "Resize" },
      { key: "far-left", className: "corner", kind: "scale" as const, x: bottom.farLeft.x, y: bottom.farLeft.y, title: "Resize" },
      { key: "near-mid", className: "edge dark", kind: "scale" as const, x: mid.near.x, y: mid.near.y, title: "Resize" },
      { key: "right-mid", className: "edge dark", kind: "scale" as const, x: mid.right.x, y: mid.right.y, title: "Resize" },
      { key: "far-mid", className: "edge dark", kind: "scale" as const, x: mid.far.x, y: mid.far.y, title: "Resize" },
      { key: "left-mid", className: "edge dark", kind: "scale" as const, x: mid.left.x, y: mid.left.y, title: "Resize" },
      { key: heightHandleKey, className: "height-top", kind: "height" as const, x: heightPoint.x, y: heightPoint.y, title: "Height" },
      { key: liftHandleKey, className: showLowerHandles ? "height-lift lower" : "height-lift", kind: "lift" as const, x: liftPoint.x, y: liftPoint.y, title: "Lift" },
    ],
    rotateHandles: [
      { key: "rotate-left", className: "screen-left", x: rotateLeft.x, y: rotateLeft.y, angle: ROTATION_UPPER_HANDLE_ICON_ANGLE },
      { key: "rotate-right", className: "screen-right", x: rotateRight.x, y: rotateRight.y, angle: ROTATION_UPPER_HANDLE_ICON_ANGLE },
      { key: "rotate-bottom", className: "screen-bottom", x: rotateBottom.x, y: rotateBottom.y, angle: ROTATION_BOTTOM_HANDLE_ICON_ANGLE },
    ],
    dimensions: dimensionMarks,
    rotationWheel: rotationWheels.y,
    rotationWheels,
    rotationPlaneCenters,
    rotationPlanes,
  };

  updateTransformOverlayIfChanged(overlayRef, setOverlay, next);
}

function syncAlignOverlay(
  state: ThreeState,
  shapes: WorkplaneShape[],
  selectedIds: string[],
  alignMode: boolean,
  alignAnchorId: string | null,
  statuses: AlignHandleStatus[],
  overlayRef: MutableRefObject<AlignOverlayState | null>,
  setOverlay: Dispatch<SetStateAction<AlignOverlayState | null>>,
) {
  const clear = () => {
    if (overlayRef.current) {
      overlayRef.current = null;
      setOverlay(null);
    }
  };

  if (!alignMode || selectedIds.length < 2) {
    clear();
    return;
  }

  const selectedFrame = selectionFrameForShapes(shapes, selectedIds);
  const anchorFrame = alignAnchorId && selectedIds.includes(alignAnchorId) ? selectionFrameForShapes(shapes, [alignAnchorId]) : null;
  const frame = anchorFrame ?? selectedFrame;
  if (!frame) {
    clear();
    return;
  }

  const rect = state.renderer.domElement.getBoundingClientRect();
  state.camera.updateMatrixWorld();
  const corners = selectionFrameCorners(frame);
  const projectedCorners = corners.map((corner) => {
    const cameraSpace = corner.clone().applyMatrix4(state.camera.matrixWorldInverse);
    const projected = corner.clone().project(state.camera);
    return { cameraSpace, projected };
  });
  const nearPlane = state.camera instanceof THREE.PerspectiveCamera ? state.camera.near : 0.1;
  if (projectedCorners.some(({ cameraSpace, projected }) => cameraSpace.z > -nearPlane * 1.5 || !Number.isFinite(projected.x) || !Number.isFinite(projected.y))) {
    clear();
    return;
  }

  const project = (point: THREE.Vector3) => {
    const projected = point.clone().project(state.camera);
    return {
      x: ((projected.x + 1) / 2) * rect.width,
      y: ((1 - projected.y) / 2) * rect.height,
    };
  };
  const worldMinY = Math.min(...corners.map((corner) => corner.y));
  const worldMaxY = Math.max(...corners.map((corner) => corner.y));
  const worldMinX = Math.min(...corners.map((corner) => corner.x));
  const worldMaxX = Math.max(...corners.map((corner) => corner.x));
  const worldMinZ = Math.min(...corners.map((corner) => corner.z));
  const worldMaxZ = Math.max(...corners.map((corner) => corner.z));
  const worldCenterX = (worldMinX + worldMaxX) / 2;
  const worldCenterY = (worldMinY + worldMaxY) / 2;
  const worldCenterZ = (worldMinZ + worldMaxZ) / 2;
  const offset = Math.max(8, Math.max(worldMaxX - worldMinX, worldMaxY - worldMinY, worldMaxZ - worldMinZ) * 0.16);
  const statusByKey = new Map(statuses.map((status) => [`${status.axis}:${status.target}`, status]));

  const guidePoints = {
    x0: project(new THREE.Vector3(worldMinX, worldMinY, worldMaxZ + offset)),
    x1: project(new THREE.Vector3(worldMaxX, worldMinY, worldMaxZ + offset)),
    z0: project(new THREE.Vector3(worldMaxX + offset, worldMinY, worldMinZ)),
    z1: project(new THREE.Vector3(worldMaxX + offset, worldMinY, worldMaxZ)),
    y0: project(new THREE.Vector3(worldMinX - offset, worldMinY, worldMaxZ + offset)),
    y1: project(new THREE.Vector3(worldMinX - offset, worldMaxY, worldMaxZ + offset)),
  };

  const makeHandle = (axis: AlignAxis, target: AlignTarget, point: THREE.Vector3) => {
    const status = statusByKey.get(`${axis}:${target}`);
    if (!status) {
      return null;
    }
    const screen = project(point);
    return {
      ...status,
      key: `${axis}-${target}`,
      x: screen.x,
      y: screen.y,
    };
  };

  const handles = [
    makeHandle("x", "min", new THREE.Vector3(worldMinX, worldMinY, worldMaxZ + offset)),
    makeHandle("x", "center", new THREE.Vector3(worldCenterX, worldMinY, worldMaxZ + offset)),
    makeHandle("x", "max", new THREE.Vector3(worldMaxX, worldMinY, worldMaxZ + offset)),
    makeHandle("z", "min", new THREE.Vector3(worldMaxX + offset, worldMinY, worldMinZ)),
    makeHandle("z", "center", new THREE.Vector3(worldMaxX + offset, worldMinY, worldCenterZ)),
    makeHandle("z", "max", new THREE.Vector3(worldMaxX + offset, worldMinY, worldMaxZ)),
    makeHandle("y", "min", new THREE.Vector3(worldMinX - offset, worldMinY, worldMaxZ + offset)),
    makeHandle("y", "center", new THREE.Vector3(worldMinX - offset, worldCenterY, worldMaxZ + offset)),
    makeHandle("y", "max", new THREE.Vector3(worldMinX - offset, worldMaxY, worldMaxZ + offset)),
  ].filter((handle): handle is AlignOverlayState["handles"][number] => Boolean(handle));

  const next = {
    guides: [
      { key: "x", x1: guidePoints.x0.x, y1: guidePoints.x0.y, x2: guidePoints.x1.x, y2: guidePoints.x1.y },
      { key: "z", x1: guidePoints.z0.x, y1: guidePoints.z0.y, x2: guidePoints.z1.x, y2: guidePoints.z1.y },
      { key: "y", x1: guidePoints.y0.x, y1: guidePoints.y0.y, x2: guidePoints.y1.x, y2: guidePoints.y1.y },
    ],
    handles,
  };

  overlayRef.current = next;
  setOverlay(next);
}

function syncMirrorOverlay(
  state: ThreeState,
  shapes: WorkplaneShape[],
  selectedIds: string[],
  mirrorMode: boolean,
  overlayRef: MutableRefObject<MirrorOverlayState | null>,
  setOverlay: Dispatch<SetStateAction<MirrorOverlayState | null>>,
) {
  const clear = () => {
    if (overlayRef.current) {
      overlayRef.current = null;
      setOverlay(null);
    }
  };

  if (!mirrorMode || selectedIds.length < 1) {
    clear();
    return;
  }

  const frame = selectionFrameForShapes(shapes, selectedIds);
  if (!frame) {
    clear();
    return;
  }

  const rect = state.renderer.domElement.getBoundingClientRect();
  state.camera.updateMatrixWorld();
  const corners = selectionFrameCorners(frame);
  const projectedCorners = corners.map((corner) => {
    const cameraSpace = corner.clone().applyMatrix4(state.camera.matrixWorldInverse);
    const projected = corner.clone().project(state.camera);
    return { cameraSpace, projected };
  });
  const nearPlane = state.camera instanceof THREE.PerspectiveCamera ? state.camera.near : 0.1;
  if (projectedCorners.some(({ cameraSpace, projected }) => cameraSpace.z > -nearPlane * 1.5 || !Number.isFinite(projected.x) || !Number.isFinite(projected.y))) {
    clear();
    return;
  }

  const project = (point: THREE.Vector3) => {
    const projected = point.clone().project(state.camera);
    return {
      x: ((projected.x + 1) / 2) * rect.width,
      y: ((1 - projected.y) / 2) * rect.height,
    };
  };
  const screenAngle = (from: THREE.Vector3, to: THREE.Vector3) => {
    const a = project(from);
    const b = project(to);
    return THREE.MathUtils.radToDeg(Math.atan2(b.y - a.y, b.x - a.x));
  };
  const worldMinY = Math.min(...corners.map((corner) => corner.y));
  const worldMaxY = Math.max(...corners.map((corner) => corner.y));
  const worldMinX = Math.min(...corners.map((corner) => corner.x));
  const worldMaxX = Math.max(...corners.map((corner) => corner.x));
  const worldMinZ = Math.min(...corners.map((corner) => corner.z));
  const worldMaxZ = Math.max(...corners.map((corner) => corner.z));
  const worldCenterX = (worldMinX + worldMaxX) / 2;
  const worldCenterY = (worldMinY + worldMaxY) / 2;
  const worldCenterZ = (worldMinZ + worldMaxZ) / 2;
  const width = Math.max(MIN_SHAPE_SIZE, worldMaxX - worldMinX);
  const height = Math.max(MIN_SHAPE_SIZE, worldMaxY - worldMinY);
  const depth = Math.max(MIN_SHAPE_SIZE, worldMaxZ - worldMinZ);
  const offset = Math.max(10, Math.max(width, height, depth) * 0.2);
  const step = Math.max(10, Math.max(width, height, depth) * 0.28);

  const xWorld = new THREE.Vector3(worldCenterX, worldMinY, worldMaxZ + offset);
  const zWorld = new THREE.Vector3(worldMaxX + offset, worldMinY, worldCenterZ);
  const yWorld = new THREE.Vector3(worldMinX - offset, worldCenterY, worldMaxZ + offset);
  const xScreen = project(xWorld);
  const zScreen = project(zWorld);
  const yScreen = project(yWorld);
  const xGuideA = new THREE.Vector3(worldMinX, worldMinY, worldMaxZ + offset);
  const xGuideB = new THREE.Vector3(worldMaxX, worldMinY, worldMaxZ + offset);
  const zGuideA = new THREE.Vector3(worldMaxX + offset, worldMinY, worldMinZ);
  const zGuideB = new THREE.Vector3(worldMaxX + offset, worldMinY, worldMaxZ);
  const yGuideA = new THREE.Vector3(worldMinX - offset, worldMinY, worldMaxZ + offset);
  const yGuideB = new THREE.Vector3(worldMinX - offset, worldMaxY, worldMaxZ + offset);
  const xA = project(xGuideA);
  const xB = project(xGuideB);
  const zA = project(zGuideA);
  const zB = project(zGuideB);
  const yA = project(yGuideA);
  const yB = project(yGuideB);

  const next = {
    guides: [
      { key: "x", x1: xA.x, y1: xA.y, x2: xB.x, y2: xB.y },
      { key: "z", x1: zA.x, y1: zA.y, x2: zB.x, y2: zB.y },
      { key: "y", x1: yA.x, y1: yA.y, x2: yB.x, y2: yB.y },
    ],
    handles: [
      {
        axis: "x" as const,
        key: "mirror-x",
        x: xScreen.x,
        y: xScreen.y,
        angle: screenAngle(xWorld.clone().add(new THREE.Vector3(-step, 0, 0)), xWorld.clone().add(new THREE.Vector3(step, 0, 0))),
        title: "Mirror left-right",
      },
      {
        axis: "z" as const,
        key: "mirror-z",
        x: zScreen.x,
        y: zScreen.y,
        angle: screenAngle(zWorld.clone().add(new THREE.Vector3(0, 0, -step)), zWorld.clone().add(new THREE.Vector3(0, 0, step))),
        title: "Mirror front-back",
      },
      {
        axis: "y" as const,
        key: "mirror-y",
        x: yScreen.x,
        y: yScreen.y,
        angle: screenAngle(yWorld.clone().add(new THREE.Vector3(0, -step, 0)), yWorld.clone().add(new THREE.Vector3(0, step, 0))),
        title: "Mirror top-bottom",
      },
    ],
  };

  overlayRef.current = next;
  setOverlay(next);
}

function findShapeObject(state: ThreeState, id: string) {
  return state.shapeLayer.children.find((child) => child.userData.shapeId === id) ?? null;
}

function findSelectionHelper(state: ThreeState, id: string) {
  const helper = state.helperLayer.children.find((child) => child.userData.shapeId === id);
  return helper instanceof THREE.Box3Helper ? helper : null;
}

function findSelectedGroundFootprint(state: ThreeState, id: string) {
  return state.helperLayer.children.find((child) => child.name === "SelectedGroundFootprint" && child.userData.shapeId === id) ?? null;
}

function updateSelectedGroundFootprintPreviews(state: ThreeState, drag: DragState) {
  drag.items.forEach((item) => {
    const footprint = findSelectedGroundFootprint(state, item.id);
    if (!footprint) {
      return;
    }
    footprint.position.x = item.nextX - item.startX;
    footprint.position.z = item.nextZ - item.startZ;
    footprint.updateMatrixWorld(true);
  });
}

function createSelectedGroundFootprint(shape: WorkplaneShape) {
  const frame = selectionFrameForShapes([shape], [shape.id]);
  if (!frame) {
    return null;
  }

  const corners = selectionFrameCorners(frame);
  const minWorldY = Math.min(...corners.map((corner) => corner.y));
  if (minWorldY <= 0.08) {
    return null;
  }

  const minX = Math.min(...corners.map((corner) => corner.x));
  const maxX = Math.max(...corners.map((corner) => corner.x));
  const minZ = Math.min(...corners.map((corner) => corner.z));
  const maxZ = Math.max(...corners.map((corner) => corner.z));
  const width = Math.max(MIN_SHAPE_SIZE, maxX - minX);
  const depth = Math.max(MIN_SHAPE_SIZE, maxZ - minZ);
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const group = new THREE.Group();
  group.name = "SelectedGroundFootprint";
  group.userData.shapeId = shape.id;

  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({
      color: "#7f8f95",
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  fill.rotation.x = -Math.PI / 2;
  fill.position.set(centerX, 0.028, centerZ);
  group.add(fill);

  const y = 0.04;
  const points = [
    new THREE.Vector3(minX, y, minZ),
    new THREE.Vector3(maxX, y, minZ),
    new THREE.Vector3(maxX, y, maxZ),
    new THREE.Vector3(minX, y, maxZ),
    new THREE.Vector3(minX, y, minZ),
  ];
  const outline = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: "#00aeea", transparent: true, opacity: 0.92 }),
  );
  outline.userData.shapeId = shape.id;
  group.add(outline);

  return group;
}

function createTransformHandles(box: THREE.Box3, id: string) {
  const group = new THREE.Group();
  group.name = "SketchForgeTransformHandles";
  group.userData.shapeId = id;

  const handleMaterial = new THREE.MeshBasicMaterial({ color: "#e8eef1" });
  const darkMaterial = new THREE.MeshBasicMaterial({ color: "#273849" });
  const rotateMaterial = new THREE.LineBasicMaterial({ color: "#00aeea", transparent: true, opacity: 0.96 });
  const dashMaterial = new THREE.LineDashedMaterial({ color: "#2c3339", dashSize: 2.2, gapSize: 2.4, transparent: true, opacity: 0.72 });
  const handleGeometry = new THREE.BoxGeometry(2.6, 2.6, 2.6);
  const dotGeometry = new THREE.BoxGeometry(1.7, 1.7, 1.7);
  const coneGeometry = new THREE.ConeGeometry(1.7, 3.4, 18);

  const center = box.getCenter(new THREE.Vector3());
  const topY = box.max.y + 1.4;
  const x0 = box.min.x;
  const x1 = box.max.x;
  const z0 = box.min.z;
  const z1 = box.max.z;
  const xm = center.x;
  const zm = center.z;

  const cornerPoints = [
    { key: "far-left", kind: "scale" as const, point: new THREE.Vector3(x0, box.min.y + 1.3, z0) },
    { key: "far-right", kind: "scale" as const, point: new THREE.Vector3(x1, box.min.y + 1.3, z0) },
    { key: "near-left", kind: "scale" as const, point: new THREE.Vector3(x0, box.min.y + 1.3, z1) },
    { key: "near-right", kind: "scale" as const, point: new THREE.Vector3(x1, box.min.y + 1.3, z1) },
    { key: "far-left", kind: "scale" as const, point: new THREE.Vector3(x0, topY, z0) },
    { key: "far-right", kind: "scale" as const, point: new THREE.Vector3(x1, topY, z0) },
    { key: "near-left", kind: "scale" as const, point: new THREE.Vector3(x0, topY, z1) },
    { key: "near-right", kind: "scale" as const, point: new THREE.Vector3(x1, topY, z1) },
    { key: "top-height", kind: "height" as const, point: new THREE.Vector3(xm, box.max.y + 7, zm) },
  ];

  cornerPoints.forEach(({ key, kind, point }) => {
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.copy(point);
    handle.userData.shapeId = id;
    handle.userData.transformHandle = kind;
    handle.userData.transformHandleKey = key;
    handle.userData.transformPlaneY = point.y;
    group.add(handle);
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(handleGeometry), new THREE.LineBasicMaterial({ color: "#2d3439", transparent: true, opacity: 0.86 }));
    outline.position.copy(point);
    outline.userData.shapeId = id;
    outline.userData.transformHandle = handle.userData.transformHandle;
    outline.userData.transformHandleKey = key;
    outline.userData.transformPlaneY = point.y;
    group.add(outline);
  });

  [
    { key: "far-mid", point: new THREE.Vector3(xm, topY, z0) },
    { key: "near-mid", point: new THREE.Vector3(xm, topY, z1) },
    { key: "left-mid", point: new THREE.Vector3(x0, topY, zm) },
    { key: "right-mid", point: new THREE.Vector3(x1, topY, zm) },
    { key: "far-mid", point: new THREE.Vector3(xm, box.min.y + 1.3, z0) },
    { key: "near-mid", point: new THREE.Vector3(xm, box.min.y + 1.3, z1) },
    { key: "left-mid", point: new THREE.Vector3(x0, box.min.y + 1.3, zm) },
    { key: "right-mid", point: new THREE.Vector3(x1, box.min.y + 1.3, zm) },
  ].forEach(({ key, point }) => {
    const dot = new THREE.Mesh(dotGeometry, darkMaterial);
    dot.position.copy(point);
    dot.userData.shapeId = id;
    dot.userData.transformHandle = "scale";
    dot.userData.transformHandleKey = key;
    dot.userData.transformPlaneY = point.y;
    group.add(dot);
  });

  [
    [new THREE.Vector3(xm, box.max.y + 7, zm), new THREE.Vector3(xm, box.min.y + 1.3, zm)],
  ].forEach(([from, to]) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geometry, dashMaterial);
    line.computeLineDistances();
    group.add(line);
  });

  [
    { key: "rotate-left", center: new THREE.Vector3(x0 - 5, topY + 5, z0 - 5), start: 0.15, end: 1.45, arrow: new THREE.Vector3(x0 - 2.8, topY + 5, z0 - 8.2), rotation: Math.PI * 0.35 },
    { key: "rotate-right", center: new THREE.Vector3(x1 + 5, topY + 5, z0 - 5), start: 1.7, end: 2.95, arrow: new THREE.Vector3(x1 + 8.2, topY + 5, z0 - 2.8), rotation: Math.PI * 0.85 },
    { key: "rotate-bottom", center: new THREE.Vector3(x1 + 5, topY + 5, z1 + 5), start: 3.3, end: 4.55, arrow: new THREE.Vector3(x1 + 2.8, topY + 5, z1 + 8.2), rotation: Math.PI * 1.35 },
  ].forEach((arc) => {
    const line = createRotateArc(arc.center, 5.5, arc.start, arc.end, rotateMaterial);
    line.userData.shapeId = id;
    line.userData.transformHandle = "rotate";
    line.userData.transformHandleKey = arc.key;
    group.add(line);
    const arrow = new THREE.Mesh(coneGeometry, darkMaterial);
    arrow.position.copy(arc.arrow);
    arrow.rotation.set(Math.PI / 2, 0, arc.rotation);
    arrow.userData.shapeId = id;
    arrow.userData.transformHandle = "rotate";
    arrow.userData.transformHandleKey = arc.key;
    group.add(arrow);
  });

  return group;
}

function createRotateArc(center: THREE.Vector3, radius: number, start: number, end: number, material: THREE.LineBasicMaterial) {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 18; i += 1) {
    const angle = start + ((end - start) * i) / 18;
    points.push(new THREE.Vector3(center.x + Math.cos(angle) * radius, center.y, center.z + Math.sin(angle) * radius));
  }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
}

function shapeWidth(shape: WorkplaneShape) {
  return shape.width ?? shape.size;
}

function shapeDepth(shape: WorkplaneShape) {
  return shape.depth ?? shape.size;
}

function mirrorSign(value?: boolean) {
  return value ? -1 : 1;
}

function mirroredAxisCount(shape: WorkplaneShape) {
  return [shape.mirrorX, shape.mirrorY, shape.mirrorZ].filter(Boolean).length;
}

function createShapeObject(shape: WorkplaneShape, showEdges = false, onTextureReady?: () => void) {
  const group = new THREE.Group();
  group.name = shape.name;
  group.userData.shapeId = shape.id;
  group.userData.showEdges = showEdges;
  group.position.set(shape.x, (shape.elevation ?? 0) + shape.height / 2, shape.z);
  group.rotation.set(
    THREE.MathUtils.degToRad(shape.rotationX ?? 0),
    THREE.MathUtils.degToRad(shape.rotation),
    THREE.MathUtils.degToRad(shape.rotationZ ?? 0),
  );
  group.scale.set(mirrorSign(shape.mirrorX), mirrorSign(shape.mirrorY), mirrorSign(shape.mirrorZ));

  if (shape.groupedShapes?.length && !shape.importedMesh) {
    const content = new THREE.Group();
    shape.groupedShapes
      .filter((child) => !child.hidden)
      .forEach((child) => {
        const childShape = shape.hole ? { ...child, hole: true, color: "#b8c2cc" } : child;
        const childObject = createShapeObject(childShape, showEdges, onTextureReady);
        content.add(childObject);
      });
    const contentBox = new THREE.Box3().setFromObject(content);
    const contentSize = contentBox.getSize(new THREE.Vector3());
    content.scale.set(
      shapeWidth(shape) / Math.max(0.001, contentSize.x),
      shape.height / Math.max(0.001, contentSize.y),
      shapeDepth(shape) / Math.max(0.001, contentSize.z),
    );
    content.position.y = -shape.height / 2;
    group.add(content);
    group.traverse((child) => {
      child.userData.shapeId = shape.id;
    });
    return group;
  }

  const material = new THREE.MeshStandardMaterial({
    color: shape.hole ? "#b7c0c9" : shape.color,
    transparent: Boolean(shape.hole),
    opacity: shape.hole ? (shape.importedMesh ? 0.34 : 0.52) : 1,
    roughness: shape.hole ? 0.88 : 0.57,
    metalness: 0.02,
    side: shape.importedMesh?.sourceFormat === "json" || mirroredAxisCount(shape) % 2 === 1 ? THREE.DoubleSide : THREE.FrontSide,
  });

  const width = shapeWidth(shape);
  const depth = shapeDepth(shape);
  const size = Math.min(width, depth);
  const height = shape.height;

  switch (shape.kind) {
    case "box":
      addMesh(
        group,
        shape.radius && shape.radius > 0 ? new RoundedBoxGeometry(width, height, depth, shape.steps ?? 10, shape.radius) : new THREE.BoxGeometry(width, height, depth),
        shape.imagePlate && !shape.hole ? createImagePlateMaterials(shape, material, onTextureReady) : material,
        shape,
      );
      break;
    case "cylinder":
      addMesh(group, new THREE.CylinderGeometry(1, 1, height, shape.sides ?? 96, shape.segments ?? 1), material, shape, undefined, undefined, new THREE.Vector3(width / 2, 1, depth / 2));
      break;
    case "sphere":
      addMesh(group, new THREE.SphereGeometry(1, Math.max(8, (shape.steps ?? 24) * 2), Math.max(6, shape.steps ?? 24)), material, shape, undefined, undefined, new THREE.Vector3(width / 2, height / 2, depth / 2));
      break;
    case "cone":
      addMesh(group, new THREE.CylinderGeometry(shape.topRadius ?? 0, shape.baseRadius ?? width / 2, height, shape.sides ?? 96), material, shape);
      break;
    case "pyramid":
      addMesh(group, createPyramidGeometry(width, height, depth, shape.sides ?? 4), material, shape);
      break;
    case "roof":
      addMesh(group, createRoofGeometry(width, height, depth), material, shape);
      break;
    case "roundRoof":
      addMesh(group, createRoundRoofGeometry(width, height, depth, shape.sides ?? 64), material, shape);
      break;
    case "halfSphere":
      addMesh(group, createHalfSphereGeometry(width, height, depth, shape.steps ?? 32), material, shape);
      break;
    case "torus":
      addMesh(group, createTorusGeometry(width, height, depth), material, shape);
      break;
    case "ring":
      addMesh(group, createHollowCylinderGeometry(width, height, depth, shape.bevel ?? 4, 144), material, shape);
      break;
    case "tube":
      addMesh(group, createHollowCylinderGeometry(width, height, depth, shape.bevel ?? 4, 144), material, shape);
      break;
    case "wedge":
      addMesh(group, createWedgeGeometry(width, height, depth), material, shape);
      break;
    case "polygon":
      addMesh(group, new THREE.CylinderGeometry(1, 1, height, 6), material, shape, undefined, undefined, new THREE.Vector3(width / 2, 1, depth / 2));
      break;
    case "icosahedron":
      addMesh(group, new THREE.IcosahedronGeometry(size / 2, 1), material, shape);
      break;
    case "star":
      addMesh(group, createExtrudedShapeGeometry(createStarShape(size / 2), height), material, shape);
      break;
    case "heart":
      addMesh(group, createExtrudedShapeGeometry(createHeartShape(size * 0.95), height), material, shape);
      break;
    case "text":
      addTextShape(group, material, shape);
      break;
    case "mesh":
      if (shape.importedMesh) {
        addMesh(
          group,
          getImportedMeshGeometry(shape.importedMesh),
          material,
          shape,
          undefined,
          undefined,
          new THREE.Vector3(
            width / Math.max(0.001, shape.importedMesh.baseWidth),
            height / Math.max(0.001, shape.importedMesh.baseHeight),
            depth / Math.max(0.001, shape.importedMesh.baseDepth),
          ),
        );
      } else {
        addMesh(group, new THREE.BoxGeometry(size, Math.max(3, height * 0.35), size * 0.72), material, shape);
      }
      break;
    case "scribble":
      addMesh(group, new THREE.TorusKnotGeometry(size * 0.22, size * 0.055, 120, 12), material, shape);
      break;
    case "sketch":
    default:
      addMesh(group, new THREE.BoxGeometry(size, Math.max(3, height * 0.35), size * 0.72), material, shape);
      break;
  }

  group.traverse((child) => {
    child.userData.shapeId = shape.id;
  });

  return group;
}

function createImagePlateMaterials(shape: WorkplaneShape, sideMaterial: THREE.MeshStandardMaterial, onTextureReady?: () => void) {
  const sideMaterials = Array.from({ length: 5 }, (_, index) => (index === 0 ? sideMaterial : sideMaterial.clone()));
  const topMaterial = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.64,
    metalness: 0,
    transparent: true,
    alphaTest: 0.02,
    side: THREE.FrontSide,
  });

  if (shape.imagePlate?.dataUrl) {
    const texture = imageTextureLoader.load(shape.imagePlate.dataUrl, () => {
      texture.needsUpdate = true;
      topMaterial.needsUpdate = true;
      onTextureReady?.();
    });
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    topMaterial.map = texture;
  }

  return [
    sideMaterials[0],
    sideMaterials[1],
    topMaterial,
    sideMaterials[2],
    sideMaterials[3],
    sideMaterials[4],
  ];
}

function addMesh(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  shape: WorkplaneShape,
  position?: THREE.Vector3,
  rotation?: THREE.Euler,
  scale?: THREE.Vector3,
) {
  const prepared = geometry.userData.cached ? geometry : putGeometryOnBase(geometry);
  const mesh = new THREE.Mesh(prepared, material);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  if (position) {
    mesh.position.copy(position);
  }
  mesh.position.y -= shape.height / 2;
  if (rotation) {
    mesh.rotation.copy(rotation);
  }
  if (scale) {
    mesh.scale.copy(scale);
  }
  group.add(mesh);

  const complexEdges =
    shape.kind === "mesh" ||
    Boolean(shape.importedMesh) ||
    ["cone", "pyramid", "roof", "roundRoof", "halfSphere", "torus", "tube", "ring", "wedge"].includes(shape.kind);
  const importedTriangleCount = shape.importedMesh?.triangleCount ?? 0;
  const skipHeavyImportedEdges = Boolean(shape.importedMesh) && importedTriangleCount > IMPORTED_SELECTED_EDGE_TRIANGLE_LIMIT;
  if ((group.userData.showEdges || complexEdges) && !skipHeavyImportedEdges) {
    const selectedOutline = Boolean(group.userData.showEdges);
    const selectedRoundedBox = selectedOutline && shape.kind === "box" && Boolean(shape.radius && shape.radius > 0);
    const edgeColor = selectedOutline ? "#00aeea" : shape.hole ? "#697989" : complexEdges ? "#141b21" : darkenHex(shape.color, 0.34);
    const edgeOpacity = selectedRoundedBox ? 0 : selectedOutline ? 0.98 : shape.hole ? 0.44 : complexEdges ? 0.38 : shape.kind === "text" ? 0.86 : 0.2;
    const edges = new THREE.LineSegments(getEdgesGeometry(shape, prepared, selectedOutline ? 1 : complexEdges ? 14 : 25), new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: edgeOpacity }));
    edges.userData.complexEdge = complexEdges;
    edges.position.copy(mesh.position);
    edges.rotation.copy(mesh.rotation);
    edges.scale.copy(mesh.scale);
    group.add(edges);
  }
}

function getImportedMeshCache(mesh: NonNullable<WorkplaneShape["importedMesh"]>) {
  const cached = importedGeometryCache.get(mesh);
  if (cached) {
    return cached;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(mesh.positions, 3));
  if (mesh.normals && mesh.normals.length === mesh.positions.length) {
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(mesh.normals, 3));
  } else {
    geometry.computeVertexNormals();
  }
  putGeometryOnBase(geometry);
  geometry.userData.cached = true;
  const next = { geometry, edges: new Map<number, THREE.EdgesGeometry>() };
  importedGeometryCache.set(mesh, next);
  return next;
}

function getImportedMeshGeometry(mesh: NonNullable<WorkplaneShape["importedMesh"]>) {
  return getImportedMeshCache(mesh).geometry;
}

function getEdgesGeometry(shape: WorkplaneShape, geometry: THREE.BufferGeometry, threshold: number) {
  if (!shape.importedMesh) {
    return new THREE.EdgesGeometry(geometry, threshold);
  }

  const cache = getImportedMeshCache(shape.importedMesh);
  const cached = cache.edges.get(threshold);
  if (cached) {
    return cached;
  }

  const edges = new THREE.EdgesGeometry(cache.geometry, threshold);
  edges.userData.cached = true;
  cache.edges.set(threshold, edges);
  return edges;
}

function setComplexEdgeVisibility(object: THREE.Object3D, visible: boolean) {
  object.traverse((child) => {
    if (child.userData.complexEdge) {
      child.visible = visible;
    }
  });
}

function addTextShape(group: THREE.Group, material: THREE.MeshStandardMaterial, shape: WorkplaneShape) {
  const text = (shape.text ?? "TEXT").trim() || " ";
  const bevel = clamp(shape.bevel ?? 0, 0, 8);
  const fontName = shape.font ?? "Multilanguage";
  const geometry = new TextGeometry(text, {
    font: textFonts[fontName] ?? textFonts.Multilanguage,
    size: 20,
    depth: shape.height,
    curveSegments: fontName === "Stencil" ? 1 : 8,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel * 0.22,
    bevelSize: bevel * 0.16,
    bevelSegments: Math.max(1, shape.segments ?? 0),
  });

  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (box) {
    const textWidth = Math.max(1, box.max.x - box.min.x);
    const textDepth = Math.max(1, box.max.y - box.min.y);
    const scale = Math.min(shapeWidth(shape) / textWidth, shapeDepth(shape) / textDepth);
    geometry.scale(scale, scale, 1);
  }

  geometry.rotateX(-Math.PI / 2);
  geometry.computeBoundingBox();
  const rotatedBox = geometry.boundingBox;
  if (rotatedBox) {
    geometry.translate(
      -(rotatedBox.min.x + rotatedBox.max.x) / 2,
      -rotatedBox.min.y,
      -(rotatedBox.min.z + rotatedBox.max.z) / 2,
    );
  }

  addMesh(group, geometry, material, shape);
}

function putGeometryOnBase(geometry: THREE.BufferGeometry) {
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const minY = geometry.boundingBox?.min.y ?? 0;
  geometry.translate(0, -minY, 0);
  return geometry;
}

function createRoofGeometry(width: number, height: number, depth: number) {
  const w = width / 2;
  const d = depth / 2;
  const vertices = new Float32Array([
    -w, 0, -d, w, 0, -d, 0, height, -d,
    -w, 0, d, w, 0, d, 0, height, d,
  ]);
  const indices = [
    0, 2, 1,
    3, 4, 5,
    0, 1, 4, 0, 4, 3,
    0, 3, 5, 0, 5, 2,
    1, 2, 5, 1, 5, 4,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  return geometry.toNonIndexed();
}

function createWedgeGeometry(width: number, height: number, depth: number) {
  const w = width / 2;
  const d = depth / 2;
  const vertices = new Float32Array([
    -w, 0, -d, w, 0, -d, w, height, -d,
    -w, 0, d, w, 0, d, w, height, d,
  ]);
  const indices = [
    0, 2, 1,
    3, 4, 5,
    0, 1, 4, 0, 4, 3,
    1, 2, 5, 1, 5, 4,
    0, 3, 5, 0, 5, 2,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  return geometry.toNonIndexed();
}

function createPyramidGeometry(width: number, height: number, depth: number, sides = 4) {
  const count = Math.max(3, Math.round(sides));
  if (count !== 4) {
    const radius = Math.min(width, depth) / 2;
    const geometry = new THREE.ConeGeometry(radius, height, count);
    geometry.translate(0, height / 2, 0);
    return geometry.toNonIndexed();
  }

  const w = width / 2;
  const d = depth / 2;
  const vertices = new Float32Array([
    -w, 0, -d, w, 0, -d, w, 0, d, -w, 0, d,
    0, height, 0,
  ]);
  const indices = [
    0, 1, 2, 0, 2, 3,
    0, 4, 1,
    1, 4, 2,
    2, 4, 3,
    3, 4, 0,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  return geometry.toNonIndexed();
}

function createTorusGeometry(width: number, height: number, depth: number) {
  const tubeRadius = Math.max(0.1, height / 2);
  const majorRadius = Math.max(0.2, Math.min(width, depth) / 2 - tubeRadius);
  const geometry = new THREE.TorusGeometry(majorRadius, tubeRadius, 36, 144);
  geometry.rotateX(Math.PI / 2);
  const outerDiameter = (majorRadius + tubeRadius) * 2;
  geometry.scale(width / outerDiameter, 1, depth / outerDiameter);
  return geometry.toNonIndexed();
}

function createHollowCylinderGeometry(width: number, height: number, depth: number, thickness: number, segments = 96) {
  const outerX = width / 2;
  const outerZ = depth / 2;
  const safeThickness = clamp(thickness, 0.1, Math.max(0.1, Math.min(outerX, outerZ) - 0.1));
  const innerX = Math.max(0.1, outerX - safeThickness);
  const innerZ = Math.max(0.1, outerZ - safeThickness);
  const count = Math.max(12, Math.round(segments));
  const positions: number[] = [];
  const point = (rx: number, rz: number, y: number, index: number): [number, number, number] => {
    const angle = (index / count) * Math.PI * 2;
    return [Math.cos(angle) * rx, y, Math.sin(angle) * rz];
  };
  const addTri = (a: [number, number, number], b: [number, number, number], c: [number, number, number]) => positions.push(...a, ...b, ...c);
  const addQuad = (a: [number, number, number], b: [number, number, number], c: [number, number, number], d: [number, number, number]) => {
    addTri(a, b, c);
    addTri(a, c, d);
  };

  for (let index = 0; index < count; index += 1) {
    const next = index + 1;
    const ob0 = point(outerX, outerZ, 0, index);
    const ob1 = point(outerX, outerZ, 0, next);
    const ot0 = point(outerX, outerZ, height, index);
    const ot1 = point(outerX, outerZ, height, next);
    const ib0 = point(innerX, innerZ, 0, index);
    const ib1 = point(innerX, innerZ, 0, next);
    const it0 = point(innerX, innerZ, height, index);
    const it1 = point(innerX, innerZ, height, next);

    addQuad(ob0, ot0, ot1, ob1);
    addQuad(ib1, it1, it0, ib0);
    addQuad(ot0, it0, it1, ot1);
    addQuad(ob0, ob1, ib1, ib0);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function createRoundRoofGeometry(width: number, height: number, depth: number, sides = 64) {
  const radius = width / 2;
  const segments = Math.max(4, Math.round(sides));
  const shape = new THREE.Shape();
  shape.moveTo(-radius, 0);
  shape.absarc(0, 0, radius, Math.PI, 0, true);
  shape.lineTo(-radius, 0);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1, curveSegments: segments });
  geometry.translate(0, 0, -depth / 2);
  geometry.scale(1, height / Math.max(0.001, radius), 1);
  return geometry.toNonIndexed();
}

function createHalfSphereGeometry(width: number, height: number, depth: number, steps = 32) {
  const lon = Math.max(8, Math.round(steps) * 2);
  const lat = Math.max(4, Math.round(steps / 2));
  const rx = width / 2;
  const rz = depth / 2;
  const positions: number[] = [];
  const normals: number[] = [];
  const point = (latIndex: number, lonIndex: number): [number, number, number] => {
    const theta = (latIndex / lat) * (Math.PI / 2);
    const phi = ((lonIndex % lon) / lon) * Math.PI * 2;
    const ring = Math.sin(theta);
    return [Math.cos(phi) * rx * ring, Math.cos(theta) * height, Math.sin(phi) * rz * ring];
  };
  const normal = ([x, y, z]: [number, number, number]): [number, number, number] => {
    const vector = new THREE.Vector3(x / Math.max(0.001, rx * rx), y / Math.max(0.001, height * height), z / Math.max(0.001, rz * rz)).normalize();
    return [vector.x, vector.y, vector.z];
  };
  const addTri = (a: [number, number, number], b: [number, number, number], c: [number, number, number]) => {
    positions.push(...a, ...b, ...c);
    normals.push(...normal(a), ...normal(b), ...normal(c));
  };
  const addCapTri = (a: [number, number, number], b: [number, number, number], c: [number, number, number]) => {
    positions.push(...a, ...b, ...c);
    normals.push(0, -1, 0, 0, -1, 0, 0, -1, 0);
  };

  const top: [number, number, number] = [0, height, 0];
  for (let xStep = 0; xStep < lon; xStep += 1) {
    addTri(top, point(1, xStep + 1), point(1, xStep));
  }

  for (let yStep = 1; yStep < lat; yStep += 1) {
    for (let xStep = 0; xStep < lon; xStep += 1) {
      const next = xStep + 1;
      const a = point(yStep, xStep);
      const b = point(yStep, next);
      const c = point(yStep + 1, next);
      const d = point(yStep + 1, xStep);
      addTri(a, c, d);
      addTri(a, b, c);
    }
  }

  const capY = 0;
  const bottomCenter: [number, number, number] = [0, capY, 0];
  const capPoint = (lonIndex: number): [number, number, number] => {
    const phi = ((lonIndex % lon) / lon) * Math.PI * 2;
    return [Math.cos(phi) * rx, capY, Math.sin(phi) * rz];
  };
  for (let xStep = 0; xStep < lon; xStep += 1) {
    addCapTri(bottomCenter, capPoint(xStep), capPoint(xStep + 1));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

function createExtrudedShapeGeometry(shape: THREE.Shape, height: number) {
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1 });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function createStarShape(radius: number) {
  const shape = new THREE.Shape();
  const inner = radius * 0.44;
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? radius : inner;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  shape.closePath();
  return shape;
}

function createHeartShape(size: number) {
  const s = size / 24;
  const shape = new THREE.Shape();
  shape.moveTo(0, -9 * s);
  shape.bezierCurveTo(-13 * s, -1 * s, -12 * s, 8 * s, -5 * s, 8 * s);
  shape.bezierCurveTo(-2 * s, 8 * s, 0, 5 * s, 0, 3 * s);
  shape.bezierCurveTo(0, 5 * s, 2 * s, 8 * s, 5 * s, 8 * s);
  shape.bezierCurveTo(12 * s, 8 * s, 13 * s, -1 * s, 0, -9 * s);
  return shape;
}

function disposeChildren(group: THREE.Group) {
  while (group.children.length > 0) {
    const child = group.children.pop();
    if (child) {
      disposeObject(child);
    }
  }
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh | THREE.LineSegments;
    if ("geometry" in mesh && mesh.geometry) {
      if (!mesh.geometry.userData.cached) {
        mesh.geometry.dispose();
      }
    }
    if ("material" in mesh && mesh.material) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        const map = "map" in material ? (material.map as THREE.Texture | null) : null;
        if (map) {
          map.dispose();
        }
        material.dispose();
      });
    }
  });
}

function darkenHex(hex: string, amount: number) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean, 16);
  const r = Math.max(0, Math.floor(((value >> 16) & 255) * (1 - amount)));
  const g = Math.max(0, Math.floor(((value >> 8) & 255) * (1 - amount)));
  const b = Math.max(0, Math.floor((value & 255) * (1 - amount)));
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
