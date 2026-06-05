# 前端代码规范 — BEM + 企业级工程化
>
> 本文档约束所有 AI 编码助手（Claude Code）生成的前端代码。
> 适用范围：`src/` 下所有 `.tsx`、`.scss`、`.css` 文件。
>
> ## 核心规则速查
>
> | 维度 | 规则 |
> |------|------|
> | **类名** | `block-name__element--modifier`，全小写+连字符 |
> | **SCSS 嵌套** | ≤2 层，仅用 `&` 生成 BEM 关系 |
> | **文件夹** | 每个 Block 独立文件夹，名与类名一致 |
> | **选择器** | 只用 BEM 类名，禁止 ID/标签/结构伪类 |
> | **跨组件** | 不跨块修改样式，共享变量走 `_variables.scss` |
> | **交付** | 文件夹结构 + SCSS + TSX + 使用示例 |
>
> ## 目录约定
>
> ```
> src/
> ├── components/        # 全局通用（Button/, Modal/, 每个块一个文件夹）
> │   └── BlockName/
> │       ├── index.tsx
> │       ├── style.scss
> │       └── assets/
> ├── features/          # 业务模块（可按需含私有 components/hooks/services）
> ├── pages/             # 路由页面
> └── styles/            # 全局变量、重置
> ```
>
> ## 示例
>
> ```scss
> .button {
>   display: inline-flex;
>   &--large { padding: 0.8em 2em; }
>   &__icon {
>     width: 1em;
>     &--left { margin-right: 0.5em; }
>   }
> }
> ```
>
> ```tsx
> const cls = ['button', primary && 'button--primary'].filter(Boolean).join(' ');
> ```

## SCSS 路径别名

组件 SCSS 通过 `@use '@/styles/variables' as *;` 引用全局变量。

**现状**：`@` 别名由 tsconfig.json 的 `paths: {"@/*": ["./src/*"]}` 定义。
Next.js (Turbopack / webpack) 在构建时将该别名传递给 sass-loader，使 SCSS 的
`@use` / `@import` 能够解析 `@/` 前缀。

**风险**：此行为是 Next.js 的隐式行为，未在 `next.config.ts` 中显式配置
`sassOptions`，`package.json` 中也未声明 `sass` 依赖（Next.js 内置 sass 支持）。
如果未来迁移到其他构建工具（Vite、纯 webpack 等），`@/` 路径将无法被 SCSS 识别。

**建议**：在 `next.config.ts` 中添加显式的 sass 配置以消除隐式依赖：

```ts
// next.config.ts — 显式声明 SCSS includePaths
sassOptions: {
  includePaths: [path.join(__dirname, 'src', 'styles')],
},
```

> 如果添加了 `sassOptions.includePaths`，SCSS 文件可以改为 `@use 'variables' as *;`
> 直接引用，不再依赖 `@/` 别名。

## Ant Design 与 BEM 共存策略

本项目同时使用 Ant Design 组件和自定义 BEM 样式。两者的样式系统独立运作，
形成双层样式架构：

| 层级 | 来源 | 作用 |
|------|------|------|
| **Ant Design 内置样式** | CSS-in-JS (emotion) | 提供组件基础外观、交互态、动画 |
| **BEM 覆盖样式** | `style.scss` 中的 BEM 类 | 通过 `className` 注入，覆盖 Ant Design 默认外观 |

### 原则

1. **BEM 类通过 `className` 注入** — 将 BEM 类名传给 Ant Design 组件的
   `className` prop，Ant Design 会将其与自身生成的类名合并。
2. **仅覆盖表现层** — BEM 样式只覆盖颜色、圆角、间距、边框等表现层属性，
   不改动 Ant Design 的布局和交互逻辑。
3. **使用 CSS 自定义属性** — 颜色通过 `var(--accent)`、`var(--bg-card)` 等
   主题变量传递，保持 Ant Design 和 BEM 的主题色一致。
4. **不引入 CSS Modules** — 不用 `*.module.scss`，Ant Design 的
   CSS-in-JS 和 CSS Modules 的哈希化会互相干扰。
5. **优先级控制** — Ant Design 内置样式有较高优先级（通过 `:where()` 或
   CSS-in-JS 注入顺序）。如需强制覆盖，使用 BEM 块级选择器
   （如 `.login-form__input`），利用选择器优先级（特异性）覆盖 Ant Design。

### 示例

```tsx
// BEM 类通过 className 注入 Ant Design 组件
<Button type="primary" className="login-form__submit">
  {t('submit')}
</Button>
```

```scss
// BEM SCSS 覆盖 Ant Design 默认外观
.login-form__submit {
  height: 44px;
  border-radius: $radius-md;
  background: var(--accent);
  border: none;

  &:hover {
    background: var(--accent-hover);
  }
}
```

### 已知技术债

- Ant Design 组件的内部结构（DOM + 类名）随版本升级可能变化，BEM 覆盖样式
  依赖这些内部结构时可能失效。
- 部分 Ant Design 组件（如 `Modal`、`Dropdown`）通过 Portal 渲染到
  `document.body`，其弹出层不在 BEM 块的 DOM 层级内，BEM 类名无法穿透。
  对于这种情况，使用 Ant Design 的 `styles` / `classNames` prop 或全局
  CSS 变量控制外观。
