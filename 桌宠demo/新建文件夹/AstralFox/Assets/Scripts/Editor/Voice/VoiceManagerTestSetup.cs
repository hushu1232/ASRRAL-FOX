using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using AstralFox.Voice;
using AstralFox.Animation;

namespace AstralFox.Editor.Voice
{
    /// <summary>
    /// One-click setup of a test scene for VoiceManager full pipeline testing.
    ///
    /// Creates: Camera, FoxPlaceholder (Live2D model), PetAnimationManager,
    /// VoiceManager (with auto-added MicrophoneCapture, VAD, WakeWordDetector,
    /// BackendClient, TTSPlayer).
    ///
    /// After clicking AstralFox -> Setup Voice E2E Test Scene, just enter
    /// Play Mode and speak. The BackendClient auto-connects to the BFF.
    /// </summary>
    public static class VoiceManagerTestSetup
    {
        private const string MenuPath = "AstralFox/Setup Voice E2E Test Scene";
        private const string PrefabPath = "Assets/Live2D/Models/AzurLane/Akagi/chicheng_5.prefab";

        [MenuItem(MenuPath, false, 101)]
        public static void SetupScene()
        {
            if (Application.isPlaying)
            {
                Debug.LogWarning("[VoiceSetup] Cannot run in Play Mode. Switch to Edit mode first.");
                return;
            }

            Debug.Log("[VoiceSetup] Creating test scene...");

            // Fresh scene
            var scene = EditorSceneManager.NewScene(NewSceneSetup.DefaultGameObjects, NewSceneMode.Single);
            Debug.Log("[VoiceSetup] Created new scene with default camera/light.");

            // ── Configure camera for editor visibility ──
            var cam = Camera.main;
            if (cam != null)
            {
                cam.clearFlags = CameraClearFlags.SolidColor;
                // Use dark gray in editor (not magenta) — model needs to be visible
                cam.backgroundColor = new Color(0.15f, 0.15f, 0.18f, 1f);
                cam.orthographic = true;
                cam.orthographicSize = 5f;
                cam.depth = 0;

                // Ensure AudioListener exists for TTS voice output
                var listener = cam.GetComponent<AudioListener>();
                if (listener == null) cam.gameObject.AddComponent<AudioListener>();

                Debug.Log("[VoiceSetup] Camera configured: orthographic, size=5, dark gray bg.");
            }

            // ── Diagnostic: sanity-check Cube to verify camera renders ──
            var testCube = GameObject.CreatePrimitive(PrimitiveType.Cube);
            testCube.name = "SanityCheckCube";
            // Place cube near center for easy visibility
            testCube.transform.position = new Vector3(0, 0, 0);
            testCube.transform.localScale = new Vector3(1f, 1f, 1f);
            // Bright orange material — easy to see against dark gray bg
            var cubeRenderer = testCube.GetComponent<MeshRenderer>();
            cubeRenderer.sharedMaterial = new Material(Shader.Find("Unlit/Color"));
            cubeRenderer.sharedMaterial.color = new Color(1f, 0.5f, 0f);
            Debug.Log("[VoiceSetup] SanityCheckCube placed at (0,0,0) with bright orange material." +
                " If this cube is not visible, the camera/lighting is broken.");

            // ── Ensure directional light for scene visibility ──
            var existingLight = Object.FindObjectOfType<Light>();
            if (existingLight == null || existingLight.type != LightType.Directional)
            {
                var lightGo = new GameObject("Diagnostic Directional Light");
                var light = lightGo.AddComponent<Light>();
                light.type = LightType.Directional;
                light.intensity = 1.5f;
                light.transform.rotation = Quaternion.Euler(50, -30, 0);
                light.color = Color.white;
                Debug.Log("[VoiceSetup] Created directional light for scene visibility.");
            }
            else
            {
                Debug.Log($"[VoiceSetup] Directional light found: {existingLight.name}, intensity={existingLight.intensity}");
            }

            // ── Diagnostic script for model visibility ──
            var diagGo = new GameObject("ModelVisibilityDebug");
            diagGo.AddComponent<AstralFox.Diagnostics.ModelVisibilityDebug>();
            Debug.Log("[VoiceSetup] Added ModelVisibilityDebug — check Console after entering Play Mode.");

            // ── FoxPlaceholder with Live2D model ──
            var foxGo = new GameObject("FoxPlaceholder");
            var modelPrefab = AssetDatabase.LoadAssetAtPath<GameObject>(PrefabPath);
            if (modelPrefab != null)
            {
                var model = PrefabUtility.InstantiatePrefab(modelPrefab, foxGo.transform) as GameObject;
                model.name = modelPrefab.name; // "cattail"

                // Add Live2DAnimator adapter (RequireComponent auto-adds Animator,
                // CubismParameterDriver, FoxEmotionController, FoxAnimationController)
                if (model.GetComponent<Live2DAnimator>() == null)
                    model.AddComponent<Live2DAnimator>();
                Debug.Log($"[VoiceSetup] Instantiated Live2D model: {PrefabPath} + Live2DAnimator");
            }
            else
            {
                Debug.LogWarning($"[VoiceSetup] Model prefab not found at {PrefabPath}. " +
                    "PetAnimationManager will try to auto-detect a Live2DAnimator in the scene.");
            }

            // ── PetAnimationManager ──
            var petAnimGo = new GameObject("PetAnimationManager");
            petAnimGo.AddComponent<PetAnimationManager>();
            Debug.Log("[VoiceSetup] Created PetAnimationManager.");

            // ── VoiceManager (RequireComponent will auto-add dependencies) ──
            var voiceGo = new GameObject("VoiceManager");
            var voiceManager = voiceGo.AddComponent<VoiceManager>();
            Debug.Log("[VoiceSetup] Created VoiceManager + auto-added dependencies:");

            // Log all auto-added components
            foreach (var comp in voiceGo.GetComponents<Component>())
            {
                if (comp is Transform) continue;
                Debug.Log($"  - {comp.GetType().Name}");
            }

            // Save the scene
            const string sceneDir = "Assets/Scenes";
            if (!AssetDatabase.IsValidFolder(sceneDir))
                AssetDatabase.CreateFolder("Assets", "Scenes");
            var savePath = sceneDir + "/";

            var scenePath = savePath + "VoiceE2ETestScene.unity";
            EditorSceneManager.SaveScene(scene, scenePath);
            Debug.Log($"[VoiceSetup] Scene saved to: {scenePath}");
            Debug.Log("[VoiceSetup] === READY ===");
            Debug.Log("[VoiceSetup] Enter Play Mode and speak to test the full pipeline.");
            Debug.Log("[VoiceSetup] Or call VoiceManager.SimulateWakeWord() from code to force trigger.");
            Debug.Log("[VoiceSetup] Ensure BFF is running: python main.py");
        }
    }
}
