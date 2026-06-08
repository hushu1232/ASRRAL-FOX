using System.IO;
using System.Reflection;
#if CUBISM_SDK_PRESENT
using Live2D.Cubism.Core;
using Live2D.Cubism.Core.Unmanaged;
using Live2D.Cubism.Framework;
using Live2D.Cubism.Framework.Json;
using Live2D.Cubism.Rendering;
#endif
using UnityEditor;
using UnityEngine;

namespace AstralFox.Editor
{
#if CUBISM_SDK_PRESENT
    [InitializeOnLoad]
    /// <summary>
    /// Auto-setup for CatTail Live2D model. Also handles GF/AL model prefab
    /// generation via BuildAllModels / BuildGfModels / BuildAlModels menu items.
    /// </summary>
    public static class CatTailImporterSetup
    {
        private const string ModelPath = "Assets/Live2D/Models/CatTail/cattail.model3.json";
        private const string PrefabPath = "Assets/Live2D/Models/CatTail/cattail.prefab";
        private const string TriggerFile = "Assets/trigger_setup.txt";

        // Additional models (for manual setup via AstralFox menu)
        private static readonly (string path, string prefab)[] ExtraModels =
        {
            ("Assets/Live2D/Models/GirlsFrontline/AK12/normal.model3.json",   "Assets/Live2D/Models/GirlsFrontline/AK12/normal.prefab"),
            ("Assets/Live2D/Models/GirlsFrontline/M4A1/normal.model3.json",   "Assets/Live2D/Models/GirlsFrontline/M4A1/normal.prefab"),
            ("Assets/Live2D/Models/GirlsFrontline/HK416/normal.model3.json",  "Assets/Live2D/Models/GirlsFrontline/HK416/normal.prefab"),
            ("Assets/Live2D/Models/GirlsFrontline/AR15/normal.model3.json",   "Assets/Live2D/Models/GirlsFrontline/AR15/normal.prefab"),
            ("Assets/Live2D/Models/GirlsFrontline/AN94/normal.model3.json",   "Assets/Live2D/Models/GirlsFrontline/AN94/normal.prefab"),
            ("Assets/Live2D/Models/AzurLane/Enterprise/qiye_7.model3.json",    "Assets/Live2D/Models/AzurLane/Enterprise/qiye_7.prefab"),
            ("Assets/Live2D/Models/AzurLane/Belfast/beierfasite_2.model3.json","Assets/Live2D/Models/AzurLane/Belfast/beierfasite_2.prefab"),
            ("Assets/Live2D/Models/Generated/model.model3.json",              "Assets/Live2D/Models/Generated/model.prefab"),
            ("Assets/Live2D/Models/AzurLane/Atago/aidang_2.model3.json",       "Assets/Live2D/Models/AzurLane/Atago/aidang_2.prefab"),
            ("Assets/Live2D/Models/AzurLane/Akagi/chicheng_5.model3.json",     "Assets/Live2D/Models/AzurLane/Akagi/chicheng_5.prefab"),
        };
        private static bool _checked = false;

        static CatTailImporterSetup()
        {
            // Use delayCall instead of update — runs once after compilation, not every frame
            EditorApplication.delayCall += DelayedCheck;
        }

        private static void DelayedCheck()
        {
            if (_checked) return;

            // Wait until compilation is fully done before processing.
            // delayCall is deferred until after compilation completes naturally,
            // but defend against re-entrancy.
            if (EditorApplication.isCompiling)
            {
                EditorApplication.delayCall += DelayedCheck;
                return;
            }

            _checked = true;

            if (File.Exists(TriggerFile))
            {
                Debug.Log("[CatTailSetup] Trigger detected.");
                File.Delete(TriggerFile);

                try
                {
                    BuildCompletePrefab();
                    SetupAnimatorController();
                    RunSceneSetup();
                    Debug.Log("[CatTailSetup] All done!");
                }
                catch (System.Exception e)
                {
                    Debug.LogError("[CatTailSetup] Failed: " + e);
                }
            }
        }

