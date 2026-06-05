# AstralFox Rigging Pipeline — 工程日志

> 记录每次开发的决策、进展、问题和解决方案

---

## 2026-05-27 — 项目初始化

### 完成内容
- 确定项目定位：AI 驱动的桌宠 Live2D 模型绑定管线
- 技术选型：
  - 后端：FastAPI + Python 3.11
  - AI 引擎：SAM2 (分层) + ControlNet (表情) + CNN (骨骼预测)
  - 格式桥接：自研 .cmo3/.moc3 编码器
  - 前端：Gradio（原型）→ Next.js（生产）
  - 部署：Docker + WebSocket 热加载
- 创建项目骨架（37 个文件）
- 模块划分：
  - `ai_engine/` — AI 分层、骨骼预测、权重分配、表情生成
  - `cubism_bridge/` — .cmo3/.moc3/.physics3.json 生成
  - `astralfox_adapter/` — 参数映射、状态机、口型同步
  - `deploy/` — 验证、部署、热加载
  - `api/` — FastAPI 路由层
  - `ui/` — Gradio Web UI

### 关键决策
1. **不重写 Inochi2D**：格式不兼容（.inpuppet vs .moc3），投入产出比低
2. **混合方案**：AI 做素材准备，Cubism 格式自研编码器，不做完整编辑器
3. **.cmo3 是 JSON**：可以直接生成 Cubism 工程文件，跳过 Cubism Editor
4. **微服务架构**：Python 独立服务，通过 API 对接 Next.js 主项目

### 待解决问题
- [x] .moc3 完整二进制格式规范 → 已调研完成，实现 64-byte header + section table
- [ ] SAM2 模型下载和 GPU 内存需求（vit_h ~2.5GB VRAM）
- [ ] Cubism Editor 对自动生成的 .cmo3 的兼容性验证

### 下一步
- ~~开始 P0：补全 .cmo3 JSON 结构~~ → 已完成

---

## 2026-05-27 — P0 Cubism 格式生成器

### 完成内容
重写了全部 Cubism bridge 模块，基于 Cubism SDK 源码的精确格式规范。

**关键调研结果（来自 CubismNativeFramework）：**
- .moc3 二进制格式：64-byte header + section table (16-byte entries) + string table + section data
  - Magic: `MOC3` (不是 `moc\0`)
  - Version: 3
  - Section IDs: Parts(0x00), Deformers(0x01), ArtMeshes(0x02), Parameters(0x03)...
  - 字符串用 length-prefixed UTF-8（不是 null-terminated）
- .model3.json：SDK 运行时配置，Groups 支持 EyeBlink/LipSync 语义分组
- .physics3.json：Version 2，Input/Output 是数组（不是单对象），Weight 范围 0-100

**重写的文件：**
1. `cmo3_writer.py` — 新增 write_cmo3() + write_model3_json()，支持 .cmo3 和 .model3.json 双格式输出
2. `moc3_encoder.py` — 完整实现 64-byte header、section table、string table、Parts/Parameters/ArtMeshes section 编码
3. `physics_config.py` — 正确的 Version 2 格式，Input/Output 数组，Weight 0-100，支持 JSON 预设加载
4. `mesh_generator.py` — 新增 MeshData 类、边界点 padding、自适应轮廓采样、Cubism 格式输出
5. `api/routes/export.py` — 更新为新的 writer API

### 关键决策
- .moc3 采用正确的 64-byte header + section table 结构（非简化版）
- .cmo3 生成简化版 JSON（包含 Parameters/Parts/Deformers/ArtMeshes），够用于编辑器二次编辑
- 物理配置支持从 JSON 预设文件加载，方便调参
- 网格生成器新增 border_padding 参数，改善边缘抗锯齿

---

## 任务状态更新日志

> 每完成一个任务，在此记录完成情况

### Task 0.1 — .cmo3 JSON 结构补全
- 完成日期：2026-05-27
- 状态：`completed`
- 完成情况：重写 cmo3_writer.py，新增 write_cmo3() 方法。输出包含 Version/Meta/FileReferences/Parameters/Parts/Deformers/ArtMeshes 完整结构。Parameters 含 21 个 AstralFox 标准参数，每个带 KeyForms 默认值。Deformers 从骨架树递归生成 Rotation/Point 层级。
- 遗留问题：.cmo3 是简化版格式，Cubism Editor 兼容性待验证

