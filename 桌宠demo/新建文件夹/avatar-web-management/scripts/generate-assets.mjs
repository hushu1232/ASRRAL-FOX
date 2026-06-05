// 虚拟形象编辑器 — 资产生成脚本
// 生成基础模型（含 Morph Target 数据）、部件 GLB 文件、部件清单
//
// 用法: node scripts/generate-assets.mjs
// 输出: public/models/base-*.glb, public/models/parts/*.glb, public/models/morph-targets.json

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'models');
const partsDir = path.join(outDir, 'parts');
fs.mkdirSync(partsDir, { recursive: true });

// ============================================================
// GLB 二进制构建工具
// ============================================================

function float32Bytes(arr) { return Buffer.from(Float32Array.from(arr).buffer); }
function uint32Bytes(val) { const b = Buffer.alloc(4); b.writeUInt32LE(val, 0); return b; }
function uint16Bytes(val) { const b = Buffer.alloc(2); b.writeUInt16LE(val, 0); return b; }
function pad4(buf) { while (buf.length % 4 !== 0) buf = Buffer.concat([buf, Buffer.alloc(1)]); return buf; }

function buildGLB({ positions, normals, indices, material, nodeName, meshName }) {
  const count = positions.length / 3;
  const posMin = [Infinity, Infinity, Infinity], posMax = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let d = 0; d < 3; d++) {
      posMin[d] = Math.min(posMin[d], positions[i + d]);
      posMax[d] = Math.max(posMax[d], positions[i + d]);
    }
  }

  const posBuf = float32Bytes(positions);
  const normBuf = float32Bytes(normals);
  const idxBuf = Buffer.from(Uint16Array.from(indices).buffer);

  const binChunk = pad4(Buffer.concat([posBuf, pad4(normBuf), pad4(idxBuf)]));

  const gltf = {
    asset: { version: '2.0', generator: 'avatar-editor-p0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: nodeName || meshName }],
    meshes: [{
      name: meshName,
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1 },
        indices: 2,
        material: 0,
        ...(material.morphTargets ? { targets: material.morphTargets } : {}),
      }],
    }],
    accessors: [
      { bufferView: 0, componentType: 5126, type: 'VEC3', count, min: posMin, max: posMax },
      { bufferView: 1, componentType: 5126, type: 'VEC3', count },
      { bufferView: 2, componentType: 5123, type: 'SCALAR', count: indices.length },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBuf.length },
      { buffer: 0, byteOffset: posBuf.length, byteLength: normBuf.length },
      { buffer: 0, byteOffset: posBuf.length + normBuf.length, byteLength: idxBuf.length },
    ],
    buffers: [{ byteLength: binChunk.length }],
    materials: [{
      name: material.name || 'default',
      pbrMetallicRoughness: {
        baseColorFactor: material.baseColorFactor || [0.9, 0.85, 0.8, 1],
        roughnessFactor: material.roughness ?? 0.5,
        metallicFactor: material.metallic ?? 0.0,
      },
    }],
  };

  const json = JSON.stringify(gltf);
  const jsonBuf = pad4(Buffer.from(json, 'utf8'));

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546C67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binChunk.length, 8);

  const jsonHdr = Buffer.alloc(8);
  jsonHdr.writeUInt32LE(jsonBuf.length, 0);
  jsonHdr.writeUInt32LE(0x4E4F534A, 4);

  const binHdr = Buffer.alloc(8);
  binHdr.writeUInt32LE(binChunk.length, 0);
  binHdr.writeUInt32LE(0x004E4942, 4);

  return Buffer.concat([header, jsonHdr, jsonBuf, binHdr, binChunk]);
}

// ============================================================
// 几何体生成器
// ============================================================

