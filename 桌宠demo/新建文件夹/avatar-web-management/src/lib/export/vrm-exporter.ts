// VRM 1.0 导出器 — 在 GLB 基础上添加 VRMC_vrm 扩展元数据
import { exportAvatar, type ExportOptions } from './glb-exporter';

const VRM_HUMANOID_BONES: Record<string, string> = {
  hips: 'Hips',
  spine: 'Spine',
  chest: 'Chest',
  upperChest: 'UpperChest',
  neck: 'Neck',
  head: 'Head',
  leftEye: 'LeftEye',
  rightEye: 'RightEye',
  jaw: 'Jaw',
  leftUpperLeg: 'LeftUpperLeg',
  leftLowerLeg: 'LeftLowerLeg',
  leftFoot: 'LeftFoot',
  leftToes: 'LeftToes',
  rightUpperLeg: 'RightUpperLeg',
  rightLowerLeg: 'RightLowerLeg',
  rightFoot: 'RightFoot',
  rightToes: 'RightToes',
  leftShoulder: 'LeftShoulder',
  leftUpperArm: 'LeftUpperArm',
  leftLowerArm: 'LeftLowerArm',
  leftHand: 'LeftHand',
  rightShoulder: 'RightShoulder',
  rightUpperArm: 'RightUpperArm',
  rightLowerArm: 'RightLowerArm',
  rightHand: 'RightHand',
  leftThumbProximal: 'LeftThumb1',
  leftThumbIntermediate: 'LeftThumb2',
  leftThumbDistal: 'LeftThumb3',
  leftIndexProximal: 'LeftIndex1',
  leftIndexIntermediate: 'LeftIndex2',
  leftIndexDistal: 'LeftIndex3',
  leftMiddleProximal: 'LeftMiddle1',
  leftMiddleIntermediate: 'LeftMiddle2',
  leftMiddleDistal: 'LeftMiddle3',
  leftRingProximal: 'LeftRing1',
  leftRingIntermediate: 'LeftRing2',
  leftRingDistal: 'LeftRing3',
  leftLittleProximal: 'LeftLittle1',
  leftLittleIntermediate: 'LeftLittle2',
  leftLittleDistal: 'LeftLittle3',
  rightThumbProximal: 'RightThumb1',
  rightThumbIntermediate: 'RightThumb2',
  rightThumbDistal: 'RightThumb3',
  rightIndexProximal: 'RightIndex1',
  rightIndexIntermediate: 'RightIndex2',
  rightIndexDistal: 'RightIndex3',
  rightMiddleProximal: 'RightMiddle1',
  rightMiddleIntermediate: 'RightMiddle2',
  rightMiddleDistal: 'RightMiddle3',
  rightRingProximal: 'RightRing1',
  rightRingIntermediate: 'RightRing2',
  rightRingDistal: 'RightRing3',
  rightLittleProximal: 'RightLittle1',
  rightLittleIntermediate: 'RightLittle2',
  rightLittleDistal: 'RightLittle3',
};