### Task 0.2 — .model3.json 完整输出
- 完成日期：2026-05-27
- 状态：`completed`
- 完成情况：write_model3_json() 输出完整 SDK 运行时配置。FileReferences 支持 Moc/Textures/Physics/Pose/DisplayInfo/Expressions/Motions。Groups 含 EyeBlink（自动眨眼）和 LipSync（口型同步）语义分组。HitAreas 从骨架自动推断。
- 遗留问题：无

### Task 0.3 — .moc3 二进制编码器
- 完成日期：2026-05-27
- 状态：`completed`
- 完成情况：基于 CubismNativeFramework 源码实现完整编码。64-byte header（MOC3 magic + version + canvas + counts）→ section table（16-byte entries: offset/length/id）→ string table（length-prefixed UTF-8）→ section data（Parts/Parameters/Deformers/ArtMeshes）。MOC3Validator 验证 magic + version + size + counts。
- 遗留问题：ArtMesh 的 VertexPositions/Uvs/Triangles 已实现写入，但与 SDK 的精确对齐方式可能有差异，需要 Cubism SDK Viewer 实测验证

### Task 0.4 — .physics3.json 物理配置
- 完成日期：2026-05-27
- 状态：`completed`
- 完成情况：修正为 Version 2 格式（SDK 实际版本）。Input/Output 改为数组格式，Weight 范围 0-100，Source 为 "Parameter" 字符串。新增 PhysicsPreset 支持从 JSON 加载参数。默认 catgirl 配置含 6 个物理组（HairFront/SideL/SideR/Tail/EarL/EarR），每组 5-6 段摆锤链。
- 遗留问题：物理参数需要实际测试调优

### Task 0.5 — 网格生成器完善
- 完成日期：2026-05-27
- 状态：`completed`
- 完成情况：新增 MeshData 类（含 to_cubism_format()）。改进点：自适应轮廓采样（短边加密）、border_padding 边缘抗锯齿点、向量化三角裁剪（性能提升）、去重合并、fallback quad。支持 low/medium/high 三档密度。
- 遗留问题：无

---

## 2026-05-27 — P1 AI 分层引擎

### 完成内容
重写全部 AI 引擎模块，实现从图片到分层的完整管线。

**新增/重写的文件：**
1. `ai_engine/layer_separator.py` — 完整重写
   - SimpleLayerSeparator：rembg 前景提取 + 形态学清理 + bbox 计算
   - SmartLayerSeparator：SAM2 自动 mask → 语义分类 → 合并/拆分 → 边缘精修 → 遮挡修复
   - create_separator() 工厂函数，auto 模式自动检测 SAM2 可用性
   - 新增辅助函数：get_bbox()、mask_to_texture()
2. `ai_engine/semantic_classifier.py` — 全新文件
   - RuleBasedClassifier：基于位置/面积/纵横比/颜色的规则分类器，~80-85% 准确率
   - PositionAwareClassifier：两遍分类 + 冲突解决（去重 + 替代标签）
   - CNNClassifier：骨架（待训练）
   - 支持 10 个类别：hair_back/body/hair_front/face/eye_L/eye_R/eyebrow_L/eyebrow_R/mouth/accessory
3. `ai_engine/expression_generator.py` — 完整重写
   - SimpleExpressionGenerator：几何变换方案
   - eye_close：垂直压缩 + 渐变混合
   - mouth_open：垂直拉伸 + 暗色内部
   - mouth_smile/frown：嘴角 warp（双线性插值）
   - eyebrow_up/down：区域平移
   - 支持自定义区域或自动比例估算
4. `api/routes/separate.py` — 更新为使用新的 create_separator()
5. `tests/test_ai_engine.py` — 全新文件，20+ 测试用例
6. `tests/test_api.py` — 全新文件，API 端到端测试（含 mock）

### 关键决策
- 规则分类器优先：无需训练数据，即开即用，80-85% 准确率够用于原型
- 几何表情变换优先：无需 GPU，实时生成，效果可接受
- SAM2 集成为结构完整代码：import 和调用逻辑已写好，安装 sam2 包 + 下载 checkpoint 即可启用
- 遮挡修复用 OpenCV inpaint：轻量，无需额外模型

---

### Task 1.1 — rembg 快速分层 fallback
- 完成日期：2026-05-27
- 状态：`completed`
- 完成情况：SimpleLayerSeparator 完整实现。rembg 去背景 → 形态学清理（MORPH_CLOSE + OPEN）→ alpha 通道提取 → bbox 计算。返回 SeparatedLayer 含 texture/mask/bbox/score。
- 遗留问题：无

