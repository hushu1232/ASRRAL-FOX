using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering.Universal;

namespace AstralFox.Editor
{
    /// <summary>
    /// Auto-registers required URP RendererFeatures on project load:
    /// - CubismRenderPassFeature (required for Live2D Cubism rendering)
    /// - ChromaKeyRenderFeature (GPU chroma key for transparent window)
    ///
    /// Without CubismRenderPassFeature, Cubism models will NOT render at all.
    /// </summary>
    [InitializeOnLoad]
    public static class ChromaKeyAutoRegister
    {
        private const string RendererPath = "Assets/URPAsset_Renderer.asset";

        static ChromaKeyAutoRegister()
        {
            EditorApplication.delayCall += RegisterOnce;
        }

        private static void RegisterOnce()
        {
            EditorApplication.delayCall -= RegisterOnce;

            var rendererData = AssetDatabase.LoadAssetAtPath<ScriptableRendererData>(RendererPath);
            if (rendererData == null)
            {
                Debug.LogWarning($"[AutoRegister] URP Renderer not found at: {RendererPath}");
                return;
            }

            bool cubismRegistered = false;
            bool chromaKeyRegistered = false;

            foreach (var feature in rendererData.rendererFeatures)
            {
                if (feature is Live2D.Cubism.Rendering.URP.CubismRenderPassFeature)
                    cubismRegistered = true;
                if (feature is Live2D.Cubism.Rendering.URP.ChromaKeyRenderFeature)
                    chromaKeyRegistered = true;
            }

            if (!cubismRegistered)
            {
                var cubismFeature = ScriptableObject.CreateInstance<Live2D.Cubism.Rendering.URP.CubismRenderPassFeature>();
                cubismFeature.name = "CubismRenderPassFeature";
                AssetDatabase.AddObjectToAsset(cubismFeature, RendererPath);
                rendererData.rendererFeatures.Add(cubismFeature);
                cubismRegistered = true;
                Debug.Log("[AutoRegister] ✓ Registered CubismRenderPassFeature (required for Live2D rendering)");
            }

            if (!chromaKeyRegistered)
            {
                var chromaFeature = ScriptableObject.CreateInstance<Live2D.Cubism.Rendering.URP.ChromaKeyRenderFeature>();
                if (chromaFeature == null)
                {
                    Debug.LogError("[AutoRegister] FAILED: CreateInstance<ChromaKeyRenderFeature>() returned null!");
                }
                else
                {
                    chromaFeature.settings.chromaColor = new Color(0f, 1f, 0f, 1f);
                    chromaFeature.settings.tolerance = 0.25f;
                    chromaFeature.settings.softness = 0.05f;
                    chromaFeature.name = "ChromaKeyRenderFeature";
                    // Must add as sub-asset for serialization to persist
                    AssetDatabase.AddObjectToAsset(chromaFeature, RendererPath);
                    rendererData.rendererFeatures.Add(chromaFeature);
                    chromaKeyRegistered = true;
                    Debug.Log("[AutoRegister] ✓ Registered ChromaKeyRenderFeature");
                }
            }

            if (cubismRegistered && chromaKeyRegistered)
            {
                return;
            }

            EditorUtility.SetDirty(rendererData);
            AssetDatabase.SaveAssets();
        }

        [MenuItem("AstralFox/ChromaKey/Register All Renderer Features")]
        public static void RegisterManually()
        {
            RegisterOnce();
            Debug.Log("[AutoRegister] Manual registration complete.");
        }

        [MenuItem("AstralFox/ChromaKey/Check Registration Status")]
        public static void CheckStatus()
        {
            var rd = AssetDatabase.LoadAssetAtPath<ScriptableRendererData>(RendererPath);
            if (rd == null) { Debug.Log($"[AutoRegister] {RendererPath}: NOT FOUND"); return; }

            bool cubism = false, chroma = false;
            foreach (var f in rd.rendererFeatures)
            {
                if (f is Live2D.Cubism.Rendering.URP.CubismRenderPassFeature) cubism = true;
                if (f is Live2D.Cubism.Rendering.URP.ChromaKeyRenderFeature ck)
                {
                    chroma = true;
                    Debug.Log($"[AutoRegister] ChromaKey: ✓ (color={ck.settings.chromaColor}, tolerance={ck.settings.tolerance})");
                }
            }

            Debug.Log($"[AutoRegister] CubismRenderPassFeature: {(cubism ? "✓ REGISTERED" : "✗ MISSING (Cubism models WILL NOT RENDER)")}");
            Debug.Log($"[AutoRegister] ChromaKeyRenderFeature: {(chroma ? "✓ REGISTERED" : "✗ missing")}");
        }
    }
}
