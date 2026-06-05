// GLB 导出器 — 合并 base model + 部件 + 烘焙 morph targets → 单个 GLB 二进制文件
import fs from 'fs';
import path from 'path';

// ============================================================
// GLB 解析
// ============================================================

interface GlbData {
  json: Record<string, unknown>;
  buffer: Buffer;
}

function parseGlb(filePath: string): GlbData {
  const buf = fs.readFileSync(filePath);
  if (buf.readUInt32LE(0) !== 0x46546C67) throw new Error('Not a GLB file');
  const jsonLength = buf.readUInt32LE(12);
  const jsonData = buf.subarray(20, 20 + jsonLength);
  const json = JSON.parse(jsonData.toString('utf-8'));

  let binOffset = 20 + jsonLength;
  // skip padding if needed
  if (binOffset % 4 !== 0) binOffset += 4 - (binOffset % 4);
  const binLength = buf.readUInt32LE(binOffset);
  const binData = buf.subarray(binOffset + 8, binOffset + 8 + binLength);

  return { json, buffer: Buffer.from(binData) };
}

// ============================================================
// Morph target 烘焙
// ============================================================

function bakeMorphTargets(
  positions: Float32Array,
  morphDeltas: Record<string, Float32Array>,
  blendShapes: Record<string, number>
): Float32Array {
  const result = new Float32Array(positions);
  for (const [name, weight] of Object.entries(blendShapes)) {
    const deltas = morphDeltas[name];
    if (deltas && weight !== 0) {
      for (let i = 0; i < result.length; i++) {
        result[i] += deltas[i] * weight;
      }
    }
  }
  return result;
}

function loadMorphDeltas(modelPath: string): Record<string, Float32Array> | null {
  const morphPath = modelPath.replace(/\.glb$/, '.morph.json');
  if (!fs.existsSync(morphPath)) return null;
  const morphData = JSON.parse(fs.readFileSync(morphPath, 'utf-8'));
  const deltas: Record<string, Float32Array> = {};
  for (const def of morphData.definitions || []) {
    if (def.deltaArray && def.vertexCount) {
      deltas[def.name] = new Float32Array(def.deltaArray);
    }
  }
  return deltas;
}

// ============================================================
// GLB 合并
// ============================================================

interface MergedGLB {
  json: Record<string, unknown>;
  buffer: Buffer;
  accessorOffsets: number[];  // 每个源 accessor 在新 buffer 中的偏移
}

function mergeGLBs(mainGlb: GlbData, partGlbs: GlbData[], partTransforms?: Float32Array[]): MergedGLB {
  const json = JSON.parse(JSON.stringify(mainGlb.json)) as Record<string, unknown>;
  let buffer = Buffer.from(mainGlb.buffer);
  const accessorOffsets: number[] = [];

  // 记录主模型 accessor 偏移
  const mainAccessors = (json.accessors as unknown[] || []);
  for (const acc of mainAccessors) {
    const a = acc as Record<string, unknown>;
    accessorOffsets.push((a.byteOffset as number) || 0);
  }

  const meshes = (json.meshes || []) as Record<string, unknown>[];
  const nodes = (json.nodes || []) as Record<string, unknown>[];
  const bufferViews = (json.bufferViews || []) as Record<string, unknown>[];
  const accessors = mainAccessors as Record<string, unknown>[];

  // 合并每个部件
  for (let pi = 0; pi < partGlbs.length; pi++) {
    const part = partGlbs[pi];
    const partJson = part.json as Record<string, unknown>;
    const partName = `part_${pi}`;

    // 偏移量: 新数据追加位置
    const bufferOffset = buffer.length;
    const alignedOffset = Math.ceil(bufferOffset / 4) * 4;
    if (alignedOffset > bufferOffset) {
      buffer = Buffer.concat([buffer, Buffer.alloc(alignedOffset - bufferOffset)]);
    }

    const partMeshes = (partJson.meshes || []) as Record<string, unknown>[];
    const partNodes = (partJson.nodes || []) as Record<string, unknown>[];
    const partViews = (partJson.bufferViews || []) as Record<string, unknown>[];
    const partAccessors = (partJson.accessors || []) as Record<string, unknown>[];

    const nodeBaseIdx = nodes.length;
    const meshBaseIdx = meshes.length;
    const viewBaseIdx = bufferViews.length;
    const accBaseIdx = accessors.length;

    // 追加 buffer 数据
    const partBuf = part.buffer;
    buffer = Buffer.concat([buffer, partBuf]);

    // 偏移 bufferView
    for (const bv of partViews) {
      const b = bv as Record<string, unknown>;
      bufferViews.push({
        ...b,
        buffer: 0,
        byteOffset: ((b.byteOffset as number) || 0) + alignedOffset,
      });
    }

    // 偏移 accessor
    for (const acc of partAccessors) {
      const a = acc as Record<string, unknown>;
      accessors.push({
        ...a,
        bufferView: ((a.bufferView as number) || 0) + viewBaseIdx,
      });
      accessorOffsets.push(((a.byteOffset as number) || 0) + alignedOffset);
    }

    // 偏移 mesh primitive 的 indices/POSITION/NORMAL
    for (const m of partMeshes) {
      const mesh = m as Record<string, unknown>;
      const primitives = mesh.primitives as Record<string, unknown>[];
      for (const prim of primitives) {
        if (prim.indices !== undefined) prim.indices = (prim.indices as number) + accBaseIdx;
        if (prim.attributes) {
          const attrs = prim.attributes as Record<string, unknown>;
          for (const [key, val] of Object.entries(attrs)) {
            attrs[key] = (val as number) + accBaseIdx;
          }
        }
      }
      meshes.push({ ...mesh, name: `${partName}_${mesh.name || 'mesh'}` });
    }

    // 偏移 node
    for (const n of partNodes) {
      const node = n as Record<string, unknown>;
      const newNode: Record<string, unknown> = {
        ...node,
        name: `${partName}_${node.name || 'node'}`,
      };
      if (node.mesh !== undefined) newNode.mesh = (node.mesh as number) + meshBaseIdx;

      // 应用部件变换
      if (partTransforms && partTransforms[pi]) {
        const tf = partTransforms[pi];
        newNode.translation = [tf[12], tf[13], tf[14]];
        newNode.rotation = matrixToQuat(tf);
        newNode.scale = [1, 1, 1];
      }

      nodes.push(newNode);
    }
  }

  json.bufferViews = bufferViews;
  json.accessors = accessors;
  json.meshes = meshes;
  json.nodes = nodes;

  // 更新 scene
  const scene = (json.scene ?? 0) as number;
  const scenes = (json.scenes || []) as Record<string, unknown>[];
  if (scenes[scene]) {
    const s = scenes[scene];
    const rootNodes = (s.nodes || []) as number[];
    // 添加所有部件根 node
    let idx = nodes.length - partGlbs.reduce((sum, p) => sum + ((p.json as Record<string, unknown>).nodes as unknown[] || []).length, 0);
    for (const _ of partGlbs) {
      // ... 更简化的方式：把所有新增 node 加入根
    }
    // 简化：把所有新 node 索引加入根场景
    const allNodeIdx = Array.from({ length: nodes.length }, (_, i) => i);
    s.nodes = allNodeIdx;
  }

  return { json, buffer, accessorOffsets };
}