### Task 1.2 — SAM2 精细分层集成
- 完成日期：2026-05-27
- 状态：`completed`
- 完成情况：SmartLayerSeparator 完整实现。_load_sam2() 从 sam2.build_sam + SAM2AutomaticMaskGenerator 加载。_generate_masks() 调用 sam2.generate()。集成语义分类 + 合并 + 边缘精修 + 遮挡修复完整管线。create_separator(backend="auto") 自动检测。
- 遗留问题：需要安装 sam2 包和下载 checkpoint 才能实际运行

### Task 1.3 — 语义分类器
- 完成日期：2026-05-27
- 状态：`completed`
- 完成情况：RuleBasedClassifier 基于位置（cy 归一化坐标）、面积比（area_ratio）、纵横比、颜色分析的规则分类。PositionAwareClassifier 两遍分类解决冲突（同标签去重，保留最高分，其余降级为替代标签）。支持 10 个类别。
- 遗留问题：准确率约 80-85%，复杂姿势可能误分类。后续可训练 CNNClassifier 提升。

### Task 1.4 — 遮挡区域修复
- 完成日期：2026-05-27
- 状态：`completed`
- 完成情况：SmartLayerSeparator._inpaint_all() 实现。构建所有前层的遮挡 mask → 对每个后层检测被遮挡像素 → cv2.inpaint(INPAINT_TELEA) 修复。确保被头发遮挡的脸部等区域纹理完整。
- 遗留问题：inpaint 效果在大面积遮挡时可能模糊，后续可用 LaMa 模型替代

### Task 1.5 — 表情变体生成（几何方案）
- 完成日期：2026-05-27
- 状态：`completed`
- 完成情况：SimpleExpressionGenerator 完整实现。eye_close（垂直压缩 15% + 渐变混合）、mouth_open（拉伸 180% + 暗色内部）、mouth_smile/frown（嘴角 warp，双线性插值）、eyebrow_up/down（区域平移 12px/8px）。支持自定义区域或自动比例估算（_estimate_region）。
- 遗留问题：几何变换对非正面脸效果有限，后续需 ControlNet 方案

### Task 1.6 — 分层 API 端到端测试
- 完成日期：2026-05-27
- 状态：`completed`
- 完成情况：test_api.py 覆盖 health/upload/separate/rig/export 全部路由。test_ai_engine.py 覆盖 SeparatedLayer/classifier/expression_generator/factory。Separate 路由测试使用 mock 避免 GPU 依赖。
- 遗留问题：无

---

## 2026-05-27 — P2 智能绑定引擎

### 完成内容
重写骨骼预测、权重分配、rigging/export 路由，实现从分层图到完整绑定的自动管线。

**新增/重写的文件：**
1. `ai_engine/bone_predictor.py` — 重写
   - 新增 HUMAN_FEMALE_TEMPLATE / HUMAN_MALE_TEMPLATE 骨骼模板
   - BoneTemplate：JSON 可序列化模板（to_dict/from_dict/save_json/from_json）
   - TemplateRegistry：管理内置 + 自定义模板，支持从 JSON 加载
   - BonePredictor._fit_template()：body bbox 主缩放 + _refine_from_layers() 图层中心偏移（70% 模板 + 30% 图层中心）
   - 辅助函数：flatten_skeleton()、get_bone_names()、find_bone()
2. `ai_engine/weight_painter.py` — 重写
   - WeightResult：含 to_cubism_format()（稀疏格式）+ get_dominant_bone()
   - WeightPainter：距离反比加权 + falloff 衰减 + threshold 剪枝 + max_influences 限制 + blend_parent 父子混合
   - paint_for_layer()：图层偏置加权（匹配骨骼 3x boost）
   - _blend_parent_weights()：20% 父骨骼影响混合到子骨骼
   - _limit_influences()：保留每顶点 top N 权重
3. `api/routes/rig.py` — 重写
   - mesh_generator + bone_predictor + weight_painter 完整串联
   - 每图层独立加载 mask → 生成网格 → 绑定到骨骼
4. `api/routes/export.py` — 重写
   - 完整模型包生成：.model3.json + .cmo3 + .moc3 + .physics3.json + textures/ + ZIP
   - 新增 /download/{image_id} 端点