const VRM_BONE_POSITIONS: Record<string, [number, number, number]> = {
  Hips: [0, 0.0, 0],
  Spine: [0, 0.35, 0],
  Chest: [0, 0.75, 0],
  UpperChest: [0, 0.92, 0],
  Neck: [0, 1.1, 0],
  Head: [0, 1.35, 0],
  LeftEye: [-0.08, 1.52, -0.1],
  RightEye: [0.08, 1.52, -0.1],
  Jaw: [0, 1.3, 0.05],
  LeftUpperLeg: [-0.09, -0.05, 0],
  LeftLowerLeg: [-0.09, -0.45, 0],
  LeftFoot: [-0.09, -0.9, 0.05],
  LeftToes: [-0.09, -0.95, 0.12],
  RightUpperLeg: [0.09, -0.05, 0],
  RightLowerLeg: [0.09, -0.45, 0],
  RightFoot: [0.09, -0.9, 0.05],
  RightToes: [0.09, -0.95, 0.12],
  LeftShoulder: [-0.22, 1.05, 0],
  LeftUpperArm: [-0.28, 0.95, 0],
  LeftLowerArm: [-0.28, 0.65, 0],
  LeftHand: [-0.28, 0.35, 0],
  RightShoulder: [0.22, 1.05, 0],
  RightUpperArm: [0.28, 0.95, 0],
  RightLowerArm: [0.28, 0.65, 0],
  RightHand: [0.28, 0.35, 0],
  LeftThumb1: [-0.32, 0.32, 0.02], LeftThumb2: [-0.34, 0.29, 0.02], LeftThumb3: [-0.35, 0.27, 0.02],
  LeftIndex1: [-0.32, 0.37, 0], LeftIndex2: [-0.33, 0.4, 0], LeftIndex3: [-0.34, 0.43, 0],
  LeftMiddle1: [-0.30, 0.38, 0], LeftMiddle2: [-0.30, 0.42, 0], LeftMiddle3: [-0.30, 0.45, 0],
  LeftRing1: [-0.28, 0.37, 0], LeftRing2: [-0.28, 0.4, 0], LeftRing3: [-0.28, 0.43, 0],
  LeftLittle1: [-0.26, 0.36, 0], LeftLittle2: [-0.26, 0.39, 0], LeftLittle3: [-0.26, 0.41, 0],
  RightThumb1: [0.32, 0.32, 0.02], RightThumb2: [0.34, 0.29, 0.02], RightThumb3: [0.35, 0.27, 0.02],
  RightIndex1: [0.32, 0.37, 0], RightIndex2: [0.33, 0.4, 0], RightIndex3: [0.34, 0.43, 0],
  RightMiddle1: [0.30, 0.38, 0], RightMiddle2: [0.30, 0.42, 0], RightMiddle3: [0.30, 0.45, 0],
  RightRing1: [0.28, 0.37, 0], RightRing2: [0.28, 0.4, 0], RightRing3: [0.28, 0.43, 0],
  RightLittle1: [0.26, 0.36, 0], RightLittle2: [0.26, 0.39, 0], RightLittle3: [0.26, 0.41, 0],
};

function buildVrmExtension(avatarName: string): Record<string, unknown> {
  return {
    specVersion: '1.0',
    name: avatarName || 'Exported Avatar',
    meta: {
      name: avatarName || 'Avatar',
      version: '1.0',
      authors: ['Avatar Web Management'],
      copyrightInformation: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      avatarPermission: 'everyone',
      allowExcessivelyViolentUsage: false,
      allowPoliticalOrReligiousUsage: false,
    },
    humanoid: {
      humanBones: Object.fromEntries(
        Object.entries(VRM_HUMANOID_BONES).map(([vrmName, boneName]) => [vrmName, { node: boneName }])
      ),
    },
    firstPerson: {
      meshAnnotations: [],
    },
    lookAt: {
      offsetFromHeadBone: [0, 0.06, 0],
      type: 'bone',
      rangeMapHorizontalInner: { inputMaxValue: 20, outputScale: 0.02 },
      rangeMapHorizontalOuter: { inputMaxValue: 90, outputScale: 0.05 },
      rangeMapVerticalDown: { inputMaxValue: 20, outputScale: 0.02 },
      rangeMapVerticalUp: { inputMaxValue: 20, outputScale: 0.02 },
    },
    expression: {
      preset: {
        happy: { morphTargetBinds: [] },
        angry: { morphTargetBinds: [] },
        sad: { morphTargetBinds: [] },
        relaxed: { morphTargetBinds: [] },
        surprised: { morphTargetBinds: [] },
        aa: { morphTargetBinds: [] },
        ih: { morphTargetBinds: [] },
        ou: { morphTargetBinds: [] },
        ee: { morphTargetBinds: [] },
        oh: { morphTargetBinds: [] },
      },
      custom: {},
    },
  };
}

