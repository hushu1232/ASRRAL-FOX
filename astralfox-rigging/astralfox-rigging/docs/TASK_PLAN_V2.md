# AstralFox Rigging — 工程任务清单 V2

> 基于项目现状审计，从「代码骨架」到「可交付系统」的精确任务拆解
> 上一版 26 个结构任务已全部完成，本版聚焦**遗留问题**和**真实可用性**

---

## 阶段一：修复管线断点（最高优先级）

> 目标：端到端流程在代码层面无断裂，数据能从入口流到出口

### T1.1 — 修复 rig→export 权重数据流
- [x] 状态：`completed` ✅ 2026-05-28
- 优先级：`critical`
- 负责文件：`api/routes/rig.py`
- 问题：`bones_flat = flatten_skeleton(skeleton)` 计算后未使用，权重未写入 RigResponse
- 具体工作：
  - [ ] RigResponse 新增 `meshes: list[dict]` 字段（每层的 vertices/uvs/indices）
  - [ ] RigResponse 新增 `weights: list[dict]` 字段（每层的权重数据）
  - [ ] rig.py 中对每层 mesh 调用 `weight_painter.paint_for_layer()` 计算权重
  - [ ] 将 mesh + weights 数据组装到响应中
- 验收标准：POST /api/rig 返回的响应包含每层的网格和权重数据

### T1.2 — export 路由接收并写入权重
- [x] 状态：`completed` ✅ 2026-05-28
- 优先级：`critical`
- 依赖：T1.1
- 负责文件：`api/routes/export.py`, `cubism_bridge/cmo3_writer.py`
- 问题：export 路由不接收 mesh/weight 数据，.cmo3 中无权重绑定
- 具体工作：
  - [ ] ExportRequest 新增 `meshes` 和 `weights` 字段
  - [ ] export.py 将 meshes 传给 `writer.write_cmo3(meshes=...)`
  - [ ] cmo3_writer.py 的 `_build_cmo3()` 将权重写入 ArtMesh 的 `VertexWeights` 字段
  - [ ] .moc3 编码器的 ArtMesh section 新增权重数据写入
- 验收标准：生成的 .cmo3 JSON 中 ArtMeshes 包含 VertexWeights

### T1.3 — pipeline 路由数据贯通
- [x] 状态：`completed` ✅ 2026-05-28
- 优先级：`critical`
- 依赖：T1.1, T1.2
- 负责文件：`api/routes/pipeline.py`
- 问题：pipeline 调用 rig 后不传递 mesh/weight 给 export
- 具体工作：
  - [ ] pipeline.py 从 rig 响应中提取 meshes/weights
  - [ ] 传递给 ExportRequest
  - [ ] 验证全链路数据不丢失
- 验收标准：POST /api/pipeline 生成的 ZIP 中 .cmo3 包含完整权重

### T1.4 — 更新测试覆盖数据流
- [x] 状态：`completed` ✅ 2026-05-28
- 优先级：`high`
- 依赖：T1.1, T1.2, T1.3
- 负责文件：`tests/test_rigging.py`, `tests/test_api.py`
- 具体工作：
  - [ ] 测试 rig 响应包含 meshes 和 weights 字段
  - [ ] 测试 export 接收 meshes/weights 后生成的 .cmo3 包含 VertexWeights
  - [ ] 测试 pipeline 端到端数据贯通
- 验收标准：所有测试通过

---

## 阶段二：格式兼容性验证

> 目标：生成的文件能被 Cubism SDK Viewer 正确加载

### T2.1 — .moc3 ArtMesh 字节对齐审查
- [ ] 状态：`pending`
- 优先级：`critical`
- 负责文件：`cubism_bridge/moc3_encoder.py`
- 问题：ArtMesh section 的字段顺序和 padding 可能与 SDK 不一致
- 具体工作：
  - [ ] 对照 CubismNativeFramework `CubismModelMoc.cpp` 逐字段比对 ArtMesh 二进制布局
  - [ ] 确认 VertexPositions 写入顺序（SDK: 4 floats per vertex: x, y, u, v 交替？还是分开？）
  - [ ] 确认 DynamicFlags 位置和含义
  - [ ] 确认 RenderOrder/PartIndex 的字节偏移
  - [ ] 修正发现的偏差
- 验收标准：SDK `LoadMoc()` 不崩溃

