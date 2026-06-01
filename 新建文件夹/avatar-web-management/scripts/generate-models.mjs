// Generate minimal humanoid GLB base models
// Creates valid binary GLB files with embedded mesh data

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'models');
fs.mkdirSync(outDir, { recursive: true });

function float32ToBytes(value) {
  const buf = Buffer.alloc(4);
  buf.writeFloatLE(value, 0);
  return buf;
}

function uint32ToBytes(value) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value, 0);
  return buf;
}

function uint16ToBytes(value) {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(value, 0);
  return buf;
}

// Build a simple humanoid mesh (8 vertices per primitive for a box approximation)
function buildHumanoidGeometry(color) {
  // We build a simple GLTF JSON structure with:
  // 1 sphere (head) + 1 capsule-like body + 4 capsule limbs
  // Using indexed triangles

  const positions = [];
  const normals = [];
  const indices = [];
  let vi = 0; // vertex index

  function addSphere(cx, cy, cz, r, segs) {
    const base = vi;
    for (let j = 0; j <= segs; j++) {
      const lat = Math.PI * (-0.5 + j / segs);
      const y = cy + r * Math.sin(lat);
      const r2 = r * Math.cos(lat);
      for (let i = 0; i <= segs; i++) {
        const lon = 2 * Math.PI * i / segs;
        const x = cx + r2 * Math.cos(lon);
        const z = cz + r2 * Math.sin(lon);
        positions.push(x, y, z);
        const nx = Math.cos(lon) * Math.cos(lat);
        const ny = Math.sin(lat);
        const nz = Math.sin(lon) * Math.cos(lat);
        normals.push(nx, ny, nz);
      }
    }
    for (let j = 0; j < segs; j++) {
      for (let i = 0; i < segs; i++) {
        const a = base + j * (segs + 1) + i;
        const b = a + segs + 1;
        const c = a + 1;
        const d = b + 1;
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }
    return (segs + 1) * (segs + 1);
  }

  // Head sphere
  const headVerts = addSphere(0, 1.35, 0, 0.2, 14);
  vi += headVerts;

  // Body (simplified as scaled sphere)
  const bodyBase = vi;
  const bodyVerts = addSphere(0, 0.75, 0, 0.28, 12);
  vi += bodyVerts;
  // Scale body vertices horizontally
  for (let i = 0; i < bodyVerts; i++) {
    const idx = (bodyBase + i) * 3;
    positions[idx] *= 0.65;
    positions[idx + 2] *= 0.5;
  }

  return { positions, normals, indices, count: vi };
}

function buildGLBFile(color) {
  const { positions, normals, indices, count } = buildHumanoidGeometry(color);

  const posMin = [Infinity, Infinity, Infinity];
  const posMax = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count * 3; i += 3) {
    for (let d = 0; d < 3; d++) {
      posMin[d] = Math.min(posMin[d], positions[i + d]);
      posMax[d] = Math.max(posMax[d], positions[i + d]);
    }
  }

  const posBytes = Buffer.from(Float32Array.from(positions).buffer);
  const normBytes = Buffer.from(Float32Array.from(normals).buffer);
  const idxBytes = Buffer.from(Uint16Array.from(indices).buffer);

  // Align to 4 bytes
  const pad = (buf) => {
    while (buf.length % 4 !== 0) buf = Buffer.concat([buf, Buffer.alloc(1)]);
    return buf;
  };

  const binChunk = pad(Buffer.concat([posBytes, pad(normBytes), pad(idxBytes)]));

  const gltfObj = {
    asset: { version: '2.0', generator: 'avatar-editor' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: color === '#f5d5c8' ? 'BaseFemale' : 'BaseMale' }],
    meshes: [{
      name: 'AvatarBody',
      primitives: [{
        attributes: {
          POSITION: 0,
          NORMAL: 1,
        },
        indices: 2,
        material: 0,
      }],
    }],
    accessors: [
      { bufferView: 0, componentType: 5126, type: 'VEC3', count: count, min: posMin, max: posMax },
      { bufferView: 1, componentType: 5126, type: 'VEC3', count: count },
      { bufferView: 2, componentType: 5123, type: 'SCALAR', count: indices.length },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBytes.length },
      { buffer: 0, byteOffset: posBytes.length, byteLength: normBytes.length },
      { buffer: 0, byteOffset: posBytes.length + normBytes.length, byteLength: idxBytes.length },
    ],
    buffers: [{ byteLength: binChunk.length }],
    materials: [{
      name: 'skin',
      pbrMetallicRoughness: {
        baseColorFactor: color === '#f5d5c8'
          ? [0.96, 0.84, 0.78, 1.0]
          : [0.91, 0.79, 0.63, 1.0],
        roughnessFactor: 0.6,
        metallicFactor: 0.0,
      },
    }],
  };

  const gltfJson = JSON.stringify(gltfObj);
  const jsonBuf = Buffer.from(gltfJson, 'utf8');
  const jsonPad = pad(jsonBuf);

  // GLB header
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546C67, 0); // glTF magic
  header.writeUInt32LE(2, 4); // version
  header.writeUInt32LE(12 + 8 + jsonPad.length + 8 + binChunk.length, 8); // total length

  // JSON chunk
  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonPad.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4E4F534A, 4); // JSON

  // BIN chunk
  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(binChunk.length, 0);
  binChunkHeader.writeUInt32LE(0x004E4942, 4); // BIN

  return Buffer.concat([header, jsonChunkHeader, jsonPad, binChunkHeader, binChunk]);
}

// Generate both models
for (const [gender, color] of [['female', '#f5d5c8'], ['male', '#e8c9a0']]) {
  const glb = buildGLBFile(color);
  const outPath = path.join(outDir, `base-${gender}.glb`);
  fs.writeFileSync(outPath, glb);
  console.log(`Generated: base-${gender}.glb (${(glb.length / 1024).toFixed(1)} KB)`);
}

console.log('Done! Models saved to public/models/');