        private static void BuildCompletePrefab(string modelPath = null, string prefabPath = null)
        {
            modelPath ??= ModelPath;
            prefabPath ??= PrefabPath;
            Debug.Log($"[CatTailSetup] Building prefab: {modelPath}");

            var model3Json = CubismModel3Json.LoadAtPath(modelPath);
            if (model3Json == null)
            {
                Debug.LogError($"[CatTailSetup] LoadAtPath failed: {modelPath}");
                return;
            }

            var mocBytes = model3Json.Moc3;
            if (mocBytes == null)
            {
                Debug.LogError("[CatTailSetup] Moc3 returned null!");
                return;
            }

            var moc = CubismMoc.CreateFrom(mocBytes, shouldCheckMocConsistency: false);
            if (moc == null)
            {
                Debug.LogError("[CatTailSetup] CubismMoc.CreateFrom failed!");
                return;
            }

            var model = CubismModel.InstantiateFrom(moc);
            if (model == null)
            {
                Debug.LogError("[CatTailSetup] InstantiateFrom failed!");
                return;
            }

            var assetPath = modelPath.Replace(".model3.json", "");
            var modelName = Path.GetFileName(assetPath);
            model.name = modelName;

            // Delete old asset if exists (standalone asset, not sub-asset)
            var existingAssetPath = $"{assetPath}.asset";
            var oldMoc = AssetDatabase.LoadAssetAtPath<CubismMoc>(existingAssetPath);
            if (oldMoc != null)
            {
                AssetDatabase.DeleteAsset(existingAssetPath);
                Debug.Log($"[CatTailSetup] Deleted old moc asset: {existingAssetPath}");
            }

            // Create moc asset
            var mocAsset = model.Moc;
            mocAsset.name = modelName;
            AssetDatabase.CreateAsset(mocAsset, existingAssetPath);

            // Add CubismRenderController
            var rc = model.gameObject.AddComponent<CubismRenderController>();

            var drawables = model.Drawables;
            Debug.Log($"[CatTailSetup] Drawables={drawables?.Length}");

            // Manually create CubismRenderer components on each drawable.
#if UNITY_6000_0_OR_NEWER
            // Unity 6: manually create renderers, inject into controller, THEN initialize
            var drawableRenderers = drawables.AddComponentEach<CubismRenderer>();
            var allRenderers = new CubismRenderer[drawableRenderers.Length];
            System.Array.Copy(drawableRenderers, allRenderers, drawableRenderers.Length);

            for (var i = 0; i < drawableRenderers.Length; ++i)
            {
                var r = drawableRenderers[i];
                r.Drawable = drawables[i];
                r.TryInitialize(rc);
                var mat = CubismBuiltinPickers.DrawableMaterialPicker(model3Json, drawables[i]);
                if (mat != null) { r.Material = mat; r.ColorBlendType = drawables[i].ColorBlend; r.AlphaBlendType = drawables[i].AlphaBlend; }
                var tex = CubismBuiltinPickers.TexturePicker(model3Json, drawables[i]);
                if (tex != null) r.MainTexture = tex;
            }

            // Inject renderers into controller to prevent TryInitialize from creating duplicates
            var renderersField = typeof(CubismRenderController).GetField("_renderers",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            if (renderersField != null)
                renderersField.SetValue(rc, allRenderers);

            rc.TryInitialize();
            Debug.Log($"[CatTailSetup] Created {drawableRenderers.Length} renderers (Unity 6).");
#else
            // Tuanjie 2022.3: manual renderer setup needed
            if (drawables != null && drawables.Length > 0)
            {
                var drawableRenderers = drawables.AddComponentEach<CubismRenderer>();
                var allRenderers = new CubismRenderer[drawableRenderers.Length];
                System.Array.Copy(drawableRenderers, allRenderers, drawableRenderers.Length);

                for (var i = 0; i < drawableRenderers.Length; ++i)
                {
                    var r = drawableRenderers[i];
                    r.Drawable = drawables[i];
                    r.TryInitialize(rc);

                    var mat = CubismBuiltinPickers.DrawableMaterialPicker(model3Json, drawables[i]);
                    if (mat != null)
                    {
                        r.Material = mat;
                        r.ColorBlendType = drawables[i].ColorBlend;
                        r.AlphaBlendType = drawables[i].AlphaBlend;
                    }

                    var tex = CubismBuiltinPickers.TexturePicker(model3Json, drawables[i]);
                    if (tex != null)
                        r.MainTexture = tex;
                }

                // On Tuanjie 2022.3, set via reflection
                var renderersField = typeof(CubismRenderController).GetField("_renderers",
                    BindingFlags.NonPublic | BindingFlags.Instance);
                if (renderersField != null)
                    renderersField.SetValue(rc, allRenderers);

                Debug.Log($"[CatTailSetup] Created {drawableRenderers.Length} renderers manually.");
            }
#endif

            // Save prefab (overwrite existing)
            PrefabUtility.SaveAsPrefabAsset(model.gameObject, prefabPath);
            Object.DestroyImmediate(model.gameObject, true);
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            Debug.Log($"[CatTailSetup] Prefab built: {prefabPath}");
        }

        private static void SetupAnimatorController()
        {
            Debug.Log("[CatTailSetup] Creating Animator Controller...");
            try
            {
                AstralFox.Editor.Animation.FoxAnimatorSetup.CreateAnimatorController();
                Debug.Log("[CatTailSetup] Animator Controller created.");
            }
            catch (System.Exception e)
            {
                Debug.LogError("[CatTailSetup] Animator Controller setup failed: " + e);
            }
        }

        private static void RunSceneSetup()
        {
            Debug.Log("[CatTailSetup] Running AstralFox scene setup...");
            try
            {
                AstralFoxSceneSetup.SetupScene();
                Debug.Log("[CatTailSetup] Scene setup completed.");
            }
            catch (System.Exception e)
            {
                Debug.LogError("[CatTailSetup] Scene setup failed: " + e);
            }
        }

        [MenuItem("AstralFox/Setup CatTail Model & Scene")]
        public static void TriggerSetup()
        {
            _checked = false;
            File.WriteAllText(TriggerFile, "setup");
            AssetDatabase.Refresh();
        }

        [MenuItem("AstralFox/Setup YouXiaoMiao Model (v5 Core 6)", false, 0)]
        public static void BuildYouXiaoMiao()
        {
            const string mp = "Assets/Live2D/Models/YouXiaoMiao/悠小喵.model3.json";
            const string pp = "Assets/Live2D/Models/YouXiaoMiao/悠小喵.prefab";
            if (System.IO.File.Exists(mp))
                BuildCompletePrefab(mp, pp);
            else
                Debug.LogError($"[AstralFox] YouXiaoMiao not found at: {mp}");
        }

        [MenuItem("AstralFox/Setup Generated Model (AI Pipeline)", false, 1)]
        public static void BuildGeneratedModel()
        {
            const string genPath = "Assets/Live2D/Models/Generated/model.model3.json";
            const string genPrefab = "Assets/Live2D/Models/Generated/model.prefab";
            if (System.IO.File.Exists(genPath))
                BuildCompletePrefab(genPath, genPrefab);
            else
                Debug.LogError($"[AstralFox] Generated model not found at: {genPath}");
        }

        [MenuItem("AstralFox/Setup TaoHua Model (Navi-Studio)", false, 3)]
        public static void BuildTaoHuaModel()
        {
            const string ep = "Assets/Live2D/Models/TaoHua/TaoHua.model3.json";
            const string pp = "Assets/Live2D/Models/TaoHua/TaoHua.prefab";
            // TaoHua has a pre-built prefab — just verify it exists
            if (System.IO.File.Exists(pp))
                Debug.Log("[AstralFox] TaoHua prefab already exists — ready for scene setup.");
            else if (System.IO.File.Exists(ep))
                BuildCompletePrefab(ep, pp);
            else
                Debug.LogError($"[AstralFox] TaoHua model not found at: {ep}");
        }

        [MenuItem("AstralFox/Setup Editor Export Model (v6)", false, 2)]
        public static void BuildEditorExportModel()
        {
            const string ep = "Assets/Live2D/Models/EditorExport/model.model3.json";
            const string pp = "Assets/Live2D/Models/EditorExport/model.prefab";
            if (System.IO.File.Exists(ep))
                BuildCompletePrefab(ep, pp);
            else
                Debug.LogError($"[AstralFox] Editor export not found at: {ep}");
        }

        [MenuItem("AstralFox/Setup All Models")]
        public static void BuildAllModels()
        {
            BuildCompletePrefab(); // CatTail
            foreach (var (modelPath, prefabPath) in ExtraModels)
            {
                if (System.IO.File.Exists(modelPath))
                    BuildCompletePrefab(modelPath, prefabPath);
                else
                    Debug.LogWarning($"[CatTailSetup] Skipping missing: {modelPath}");
            }
            Debug.Log("[CatTailSetup] All models built.");
        }

        [MenuItem("AstralFox/Setup GF Models")]
        public static void BuildGfModels()
        {
            for (int i = 0; i < 5 && i < ExtraModels.Length; i++)
            {
                var (modelPath, prefabPath) = ExtraModels[i];
                if (System.IO.File.Exists(modelPath))
                    BuildCompletePrefab(modelPath, prefabPath);
            }
        }

        [MenuItem("AstralFox/Setup AL Models")]
        public static void BuildAlModels()
        {
            for (int i = 5; i < ExtraModels.Length; i++)
            {
                var (modelPath, prefabPath) = ExtraModels[i];
                if (System.IO.File.Exists(modelPath))
                    BuildCompletePrefab(modelPath, prefabPath);
            }
        }

        /// <summary>Entry point for -executeMethod command-line launch (CatTail only).</summary>
        public static void RunSetup()
        {
            EditorApplication.delayCall += () =>
            {
                Debug.Log("[CatTailSetup] CLI-triggered setup starting...");
                try
                {
                    BuildCompletePrefab();
                    SetupAnimatorController();
                    RunSceneSetup();
                    Debug.Log("[CatTailSetup] All done!");
                }
                catch (System.Exception e)
                {
                    Debug.LogError("[CatTailSetup] Failed: " + e);
                }
            };
        }

        /// <summary>CLI entry point: builds prefabs for ALL models (CatTail + GF + AL).
        /// Executes synchronously — required for -batchmode where callbacks
        /// (delayCall/update) are lost on script recompilation.</summary>
        public static void BuildAllModelsCli()
        {
            Debug.Log("[CatTailSetup] CLI-triggered BuildAllModels starting...");
            try
            {
                BuildCompletePrefab();
                foreach (var (modelPath, prefabPath) in ExtraModels)
                {
                    if (System.IO.File.Exists(modelPath))
                        BuildCompletePrefab(modelPath, prefabPath);
                    else
                        Debug.LogWarning($"[CatTailSetup] Skipping missing: {modelPath}");
                }
                Debug.Log("[CatTailSetup] BuildAllModels complete!");
            }
            catch (System.Exception e)
            {
                Debug.LogError("[CatTailSetup] BuildAllModels failed: " + e);
            }
        }
    }
#endif
}
