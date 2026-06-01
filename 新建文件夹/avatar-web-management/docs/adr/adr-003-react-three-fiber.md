# ADR-003: 选用 React Three Fiber 而非原生 Three.js 进行 3D 渲染

| 属性 | 值 |
|---|---|
| **编号** | ADR-003 |
| **状态** | 已采纳 |
| **日期** | 2025-02-01 |
| **决策者** | 开发团队 |

## 背景

虚拟形象编辑器是项目的核心功能——用户需要在浏览器中实时预览 3D 模型、拖拽装配部件、调整 BlendShape（面部捏脸）参数、修改材质颜色。传统 Three.js 开发模式使用命令式 API（`scene.add(mesh)`、`renderer.render()`），与 React 声明式组件模型的理念冲突，导致代码中充斥着 `useEffect`、`useRef` 和手动生命周期管理。

## 决策

**采用 React Three Fiber (R3F) + @react-three/drei 作为 3D 渲染层**，而非直接使用原生 Three.js。

核心理由：
1. **声明式场景图**：`<mesh>`、`<group>`、`<ambientLight>` 等 JSX 元素直接映射 Three.js 对象，与 React 组件树统一
2. **React 生态集成**：3D 组件可接收 props、使用 Context（`BaseModelContext`）、配合 Zustand 做状态管理
3. **自动资源管理**：R3F 的 `useLoader`、`useGLTF` hooks 自动处理几何体和纹理的加载与释放，避免内存泄漏
4. **@react-three/drei 生态**：提供开箱即用的 `OrbitControls`、`Environment`、`useAnimations` 等组件，减少样板代码
5. **并发渲染**：R3F 在 React 的 reconciler 层运行，天然支持 Concurrent Mode 和 Suspense

排除的方案：
- **原生 Three.js**：命令式 API 与 React 组件生命周期分离，需要大量 `useEffect` 和 `useRef` 进行手动同步，容易产生 bug
- **Babylon.js**：功能强大但学习曲线陡峭，社区规模小于 Three.js，R3F 类似的 React 绑定（`react-babylonjs`）不够成熟
- **PlayCanvas / Unity WebGL**：封闭生态、打包体积大、自定义扩展困难，不适合作为 Web 管理平台的集成组件

## 后果

### 正面
- 编辑器组件与 3D 场景共享同一 Zustand store，数据流清晰单向
- `Suspense` 优雅处理模型加载状态（加载中显示 fallback，加载完成自动渲染）
- 截图服务可通过无头渲染复用相同的 R3F 场景组件
- 代码审查和维护成本降低——TSX 比命令式 Three.js 代码更易读

### 负面
- R3F 增加了一层抽象，某些性能敏感场景（如大量骨骼动画的蒙皮网格）需要穿透到原生 Three.js 对象
- 调试难度增加：React DevTools 无法直接检查 Three.js 场景图，需要 R3F 专用调试工具
- R3F 版本升级可能引入 Breaking Changes，需关注与 Three.js 的版本兼容性
- 打包体积：R3F + drei + Three.js 共约 600KB gzipped，对移动端加载有一定影响

### 中性
- 团队需要同时掌握 React 和 Three.js 两个领域知识
- 3D 模型格式（GLB/VRM）的加载和解析仍需要 gltfjsx 等工具预处理

## 参考资料

- [React Three Fiber 文档](https://docs.pmnd.rs/react-three-fiber)
- [@react-three/drei 组件库](https://github.com/pmndrs/drei)
- [Three.js 文档](https://threejs.org/docs/)
