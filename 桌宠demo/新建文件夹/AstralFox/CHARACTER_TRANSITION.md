# 角色设定更新文档 — 星尘狐 → 星尘 (二次元少女)

## 概述

项目内部代号 "AstralFox" (星尘狐) 保持不变，但用户可见的角色身份已从
**狐狸** 全面更新为 **二次元少女「星尘」(昵称: 小星)**。

---

## 1. 角色设定

### 新形象
| 属性 | 旧 (狐狸) | 新 (少女) |
|------|----------|----------|
| 名称 | 星尘狐 | **星尘** (昵称: 小星) |
| 物种 | 幻想狐 | **二次元 AI 少女** |
| 发型 | 狐耳 | **银白长发，发梢渐变星蓝色** |
| 眼睛 | 普通 | **星辰纹理** |
| 服装 | 未定义 | **未来感休闲服** |
| 饰品 | 无 | **以太水晶吊坠 (情绪变色)** |
| 特效 | 尾巴星光粒子 | **周身漂浮微光粒子** |

### 新性格
温柔体贴，带着些许俏皮，像邻家少女一般亲切。说话带有二次元风格，
喜欢用「～」「！」语气词。对主人十分依赖，偶尔会露出害羞的一面，
偶尔也会小傲娇。

### 新背景故事
来自数字星系的少女「星尘」，拥有一头银白长发，发梢渐变为星蓝色，
仿佛流淌着星光。她的眼睛中有星辰般的纹理，胸前佩戴的以太水晶吊坠
会随情绪变换颜色。因为一次意外的次元穿越，她来到了人类的电脑桌面上，
从此成为了用户的 AI 桌面伙伴。她对人类世界充满好奇，喜欢探索各种
新鲜的知识。

---

## 2. 已变更文件清单

### Unity C# 核心文件

| 文件 | 变更内容 |
|------|---------|
| `AppConfig.cs` | `character_name` 默认值: "星尘狐" → "星尘"；重写 `character_personality` 和 `character_backstory` |
| `DataStore.cs` | `foxPersonality` → `characterPersonality`；`GetFoxPersonality()` → `GetCharacterPersonality()`；`SetFoxPersonality()` → `SetCharacterPersonality()`；`foxFacingDir` → `petFacingDir`；`foxTargetX/Y` → `petTargetX/Y`；`SaveFoxMovementState()` → `SavePetMovementState()`；聊天摘要: "星尘狐:" → "星尘:" |
| `AppLifecycle.cs` | 变量重命名: `foxInteraction` → `petInteraction`；`foxPlaceholder` → `petPlaceholder`；`onToggleFox` → `onTogglePet`；调用 `SetCharacterPersonality()`；注释: "Hide fox" → "Hide pet" |
| `FoxSimpleMovement.cs` | 注释: "狐狸" → "角色"；"尾巴" → "头发/尾巴"；`ws.foxFacingDir` → `ws.petFacingDir`；`SaveFoxMovementState` → `SavePetMovementState`；新增类名说明注释 |
| `PetAnimationManager.cs` | 注释: "FoxPlaceholder" → "PetPlaceholder"；`FindAnimatorInChildren` 变量重命名 |
| `DragonBonesAnimator.cs` | 注释: "FoxPlaceholder" → "PetPlaceholder"；耳朵/尾巴注释更新为模型自适应 (头发/发饰); IdleMotion 区域重命名 |
| `DragonBonesBoneMap.cs` | 重写文档注释 (少女模型骨骼结构)；新增 `HairBack/Front/SideL/SideR`、`HairRibbonL/R`、`Pendant`、`OutfitTop/Bottom` 常量；Ear/Tail 标记为模型自适应；`AnimatedBones` 更新 |
| `GlobalHotkeyManager.cs` | `ToggleFox` → `TogglePet`；`_onToggleFoxHotkey` → `_onTogglePetHotkey`；参数 `onToggleFox` → `onTogglePet`；日志: "toggle fox" → "toggle pet" |
| `VoiceManager.cs` | `GetFoxPersonality()` → `GetCharacterPersonality()`；`SetFoxPersonality()` → `SetCharacterPersonality()` |
| `WakeWordDetector.cs` | 唤醒词: "星尘狐" → "星尘" |
| `MockVoicePipeline.cs` | 模拟回复: "星尘狐" → "星尘"；"尾巴短" → "头发乱" |
| `TrayIconManager.cs` | 托盘提示: "星尘狐 AstralFox" → "星尘 AstralFox" |
| `CommandLineArgs.cs` | 帮助文本: "星尘狐" → "星尘" |
| `PetApiClient.cs` | 默认角色名称: "星尘狐" → "星尘" |

