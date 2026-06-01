# DragonBones 模型目录 (角色: 星尘)

将 DragonBones 导出的 3 个文件放入此目录：

```
Assets/StreamingAssets/Models/fox/        # 目录名 "fox" 为内部代号，保持不变
├── girl_ske.json       # 骨骼数据 (推荐命名: girl_ske.json)
├── girl_tex.json        # 纹理集配置
└── girl_tex.png         # 纹理集图片
```

在 Unity 中：
1. 选中 girl_ske.json → 右键 → Create → DragonBones → Create Unity Data
2. 将生成的 _Data.asset 拖入 DragonBonesAnimator 的 DragonBones Data 字段
3. 更新 DragonBonesBoneMap.cs 中的骨骼名称（参考 girl_ske.json 中的 bones 数组）

角色形象:
  二次元少女「星尘」— 银白长发发梢渐变星蓝色，眼睛有星辰纹理，
  身着未来感休闲服，胸前佩戴情绪感应以太水晶吊坠。
