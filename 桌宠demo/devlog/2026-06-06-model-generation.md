# DevLog: AI 模型生成 + 参数映射对齐 — 2026-06-06

## 概述

成功运行 AstralFox Rigging Pipeline，从图片到 Live2D 模型全自动生成。
同时修复了 ContextAwareness.cs 的 TickCount 溢出 bug（improvement-plan 遗漏项），
并重写 FoxParamId.cs 对齐生成模型的标准参数名。

## 环境

- **Rigging**: FastAPI + MobileSAM + BonePredictor + Cubism Bridge
- **AI checkpoints**: u2net.onnx (176MB) + mobile_sam.pt (40.7MB)
- **torch**: 2.12.0 CPU-only (无 CUDA)
- **ComfyUI**: 未安装，跳过 img2img 姿态标准化步骤
- **Pipeline 耗时**: 41.5s (CPU)

## Pipeline 输出

```
output/03215aa77553/
├── layers/
│   ├── body.png + body_mask.png
│   ├── face.png + face_mask.png
│   ├── hair_front.png + hair_front_mask.png
│   └── eyebrow_R.png + eyebrow_R_mask.png
└── cubism/
    ├── model.moc3           # 运行时模型
    ├── model.model3.json    # SDK 配置 (含 AstralFox Group 20 参数)
    ├── model.physics3.json  # 物理参数
    ├── model.cmo3           # Editor 工程文件
    └── model.zip            # 完整打包
```

## 参数映射对齐

### 问题
FoxParamId.cs 原本为 CatTail 模型设计，参数名与 AI 生成模型不一致：
- 耳朵: `ParamHairFront/Back` → 生成模型用 `ParamEarL/R`
- 尾巴: `Param2/3` → 生成模型用 `ParamTail`
- 手臂: 复用 `ParamAngleX/Y` → 生成模型无专用手臂参数（继续 fallback）

### 修复
重写 FoxParamId.cs，所有参数名对齐生成模型的标准命名约定。
新增 `AstralFoxParams` 数组列出所有 AI 模型支持的参数。

### 模型注册
PetModelRegistry 新增:
- `generated` — 星尘 (AI生成)，首位默认
- `senko` — Senko 仙狐 (占位)，标记为开发用
- `cattail` — CatTail 猫尾 (旧版)，保留向后兼容

## Bug 修复

### ContextAwareness.cs TickCount 溢出 (P0)
**文件**: `Assets/Scripts/Runtime/Behavior/ContextAwareness.cs:153`
**问题**: `(Environment.TickCount - (int)lii.dwTime)` 在系统运行 24.9 天后溢出
**修复**: 改用 uint 无符号减法:
```csharp
uint tickNow = (uint)Environment.TickCount;
_idleSeconds = (tickNow - lii.dwTime) / 1000f;
```
**注**: TimeAwareness.cs 已在 improvement-plan 中修复，但 ContextAwareness.cs 被遗漏。

## 下一步

- [ ] 准备真实角色立绘作为输入 → 替换测试几何图形
- [ ] Unity Editor Play Mode 验证新模型渲染 + 动画联动
- [ ] 如 ComfyUI 可用，加入 img2img 姿态标准化步骤