### Unity Editor 文件

| 文件 | 变更内容 |
|------|---------|
| `AstralFoxSettingsWindow.cs` | 窗口标题: "星尘狐 · 系统设置" → "星尘 · 系统设置" |

### HTML 设置页面

| 文件 | 变更内容 |
|------|---------|
| `settings.html` | 标题/占位符/默认值: "星尘狐" → "星尘"; 副标题更新 |
| `preview_config.html` | 同上 |
| `SettingsWebServer.cs` (内嵌HTML) | 同上；`SetFoxPersonality()` → `SetCharacterPersonality()` |

### 模型文档

| 文件 | 变更内容 |
|------|---------|
| `DRAGONBONES_SETUP.md` | 模型文件名: `fox_*` → `girl_*`；骨骼关键词: 耳朵/尾巴 → 头发/发饰/裙摆 |
| `Models/fox/README.txt` | 重写为少女模型说明，添加角色形象描述 |
| `DragonBones/Models/Fox/MODEL_README.txt` | 重写为少女模型说明；目录名 "Fox" 注记为内部代号 |

### 批处理/脚本

| 文件 | 变更内容 |
|------|---------|
| `Start-AstralFox.bat` | 标题: "星尘狐" → "星尘"；"Show/hide fox" → "Show/hide pet" |
| `Build-Standalone.bat` | 标题: "星尘狐" → "星尘" |

### Python 后端

| 文件 | 变更内容 |
|------|---------|
| `backend/llm.py` | `SYSTEM_PROMPT` 完全重写 (狐狸 → 少女)；新增形象设定段落；默认名称: "星尘狐" → "星尘"；模拟回复: "小狐狸" → "AI 少女" |
| `backend/main.py` | 默认角色名: "星尘狐" → "星尘"；模拟回复更新 |
| `backend/.env.example` | 注释: "星尘狐" → "星尘" |

### Next.js Web 管理端

| 文件 | 变更内容 |
|------|---------|
| `api/pet/config/route.ts` | 默认角色名: "星尘狐" → "星尘" (2 处) |
| `RegisterForm.tsx` | alt 文本: "星尘狐" → "星尘" |
| `LoginForm.tsx` | alt 文本: "星尘狐" → "星尘" |
| `Sidebar.tsx` | alt 文本 + 品牌名: "星尘狐 Avatar" → "星尘 Avatar" |
| `seed.ts` | 种子数据: "星尘狐·默认" → "星尘·默认"；"Q版小狐" → "Q版小星"；"小狐仙" → "小星仙" |
| `blendshapes.ts` | 类别: "耳朵" → "发饰"；显示名: "耳朵大小/角度" → "发饰大小/角度" |
| `parts.ts` | "猫耳" → "星星发饰" |

---

## 3. 保持不变的内容

### 内部代号 (不修改)
- 项目名称: **AstralFox** (星尘狐) — 目录名、命名空间、文件前缀
- 类名: `FoxSimpleMovement`, `FoxInteraction`, `FoxEmotionController` — 维持不变
- GameObject 名称: `FoxPlaceholder` — 场景中的根节点名不变
- 目录路径: `Models/fox/` — 内部模型目录不变
- Git 仓库名: AstralFox

### API 参数键 (向后兼容)
- `TailWag`, `TailSwing`, `EarL`, `EarR` — 作为 API 参数键保持不变
  (映射关系在 `DragonBonesBoneMap.cs` 中通过注释说明)

### 开发日志
- `devlog/` 中记录的历史信息不修改 (记录的是当时的状态)

---

## 4. 适配新模型骨骼

当导入实际的少女 DragonBones 模型后，更新 `DragonBonesBoneMap.cs` 中的
骨骼名称常量即可。已预定义好少女模型的骨骼结构:

```
root → body → head → (eyes, eyebrows, mouth)
root → body → hair_back, hair_front, hair_side_l, hair_side_r
root → body → arm_l, arm_r, leg_l, leg_r
accessories → ribbon_l, ribbon_r, pendant
```

旧狐狸骨骼别名 (EarL, EarR, Tail1-3) 保留在代码中，向后兼容。
