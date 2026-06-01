// Generate simple placeholder part GLB files for the avatar editor
// Builds minimal GLB binary manually (no Three.js needed in Node.js)
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const partsDir = resolve(__dirname, '..', 'public', 'models', 'parts');

if (!existsSync(partsDir)) {
  mkdirSync(partsDir, { recursive: true });
}

const parts = [
  { name: 'hair-长发飘逸', color: [0.29, 0.22, 0.16] },
  { name: 'hair-短发干练', color: [0.16, 0.16, 0.16] },
  { name: 'hair-双马尾', color: [0.55, 0.27, 0.07] },
  { name: 'top-t恤', color: [0.29, 0.56, 0.85] },
  { name: 'top-西装外套', color: [0.10, 0.10, 0.18] },
  { name: 'bottom-短裙', color: [0.75, 0.22, 0.17] },
  { name: 'bottom-长裤', color: [0.17, 0.24, 0.31] },
  { name: 'shoes-运动鞋', color: [0.93, 0.94, 0.95] },
  { name: 'shoes-高跟鞋', color: [0.91, 0.30, 0.24] },
  { name: 'accessory-圆框眼镜', color: [0.95, 0.77, 0.25] },
  { name: 'accessory-星星发饰', color: [0.91, 0.12, 0.39] },
  { name: 'accessory-鸭舌帽', color: [0.90, 0.40, 0.13] },
  { name: 'accessory-项链', color: [1.0, 0.84, 0.0] },
];

// A simple unit cube: 8 vertices, 12 triangles (36 indices)
const cubeVertices = new Float32Array([
  // positions (x, y, z) x 8
  -0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,  -0.5,  0.5,  0.5,  // front
  -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,   0.5,  0.5, -0.5,  -0.5,  0.5, -0.5,  // back
]);
const cubeNormals = new Float32Array([
  0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
  0, 0,-1,  0, 0,-1,  0, 0,-1,  0, 0,-1,
]);
const cubeIndices = new Uint16Array([
  0,1,2, 0,2,3,   // front
  1,5,6, 1,6,2,   // right
  5,4,7, 5,7,6,   // back
  4,0,3, 4,3,7,   // left
  3,2,6, 3,6,7,   // top
  4,5,1, 4,1,0,   // bottom
]);

function buildGLB(positions, normals, indices, baseColorFactor) {
  // Flatten index/vertex data into a single buffer
  const posBytes = new Uint8Array(positions.buffer);
  const normBytes = new Uint8Array(normals.buffer);
  const idxBytes = new Uint8Array(indices.buffer);

  // Pad to 4-byte alignment
  const padLen = (4 - (idxBytes.length % 4)) % 4;
  const binLength = posBytes.length + normBytes.length + idxBytes.length + padLen;
  const binBuffer = new Uint8Array(binLength);
  let offset = 0;
  binBuffer.set(posBytes, offset); offset += posBytes.length;
  binBuffer.set(normBytes, offset); offset += normBytes.length;
  binBuffer.set(idxBytes, offset); offset += idxBytes.length;

  const gltf = {
    asset: { version: '2.0', generator: 'generate-parts.mjs' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1 },
        indices: 2,
        material: 0,
      }],
    }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3', min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
      { bufferView: 1, componentType: 5126, count: normals.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5123, count: indices.length, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBytes.length },
      { buffer: 0, byteOffset: posBytes.length, byteLength: normBytes.length },
      { buffer: 0, byteOffset: posBytes.length + normBytes.length, byteLength: idxBytes.length },
    ],
    buffers: [{ byteLength: binLength }],
    materials: [{
      pbrMetallicRoughness: { baseColorFactor: [...baseColorFactor, 1.0], metallicFactor: 0.1, roughnessFactor: 0.6 },
    }],
  };

  const jsonStr = JSON.stringify(gltf);
  // Pad JSON to 4-byte boundary with spaces
  const jsonPadLen = (4 - (jsonStr.length % 4)) % 4;
  const jsonPadded = jsonStr + ' '.repeat(jsonPadLen);

  const headerLen = 12;
  const jsonChunkHeaderLen = 8;
  const binChunkHeaderLen = 8;
  const totalLen = headerLen + jsonChunkHeaderLen + jsonPadded.length + binChunkHeaderLen + binLength;

  const buf = new ArrayBuffer(totalLen);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);

  // Header
  u8.set([0x67, 0x6C, 0x54, 0x46], 0);  // magic "glTF"
  view.setUint32(4, 2, true);               // version
  view.setUint32(8, totalLen, true);         // total length

  // JSON chunk
  view.setUint32(12, jsonPadded.length, true);
  view.setUint32(16, 0x4E4F534A, true);     // "JSON"
  for (let i = 0; i < jsonPadded.length; i++) {
    u8[20 + i] = jsonPadded.charCodeAt(i);
  }

  // BIN chunk
  const binOffset = 20 + jsonPadded.length;
  view.setUint32(binOffset, binLength, true);
  view.setUint32(binOffset + 4, 0x004E4942, true); // "BIN\0"
  u8.set(binBuffer, binOffset + 8);

  return Buffer.from(buf);
}

console.log('Generating part prefabs...\n');
for (const part of parts) {
  const glb = buildGLB(cubeVertices, cubeNormals, cubeIndices, part.color);
  const filename = `${part.name}.glb`;
  const filepath = resolve(partsDir, filename);
  writeFileSync(filepath, glb);
  console.log(`  ✓ ${filename} (${glb.length} bytes)`);
}
console.log(`\nGenerated ${parts.length} part prefabs in: ${partsDir}`);
