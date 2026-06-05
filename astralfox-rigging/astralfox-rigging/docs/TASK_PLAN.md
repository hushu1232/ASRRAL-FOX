# AstralFox Rigging Pipeline — 任务计划

> 项目目标：一张立绘 → AI 分层 → 自动绑定 → .moc3 导出 → 一键部署到桌宠
> 预估总周期：8 周（P0-P3 核心管线）

---

## P0：Cubism 工程生成器（第 1-2 周）

> 打通格式，实现从骨架数据到 .cmo3/.moc3 的完整输出

### Task 0.1 — .cmo3 JSON 结构补全
- [x] 状态：`completed` ✅ 2026-05-27
- 优先级：`P0-critical`
- 负责模块：`cubism_bridge/cmo3_writer.py`
- 目标：生成的 .cmo3 能被 Cubism Editor 4.x 正确打开
- 具体工作：
  - [x] 补全 Groups 层级结构（Deformer → ArtMesh 树）
  - [x] 补全 Parts 与纹理路径绑定
  - [x] 补全 Parameters 的 KeyForms（默认姿态）
  - [x] 写入 Meshes 数据（顶点 + UV + 三角面）
- 验收标准：Cubism Editor 打开 .cmo3 无报错，能看到图层和网格

### Task 0.2 — .model3.json 完整输出
- [x] 状态：`completed` ✅ 2026-05-27
- 优先级：`P0-critical`
- 负责模块：`cubism_bridge/cmo3_writer.py`
- 目标：输出 Cubism SDK 可直接加载的运行时配置
- 具体工作：
  - [x] FileReferences 正确指向 .moc3 + textures/ + physics
  - [x] Groups 定义 AstralFox 专用参数组
  - [x] HitAreas 定义头部/身体点击区域
  - [ ] 生成 DisplayInfo（参数中文名称映射）— 待补充
- 验收标准：Cubism SDK Viewer 能加载并显示模型

### Task 0.3 — .moc3 二进制编码器
- [x] 状态：`completed` ✅ 2026-05-27
- 优先级：`P0-critical`
- 负责模块：`cubism_bridge/moc3_encoder.py`
- 目标：生成合法的 .moc3 二进制文件
- 具体工作：
  - [x] 实现完整 Header 写入（64-byte: MOC3 magic + version + canvas + counts）
  - [x] 实现 Section Table（16-byte entries: offset/length/id）
  - [x] 实现 String Table（length-prefixed UTF-8）
  - [x] 实现 Parts section 编码
  - [x] 实现 Parameters section 编码
  - [x] 实现 ArtMeshes section 编码（vertices + uvs + indices）
- 验收标准：Cubism SDK `LoadMoc()` 不崩溃，能渲染基本图形

### Task 0.4 — .physics3.json 物理配置
- [x] 状态：`completed` ✅ 2026-05-27
- 优先级：`P0-high`
- 负责模块：`cubism_bridge/physics_config.py`
- 目标：为头发/尾巴/耳朵生成物理模拟参数
- 具体工作：
  - [x] 实现完整的 PhysicsSetting 结构（输入/输出/顶点/归一化）
  - [x] 创建 catgirl 专用物理预设（头发、尾巴、猫耳）
  - [x] 支持从 JSON 预设文件加载参数
  - [x] 生成 Gravity + Wind 环境力配置
- 验收标准：Cubism Viewer 加载后头发/尾巴有物理摆动

### Task 0.5 — 模板驱动网格生成
- [x] 状态：`completed` ✅ 2026-05-27
- 优先级：`P0-high`
- 负责模块：`cubism_bridge/mesh_generator.py`
- 目标：从图层 mask 自动生成三角网格
- 具体工作：
  - [x] 完善 Delaunay 三角剖分（边界点加密 + 内部点采样）
  - [x] 实现网格密度控制（low/medium/high 对应不同采样间距）
  - [x] 实现 mask 外三角裁剪（向量化）
  - [x] 生成 UV 坐标映射
  - [x] 输出 Cubism 兼容的顶点/三角面格式
- 验收标准：生成的网格能正确贴合图层纹理

### Task 0.6 — 单元测试补全
- [x] 状态：`completed` ✅ 2026-05-27
- 优先级：`P0-medium`
- 负责模块：`tests/test_cubism.py`
- 目标：覆盖 Cubism bridge 所有模块
- 具体工作：
  - [x] .model3.json 写入 + 结构验证（Groups/HitAreas/Expressions/Motions）
  - [x] .cmo3 写入 + 结构验证（Parameters/Parts/Deformers/ArtMeshes）
  - [x] .moc3 编码 → magic number + header + validator 通过
  - [x] .physics3.json → Version 2 格式 + Input/Output 数组 + 预设加载
  - [x] mesh_generator → 顶点数/UV 范围/密度对比/空 mask fallback
