using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Live2D.Cubism.Rendering.URP
{
    /// <summary>
    /// URP ScriptableRendererFeature that applies GPU chroma key in-place on the camera output.
    ///
    /// Reads the camera color target, runs ChromaKey.shader to set alpha=0 on chroma-key
    /// pixels, and writes back. This runs BEFORE transparent rendering so the alpha channel
    /// is correct when TransparentWindow reads the RenderTexture for DWM compositing.
    ///
    /// Registration: Auto-registered by ChromaKeyFeatureAutoRegister.cs on project load.
    /// Manual: Add to PC_Renderer.asset → Renderer Features list.
    ///
    /// Chroma key color: GREEN (0,1,0) — must match Camera.backgroundColor and
    /// TransparentWindow._chromaKeyColor.
    /// </summary>
    public sealed class ChromaKeyRenderFeature : ScriptableRendererFeature
    {
        [System.Serializable]
        public class Settings
        {
            [Tooltip("Chroma key color (must match camera background and TransparentWindow).")]
            public Color chromaColor = new Color(0f, 1f, 0f, 1f); // Green

            [Tooltip("Tolerance in RGB space (0 = exact match only).")]
            [Range(0f, 1f)]
            public float tolerance = 0.25f;

            [Tooltip("Soft edge width for anti-aliased edges.")]
            [Range(0f, 0.5f)]
            public float softness = 0.05f;
        }

        public Settings settings = new Settings();

        private ChromaKeyPass _pass;
        private Material _material;

        public override void Create()
        {
            var shader = Shader.Find("Hidden/AstralFox/ChromaKey");
            if (shader == null)
            {
                Debug.LogWarning("[ChromaKey] Shader 'Hidden/AstralFox/ChromaKey' not found. Feature disabled.");
                return;
            }

            _material = CoreUtils.CreateEngineMaterial(shader);
            _pass = new ChromaKeyPass(_material, settings);
            // Run after opaque geometry but before transparents + post-processing
            _pass.renderPassEvent = RenderPassEvent.AfterRenderingOpaques;
        }

        public override void AddRenderPasses(ScriptableRenderer renderer, ref RenderingData renderingData)
        {
            if (_pass == null || _material == null) return;
            // Only apply to Game and SceneView cameras (skip UI/overlay cameras)
            if (renderingData.cameraData.cameraType != CameraType.Game
                && renderingData.cameraData.cameraType != CameraType.SceneView)
                return;

            _pass.UpdateMaterialProperties(settings);
            renderer.EnqueuePass(_pass);
        }

        protected override void Dispose(bool disposing)
        {
            if (_pass != null) { _pass.Dispose(); _pass = null; }
            CoreUtils.Destroy(_material);
            _material = null;
        }

        /// <summary>
        /// In-place chroma key render pass. Uses a temporary RT internally
        /// (URP doesn't allow read+write same RT in a single Blit).
        /// </summary>
        private sealed class ChromaKeyPass : ScriptableRenderPass
        {
            private Material _material;
            private Settings _settings;
            private static readonly int TempRTId = Shader.PropertyToID("_ChromaKeyTempRT");
            private static readonly int ChromaColorId = Shader.PropertyToID("_ChromaColor");
            private static readonly int ToleranceId = Shader.PropertyToID("_Tolerance");
            private static readonly int SoftnessId = Shader.PropertyToID("_Softness");

            public ChromaKeyPass(Material material, Settings settings)
            {
                _material = material;
                _settings = settings;
                profilingSampler = new ProfilingSampler("AstralFox ChromaKey");
            }

            public void UpdateMaterialProperties(Settings settings)
            {
                if (_material == null) return;
                _material.SetColor(ChromaColorId, settings.chromaColor);
                _material.SetFloat(ToleranceId, settings.tolerance);
                _material.SetFloat(SoftnessId, settings.softness);
            }

            [System.Obsolete] // Using legacy Execute for URP compatibility
            public override void Execute(ScriptableRenderContext context, ref RenderingData renderingData)
            {
                if (_material == null) return;

                var cmd = CommandBufferPool.Get("AstralFox ChromaKey");
                var cameraTarget = renderingData.cameraData.renderer.cameraColorTargetHandle;

                // Allocate temporary RT matching camera target
                var desc = renderingData.cameraData.cameraTargetDescriptor;
                desc.depthBufferBits = 0; // no depth needed for fullscreen blit
                cmd.GetTemporaryRT(TempRTId, desc, FilterMode.Bilinear);

                // Camera → Temp (through chroma key shader: RGB preserved, alpha computed)
                cmd.Blit(cameraTarget, TempRTId, _material, 0);
                // Temp → Camera (now has correct alpha channel)
                cmd.Blit(TempRTId, cameraTarget);

                cmd.ReleaseTemporaryRT(TempRTId);
                context.ExecuteCommandBuffer(cmd);
                CommandBufferPool.Release(cmd);
            }

            public void Dispose()
            {
                _material = null;
            }
        }
    }
}