function addBox(positions, normals, indices, cx, cy, cz, w, h, d) {
  const base = positions.length / 3;
  const hw = w / 2, hh = h / 2, hd = d / 2;
  // 8 corners
  const corners = [];
  for (let iz = -1; iz <= 1; iz += 2)
    for (let iy = -1; iy <= 1; iy += 2)
      for (let ix = -1; ix <= 1; ix += 2)
        corners.push([cx + ix * hw, cy + iy * hh, cz + iz * hd]);

  // 6 faces, each 2 triangles
  const faces = [
    [0,1,3,2, 0,0,1], [4,5,7,6, 0,0,-1],
    [0,4,6,2, -1,0,0], [1,5,7,3, 1,0,0],
    [2,3,7,6, 0,1,0], [0,1,5,4, 0,-1,0],
  ];
  for (const [a,b,c,d, nx,ny,nz] of faces) {
    const ai = base + a, bi = base + b, ci = base + c, di = base + d;
    positions.push(...corners[a], ...corners[b], ...corners[c], ...corners[d]);
    normals.push(nx,ny,nz, nx,ny,nz, nx,ny,nz, nx,ny,nz);
    indices.push(ai, bi, ci, ai, ci, di);
  }
  return 24; // 4 verts × 6 faces
}

function addCylinder(positions, normals, indices, cx, cy, cz, radiusTop, radiusBottom, height, segs = 16) {
  const base = positions.length / 3;
  const halfH = height / 2;

  // Side vertices
  for (let i = 0; i <= segs; i++) {
    const angle = (2 * Math.PI * i) / segs;
    const cosA = Math.cos(angle), sinA = Math.sin(angle);
    const nx = cosA, nz = sinA;
    // top ring
    positions.push(cx + radiusTop * cosA, cy + halfH, cz + radiusTop * sinA);
    normals.push(nx, 0, nz);
    // bottom ring
    positions.push(cx + radiusBottom * cosA, cy - halfH, cz + radiusBottom * sinA);
    normals.push(nx, 0, nz);
  }

  for (let i = 0; i < segs; i++) {
    const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;
    indices.push(a, b, c, b, d, c);
  }

  // Top cap
  const topCenter = positions.length / 3;
  positions.push(cx, cy + halfH, cz);
  normals.push(0, 1, 0);
  for (let i = 0; i <= segs; i++) {
    const angle = (2 * Math.PI * i) / segs;
    positions.push(cx + radiusTop * Math.cos(angle), cy + halfH, cz + radiusTop * Math.sin(angle));
    normals.push(0, 1, 0);
  }
  for (let i = 0; i < segs; i++) {
    indices.push(topCenter, topCenter + 1 + i, topCenter + 2 + i);
  }

  // Bottom cap
  const botCenter = positions.length / 3;
  positions.push(cx, cy - halfH, cz);
  normals.push(0, -1, 0);
  for (let i = 0; i <= segs; i++) {
    const angle = (2 * Math.PI * i) / segs;
    positions.push(cx + radiusBottom * Math.cos(angle), cy - halfH, cz + radiusBottom * Math.sin(angle));
    normals.push(0, -1, 0);
  }
  for (let i = 0; i < segs; i++) {
    indices.push(botCenter, botCenter + 2 + i, botCenter + 1 + i);
  }

  return (positions.length / 3) - base;
}