- 验收标准：`pytest tests/test_cubism.py` 全部通过

---

## P1：AI 分层引擎（第 3-4 周）

> 从一张立绘自动拆出 Live2D 可用的分层素材

### Task 1.1 — rembg 快速分层 fallback
- [x] 状态：`completed` ✅ 2026-05-27
- 优先级：`P1-critical`
- 负责模块：`ai_engine/layer_separator.py`
- 目标：无需 GPU 即可运行的基本分层
- 具体工作：
  - [x] 完善 `SimpleLayerSeparator` 实现
  - [x] 从单张图提取前景（去背景）
  - [x] 返回 body 层 + alpha mask + bbox
  - [x] 作为 SAM2 不可用时的 fallback
- 验收标准：上传 PNG → 得到去背景的 body 层

### Task 1.2 — SAM2 集成（核心分层）
- [x] 状态：`completed` ✅ 2026-05-27
- 优先级：`P1-critical`
- 负责模块：`ai_engine/layer_separator.py`
- 目标：用 SAM2 实现精细分层
- 具体工作：
  - [x] 集成 `sam2` 库（`pip install sam2`）
  - [x] 实现自动 mask 生成（automatic mask generator）
  - [x] 实现语义分类器：对每个 mask 分配标签（hair/face/eye...）
  - [x] 实现 mask 合并/拆分逻辑
  - [x] 实现边缘精修（形态学 + 高斯模糊）
- 验收标准：上传立绘 → 输出 8-10 个正确分层

### Task 1.3 — 语义分类器训练/集成
- [x] 状态：`completed` ✅ 2026-05-27
- 优先级：`P1-high`
- 负责模块：`ai_engine/semantic_classifier.py`
- 目标：自动识别每个 mask 属于哪个部件
- 具体工作：
  - [x] 方案A：基于位置+面积的规则分类器（快速实现）
  - [ ] 方案B：训练轻量 CNN 分类器（长期方案）— 待后续
  - [x] 支持 10 个类别：hair_back/body/hair_front/face/eye_L/eye_R/eyebrow_L/eyebrow_R/mouth/accessory
  - [x] 处理左右对称部件的区分（PositionAwareClassifier 冲突解决）
- 验收标准：分类准确率 > 85%（规则方案）/ > 95%（CNN 方案）

### Task 1.4 — 遮挡区域修复（Inpainting）
- [x] 状态：`completed` ✅ 2026-05-27
- 优先级：`P1-medium`
- 负责模块：`ai_engine/layer_separator.py`
- 目标：被遮挡的图层需要补全可见区域外的内容
- 具体工作：
  - [x] 检测被遮挡像素（前层 mask 覆盖后层的区域）
  - [x] 用 inpainting 补全被遮挡部分（例如被头发遮挡的脸部）
  - [x] 使用 OpenCV inpaint (INPAINT_TELEA)
- 验收标准：分层后图层边缘无明显残缺

### Task 1.5 — 表情变体生成（几何方案）
- [x] 状态：`completed` ✅ 2026-05-27
- 优先级：`P1-medium`
- 负责模块：`ai_engine/expression_generator.py`
- 目标：从正面表情生成眨眼/张嘴/皱眉等变形目标
- 具体工作：
  - [x] 完善 `SimpleExpressionGenerator` 的几何变换
  - [x] 实现 eye_close（垂直压缩 + 渐变混合）
  - [x] 实现 mouth_open（拉伸 + 暗色内部）
  - [x] 实现 eyebrow_up/down（区域平移）
  - [x] 实现 mouth_smile/frown（嘴角 warp，双线性插值）
- 验收标准：生成 6+ 个表情变体，视觉效果合理

### Task 1.6 — 分层 API 端到端测试
- [x] 状态：`completed` ✅ 2026-05-27
- 优先级：`P1-medium`
- 负责模块：`api/routes/separate.py` + `tests/`
- 目标：API 端到端可调用
- 具体工作：
  - [x] test_api.py：health/upload/separate/rig/export 全路由覆盖
  - [x] test_ai_engine.py：SeparatedLayer/classifier/expression/factory 测试
  - [x] 测试使用 mock 避免 GPU 依赖
  - [x] 编写自动化测试用例（20+ 用例）
