# .moc3 v3 → v6 编码器升级工程计划

> **目标**: 更新 `cubism_bridge/moc3_encoder.py` 输出 Cubism Core 6 兼容格式
> **策略**: 获取 v6 参考 → 逆向差异 → 重写编码器 → 回归测试
> **预估**: 18h / 2-3 工作日

---

## Phase 1: 获取 v6 参考基准 (2h)

### 1.1 从 SDK 样品中提取 v6 .moc3
- [ ] 搜索 `D:/新建文件夹/CubismSdkForUnity-5-r.5.unitypackage` 内置的 .moc3 文件
- [ ] 或从 `D:/Live2D Cubism 5.3/` Editor 资源中提取
- [ ] 用 Python 解析头部确认版本号 = 6

### 1.2 备选：Cubism Editor 导出一个简单模型
- [ ] 打开 Cubism Editor 5.3
- [ ] 新建项目（一个 ArtMesh + 两个参数）
- [ ] 导出 .moc3
- [ ] 验证 Core 6 接受此文件

### 1.3 生成最小对比基准
- [ ] 用 v3 编码器生成一份最小模型（1 part, 1 param, 1 drawable）
- [ ] 用 v6 参考文件的头部结构作为目标
- [ ] 逐字节标注差异点

---

## Phase 2: 差异化分析 (3h)

### 2.1 头部（Header）差异
- [ ] 对比 64 字节头部的字段布局
- [ ] 确认每个字段的 offset、type、含义
- [ ] 标记 v6 新增/移除的字段

### 2.2 Section Table 差异
- [ ] 对比 Section ID 枚举（v3: 11 sections, v6: ?）
- [ ] 确认 Section Table entry 结构（16 bytes? 格式?）
- [ ] 标记新增 Section 类型

### 2.3 String Table 差异
- [ ] 对比字符串编码方式
- [ ] 确认对齐规则

### 2.4 ArtMesh SoA 差异
- [ ] 对比 SoA 字段列表和顺序
- [ ] 对比每个字段的数据类型（uint32 → ?）
- [ ] 标记 v6 新增字段和默认值

---

## Phase 3: 重写编码器 (4h)

### 3.1 更新常量
- [ ] `MOC3_VERSION = 6`
- [ ] 新增 Section IDs
- [ ] 更新 `SECTION_IDS` 列表

### 3.2 更新 `_encode_data()`
- [ ] 更新 header 布局
- [ ] 更新 section table 生成
- [ ] 更新 parts/parameters/deformers section
- [ ] 更新 ArtMesh SoA 字段
- [ ] 填充新增 section 为空/默认值

### 3.3 更新 Validator
- [ ] 适配 v6 的校验逻辑
- [ ] 更新版本号检查

---

## Phase 4: 验证 (3h)

### 4.1 单元测试
- [ ] 编码 → 解码 → 比对往返测试
- [ ] 最少模型测试（1 part, 1 param, 1 drawable）
- [ ] AI 生成模型全量测试

### 4.2 Unity 导入验证
- [ ] 复制新的 .moc3 到 Assets/Live2D/Models/Generated/
- [ ] 删除旧 .meta → SDK 重新导入
- [ ] 确认 `HasMocConsistency` 通过
- [ ] 确认预制体生成成功

### 4.3 端到端验证
- [ ] 从头生成角色模型
- [ ] Unity Setup Desktop Pet Scene → Play
- [ ] Live2D 角色原生渲染

---

## Phase 5: 文档与清理 (2h)

### 5.1 代码注释
- [ ] 编码器文件头说明 v6 兼容性
- [ ] 关键字段注释（参考来源）

### 5.2 变更日志
- [ ] 记录 v3→v6 的二进制差异决策
- [ ] 更新 `API_REFERENCE.md`

### 5.3 Git 提交
- [ ] 单独的 commit message 说明技术细节

---

## 进度追踪

| Phase | 状态 | 开始 | 完成 |
|-------|------|------|------|
| 1. 获取 v6 参考 | ⬜ | | |
| 2. 差异化分析 | ⬜ | | |
| 3. 重写编码器 | ⬜ | | |
| 4. 验证 | ⬜ | | |
| 5. 文档清理 | ⬜ | | |

---

## 参考资源

- CubismNativeFramework: `CubismMoc.cpp`, `CubismModelMoc.cpp`
- Cubism SDK 5.3 CHANGELOG: Core 06.00.0001
- 官方文档: https://docs.live2d.com/cubism-sdk-manual/moc3-consistency/