function addSphere(positions, normals, indices, cx, cy, cz, radius, segs = 16) {
  const base = positions.length / 3;
  for (let j = 0; j <= segs; j++) {
    const lat = Math.PI * (-0.5 + j / segs);
    const y = cy + radius * Math.sin(lat);
    const r2 = radius * Math.cos(lat);
    for (let i = 0; i <= segs; i++) {
      const lon = (2 * Math.PI * i) / segs;
      const x = cx + r2 * Math.cos(lon);
      const z = cz + r2 * Math.sin(lon);
      positions.push(x, y, z);
      normals.push(Math.cos(lon) * Math.cos(lat), Math.sin(lat), Math.sin(lon) * Math.cos(lat));
    }
  }
  for (let j = 0; j < segs; j++) {
    for (let i = 0; i < segs; i++) {
      const a = base + j * (segs + 1) + i;
      const b = a + segs + 1, c = a + 1, d = b + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  return (segs + 1) * (segs + 1);
}

// ============================================================
// 基础人体模型生成
// ============================================================

function buildHumanoidModel(gender) {
  const positions = [], normals = [], indices = [];
  const vertexGroups = {}; // 记录顶点分组用于 morph target

  const isFemale = gender === 'female';
  const scale = isFemale ? 0.9 : 1.0;

  // 记录各部位顶点范围
  function markGroup(name) {
    vertexGroups[name] = {
      start: positions.length / 3,
      end: -1, // 稍后填充
    };
  }

  // Head
  markGroup('head');
  addSphere(positions, normals, indices, 0, 1.5 * scale, 0, 0.18 * scale, 14);
  vertexGroups.head.end = positions.length / 3;

  // Neck
  markGroup('neck');
  addCylinder(positions, normals, indices, 0, 1.24 * scale, 0, 0.06 * scale, 0.06 * scale, 0.1 * scale, 8);
  vertexGroups.neck.end = positions.length / 3;

  // Torso (upper body)
  markGroup('torso');
  const torsoTop = 1.19 * scale, torsoBot = 0.75 * scale;
  const torsoRadTop = 0.14 * scale, torsoRadBot = 0.13 * scale;
  if (isFemale) {
    addCylinder(positions, normals, indices, 0, (torsoTop + torsoBot) / 2, 0, 0.13 * scale, 0.12 * scale, torsoTop - torsoBot, 14);
  } else {
    addCylinder(positions, normals, indices, 0, (torsoTop + torsoBot) / 2, 0, torsoRadTop, torsoRadBot, torsoTop - torsoBot, 14);
  }
  vertexGroups.torso.end = positions.length / 3;

  // Hips
  markGroup('hips');
  addCylinder(positions, normals, indices, 0, 0.7 * scale, 0, 0.14 * scale, 0.15 * scale, 0.1 * scale, 14);
  vertexGroups.hips.end = positions.length / 3;

  // Upper arms
  markGroup('leftUpperArm');
  addCylinder(positions, normals, indices, -0.2 * scale, 1.15 * scale, 0, 0.04 * scale, 0.04 * scale, 0.25 * scale, 8);
  vertexGroups.leftUpperArm.end = positions.length / 3;
  markGroup('rightUpperArm');
  addCylinder(positions, normals, indices, 0.2 * scale, 1.15 * scale, 0, 0.04 * scale, 0.04 * scale, 0.25 * scale, 8);
  vertexGroups.rightUpperArm.end = positions.length / 3;

  // Lower arms
  markGroup('leftLowerArm');
  addCylinder(positions, normals, indices, -0.2 * scale, 0.84 * scale, 0, 0.035 * scale, 0.035 * scale, 0.22 * scale, 8);
  vertexGroups.leftLowerArm.end = positions.length / 3;
  markGroup('rightLowerArm');
  addCylinder(positions, normals, indices, 0.2 * scale, 0.84 * scale, 0, 0.035 * scale, 0.035 * scale, 0.22 * scale, 8);
  vertexGroups.rightLowerArm.end = positions.length / 3;

  // Hands
  markGroup('leftHand');
  addSphere(positions, normals, indices, -0.2 * scale, 0.58 * scale, 0, 0.04 * scale, 8);
  vertexGroups.leftHand.end = positions.length / 3;
  markGroup('rightHand');
  addSphere(positions, normals, indices, 0.2 * scale, 0.58 * scale, 0, 0.04 * scale, 8);
  vertexGroups.rightHand.end = positions.length / 3;

  // Upper legs
  markGroup('leftUpperLeg');
  addCylinder(positions, normals, indices, -0.07 * scale, 0.48 * scale, 0, 0.07 * scale, 0.06 * scale, 0.3 * scale, 10);
  vertexGroups.leftUpperLeg.end = positions.length / 3;
  markGroup('rightUpperLeg');
  addCylinder(positions, normals, indices, 0.07 * scale, 0.48 * scale, 0, 0.07 * scale, 0.06 * scale, 0.3 * scale, 10);
  vertexGroups.rightUpperLeg.end = positions.length / 3;

  // Lower legs
  markGroup('leftLowerLeg');
  addCylinder(positions, normals, indices, -0.07 * scale, 0.13 * scale, 0, 0.055 * scale, 0.05 * scale, 0.28 * scale, 10);
  vertexGroups.leftLowerLeg.end = positions.length / 3;
  markGroup('rightLowerLeg');
  addCylinder(positions, normals, indices, 0.07 * scale, 0.13 * scale, 0, 0.055 * scale, 0.05 * scale, 0.28 * scale, 10);
  vertexGroups.rightLowerLeg.end = positions.length / 3;

  // Feet
  markGroup('leftFoot');
  addBox(positions, normals, indices, -0.07 * scale, -0.06 * scale, 0.04 * scale, 0.06 * scale, 0.05 * scale, 0.1 * scale);
  vertexGroups.leftFoot.end = positions.length / 3;
  markGroup('rightFoot');
  addBox(positions, normals, indices, 0.07 * scale, -0.06 * scale, 0.04 * scale, 0.06 * scale, 0.05 * scale, 0.1 * scale);
  vertexGroups.rightFoot.end = positions.length / 3;

  const totalVerts = positions.length / 3;
  return { positions, normals, indices, vertexGroups, totalVerts, scale, gender };
}

// ============================================================
// Morph Target 计算
// ============================================================

function computeMorphDeltas(baseModel) {
  const { positions: basePos, vertexGroups, scale } = baseModel;
  const totalVerts = basePos.length / 3;

  // 定义一个 helper：对指定顶点组做偏移
  function makeMorph(groupNames, modifier) {
    const deltas = new Float32Array(basePos.length);
    const groupStarts = new Set();

    for (const gName of groupNames) {
      const g = vertexGroups[gName];
      if (!g) continue;
      for (let i = g.start; i < g.end; i++) {
        if (groupStarts.has(i)) continue; // 不重复处理重叠顶点
        groupStarts.add(i);
        const idx = i * 3;
        modifier(deltas, basePos, idx, i, scale);
      }
    }
    return Array.from(deltas);
  }

  const morphDefs = [
    {
      name: 'eye_size',
      displayName: '眼睛大小',
      category: '脸部',
      min: -1, max: 1, step: 0.01, defaultValue: 0,
      deltas: makeMorph(['head'], (d, p, idx) => {
        const y = p[idx + 1];
        // 眼部区域（头部上半前方）
        if (y > 1.4 * scale && Math.abs(p[idx + 2]) < 0.15 * scale) {
          d[idx] = p[idx] * 0.1;
          d[idx + 1] = (p[idx + 1] - 1.5 * scale) * 0.15;
          d[idx + 2] = p[idx + 2] * 0.1;
        }
      }),
    },
    {
      name: 'nose_height',
      displayName: '鼻梁高度',
      category: '脸部',
      min: -1, max: 1, step: 0.01, defaultValue: 0,
      deltas: makeMorph(['head'], (d, p, idx) => {
        const y = p[idx + 1];
        const z = p[idx + 2];
        // 鼻梁区域（头部前方中央）
        if (y > 1.43 * scale && y < 1.58 * scale && Math.abs(p[idx]) < 0.06 * scale && Math.abs(z) < 0.08 * scale) {
          d[idx + 2] = 0.025 * scale;
        }
      }),
    },
    {
      name: 'jaw_width',
      displayName: '下颌宽度',
      category: '脸部',
      min: -1, max: 1, step: 0.01, defaultValue: 0,
      deltas: makeMorph(['head'], (d, p, idx) => {
        const y = p[idx + 1];
        // 下颌区域（头部下半部分侧面）
        if (y > 1.3 * scale && y < 1.46 * scale) {
          const distFromCenter = Math.abs(p[idx]);
          if (distFromCenter > 0.1 * scale) {
            d[idx] = p[idx] * 0.08;
          }
        }
      }),
    },
    {
      name: 'mouth_width',
      displayName: '嘴巴宽度',
      category: '脸部',
      min: -1, max: 1, step: 0.01, defaultValue: 0,
      deltas: makeMorph(['head'], (d, p, idx) => {
        const y = p[idx + 1];
        const z = p[idx + 2];
        // 嘴巴区域
        if (y > 1.4 * scale && y < 1.48 * scale && Math.abs(z) < 0.06 * scale && Math.abs(p[idx]) < 0.1 * scale) {
          d[idx] = p[idx] * 0.12;
        }
      }),
    },
    {
      name: 'brow_raise',
      displayName: '眉骨高度',
      category: '脸部',
      min: -1, max: 1, step: 0.01, defaultValue: 0,
      deltas: makeMorph(['head'], (d, p, idx) => {
        const y = p[idx + 1];
        const z = p[idx + 2];
        // 眉骨区域
        if (y > 1.55 * scale && y < 1.68 * scale && Math.abs(z) < 0.06 * scale && Math.abs(p[idx]) < 0.16 * scale) {
          d[idx + 1] = 0.015 * scale;
        }
      }),
    },
    {
      name: 'cheekbone',
      displayName: '颧骨突出',
      category: '脸部',
      min: -1, max: 1, step: 0.01, defaultValue: 0,
      deltas: makeMorph(['head'], (d, p, idx, i) => {
        const y = p[idx + 1];
        if (y > 1.45 * scale && y < 1.56 * scale) {
          const dist = Math.sqrt(p[idx] * p[idx] + p[idx + 2] * p[idx + 2]);
          if (dist > 0.12 * scale && dist < 0.19 * scale) {
            const factor = (dist - 0.12 * scale) / (0.07 * scale);
            d[idx] = (p[idx] / dist) * 0.02 * scale * factor;
            d[idx + 2] = (p[idx + 2] / dist) * 0.02 * scale * factor;
          }
        }
      }),
    },
    {
      name: 'chin_length',
      displayName: '下巴长度',
      category: '脸部',
      min: -1, max: 1, step: 0.01, defaultValue: 0,
      deltas: makeMorph(['head'], (d, p, idx) => {
        const y = p[idx + 1];
        if (y > 1.3 * scale && y < 1.45 * scale && Math.abs(p[idx]) < 0.08 * scale) {
          d[idx + 1] = -0.02 * scale;
        }
      }),
    },
    {
      name: 'head_width',
      displayName: '头型宽度',
      category: '脸部',
      min: -1, max: 1, step: 0.01, defaultValue: 0,
      deltas: makeMorph(['head'], (d, p, idx) => {
        d[idx] = p[idx] * 0.08;
        d[idx + 2] = p[idx + 2] * 0.04;
      }),
    },
    {
      name: 'eye_angle',
      displayName: '眼角角度',
      category: '脸部',
      min: -1, max: 1, step: 0.01, defaultValue: 0,
      deltas: makeMorph(['head'], (d, p, idx) => {
        const y = p[idx + 1];
        // 眼部区域 → 斜向偏移
        if (y > 1.55 * scale && y < 1.68 * scale && Math.abs(p[idx]) > 0.04 * scale && Math.abs(p[idx]) < 0.16 * scale) {
          const sign = p[idx] > 0 ? 1 : -1;
          d[idx + 1] = sign * (p[idx] - sign * 0.04 * scale) * 0.06;
        }
      }),
    },
    {
      name: 'nose_width',
      displayName: '鼻翼宽度',
      category: '脸部',
      min: -1, max: 1, step: 0.01, defaultValue: 0,
      deltas: makeMorph(['head'], (d, p, idx) => {
        const y = p[idx + 1];
        const z = p[idx + 2];
        if (y > 1.45 * scale && y < 1.54 * scale && Math.abs(z) < 0.06 * scale && Math.abs(p[idx]) < 0.1 * scale) {
          d[idx] = p[idx] * 0.1;
        }
      }),
    },
    {
      name: 'mouth_height',
      displayName: '嘴唇厚度',
      category: '脸部',
      min: -1, max: 1, step: 0.01, defaultValue: 0,
      deltas: makeMorph(['head'], (d, p, idx) => {
        const y = p[idx + 1];
        const z = p[idx + 2];
        if (y > 1.4 * scale && y < 1.5 * scale && Math.abs(z) < 0.04 * scale && Math.abs(p[idx]) < 0.08 * scale) {
          d[idx + 1] = 0.01 * scale;
        }
      }),
    },
    {
      name: 'body_height',
      displayName: '身高',
      category: '身体',
      min: -1, max: 1, step: 0.01, defaultValue: 0,
      deltas: makeMorph(['torso', 'hips', 'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg'], (d, p, idx) => {
        if (p[idx + 1] > 0) {
          d[idx + 1] = p[idx + 1] * 0.06;
        }
      }),
    },
  ];

  // 将 deltas 存储为差值数组格式（与 Three.js morphAttributes.position 兼容）
  const result = {
    definitions: morphDefs.map(m => ({
      name: m.name,
      displayName: m.displayName,
      category: m.category,
      min: m.min,
      max: m.max,
      step: m.step,
      defaultValue: m.defaultValue,
    })),
    deltas: morphDefs.reduce((acc, m) => {
      acc[m.name] = m.deltas;
      return acc;
    }, {}),
    vertexCount: totalVerts,
  };

  return result;
}

// ============================================================
// 部件 GLB 生成
// ============================================================

function generatePartGLB({ name, category, slot, gender, buildFn }) {
  const p = [], n = [], idx = [];
  const _groups = buildFn(p, n, idx);

  const colors = {
    hair: [0.2, 0.15, 0.3, 1],
    top: [0.3, 0.4, 0.7, 1],
    bottom: [0.2, 0.3, 0.5, 1],
    shoes: [0.15, 0.15, 0.2, 1],
    accessory: [0.7, 0.5, 0.2, 1],
  };

  const buf = buildGLB({
    positions: p, normals: n, indices: idx,
    material: {
      name: `${category}_material`,
      baseColorFactor: colors[category] || [0.5, 0.5, 0.5, 1],
      roughness: category === 'accessory' ? 0.3 : 0.6,
      metallic: category === 'accessory' ? 0.6 : 0.05,
    },
    nodeName: name,
    meshName: name,
  });

  const filename = `${category}-${name.replace(/\s+/g, '_').toLowerCase()}.glb`;
  fs.writeFileSync(path.join(partsDir, filename), buf);
  console.log(`  ✓ parts/${filename} (${(buf.length / 1024).toFixed(1)} KB)`);
  return `/models/parts/${filename}`;
}

const partsManifest = [];

function addPart(def) {
  const prefabUrl = generatePartGLB(def);
  partsManifest.push({
    id: def.id,
    name: def.name,
    category: def.category,
    slot: def.slot,
    gender: def.gender,
    style_tags: def.style_tags,
    prefab_url: prefabUrl,
  });
}

// ============================================================
// 主流程
// ============================================================

console.log('\n🎨 虚拟形象资产生成器\n');
console.log('═'.repeat(50));

// 1. 生成基础人体模型
console.log('\n📦 生成基础模型...');
for (const gender of ['female', 'male']) {
  const model = buildHumanoidModel(gender);
  const skinColor = gender === 'female' ? [0.96, 0.84, 0.78, 1] : [0.91, 0.79, 0.63, 1];

  const buf = buildGLB({
    positions: model.positions,
    normals: model.normals,
    indices: model.indices,
    material: {
      name: 'skin',
      baseColorFactor: skinColor,
      roughness: 0.6,
      metallic: 0.0,
    },
    nodeName: gender === 'female' ? 'BaseFemale' : 'BaseMale',
    meshName: 'AvatarBody',
  });

  const outPath = path.join(outDir, `base-${gender}.glb`);
  fs.writeFileSync(outPath, buf);
  console.log(`  ✓ base-${gender}.glb (${(buf.length / 1024).toFixed(1)} KB, ${model.totalVerts} verts)`);

  // 生成 Morph Target 数据
  const morphData = computeMorphDeltas(model);
  const morphPath = path.join(outDir, `base-${gender}.morph.json`);
  fs.writeFileSync(morphPath, JSON.stringify(morphData, null, 2));
  console.log(`  ✓ base-${gender}.morph.json (${morphData.definitions.length} morph targets)`);
}

// 2. 生成部件 GLB
console.log('\n🧩 生成部件...');

// 发型 (3种)
addPart({
  id: 'hair-1', name: '长发飘逸', category: 'hair', slot: 'Head', gender: 'female',
  style_tags: ['anime', 'korean'],
  buildFn: (p, n, idx) => {
    // 后半椭球 + 侧面长条
    addSphere(p, n, idx, 0, 0, 0, 0.22, 12);
  },
});

addPart({
  id: 'hair-2', name: '短发干练', category: 'hair', slot: 'Head', gender: 'unisex',
  style_tags: ['realistic', 'western'],
  buildFn: (p, n, idx) => {
    // 较短的半球
    for (let j = 0; j < 8; j++) {
      const lat = Math.PI * (-0.5 + j / 14);
      const y = 0.05 + 0.2 * Math.sin(lat);
      const r2 = 0.24 * Math.cos(lat);
      const base = p.length / 3, segs = 12;
      for (let i = 0; i <= segs; i++) {
        const lon = (2 * Math.PI * i) / segs;
        p.push(r2 * Math.cos(lon), y, r2 * Math.sin(lon));
        n.push(Math.cos(lon) * Math.cos(lat), Math.sin(lat), Math.sin(lon) * Math.cos(lat));
      }
      if (j > 0) {
        for (let i = 0; i < segs; i++) {
          const a = base - (segs + 1) + i, b = a + segs + 1, c = a + 1, d = b + 1;
          idx.push(a, b, c, b, d, c);
        }
      }
    }
  },
});

addPart({
  id: 'hair-3', name: '双马尾', category: 'hair', slot: 'Head', gender: 'female',
  style_tags: ['anime', 'chibi'],
  buildFn: (p, n, idx) => {
    // 头盔 + 两个侧边马尾
    addSphere(p, n, idx, 0, 0.02, 0, 0.2, 10);
    addCylinder(p, n, idx, -0.18, -0.15, -0.05, 0.04, 0.025, 0.4, 8);
    addCylinder(p, n, idx, 0.18, -0.15, -0.05, 0.04, 0.025, 0.4, 8);
  },
});

// 上装 (2种)
addPart({
  id: 'top-1', name: 'T恤', category: 'top', slot: 'Spine2', gender: 'unisex',
  style_tags: ['anime', 'realistic'],
  buildFn: (p, n, idx) => {
    addCylinder(p, n, idx, 0, 0, 0, 0.15, 0.16, 0.45, 14);
  },
});

addPart({
  id: 'top-2', name: '西装外套', category: 'top', slot: 'Spine2', gender: 'unisex',
  style_tags: ['realistic', 'western'],
  buildFn: (p, n, idx) => {
    // 主体 + 翻领
    addCylinder(p, n, idx, 0, 0, 0, 0.17, 0.18, 0.5, 14);
    // 翻领（两个小三角片）
    addBox(p, n, idx, -0.08, 0.15, 0.04, 0.06, 0.1, 0.02);
    addBox(p, n, idx, 0.08, 0.15, 0.04, 0.06, 0.1, 0.02);
  },
});

// 下装 (2种)
addPart({
  id: 'bottom-1', name: '短裙', category: 'bottom', slot: 'Hips', gender: 'female',
  style_tags: ['anime', 'korean'],
  buildFn: (p, n, idx) => {
    addCylinder(p, n, idx, 0, -0.05, 0, 0.16, 0.2, 0.22, 16);
  },
});

addPart({
  id: 'bottom-2', name: '长裤', category: 'bottom', slot: 'Hips', gender: 'unisex',
  style_tags: ['realistic', 'western'],
  buildFn: (p, n, idx) => {
    addCylinder(p, n, idx, 0, -0.15, 0, 0.15, 0.13, 0.35, 12);
    // 两条裤腿
    addCylinder(p, n, idx, -0.06, -0.38, 0, 0.06, 0.05, 0.3, 8);
    addCylinder(p, n, idx, 0.06, -0.38, 0, 0.06, 0.05, 0.3, 8);
  },
});

// 鞋子 (2种)
addPart({
  id: 'shoe-1', name: '运动鞋', category: 'shoes', slot: 'RightFoot', gender: 'unisex',
  style_tags: ['realistic', 'western'],
  buildFn: (p, n, idx) => {
    addBox(p, n, idx, 0, 0.02, 0, 0.07, 0.05, 0.12);
    addBox(p, n, idx, 0, -0.02, 0, 0.08, 0.03, 0.13);
  },
});

addPart({
  id: 'shoe-2', name: '高跟鞋', category: 'shoes', slot: 'RightFoot', gender: 'female',
  style_tags: ['anime', 'korean', 'western'],
  buildFn: (p, n, idx) => {
    addBox(p, n, idx, 0, 0.03, 0.03, 0.06, 0.04, 0.1);
    addCylinder(p, n, idx, 0, -0.02, 0.05, 0.01, 0.01, 0.06, 6);
  },
});

// 配饰 (4种)
addPart({
  id: 'acc-1', name: '圆框眼镜', category: 'accessory', slot: 'Head', gender: 'unisex',
  style_tags: ['anime', 'realistic', 'korean'],
  buildFn: (p, n, idx) => {
    // 两个小圆环 + 鼻梁
    addCylinder(p, n, idx, -0.06, 0, 0.02, 0.035, 0.035, 0.01, 16);
    addCylinder(p, n, idx, 0.06, 0, 0.02, 0.035, 0.035, 0.01, 16);
    addBox(p, n, idx, 0, 0, 0.02, 0.12, 0.01, 0.005);
  },
});

addPart({
  id: 'acc-2', name: '星星发饰', category: 'accessory', slot: 'Head', gender: 'female',
  style_tags: ['anime', 'chibi'],
  buildFn: (p, n, idx) => {
    // 小星星（用扁平盒子 + 球体表示）
    addSphere(p, n, idx, 0, 0.05, 0, 0.04, 8);
    addBox(p, n, idx, 0, 0.05, 0, 0.08, 0.01, 0.01);
    addBox(p, n, idx, 0, 0.05, 0, 0.01, 0.01, 0.08);
    addBox(p, n, idx, 0.03, 0.05, 0.03, 0.04, 0.01, 0.01);
    addBox(p, n, idx, -0.03, 0.05, -0.03, 0.04, 0.01, 0.01);
  },
});

addPart({
  id: 'acc-3', name: '鸭舌帽', category: 'accessory', slot: 'Head', gender: 'unisex',
  style_tags: ['realistic', 'western'],
  buildFn: (p, n, idx) => {
    addCylinder(p, n, idx, 0, 0.02, 0, 0.2, 0.21, 0.08, 16);
    addCylinder(p, n, idx, 0, 0.0, -0.05, 0.22, 0.22, 0.02, 16);
  },
});

addPart({
  id: 'acc-4', name: '项链', category: 'accessory', slot: 'Neck', gender: 'unisex',
  style_tags: ['realistic', 'korean', 'western'],
  buildFn: (p, n, idx) => {
    // 细环 + 小吊坠
    addCylinder(p, n, idx, 0, 0, 0, 0.08, 0.08, 0.01, 20);
    addSphere(p, n, idx, 0, -0.06, 0, 0.02, 8);
  },
});

// 3. 保存部件清单
const manifestPath = path.join(outDir, 'parts-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(partsManifest, null, 2));
console.log(`\n📋 部件清单: parts-manifest.json (${partsManifest.length} 个部件)`);

// 4. 生成缩略图占位文件（SVG）
console.log('\n🖼️  生成缩略图占位...');
const placeholderDir = path.join(__dirname, '..', 'public', 'images');
fs.mkdirSync(placeholderDir, { recursive: true });

const partThumbDir = path.join(placeholderDir, 'parts');
fs.mkdirSync(partThumbDir, { recursive: true });

partsManifest.forEach(part => {
  const colorMap = { hair: '#4a3080', top: '#4060b0', bottom: '#3050a0', shoes: '#202030', accessory: '#b08030' };
  const color = colorMap[part.category] || '#666';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  <rect width="120" height="120" fill="#1a1a2e" rx="8"/>
  <circle cx="60" cy="50" r="25" fill="${color}" opacity="0.8"/>
  <text x="60" y="95" text-anchor="middle" fill="#888" font-size="9" font-family="sans-serif">${part.name}</text>
</svg>`;
  fs.writeFileSync(path.join(partThumbDir, `${part.id}.svg`), svg);
});

console.log(`  ✓ ${partsManifest.length} 缩略图占位\n`);

console.log('═'.repeat(50));
console.log('✅ 资产生成完成！');
console.log(`\n输出目录: ${outDir}`);
console.log('  - base-female.glb / base-male.glb (基础模型)');
console.log('  - base-*.morph.json (Morph Target 数据)');
console.log(`  - parts/*.glb (${partsManifest.length} 个部件)`);
console.log('  - parts-manifest.json (部件清单)');
console.log('  - images/parts/*.svg (缩略图占位)');