### T2.2 — .moc3 Drawable 完整性
- [ ] 状态：`pending`
- 优先级：`high`
- 依赖：T2.1
- 负责文件：`cubism_bridge/moc3_encoder.py`
- 问题：当前 drawables 传空列表，ArtMesh 数据未从 cmo3 中提取
- 具体工作：
  - [ ] `_encode_cmo3()` 从 cmo3 的 ArtMeshes 中提取 drawables 数据
  - [ ] 传递给 `_encode_data()` 的 drawables 参数
  - [ ] 验证 VertexPositions/Uvs/Triangles 正确写入
- 验收标准：生成的 .moc3 中 ArtMesh section 有实际顶点数据

### T2.3 — .moc3 Deformer section 编码
- [ ] 状态：`pending`
- 优先级：`high`
- 依赖：T2.1
- 负责文件：`cubism_bridge/moc3_encoder.py`
- 问题：当前 Deformers section 写入空数据（count=0）
- 具体工作：
  - [ ] 从 cmo3 的 Deformers 树中提取变形器数据
  - [ ] 编码 Rotation/Point deformers 到 binary section
  - [ ] 写入 deformers 的参数（angle, scale, origin）
- 验收标准：SDK 加载后 deformers 可见

### T2.4 — .cmo3 Cubism Editor 兼容性测试
- [ ] 状态：`pending`
- 优先级：`medium`
- 依赖：T1.2
- 具体工作：
  - [ ] 用 Cubism Editor 4.x 打开生成的 .cmo3
  - [ ] 记录所有报错和警告
  - [ ] 逐一修复格式问题
  - [ ] 确认图层/网格/骨骼/权重在编辑器中正确显示
- 验收标准：Cubism Editor 打开 .cmo3 无致命错误

### T2.5 — Cubism SDK Viewer 端到端加载测试
- [ ] 状态：`pending`
- 优先级：`high`
- 依赖：T2.1, T2.2, T2.3
- 具体工作：
  - [ ] 用 Cubism SDK Native Viewer 加载生成的 .model3.json
  - [ ] 确认模型能渲染（即使不完美）
  - [ ] 记录渲染问题（缺失贴图、变形错误等）
  - [ ] 逐一修复
- 验收标准：SDK Viewer 能显示基本模型图形

---

## 阶段三：AI 引擎真实验证

> 目标：AI 分层在真实图片上跑通，效果可接受

### T3.1 — rembg fallback 真实测试
- [ ] 状态：`pending`
- 优先级：`high`
- 负责文件：`ai_engine/layer_separator.py`
- 具体工作：
  - [ ] 准备 5 张测试立绘（不同风格：赛璐璐/厚涂/Q版/真人风/黑白）
  - [ ] 运行 SimpleLayerSeparator，记录每张的处理时间和效果
  - [ ] 验证返回的 texture/mask/bbox 正确
  - [ ] 记录失败案例（边缘锯齿、前景误判等）
- 验收标准：5 张中至少 3 张分层效果可接受

### T3.2 — SAM2 真实环境搭建与测试
- [ ] 状态：`pending`
- 优先级：`high`
- 依赖：T3.1
- 负责文件：`ai_engine/layer_separator.py`
- 具体工作：
  - [ ] 安装 sam2 包（`pip install sam2`）
  - [ ] 下载 checkpoint（vit_h ~2.5GB）
  - [ ] 运行 SmartLayerSeparator 在 T3.1 的 5 张测试图上
  - [ ] 对比 SAM2 vs rembg 的分层数量和质量
  - [ ] 记录每张的处理时间和 GPU 显存占用
- 验收标准：SAM2 分层数量 8-10 个，质量明显优于 rembg

### T3.3 — 语义分类器真实准确率评估
- [ ] 状态：`pending`
- 优先级：`high`
- 依赖：T3.2
- 负责文件：`ai_engine/semantic_classifier.py`
- 具体工作：
  - [ ] 对 T3.2 的分层结果，人工标注正确分类
  - [ ] 运行 RuleBasedClassifier，计算准确率
  - [ ] 分析误分类模式（哪些类别容易混淆）
  - [ ] 调整规则参数提升准确率
- 验收标准：准确率 > 85%

### T3.4 — 分层端到端 API 真实测试
- [ ] 状态：`pending`
- 优先级：`high`
- 依赖：T3.3
- 负责文件：`api/routes/separate.py`
- 具体工作：
  - [ ] 通过 API 上传真实图片
  - [ ] 调用 /api/separate/ 获取分层结果
  - [ ] 验证每层的 texture_url 可访问、mask_url 可下载
  - [ ] 验证 bbox 合理