export async function exportVRM(options: ExportOptions & { avatarName?: string }): Promise<Buffer> {
  // 先用 GLB 导出逻辑生成基础模型
  const glbBuffer = await exportAvatar({ ...options, format: 'glb' });

  // 解析 GLB，注入 VRMC_vrm 扩展
  const buf = glbBuffer;
  const jsonLength = buf.readUInt32LE(12);
  const jsonData = buf.subarray(20, 20 + jsonLength);
  const json = JSON.parse(jsonData.toString('utf-8'));

  // 添加 VRM 扩展
  const vrmExt = buildVrmExtension(options.avatarName || 'Avatar');

  if (!json.extensionsUsed) json.extensionsUsed = [];
  if (!json.extensionsRequired) json.extensionsRequired = [];
  const used = json.extensionsUsed as string[];
  const required = json.extensionsRequired as string[];
  if (!used.includes('VRMC_vrm')) used.push('VRMC_vrm');
  if (!required.includes('VRMC_vrm')) required.push('VRMC_vrm');
  if (!used.includes('VRMC_materials_mtoon')) used.push('VRMC_materials_mtoon');

  json.extensions = { ...(json.extensions as Record<string, unknown> || {}), VRMC_vrm: vrmExt };

  // 添加人形骨架节点
  const nodes = (json.nodes || []) as Record<string, unknown>[];
  const existingNodeNames = new Set(nodes.map((n: Record<string, unknown>) => n.name as string));
  const boneNodeMap: Record<string, number> = {};

  // 重建骨骼层级 (父子关系)
  const boneHierarchy: Record<string, string> = {
    Hips: '',
    Spine: 'Hips',
    Chest: 'Spine',
    UpperChest: 'Chest',
    Neck: 'UpperChest',
    Head: 'Neck',
    LeftEye: 'Head', RightEye: 'Head', Jaw: 'Head',
    LeftUpperLeg: 'Hips', LeftLowerLeg: 'LeftUpperLeg', LeftFoot: 'LeftLowerLeg', LeftToes: 'LeftFoot',
    RightUpperLeg: 'Hips', RightLowerLeg: 'RightUpperLeg', RightFoot: 'RightLowerLeg', RightToes: 'RightFoot',
    LeftShoulder: 'UpperChest', LeftUpperArm: 'LeftShoulder', LeftLowerArm: 'LeftUpperArm', LeftHand: 'LeftLowerArm',
    RightShoulder: 'UpperChest', RightUpperArm: 'RightShoulder', RightLowerArm: 'RightUpperArm', RightHand: 'RightLowerArm',
    LeftThumb1: 'LeftHand', LeftThumb2: 'LeftThumb1', LeftThumb3: 'LeftThumb2',
    LeftIndex1: 'LeftHand', LeftIndex2: 'LeftIndex1', LeftIndex3: 'LeftIndex2',
    LeftMiddle1: 'LeftHand', LeftMiddle2: 'LeftMiddle1', LeftMiddle3: 'LeftMiddle2',
    LeftRing1: 'LeftHand', LeftRing2: 'LeftRing1', LeftRing3: 'LeftRing2',
    LeftLittle1: 'LeftHand', LeftLittle2: 'LeftLittle1', LeftLittle3: 'LeftLittle2',
    RightThumb1: 'RightHand', RightThumb2: 'RightThumb1', RightThumb3: 'RightThumb2',
    RightIndex1: 'RightHand', RightIndex2: 'RightIndex1', RightIndex3: 'RightIndex2',
    RightMiddle1: 'RightHand', RightMiddle2: 'RightMiddle1', RightMiddle3: 'RightMiddle2',
    RightRing1: 'RightHand', RightRing2: 'RightRing1', RightRing3: 'RightRing2',
    RightLittle1: 'RightHand', RightLittle2: 'RightLittle1', RightLittle3: 'RightLittle2',
  };

  // 添加所有骨骼节点
  for (const boneName of Object.keys(boneHierarchy)) {
    if (existingNodeNames.has(boneName)) {
      boneNodeMap[boneName] = nodes.findIndex((n: Record<string, unknown>) => n.name === boneName);
      continue;
    }
    const pos = VRM_BONE_POSITIONS[boneName] || [0, 0, 0];
    boneNodeMap[boneName] = nodes.length;
    nodes.push({
      name: boneName,
      translation: pos,
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    });
  }

  // 设置骨骼父子关系
  for (const [boneName, parentName] of Object.entries(boneHierarchy)) {
    const nodeIdx = boneNodeMap[boneName];
    if (parentName && boneNodeMap[parentName] !== undefined) {
      const node = nodes[nodeIdx] as Record<string, unknown>;
      const children = (node.children || []) as number[];
      if (!children.includes(boneNodeMap[parentName])) continue;

      // 查找父节点已有 children
      const parentNode = nodes[boneNodeMap[parentName]] as Record<string, unknown>;
      const parentChildren = (parentNode.children || []) as number[];
      parentChildren.push(nodeIdx);
      parentNode.children = parentChildren;
    }
  }

  json.nodes = nodes;

  // 转换材质为 MToon
  const materials = json.materials as Record<string, unknown>[] | undefined;
  if (materials) {
    for (let i = 0; i < materials.length; i++) {
      const mat = materials[i];
      const name = (mat.name as string) || `material_${i}`;
      const pbr = mat.pbrMetallicRoughness as Record<string, unknown> | undefined;
      const baseColor = (pbr?.baseColorFactor as number[]) || [1, 1, 1, 1];
      const baseColorHex = floatToHex(baseColor);

      mat.extensions = {
        ...(mat.extensions as Record<string, unknown> || {}),
        VRMC_materials_mtoon: {
          specVersion: '1.0',
          name,
          shadeColorFactor: [0, 0, 0],
          matcapFactor: [0, 0, 0, 0],
          parametricRimColorFactor: [0, 0, 0, 0],
          outlineWidthFactor: 0.02,
          shadingShiftFactor: 0,
          shadingToonyFactor: 0.9,
          giEqualizationFactor: 0.9,
          renderQueueOffsetNumber: 0,
          pbrMetallicRoughness: {
            baseColorFactor: baseColor,
            metallicFactor: (pbr?.metallicFactor as number) || 0,
            roughnessFactor: (pbr?.roughnessFactor as number) || 0.8,
          },
        },
      };
    }
  }

  // 重新编码 GLB
  const jsonStr = JSON.stringify(json);
  const jsonBuf = Buffer.from(jsonStr, 'utf-8');
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;

  let binOffset = 20 + jsonBuf.length + jsonPad;
  if (binOffset % 4 !== 0) binOffset += 4 - (binOffset % 4);
  const binLength = buf.readUInt32LE(binOffset);
  const binData = buf.subarray(binOffset + 8, binOffset + 8 + binLength);

  const totalLength = 12 + 8 + jsonBuf.length + jsonPad + 8 + binData.length + ((4 - (binData.length % 4)) % 4);

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546C67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const jsonChunk = Buffer.alloc(8 + jsonBuf.length + jsonPad);
  jsonChunk.writeUInt32LE(jsonBuf.length + jsonPad, 0);
  jsonChunk.writeUInt32LE(0x4E4F534A, 4);
  jsonBuf.copy(jsonChunk, 8);

  const binPad = (4 - (binData.length % 4)) % 4;
  const binChunk = Buffer.alloc(8 + binData.length + binPad);
  binChunk.writeUInt32LE(binData.length + binPad, 0);
  binChunk.writeUInt32LE(0x004E4942, 4);
  binData.copy(binChunk, 8);

  return Buffer.concat([header, jsonChunk, binChunk]);
}

function floatToHex(color: number[]): string {
  const r = Math.round((color[0] || 1) * 255);
  const g = Math.round((color[1] || 1) * 255);
  const b = Math.round((color[2] || 1) * 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
