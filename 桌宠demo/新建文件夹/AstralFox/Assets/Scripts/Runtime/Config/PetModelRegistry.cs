using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace AstralFox.Config
{
    /// <summary>
    /// Single source of truth for all built-in Live2D pet models.
    /// Used by StartupWizard, QuickModelSwitch, and SettingsWebServer.
    /// Add new models here ONCE — all three entry points pick up changes automatically.
    /// </summary>
    [CreateAssetMenu(fileName = "PetModelRegistry", menuName = "AstralFox/Pet Model Registry")]
    public sealed class PetModelRegistry : ScriptableObject
    {
        public enum ModelComplexity { Light, Standard, High }

        [System.Serializable]
        public struct ModelEntry
        {
            public string id;
            public string displayName;
            public string source;          // "内置" / "少女前线" / "碧蓝航线" / "自定义"
            public string modelPath;        // Relative to StreamingAssets, e.g. "Models/generated/model.model3.json"
            public ModelComplexity complexity;
            public int drawables;           // ArtMesh count for performance hint
            public string description;
        }

        [SerializeField]
        private ModelEntry[] _models = new ModelEntry[]
        {
            new() { id = "generated", displayName = "星尘 (AI生成)", source = "AI管线",
                modelPath = "Models/generated/model.model3.json", complexity = ModelComplexity.Standard, drawables = 4,
                description = "通过 AstralFox Rigging Pipeline 从角色立绘自动生成。Pipeline: MobileSAM图层分离 → 模板骨骼绑定 → Cubism导出。" },
            new() { id = "senko", displayName = "Senko 仙狐 (占位)", source = "内置",
                modelPath = "Models/Senko/senko.model3.json", complexity = ModelComplexity.Light, drawables = 0,
                description = "开发用占位模型，版权仅限个人非商业使用。正式演示请切换至「星尘 (AI生成)」。" },
            new() { id = "cattail", displayName = "CatTail 猫尾 (旧版)", source = "内置",
                modelPath = "Models/CatTail/cattail.model3.json", complexity = ModelComplexity.Light, drawables = 18,
                description = "轻量猫耳少女，默认角色" },

            new() { id = "ak12", displayName = "AK-12", source = "少女前线",
                modelPath = "Models/GirlsFrontline/AK12/normal.model3.json", complexity = ModelComplexity.Standard, drawables = 45 },
            new() { id = "m4a1", displayName = "M4A1", source = "少女前线",
                modelPath = "Models/GirlsFrontline/M4A1/normal.model3.json", complexity = ModelComplexity.Standard, drawables = 48 },
            new() { id = "hk416", displayName = "HK416", source = "少女前线",
                modelPath = "Models/GirlsFrontline/HK416/normal.model3.json", complexity = ModelComplexity.Standard, drawables = 52 },
            new() { id = "ar15", displayName = "AR-15", source = "少女前线",
                modelPath = "Models/GirlsFrontline/AR15/normal.model3.json", complexity = ModelComplexity.Standard, drawables = 40 },
            new() { id = "an94", displayName = "AN-94", source = "少女前线",
                modelPath = "Models/GirlsFrontline/AN94/normal.model3.json", complexity = ModelComplexity.Standard, drawables = 38 },

            new() { id = "enterprise", displayName = "Enterprise 企业", source = "碧蓝航线",
                modelPath = "Models/AzurLane/Enterprise/qiye_7.model3.json", complexity = ModelComplexity.High, drawables = 521,
                description = "高精度模型，推荐性能较好设备" },
            new() { id = "belfast", displayName = "Belfast 贝尔法斯特", source = "碧蓝航线",
                modelPath = "Models/AzurLane/Belfast/beierfasite_2.model3.json", complexity = ModelComplexity.High, drawables = 450 },
            new() { id = "atago", displayName = "Atago 爱宕", source = "碧蓝航线",
                modelPath = "Models/AzurLane/Atago/aidang_2.model3.json", complexity = ModelComplexity.High, drawables = 480 },
            new() { id = "akagi", displayName = "Akagi 赤城", source = "碧蓝航线",
                modelPath = "Models/AzurLane/Akagi/chicheng_5.model3.json", complexity = ModelComplexity.High, drawables = 1118,
                description = "最高精度模型（1118 Drawables），需高性能设备" },
        };

        public IReadOnlyList<ModelEntry> Models => _models;

        public ModelEntry GetById(string id)
        {
            foreach (var m in _models)
                if (m.id == id) return m;
            return _models[0]; // Fallback to first bundled entry.
        }

        public IReadOnlyList<ModelEntry> GetAvailableModels()
        {
            var available = new List<ModelEntry>();
            foreach (var model in _models)
            {
                if (!TryGetExistingModelPath(model.modelPath, out var normalizedPath))
                    continue;

                var normalizedModel = model;
                normalizedModel.modelPath = normalizedPath;
                available.Add(normalizedModel);
            }
            return available;
        }

        public string[] GetDisplayNames()
        {
            var names = new string[_models.Length];
            for (int i = 0; i < _models.Length; i++)
                names[i] = _models[i].displayName;
            return names;
        }

        public Dictionary<string, List<ModelEntry>> GetBySource()
        {
            var dict = new Dictionary<string, List<ModelEntry>>();
            foreach (var m in _models)
            {
                if (!dict.ContainsKey(m.source))
                    dict[m.source] = new List<ModelEntry>();
                dict[m.source].Add(m);
            }
            return dict;
        }

        public static bool IsModelAvailable(string modelPath)
        {
            return TryGetExistingModelPath(modelPath, out _);
        }

        public static bool TryGetExistingModelPath(string modelPath, out string normalizedPath)
        {
            normalizedPath = NormalizeModelPath(modelPath);
            if (string.IsNullOrEmpty(normalizedPath))
                return false;

            var fullPath = Path.Combine(
                Application.streamingAssetsPath,
                normalizedPath.Replace('/', Path.DirectorySeparatorChar));

            return File.Exists(fullPath);
        }

        public static string NormalizeModelPath(string modelPath)
        {
            if (string.IsNullOrWhiteSpace(modelPath))
                return string.Empty;

            var normalized = modelPath.Trim().Replace('\\', '/').TrimStart('/');

            const string assetsPrefix = "Assets/StreamingAssets/";
            if (normalized.StartsWith(assetsPrefix, StringComparison.OrdinalIgnoreCase))
                normalized = normalized.Substring(assetsPrefix.Length);

            const string streamingAssetsPrefix = "StreamingAssets/";
            if (normalized.StartsWith(streamingAssetsPrefix, StringComparison.OrdinalIgnoreCase))
                normalized = normalized.Substring(streamingAssetsPrefix.Length);

            const string modelsPrefix = "models/";
            if (normalized.StartsWith(modelsPrefix, StringComparison.OrdinalIgnoreCase))
                normalized = "Models/" + normalized.Substring(modelsPrefix.Length);

            return normalized;
        }

        /// <summary>Singleton accessor — loads from Resources.</summary>
        public static PetModelRegistry Instance
        {
            get
            {
                if (_instance == null)
                    _instance = Resources.Load<PetModelRegistry>("PetModelRegistry");
                if (_instance == null)
                {
                    Debug.LogWarning("[PetModelRegistry] No asset found at Resources/PetModelRegistry. Using fallback.");
                    _instance = CreateInstance<PetModelRegistry>();
                }
                return _instance;
            }
        }
        private static PetModelRegistry _instance;
    }
}