- 验收标准：API 返回的图层可用于后续绑定

### T3.5 — 权重分配视觉验证
- [ ] 状态：`pending`
- 优先级：`medium`
- 依赖：T1.1, T3.4
- 负责文件：`ai_engine/weight_painter.py`
- 具体工作：
  - [ ] 对真实分层结果运行 weight_painter
  - [ ] 将权重可视化为热力图（每骨骼一张）
  - [ ] 检查边界区域的权重过渡是否平滑
  - [ ] 检查 max_influences 限制是否生效
- 验收标准：权重热力图无明显异常

---

## 阶段四：物理与动画调优

> 目标：物理模拟和动画参数在实际效果上合理

### T4.1 — 物理预设参数调优
- [ ] 状态：`pending`
- 优先级：`medium`
- 负责文件：`cubism_bridge/physics_config.py`
- 具体工作：
  - [ ] 在 Cubism Viewer 中加载物理配置
  - [ ] 调整 HairFront/SideL/SideR 的 stiffness/damping/mass
  - [ ] 调整 Tail 的摆动幅度和回弹
  - [ ] 调整 Ear 的灵敏度
  - [ ] 保存调优后的参数为 JSON 预设
- 验收标准：物理摆动自然，无穿模

### T4.2 — 动画状态真实效果测试
- [ ] 状态：`pending`
- 优先级：`medium`
- 负责文件：`astralfox_adapter/param_mapper.py`
- 具体工作：
  - [ ] 用 param_mapper 生成的配置驱动 Cubism Viewer
  - [ ] 测试 idle 状态的呼吸/尾巴微动
  - [ ] 测试 speak 状态的口型同步
  - [ ] 测试 sleep→greet 唤醒动画
  - [ ] 调整 speed/target 参数使效果自然
- 验收标准：6 个状态的动画过渡流畅

### T4.3 — 表情变体效果评估
- [ ] 状态：`pending`
- 优先级：`low`
- 负责文件：`ai_engine/expression_generator.py`
- 具体工作：
  - [ ] 在真实图层上生成 9 个表情变体
  - [ ] 目视评估 eye_close/mouth_open/smile/frown 效果
  - [ ] 记录几何变换的局限（侧面脸、大角度等）
  - [ ] 标记需要 ControlNet 替代的场景
- 验收标准：正面脸的表情变体可接受

---

## 阶段五：测试补全与健壮性

> 目标：边界情况有覆盖，错误不会导致崩溃

### T5.1 — 边界输入测试
- [ ] 状态：`pending`
- 优先级：`medium`
- 负责文件：`tests/`
- 具体工作：
  - [ ] 测试空图片（0x0）上传
  - [ ] 测试超大图片（8000x8000）上传
  - [ ] 测试非 PNG 格式（JPG/BMP/WebP）
  - [ ] 测试单色图片（纯白/纯黑）
  - [ ] 测试无前景图片（纯背景）
- 验收标准：所有边界情况返回明确错误，不崩溃

### T5.2 — 错误恢复测试
- [ ] 状态：`pending`
- 优先级：`medium`
- 负责文件：`api/routes/pipeline.py`
- 具体工作：
  - [ ] 测试分层阶段失败后 pipeline 的行为
  - [ ] 测试 rig 阶段失败后是否清理中间文件
  - [ ] 测试 export 阶段失败后是否回滚
  - [ ] 验证错误信息对用户友好
- 验收标准：pipeline 任何阶段失败都有清晰错误信息

### T5.3 — 并发请求测试
- [ ] 状态：`pending`
- 优先级：`low`
- 负责文件：`api/`
- 具体工作：
  - [ ] 同时上传 2 张图片
  - [ ] 同时运行 2 个 pipeline
  - [ ] 验证 output 目录不冲突（按 image_id 隔离）
- 验收标准：并发请求不互相干扰

### T5.4 — .moc3 编码器边界测试
- [ ] 状态：`pending`
- 优先级：`medium`
- 负责文件：`tests/test_cubism.py`
- 具体工作：
  - [ ] 测试 0 个 ArtMesh 的 .moc3 生成
  - [ ] 测试 100+ ArtMesh 的 .moc3 生成
  - [ ] 测试 0 个 Parameter 的 .moc3 生成
  - [ ] 验证 MOC3Validator 对所有情况的判断
- 验收标准：边界情况不崩溃

---

## 阶段六：Gradio UI 增强