- 验收标准：API 调用不报错，返回正确分层结果

---

## P2：智能绑定引擎（第 5-6 周）

> 从分层图自动生成骨骼 + 网格 + 权重

### Task 2.1 — 骨骼模板系统
- [x] 状态：`completed` ✅ 2026-05-27
- 优先级：`P2-critical`
- 负责模块：`ai_engine/bone_predictor.py`
- 目标：模板骨骼自动适配不同体型的角色
- 具体工作：
  - 完善 catgirl 模板骨骼树
  - 实现基于 body bbox 的自动缩放
  - 实现基于图层位置的骨骼偏移
  - 添加 human_female / human_male 模板
  - 支持从 JSON 加载自定义模板
- 验收标准：不同体型的角色都能正确适配骨骼

### Task 2.2 — 权重自动分配
- [x] 状态：`completed` ✅ 2026-05-27
- 优先级：`P2-critical`
- 负责模块：`ai_engine/weight_painter.py`
- 目标：自动为网格顶点分配骨骼权重
- 具体工作：
  - 完善热扩散权重算法
  - 实现距离衰减控制（falloff 参数）
  - 实现权重归一化和稀疏化（threshold）
  - 处理边界顶点的平滑过渡
  - 输出 Cubism 兼容的权重格式
- 验收标准：权重分配后变形无撕裂/穿帮

### Task 2.3 — 网格 + 骨骼 + 权重集成
- [x] 状态：`completed` ✅ 2026-05-27
- 优先级：`P2-critical`
- 负责模块：`api/routes/rig.py`
- 目标：rigging API 完整可用
- 具体工作：
  - 将 mesh_generator + bone_predictor + weight_painter 串联
  - 每个图层生成独立网格 + 绑定到对应骨骼
  - 输出完整的骨架+网格数据给 export 阶段
  - 处理图层之间的父子关系
- 验收标准：POST /api/rig 返回完整骨架 + 每层网格信息

### Task 2.4 — Cubism 工程 + 绑定数据合并
- [x] 状态：`completed` ✅ 2026-05-27
- 优先级：`P2-critical`
- 负责模块：`cubism_bridge/cmo3_writer.py`
- 目标：将绑定数据写入 .cmo3 工程文件
- 具体工作：
  - 将骨骼层级写入 Deformer 层
  - 将网格数据写入 ArtMesh 层
  - 将权重数据写入 VertexWeight
  - 确保 Cubism Editor 打开后能看到完整的绑定
- 验收标准：Cubism Editor 打开后骨骼/网格/权重完整显示

### Task 2.5 — export API 完善
- [x] 状态：`completed` ✅ 2026-05-27
- 优先级：`P2-high`
- 负责模块：`api/routes/export.py`
- 目标：导出完整的 Cubism 模型包
- 具体工作：
  - 输出 .cmo3（可选，用于二次编辑）
  - 输出 .moc3（运行时必须）
  - 输出 .model3.json（SDK 加载配置）
  - 输出 .physics3.json（物理配置）
  - 输出 textures/（纹理目录）
  - 打包为 ZIP 下载
- 验收标准：导出的模型包能被 Cubism SDK Viewer 直接加载

### Task 2.6 — 绑定质量验证
- [x] 状态：`completed` ✅ 2026-05-27
- 优先级：`P2-medium`
- 负责模块：`tests/`
- 目标：自动验证绑定质量
- 具体工作：
  - 测试参数极端值下的变形（AngleX = ±30 等）
  - 检测顶点穿透/撕裂
  - 检测权重归一化误差
  - 截图对比（变形前后）
- 验收标准：无明显视觉穿帮

---

## P3：一键部署（第 7 周）

> 端到端打通，从图片到桌宠用上新模型

### Task 3.1 — 模型验证器完善
- [x] 状态：`completed` ✅ 2026-05-27
- 优先级：`P3-critical`
- 负责模块：`deploy/validator.py`
- 目标：部署前完整验证模型文件
- 具体工作：
  - 验证 .moc3 magic number + version
  - 验证 .model3.json 结构完整性
  - 验证纹理文件存在且尺寸合法
  - 验证参数范围与模板一致
  - 输出详细的验证报告
- 验收标准：非法模型被拦截并给出明确错误信息

### Task 3.2 — 一键部署器
- [x] 状态：`completed` ✅ 2026-05-27
- 优先级：`P3-critical`
- 负责模块：`deploy/deployer.py`
- 目标：一键将模型部署到 AstralFox Unity 项目
- 具体工作：
  - 复制模型文件到 Unity StreamingAssets
  - 写入 anim_params.json（动画参数映射）
  - 写入 state_machine.json（状态机配置）
  - 写入 lipsync.json（口型同步配置）
  - 通过 WebSocket 触发 Unity 热加载
