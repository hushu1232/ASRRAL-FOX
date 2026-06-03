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