> 目标：UI 能展示关键结果，非技术人员可用

### T6.1 — 骨骼可视化叠加
- [ ] 状态：`pending`
- 优先级：`medium`
- 负责文件：`ui/app.py`
- 具体工作：
  - [ ] 在原图上用 Canvas 叠加骨骼线（父→子连线）
  - [ ] 标注骨骼名称
  - [ ] 用不同颜色区分骨骼层级
  - [ ] 在 Rigging Tab 中显示
- 验收标准：用户能直观看到骨骼位置

### T6.2 — 分层结果对比视图
- [ ] 状态：`pending`
- 优先级：`low`
- 负责文件：`ui/app.py`
- 具体工作：
  - [ ] 原图与分层结果并排显示
  - [ ] 支持点击图层高亮对应区域
  - [ ] 显示每层的 bbox 和分类置信度
- 验收标准：用户能判断分层质量

### T6.3 — 进度反馈
- [ ] 状态：`pending`
- 优先级：`low`
- 负责文件：`ui/app.py`, `api/`
- 具体工作：
  - [ ] API 添加 SSE 进度回调（分层→绑定→导出每阶段进度）
  - [ ] UI 用 Progress 组件显示实时进度
  - [ ] 预估剩余时间
- 验收标准：用户知道当前在做什么、还要多久

---

## 阶段七：Docker 与部署

> 目标：容器化部署可一键启动

### T7.1 — Docker GPU 支持完善
- [ ] 状态：`pending`
- 优先级：`low`
- 负责文件：`Dockerfile`, `docker-compose.yml`
- 具体工作：
  - [ ] 创建 `Dockerfile.gpu`（基于 nvidia/cuda 基础镜像）
  - [ ] docker-compose.yml 取消注释 GPU 服务配置
  - [ ] 添加 GPU/CPU 模式切换说明
- 验收标准：`docker compose --profile gpu up` 可用

### T7.2 — 配置外部化
- [ ] 状态：`pending`
- 优先级：`medium`
- 负责文件：`config.yaml`, `api/main.py`
- 具体工作：
  - [ ] 所有配置项支持环境变量覆盖
  - [ ] Docker 卷挂载 config.yaml
  - [ ] 添加配置验证（启动时检查必填项）
- 验收标准：无需修改代码即可部署到不同环境

---

## 依赖关系

```
阶段一（管线断点）          阶段二（格式兼容）
  T1.1 ─→ T1.2 ─→ T1.3      T2.1 ─→ T2.2
  T1.1 ─→ T1.4               T2.1 ─→ T2.3
         │                    T2.4 (需 T1.2)
         │                    T2.5 (需 T2.1-T2.3)
         ▼                         │
阶段三（AI 验证）                 │
  T3.1 ─→ T3.2 ─→ T3.3           │
  T3.3 ─→ T3.4                    │
  T3.5 (需 T1.1)                  │
         │                         │
         ▼                         ▼
阶段四（调优）    阶段五（测试）    阶段六（UI）
  T4.1             T5.1            T6.1
  T4.2             T5.2            T6.2
  T4.3             T5.3            T6.3
                   T5.4
                         │
                         ▼
                   阶段七（Docker）
                     T7.1
                     T7.2
```

---

## 进度跟踪

| 阶段 | 任务数 | 已完成 | 进度 |
|------|--------|--------|------|
| 一：管线断点 | 4 | 4 | 100% ✅ |
| 二：格式兼容 | 5 | 0 | 0% |
| 三：AI 验证 | 5 | 0 | 0% |
| 四：调优 | 3 | 0 | 0% |
| 五：测试 | 4 | 0 | 0% |
| 六：UI | 3 | 0 | 0% |
| 七：Docker | 2 | 0 | 0% |
| **总计** | **26** | **4** | **15%** |

---

## 建议执行顺序

**第一批（立即）**：T1.1 → T1.2 → T1.3 → T1.4
> 打通数据流是一切的前提

**第二批（紧跟）**：T2.1 → T2.2 → T2.3 → T2.5
> 让 .moc3 能被 SDK 加载

**第三批（验证）**：T3.1 → T3.2 → T3.3 → T3.4
> 用真实图片验证 AI 效果

**第四批（完善）**：T2.4, T3.5, T4.1-T4.3, T5.1-T5.4
> 调优 + 测试 + 健壮性

**第五批（收尾）**：T6.1-T6.3, T7.1-T7.2
> UI 增强 + 部署