- 验收标准：桌宠自动加载新模型并响应动画

### Task 3.3 — 端到端 Pipeline 测试
- [x] 状态：`completed` ✅ 2026-05-27
- 优先级：`P3-critical`
- 负责模块：`api/routes/pipeline.py`
- 目标：一键运行全流程
- 具体工作：
  - 测试 POST /api/pipeline（upload → separate → rig → export → deploy）
  - 测量每阶段耗时
  - 测试错误恢复（某阶段失败后回滚）
  - 测试并发请求处理
- 验收标准：全流程 < 3 分钟（GPU），无报错

### Task 3.4 — 参数映射 + 状态机配置
- [x] 状态：`completed` ✅ 2026-05-27
- 优先级：`P3-high`
- 负责模块：`astralfox_adapter/`
- 目标：6 个动画状态正确映射到模型参数
- 具体工作：
  - 完善 param_mapper 的默认配置
  - 实现 idle 状态的微动（呼吸、尾巴摆动）
  - 实现 speak 状态的口型同步映射
  - 实现 sleep → greet 的唤醒动画
  - 实现 drag 状态的物理跟随
- 验收标准：每个动画状态视觉效果自然

### Task 3.5 — Unity 热加载对接
- [x] 状态：`completed` ✅ 2026-05-27
- 优先级：`P3-high`
- 负责模块：`deploy/deployer.py`
- 目标：部署后桌宠自动加载新模型
- 具体工作：
  - 实现 WebSocket 命令：`reload_model`
  - 实现 WebSocket 命令：`reload_params`
  - 处理 Unity 端的模型热替换逻辑
  - 处理加载失败的回退机制
- 验收标准：桌宠无需重启即可切换模型

---

## P4：Web UI + 优化（第 8 周）

### Task 4.1 — Gradio UI 完善
- [x] 状态：`completed` ✅ 2026-05-27
- 优先级：`P4-medium`
- 负责模块：`ui/app.py`
- 目标：提供可视化的操作界面
- 具体工作：
  - 图片上传 + 预览
  - 分层结果实时预览（Gallery）
  - 骨骼可视化（在图片上叠加骨骼线）
  - 导出格式选择
  - 一键部署按钮 + 状态反馈
- 验收标准：非技术人员也能操作

### Task 4.2 — 性能优化
- [x] 状态：`completed` ✅ 2026-05-27
- 优先级：`P4-medium`
- 负责模块：全局
- 目标：全流程 < 2 分钟
- 具体工作：
  - AI 模型预加载（启动时加载到 GPU）
  - 图片预处理并行化
  - .moc3 编码优化（减少内存分配）
  - 添加进度回调（SSE/WebSocket）
- 验收标准：全流程 < 2 分钟（GPU）

### Task 4.3 — Docker 部署
- [x] 状态：`completed` ✅ 2026-05-27
- 优先级：`P4-low`
- 负责模块：`Dockerfile` + `docker-compose.yml`
- 目标：一键容器化部署
- 具体工作：
  - 多阶段构建（builder + runtime）
  - GPU 支持（nvidia-docker）
  - 模型文件挂载
  - 健康检查端点
- 验收标准：`docker compose up` 一键启动

---

## 依赖关系图

```
P0 (Cubism 格式)          P1 (AI 分层)
  0.1 ─→ 0.2 ─→ 0.5        1.1 ─→ 1.2 ─→ 1.3
  0.3 ─→ 0.6                1.4
  0.4                        1.5
    │                         │
    └────────┬────────────────┘
             ▼
P2 (智能绑定)
  2.1 ─→ 2.3 ─→ 2.4
  2.2 ─→ 2.3
         2.5
         2.6
             │
             ▼
P3 (一键部署)
  3.1 ─→ 3.2 ─→ 3.3
         3.4
         3.5
             │
             ▼
P4 (UI + 优化)
  4.1
  4.2
  4.3
```

---

## 当前进度

| 阶段 | 任务数 | 已完成 | 进度 |
|------|--------|--------|------|
| P0   | 6      | 6      | 100% ✅ |
| P1   | 6      | 6      | 100% ✅ |
| P2   | 6      | 6      | 100% ✅ |
| P3   | 5      | 5      | 100% ✅ |
| P4   | 3      | 3      | 100% ✅ |
| **总计** | **26** | **26** | **100%** ✅ |