function matrixToQuat(mat: Float32Array): number[] {
  const m = mat;
  const trace = m[0] + m[5] + m[10];
  let qx: number, qy: number, qz: number, qw: number;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1.0) * 2;
    qw = s * 0.25;
    qx = (m[6] - m[9]) / s;
    qy = (m[8] - m[2]) / s;
    qz = (m[1] - m[4]) / s;
  } else if (m[0] > m[5] && m[0] > m[10]) {
    const s = Math.sqrt(1.0 + m[0] - m[5] - m[10]) * 2;
    qw = (m[6] - m[9]) / s;
    qx = s * 0.25;
    qy = (m[4] + m[1]) / s;
    qz = (m[8] + m[2]) / s;
  } else if (m[5] > m[10]) {
    const s = Math.sqrt(1.0 + m[5] - m[0] - m[10]) * 2;
    qw = (m[8] - m[2]) / s;
    qx = (m[4] + m[1]) / s;
    qy = s * 0.25;
    qz = (m[9] + m[6]) / s;
  } else {
    const s = Math.sqrt(1.0 + m[10] - m[0] - m[5]) * 2;
    qw = (m[1] - m[4]) / s;
    qx = (m[8] + m[2]) / s;
    qy = (m[9] + m[6]) / s;
    qz = s * 0.25;
  }
  return [qx, qy, qz, qw];
}

// ============================================================
// GLB 编码
// ============================================================

function encodeGLB(json: Record<string, unknown>, buffer: Buffer): Buffer {
  const jsonStr = JSON.stringify(json);
  const jsonBuf = Buffer.from(jsonStr, 'utf-8');
  // pad JSON chunk to 4-byte boundary
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  const binPad = (4 - (buffer.length % 4)) % 4;

  const totalLength = 12 // header
    + 8 + jsonBuf.length + jsonPad  // JSON chunk with padding
    + 8 + buffer.length + binPad;   // BIN chunk with padding

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546C67, 0); // glTF
  header.writeUInt32LE(2, 4);          // version 2
  header.writeUInt32LE(totalLength, 8);

  const jsonChunk = Buffer.alloc(8 + jsonBuf.length + jsonPad);
  jsonChunk.writeUInt32LE(jsonBuf.length + jsonPad, 0);
  jsonChunk.writeUInt32LE(0x4E4F534A, 4); // JSON
  jsonBuf.copy(jsonChunk, 8);

  const binChunk = Buffer.alloc(8 + buffer.length + binPad);
  binChunk.writeUInt32LE(buffer.length + binPad, 0);
  binChunk.writeUInt32LE(0x004E4942, 4); // BIN
  buffer.copy(binChunk, 8);

  return Buffer.concat([header, jsonChunk, binChunk]);
}

