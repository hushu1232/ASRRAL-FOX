using UnityEditor;
using UnityEditor.Rendering.Universal;
using UnityEngine;
using UnityEngine.Rendering.Universal;

namespace AstralFox.Editor
{
    /// <summary>
    /// Auto-registers ChromaKeyRenderFeature into the active URP Renderer asset
    /// on project load. Ensures the GPU chroma key is always active without
    /// requiring manual configuration.
    ///
    /// Checks both PC_Renderer and Mobile_Renderer assets.
    /// Safe to call multiple times — skips if already registered.
    /// </summary>
    [InitializeOnLoad]
    public static class ChromaKeyAutoRegister
    {
        private const string PcRendererPath = "Assets/Settings/PC_Renderer.asset";
        private const string MobileRendererPath = "Assets/Settings/Mobile_Renderer.asset";

        static ChromaKeyAutoRegister()
        {
            EditorApplication.delayCall += RegisterOnce;
        }

        private static void RegisterOnce()
        {
            EditorApplication.delayCall -= RegisterOnce;

            RegisterForRenderer(PcRendererPath);
            RegisterForRenderer(MobileRendererPath);
        }

        private static void RegisterForRenderer(string assetPath)
        {
            var rendererData = AssetDatabase.LoadAssetAtPath<ScriptableRendererData>(assetPath);
            if (rendererData == null)
            {
                Debug.LogWarning($"[ChromaKey] URP Renderer not found at: {assetPath}");
                return;
            }

            // Check if already registered
            var features = rendererData.rendererFeatures;
            foreach (var feature in features)
            {
                if (feature is Live2D.Cubism.Rendering.URP.ChromaKeyRenderFeature existing)
                {
                    // Already registered — update color to green (in case it was magenta before)
                    existing.settings.chromaColor = new Color(0f, 1f, 0f, 1f);
                    EditorUtility.SetDirty(rendererData);
                    return;
                }
            }

            // Not found — add it
            var chromaFeature = ScriptableObject.CreateInstance<Live2D.Cubism.Rendering.URP.ChromaKeyRenderFeature>();
            chromaFeature.settings.chromaColor = new Color(0f, 1f, 0f, 1f); // Green
            chromaFeature.settings.tolerance = 0.25f;
            chromaFeature.settings.softness = 0.05f;

            // Add via ScriptableRendererData API
            rendererData.rendererFeatures.Add(chromaFeature);
            EditorUtility.SetDirty(rendererData);

            // Save the renderer data asset
            AssetDatabase.SaveAssetIfDirty(rendererData);

            Debug.Log($"[ChromaKey] ✓ Registered ChromaKeyRenderFeature in {assetPath}");
        }

        [MenuItem("AstralFox/ChromaKey/Register in URP Renderer")]
        public static void RegisterManually()
        {
            RegisterForRenderer(PcRendererPath);
            RegisterForRenderer(MobileRendererPath);
            Debug.Log("[ChromaKey] Manual registration complete.");
        }

        [MenuItem("AstralFox/ChromaKey/Check Registration Status")]
        public static void CheckStatus()
        {
            foreach (var path in new[] { PcRendererPath, MobileRendererPath })
            {
                var rd = AssetDatabase.LoadAssetAtPath<ScriptableRendererData>(path);
                if (rd == null) { Debug.Log($"[ChromaKey] {path}: NOT FOUND"); continue; }

                bool found = false;
                foreach (var f in rd.rendererFeatures)
                {
                    if (f is Live2D.Cubism.Rendering.URP.ChromaKeyRenderFeature ck)
                    {
                        Debug.Log($"[ChromaKey] {path}: ✓ REGISTERED (color={ck.settings.chromaColor}, tolerance={ck.settings.tolerance})");
                        found = true; break;
                    }
                }
                if (!found) Debug.Log($"[ChromaKey] {path}: ✗ NOT registered");
            }
        }
    }
}