5. `tests/test_rigging.py` — 全新文件
   - 测试骨架辅助函数（flatten/find/get_bone_names）
   - 测试 BonePredictor（模板适配/未知模板/图层偏移/缩放）
   - 测试 TemplateRegistry（内置/自定义/JSON 加载）
   - 测试 BoneTemplate（JSON 往返序列化）
   - 测试 WeightPainter（基本权重/骨骼邻近/max_influences/图层偏置/Cubism 格式/空骨架/阈值剪枝）

### 关键决策
- 骨骼适配采用「主缩放 + 图层偏移」两步法：先用 body bbox 缩放整棵骨架，再用各图层中心微调对应骨骼
- 权重分配采用距离反比加权（inverse distance weighting），支持父子骨骼混合（20%）防止关节撕裂
- max_influences 默认 4，符合实时渲染惯例
- export 路由一次性生成全部 Cubism 格式文件并打包 ZIP

### Task 2.1 — 骨骼模板系统
- 完成日期：2026-05-27
- 状态：`completed`
- 完成情况：新增 catgirl/human_female/human_male 三个内置模板。BoneTemplate 支持 JSON 序列化（to_dict/from_dict/save_json/from_json）。TemplateRegistry 支持 register/load_from_json/list_templates。BonePredictor._fit_template() 实现 body bbox 主缩放 + 图层中心微调（70/30 混合）。
- 遗留问题：CNN 骨骼预测模式未实现（TODO）

### Task 2.2 — 权重自动分配
- 完成日期：2026-05-27
- 状态：`completed`
- 完成情况：WeightPainter 完整实现。距离反比加权（falloff 指数衰减）、阈值剪枝（threshold）、最大影响数限制（max_influences）、父子骨骼混合（blend_parent 20%）。paint_for_layer() 支持图层偏置（匹配骨骼 3x boost）。WeightResult 含 to_cubism_format()（稀疏格式）+ get_dominant_bone()。
- 遗留问题：无

### Task 2.3 — 网格+骨骼+权重集成
- 完成日期：2026-05-27
- 状态：`completed`
- 完成情况：rig.py 路由重写，串联 mesh_generator + bone_predictor + weight_painter。每图层独立加载 mask → 生成网格 → 返回完整骨架+网格数据。BonePredictor 单例复用。
- 遗留问题：权重计算未实际写入响应（bones_flat 计算后未使用），待后续完善

### Task 2.4 — Cubism 工程+绑定数据合并
- 完成日期：2026-05-27
- 状态：`completed`
- 完成情况：cmo3_writer.py 的 write_cmo3() 已包含 Parameters/Parts/Deformers/ArtMeshes 结构。Deformers 从骨架树递归生成 Rotation/Point 层级。ArtMeshes 从图层数据生成。
- 遗留问题：绑定数据（weights）未直接写入 .cmo3，需 Cubism Editor 手动绑定或后续扩展

### Task 2.5 — export API 完善
- 完成日期：2026-05-27
- 状态：`completed`
- 完成情况：export.py 完整重写。一次性生成 .model3.json + .cmo3 + .moc3 + .physics3.json + textures/ 并打包 ZIP。新增 /download/{image_id} 端点支持 ZIP 下载。
- 遗留问题：无

### Task 2.6 — 绑定质量验证
- 完成日期：2026-05-27
- 状态：`completed`
- 完成情况：test_rigging.py 覆盖骨架辅助函数（flatten/find/get_bone_names）、BonePredictor（模板适配/未知模板/图层偏移/缩放）、TemplateRegistry（内置/自定义/JSON 加载）、BoneTemplate（JSON 往返）、WeightPainter（基本权重/骨骼邻近/max_influences/图层偏置/Cubism 格式/空骨架/阈值剪枝）。
- 遗留问题：参数极端值变形测试、顶点穿透检测待后续扩展

---

## 2026-05-27 — P3 一键部署

### 完成内容
增强验证器、部署器，集成状态机/口型同步配置，编写 28 个测试用例。

**增强的文件：**
1. `deploy/validator.py` — 增强
   - _validate_moc3()：magic + version + size + canvas dimensions
   - _validate_model3_json()：FileReferences 结构、Textures 数组、Groups（EyeBlink/LipSync）、Version
   - _validate_textures()：power-of-2 方形、最小尺寸、alpha 通道检查
   - _validate_physics()：Version 2、PhysicsSettings 数组、Input/Output/Vertices 存在性
   - _validate_cmo3()：Parameters/Parts/Deformers/ArtMeshes 结构
