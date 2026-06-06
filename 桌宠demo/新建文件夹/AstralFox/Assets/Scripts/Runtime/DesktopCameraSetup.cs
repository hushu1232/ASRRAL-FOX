using UnityEngine;

namespace AstralFox
{
    /// <summary>
    /// Configures the camera for a transparent desktop window (Built-in RP compatible).
    /// Must be attached to the Main Camera alongside TransparentWindow on a root GameObject.
    /// </summary>
    [RequireComponent(typeof(Camera))]
    public sealed class DesktopCameraSetup : MonoBehaviour
    {
        [Header("Camera Setup")]
        [SerializeField]
        private Color _chromaKeyColor = new Color(1f, 0f, 1f, 1f);  // Magenta for chroma key

        [SerializeField, Range(1f, 20f)]
        private float _orthoSize = 10f; // full character view

        [SerializeField]
        private bool _autoConfigure = true;

        private Camera _cam;

        private void Awake()
        {
            _cam = GetComponent<Camera>();
        }

        private void Start()
        {
            if (_autoConfigure)
                ConfigureCamera();
        }

        [ContextMenu("Configure Camera")]
        public void ConfigureCamera()
        {
            if (_cam == null) _cam = GetComponent<Camera>();

            _cam.clearFlags = CameraClearFlags.SolidColor;
            _cam.backgroundColor = _chromaKeyColor;
            _cam.orthographic = true;
            _cam.orthographicSize = _orthoSize;
            _cam.depth = 0;

            // URP additional camera data — only applicable when URP is the active pipeline.
            // In Built-in RP the component either doesn't exist or is harmless, but
            // we guard the call to avoid a missing-type exception when URP is removed.
            TryConfigureURPCameraData();

            Debug.Log($"[DesktopCameraSetup] Camera configured: orthographic, " +
                      $"size={_orthoSize}, chroma=#{ColorUtility.ToHtmlStringRGB(_chromaKeyColor)}");
        }

        private void TryConfigureURPCameraData()
        {
            var urpDataType = System.Type.GetType(
                "UnityEngine.Rendering.Universal.UniversalAdditionalCameraData, Unity.RenderPipelines.Universal.Runtime");
            if (urpDataType == null) return;

            var urpAddCamData = _cam.GetComponent(urpDataType);
            if (urpAddCamData == null) return;

            // Disable post-processing for clean chroma key
            try
            {
                var renderPostProp = urpDataType.GetProperty("renderPostProcessing");
                renderPostProp?.SetValue(urpAddCamData, false);

                var requiresColorProp = urpDataType.GetProperty("requiresColorOption");
                var offEnum = System.Enum.ToObject(requiresColorProp.PropertyType.GetGenericArguments()[0], 1); // CameraOverrideOption.Off
                requiresColorProp?.SetValue(urpAddCamData, offEnum);

                var requiresDepthProp = urpDataType.GetProperty("requiresDepthOption");
                requiresDepthProp?.SetValue(urpAddCamData, offEnum);

                var renderShadowsProp = urpDataType.GetProperty("renderShadows");
                renderShadowsProp?.SetValue(urpAddCamData, false);
            }
            catch
            {
                // Silently ignore — URP camera data is non-critical
            }
        }

        private void OnValidate()
        {
            if (_autoConfigure && Application.isPlaying)
            {
                ConfigureCamera();
            }
        }
    }
}
