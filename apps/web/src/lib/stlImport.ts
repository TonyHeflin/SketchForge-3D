import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { createLocalId } from "@/lib/localIds";
import type { WorkplaneShape } from "@/types/sketchforge";

const stlLoader = new STLLoader();

export function importedShapeFromStl(fileName: string, buffer: ArrayBuffer): WorkplaneShape {
  const rawGeometry = stlLoader.parse(buffer);
  const geometry = rawGeometry.index ? rawGeometry.toNonIndexed() : rawGeometry.clone();
  geometry.computeBoundingBox();

  const box = geometry.boundingBox;
  if (!box) {
    throw new Error("STL has no readable geometry");
  }

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDimension = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxDimension) || maxDimension <= 0) {
    throw new Error("STL geometry is empty");
  }

  const scale = 1;
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const positions: number[] = [];
  const normals: number[] = [];

  for (let i = 0; i < position.count; i += 1) {
    positions.push((position.getX(i) - center.x) * scale, (position.getY(i) - box.min.y) * scale, (position.getZ(i) - center.z) * scale);
    if (normal) {
      normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
    }
  }

  const width = Math.max(1, size.x * scale);
  const height = Math.max(1, size.y * scale);
  const depth = Math.max(1, size.z * scale);
  const triangleCount = Math.floor(position.count / 3);

  return {
    id: createLocalId("uploaded-mesh"),
    name: fileName.replace(/\.[^.]+$/, "") || "Imported STL",
    kind: "mesh",
    color: "#0098c7",
    x: 10,
    z: -10,
    size: Math.max(width, depth),
    width,
    depth,
    height,
    rotation: 0,
    rotationX: 0,
    rotationZ: 0,
    importedMesh: {
      positions,
      normals: normals.length ? normals : undefined,
      baseWidth: width,
      baseDepth: depth,
      baseHeight: height,
      triangleCount,
      sourceFormat: "stl",
    },
    locked: false,
    hidden: false,
  };
}