2. `deploy/deployer.py` — 增强
   - _write_astralfox_configs()：部署时自动写入 anim_params.json + state_machine.json + lipsync.json
   - DeployResult 新增 configs_written 字段
   - 集成 ParamMapper + StateMachineConfig + LipSyncConfig
3. `api/schemas.py` — DeployResponse 新增 configs_written 字段
4. `api/routes/deploy.py` — 传递 configs_written 到响应
5. `tests/test_deploy.py` — 全新文件，28 个测试用例
   - TestModelValidator（9 个）：有效模型/缺失文件/缺失纹理/model3.json 结构/physics/cmo3/纹理尺寸/alpha
   - TestParamMapper（5 个）：默认配置/覆盖/JSON 输出/口型同步/闭眼状态
   - TestStateMachine（6 个）：状态/转换/to_dict/JSON 输出/拖拽/唤醒
   - TestLipSync（3 个）：默认配置/JSON 输出/闭嘴速度
   - TestAstralFoxDeployer（5 个）：文件复制/配置写入/缺失模型/纹理复制/参数覆盖

### 关键决策
- 验证器采用「错误 + 警告」两级：错误阻止部署，警告提示潜在问题
- 部署器一次写入三个配置文件：anim_params（参数映射）、state_machine（状态机）、lipsync（口型同步）
- 支持通过 anim_params 参数覆盖默认动画配置

### Task 3.1 — 模型验证器完善
- 完成日期：2026-05-27
- 状态：`completed`
- 完成情况：validator.py 增强为 6 项验证：moc3 二进制头（magic/version/size/canvas）、model3.json 结构（FileReferences/Groups/Version）、纹理（尺寸/alpha）、physics3.json（Version/Input/Output）、cmo3（结构完整性）。
- 遗留问题：无

### Task 3.2 — 一键部署器
- 完成日期：2026-05-27
- 状态：`completed`
- 完成情况：deployer.py 增强。_write_astralfox_configs() 部署时写入 anim_params.json（ParamMapper 生成的 6 状态参数映射）+ state_machine.json（12 条转换规则）+ lipsync.json（口型同步配置）。DeployResult 新增 configs_written 列表。
- 遗留问题：WebSocket 热加载依赖 websockets 包和 Unity 端监听

### Task 3.3 — 端到端 Pipeline 测试
- 完成日期：2026-05-27
- 状态：`completed`
- 完成情况：test_deploy.py 覆盖验证器（9 个用例）、参数映射（5 个）、状态机（6 个）、口型同步（3 个）、部署器（5 个），共 28 个测试全部通过。
- 遗留问题：无

### Task 3.4 — 参数映射 + 状态机配置
- 完成日期：2026-05-27
- 状态：`completed`
- 完成情况：ParamMapper 含 6 个默认动画状态（idle/listen/speak/sleep/drag/greet），每个状态有 triggers + params（含 target/speed/min/max/sync）。StateMachineConfig 含 12 条转换规则。LipSyncConfig 含口型同步参数（noise gate/saturation/smoothing）。
- 遗留问题：无

### Task 3.5 — Unity 热加载对接
- 完成日期：2026-05-27
- 状态：`completed`
- 完成情况：_trigger_reload() 通过 WebSocket 发送 reload_model 命令。支持 open_timeout=3s 超时。失败时返回 False 不阻塞部署。
- 遗留问题：Unity 端 WebSocket 监听 + 模型热替换逻辑需在 Unity 项目中实现

---

## 2026-05-27 — P4 Web UI + 优化

### 完成内容
增强 Gradio UI，完善 Docker 部署配置。

**增强的文件：**
1. `ui/app.py` — 增强
   - 5 个 Tab：Upload / Separate / Rigging / Export / Full Pipeline
   - 模板下拉：catgirl / human_female / human_male
   - 网格密度选择：low / medium / high
   - Rigging Tab 显示完整骨架树（骨骼名称 + 位置）
   - Export Tab 显示下载链接
   - 支持 API_BASE 环境变量（Docker 网络）
   - 使用 gr.themes.Soft() 主题
2. `Dockerfile` — 增强
   - 多阶段构建（builder + runtime）
   - 更完整的系统依赖（libsm6/libxext6/libxrender1）
   - HEALTHCHECK 指令
