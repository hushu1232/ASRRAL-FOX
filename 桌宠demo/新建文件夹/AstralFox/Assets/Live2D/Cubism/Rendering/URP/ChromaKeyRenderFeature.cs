using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
#if UNITY_6000_0_OR_NEWER
using UnityEngine.Rendering.RenderGraphModule;
#endif

namespace Live2D.Cubism.Rendering.URP
{
    /// <summary>
    /// URP ScriptableRendererFeature: GPU chroma key registration point.
    ///
    /// The actual chroma key is applied by TransparentWindow.PerPixelAlphaLoop()
    /// via manual Graphics.Blit with ChromaKey.shader. This RenderFeature serves
    /// as a registration marker so the Editor auto-registration script can ensure
    /// the feature is present in the URP Renderer asset.
    ///
    /// The Blit approach inside TransparentWindow is more flexible than a URP
    /// render pass because it can fall back to CPU chroma key without
    /// Unity-version-specific API dependencies.
    /// </summary>
    public sealed class ChromaKeyRenderFeature : ScriptableRendererFeature
    {
        [System.Serializable]
        public class Settings
        {
            [Tooltip("Chroma key color (must match camera background).")]
            public Color chromaColor = new Color(0f, 1f, 0f, 1f);
            [Range(0f, 1f)] public float tolerance = 0.25f;
            [Range(0f, 0.5f)] public float softness = 0.05f;
        }

        public Settings settings = new Settings();

        private ChromaKeyMarkerPass _pass;

        public override void Create()
        {
            _pass = new ChromaKeyMarkerPass();
            _pass.renderPassEvent = RenderPassEvent.AfterRenderingOpaques;
        }

        public override void AddRenderPasses(ScriptableRenderer renderer, ref RenderingData renderingData)
        {
            if (_pass == null) return;
            if (renderingData.cameraData.cameraType != CameraType.Game
                && renderingData.cameraData.cameraType != CameraType.SceneView)
                return;
            renderer.EnqueuePass(_pass);
        }

        protected override void Dispose(bool disposing)
        {
            _pass = null;
        }

        /// <summary>
        /// Minimal pass that only serves as a URP registration marker.
        /// Actual chroma key is done by TransparentWindow via Graphics.Blit.
        /// </summary>
        private sealed class ChromaKeyMarkerPass : ScriptableRenderPass
        {
            public ChromaKeyMarkerPass()
            {
                profilingSampler = new ProfilingSampler("AstralFox ChromaKey (marker)");
            }

#if UNITY_6000_0_OR_NEWER
            public override void RecordRenderGraph(RenderGraph renderGraph, ContextContainer frameData)
            {
                // No-op: chroma key is applied by TransparentWindow.PerPixelAlphaLoop()
                // via Graphics.Blit with Hidden/AstralFox/ChromaKey shader.
                // This pass exists so the URP Renderer asset has the feature registered.
            }
#else
            public override void Execute(ScriptableRenderContext context, ref RenderingData renderingData)
            {
                // No-op for Unity 2022: chroma key handled by TransparentWindow.
            }
#endif
        }
    }
}
