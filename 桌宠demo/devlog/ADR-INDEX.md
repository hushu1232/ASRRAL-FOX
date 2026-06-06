# 架构决策记录索引 (ADR Index)

> 关键架构决策 + 面试回答要点
> 完整 ADR 见 `avatar-web-management/docs/adr/`

---

## 核心 ADR

### 1. WebSocket 而非 REST 用于语音管线

**决策**: 语音交互选 WebSocket，管理操作用 REST
**原因**: 语音需要双向实时流（PCM 音频上行 + token streaming 下行），REST 轮询延迟太高
**面试要点**: "WebSocket 做 streaming，协议自带了 hello/welcome 版本握手，断线自动重连"

### 2. IPetAnimator 接口抽象模型层

**决策**: 动画系统通过接口 `IPetAnimator` 访问模型，不直接依赖 Live2D SDK
**原因**: 未来可能切换 Spine/DragonBones，切换成本接近于零
**面试要点**: "15 个接口方法，任何模型引擎实现一遍就能接入"

### 3. AES-256-CBC + HMAC 而非 DPAPI

**决策**: 使用跨平台 AES fallback 而非 Windows DPAPI
**原因**: Tuanjie 引擎不自动引用 System.Security.dll，DPAPI 无法编译
**面试要点**: "加密强度等价于 DPAPI，且跨平台可用。HMAC 保证密文完整性"

### 4. 模板骨骼而非 CNN 预测器

**决策**: 当前使用模板骨骼（BonePredictor template mode），CNN 预测器标记 TODO
**原因**: CNN 需要训练数据当前不具备，模板方案在有语义标签图层时效果足够好
**面试要点**: "先跑通流程再优化精度。CNN 预测器的接口已经留好了，checkpoint 到了就能切"

### 5. ScriptableObject 数据驱动空闲行为

**决策**: 12 种空闲行为支持 hardcode 和 ScriptableObject AnimationCurve 双模式
**原因**: 设计阶段 hardcode 快速迭代；生产阶段 ScriptableObject 让非程序人员调参
**面试要点**: "设计模式上的优雅降级——没配置时用 hardcode，有配置时自动切换"

### 6. Python BFF 而非 Unity 直连 LLM

**决策**: 在 Python 端集中处理所有 AI 调用，Unity 只负责渲染
**原因**: Python 生态在 AI/音频处理上有绝对优势；Unity 端可以换离线/Mock 管线
**面试要点**: "关注点分离——Unity 不需要知道 LLM 是什么模型，它只管渲染和交互"

### 7. 先做到能跑，再做到能打

**决策**: remediation-plan → improvement-plan → 本次面试升级，三轮渐进
**原因**: MVP 快速验证可行性，然后系统性加固，最后针对性优化演示效果
**面试要点**: "我的工程节奏是 0→1 先跑通，1→10 再加固，10→100 才优化"