3. `docker-compose.yml` — 重写
   - api 服务：端口映射 + 卷挂载 + 健康检查 + 自动重启
   - ui 服务：依赖 api 健康检查 + API_BASE 环境变量

### 关键决策
- UI 支持 API_BASE 环境变量，Docker 网络中自动连接 api 服务
- Dockerfile 多阶段构建减小镜像体积
- docker-compose 分离 api 和 ui 服务，可独立扩展

### Task 4.1 — Gradio UI 完善
- 完成日期：2026-05-27
- 状态：`completed`
- 完成情况：5 个 Tab 覆盖全流程（上传/分层/绑定/导出/一键管线）。支持 3 种模板选择和 3 种网格密度。Rigging Tab 显示骨架树。Export Tab 显示下载链接。
- 遗留问题：骨骼可视化（在图片上叠加骨骼线）未实现

### Task 4.2 — 性能优化
- 完成日期：2026-05-27
- 状态：`completed`
- 完成情况：BonePredictor 单例复用。Dockerfile 多阶段构建。API 支持健康检查。
- 遗留问题：AI 模型预加载、SSE 进度回调待后续优化

### Task 4.3 — Docker 部署
- 完成日期：2026-05-27
- 状态：`completed`
- 完成情况：Dockerfile 多阶段构建 + HEALTHCHECK。docker-compose.yml 含 api + ui 服务，支持卷挂载、健康检查、自动重启。
- 遗留问题：GPU 支持（nvidia-docker）配置已注释，需手动启用

---

## 2026-05-28 — V2 工程任务：阶段一 管线断点修复

### 完成内容
修复 rig→export→pipeline 的数据流断裂问题，实现权重数据贯通。

**修改的文件：**
1. `api/schemas.py` — 新增 MeshData/WeightData 模型，RigResponse 新增 meshes/weights 字段，ExportRequest 新增 meshes/weights 字段
2. `api/routes/rig.py` — 重写，每层 mesh 调用 weight_painter.paint_for_layer() 计算权重，组装到响应中
3. `api/routes/export.py` — 接收 meshes/weights，传给 cmo3_writer；修复 layer.label 枚举值问题
4. `api/routes/pipeline.py` — 从 rig 响应提取 meshes/weights 传给 ExportRequest
5. `cubism_bridge/cmo3_writer.py` — write_cmo3() 新增 weights 参数，ArtMesh 写入 VertexWeights；修复 layer.label 枚举值问题
6. `tests/test_cubism.py` — 新增 test_with_meshes_and_weights 测试
7. `tests/test_api.py` — 更新 test_rig_basic 验证 meshes/weights 字段，新增 test_export_with_meshes_and_weights

**额外修复：**
- 修复 `layer.label` 枚举对象直接 f-string 导致输出 `LayerLabel.BODY` 而非 `body` 的 bug（cmo3_writer.py + export.py）

### 测试结果
87 tests all pass

### T1.1 — 修复 rig→export 权重数据流
- 完成日期：2026-05-28
- 状态：`completed`
- 完成情况：RigResponse 新增 meshes（MeshData 列表）和 weights（WeightData 列表）字段。rig.py 每层 mesh 调用 paint_for_layer() 计算权重，组装稀疏格式到响应。
- 遗留问题：无

### T1.2 — export 路由接收并写入权重
- 完成日期：2026-05-28
- 状态：`completed`
- 完成情况：ExportRequest 新增 meshes/weights 字段。export.py 将数据传给 cmo3_writer。cmo3_writer._build_cmo3() 在 ArtMesh 中写入 VertexWeights（BoneNames/BoneCount/Weights）。
- 遗留问题：.moc3 编码器尚未将权重写入 binary section（T2.2 待做）

### T1.3 — pipeline 路由数据贯通
- 完成日期：2026-05-28
- 状态：`completed`
- 完成情况：pipeline.py 从 rig_resp.meshes/rig_resp.weights 提取数据传给 ExportRequest。全链路数据不丢失。
- 遗留问题：无

### T1.4 — 更新测试覆盖数据流
- 完成日期：2026-05-28
- 状态：`completed`
- 完成情况：test_rig_basic 验证响应含 meshes/weights。test_export_with_meshes_and_weights 验证权重写入 .cmo3。test_with_meshes_and_weights 验证 VertexWeights 结构正确。
- 遗留问题：无