// ============================================================
// 主导出函数
// ============================================================

export interface ExportOptions {
  baseModel: 'male' | 'female';
  blendShapes: Record<string, number>;
  equippedParts: { slot: string; partId: string }[];
  materialOverrides?: Record<string, { albedo: string; roughness: number; metallic: number }>;
  format: 'glb' | 'vrm';
}

export async function exportAvatar(options: ExportOptions): Promise<Buffer> {
  const modelsDir = path.join(process.cwd(), 'public', 'models');
  const baseName = `base-${options.baseModel}`;
  const basePath = path.join(modelsDir, `${baseName}.glb`);

  if (!fs.existsSync(basePath)) {
    throw new Error(`Base model not found: ${basePath}`);
  }

  // 解析主模型
  const mainGlb = parseGlb(basePath);

  // 加载并烘焙 morph targets
  const morphDeltas = loadMorphDeltas(basePath);
  if (morphDeltas && Object.keys(options.blendShapes).length > 0) {
    const accessors = mainGlb.json.accessors as Record<string, unknown>[];
    for (const acc of accessors) {
      if (acc.type === 'VEC3' && acc.name !== 'NORMAL') {
        const bufViewIdx = acc.bufferView as number;
        const bufViews = mainGlb.json.bufferViews as Record<string, unknown>[];
        const bv = bufViews[bufViewIdx] as Record<string, unknown>;
        const offset = (bv.byteOffset as number) || 0;
        const count = (acc.count as number) || 0;
        const posArray = new Float32Array(mainGlb.buffer.buffer, mainGlb.buffer.byteOffset + offset, count * 3);
        const baked = bakeMorphTargets(posArray, morphDeltas, options.blendShapes);
        mainGlb.buffer.set(Buffer.from(baked.buffer), offset);
      }
    }
  }

  // 加载并合并部件
  const partsManifestPath = path.join(modelsDir, 'parts-manifest.json');
  let partsManifest: { id: string; prefab_url: string; slot: string }[] = [];
  if (fs.existsSync(partsManifestPath)) {
    partsManifest = JSON.parse(fs.readFileSync(partsManifestPath, 'utf-8'));
  }

  const partGlbs: GlbData[] = [];
  const partTransforms: Float32Array[] = [];

  for (const equip of options.equippedParts) {
    const manifest = partsManifest.find(p => p.id === equip.partId);
    if (!manifest) continue;

    const partPath = path.join(modelsDir, manifest.prefab_url);
    if (!fs.existsSync(partPath)) continue;

    partGlbs.push(parseGlb(partPath));

    // 计算附件点变换（简化：按 slot 估算位置）
    const tf = new Float32Array(16);
    identityMatrix(tf);
    applySlotTransform(tf, equip.slot);
    partTransforms.push(tf);
  }

  // 合并
  const merged = mergeGLBs(mainGlb, partGlbs, partTransforms);

  // 应用材质覆盖
  applyMaterialOverrides(merged.json, options.materialOverrides || {});

  return encodeGLB(merged.json, merged.buffer);
}

function identityMatrix(m: Float32Array) {
  m.fill(0);
  m[0] = m[5] = m[10] = m[15] = 1;
}

function applySlotTransform(m: Float32Array, slot: string) {
  // 简化的附件位置映射（与 BoneAttachment 的 fallback 位置一致）
  const positions: Record<string, [number, number, number]> = {
    'Head': [0, 1.65, 0],
    'Neck': [0, 1.4, 0],
    'Spine2': [0, 1.1, 0],
    'Spine1': [0, 0.7, 0],
    'Hips': [0, 0.0, 0],
    'RightHand': [0.6, 0.7, 0],
    'LeftHand': [-0.6, 0.7, 0],
    'RightFoot': [0.2, -1.0, 0],
    'LeftFoot': [-0.2, -1.0, 0],
  };
  const pos = positions[slot] || [0, 0, 0];
  m[12] = pos[0];
  m[13] = pos[1];
  m[14] = pos[2];
}

function applyMaterialOverrides(json: Record<string, unknown>, overrides: Record<string, { albedo: string; roughness: number; metallic: number }>) {
  const materials = json.materials as Record<string, unknown>[] | undefined;
  if (!materials || Object.keys(overrides).length === 0) return;

  for (let i = 0; i < materials.length; i++) {
    const mat = materials[i];
    const baseName = (mat.name as string) || '';
    // 查找匹配的材质覆盖
    for (const [_partId, override] of Object.entries(overrides)) {
      const pbr = mat.pbrMetallicRoughness as Record<string, unknown> | undefined;
      if (pbr == null) continue;
      if (override.albedo) {
        pbr.baseColorFactor = hexToFloatArray(override.albedo);
      }
      if (override.roughness !== undefined) pbr.roughnessFactor = override.roughness;
      if (override.metallic !== undefined) pbr.metallicFactor = override.metallic;
    }
  }
}

function hexToFloatArray(hex: string): [number, number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b, 1.0];
}
