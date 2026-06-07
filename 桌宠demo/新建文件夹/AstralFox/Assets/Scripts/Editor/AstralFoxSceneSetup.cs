using AstralFox.Platform;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using AstralFox.Animation;
using AstralFox.Audio;
using AstralFox.Voice;
#if CUBISM_SDK_PRESENT
using Live2D.Cubism.Core;
using Live2D.Cubism.Framework;
using Live2D.Cubism.Framework.Raycasting;
#endif

namespace AstralFox.Editor
{
    /// <summary>
    /// Editor utility to quickly set up the AstralFox scene with
    /// the correct GameObject hierarchy, camera, placeholder fox,
    /// and animation components.
    /// </summary>
    public static class AstralFoxSceneSetup
    {
        private const string MenuPath = "GameObject/AstralFox/Setup Scene";
        private const string MenuPath2 = "AstralFox/Setup Desktop Pet Scene";

        [MenuItem(MenuPath2, false, 0)]
        public static void SetupScene()
        {
            Scene activeScene = SceneManager.GetActiveScene();

            // --- Create root GameObject ---
            GameObject root = CreateOrGet("AstralFoxRoot");

            // --- Configure Main Camera ---
            GameObject camGo = CreateOrGet("Main Camera");
            camGo.transform.SetParent(root.transform, false);

            Camera cam = camGo.GetComponent<Camera>();
            if (cam == null) cam = camGo.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(1f, 0f, 1f, 1f);
            cam.orthographic = true;
            cam.orthographicSize = 10f; // wide enough for full character in any aspect ratio
            cam.nearClipPlane = 0.1f;
            cam.farClipPlane = 100f;
            cam.depth = -1;
            camGo.tag = "MainCamera";

            // URP camera data
            var urpDataType = System.Type.GetType(
                "UnityEngine.Rendering.Universal.UniversalAdditionalCameraData, Unity.RenderPipelines.Universal.Runtime");
            if (urpDataType != null)
            {
                var existingURP = camGo.GetComponent(urpDataType);
                if (existingURP == null) existingURP = camGo.AddComponent(urpDataType);
                try
                {
                    urpDataType.GetProperty("renderPostProcessing")?.SetValue(existingURP, false);
                    urpDataType.GetProperty("renderShadows")?.SetValue(existingURP, false);
                }
                catch { }
            }

            // --- Add TransparentWindow ---
            var tw = root.GetComponent<TransparentWindow>();
            if (tw == null) tw = root.AddComponent<TransparentWindow>();

            // --- Add DesktopCameraSetup to camera ---
            // AudioListener — required for TTS voice output
            var listener = camGo.GetComponent<AudioListener>();
            if (listener == null) listener = camGo.AddComponent<AudioListener>();

            var dcs = camGo.GetComponent<DesktopCameraSetup>();
            if (dcs == null) dcs = camGo.AddComponent<DesktopCameraSetup>();

            // --- Directional Light (used for scene illumination) ---
            var dirLightGo = GameObject.Find("Directional Light");
            if (dirLightGo == null)
            {
                dirLightGo = new GameObject("Directional Light");
                Undo.RegisterCreatedObjectUndo(dirLightGo, "Create Directional Light");
                var light = dirLightGo.AddComponent<Light>();
                light.type = LightType.Directional;
                light.intensity = 1.5f;
                light.transform.rotation = Quaternion.Euler(50, -30, 0);
            }
            dirLightGo.transform.SetParent(root.transform, false);

            // ========== Phase 2: Animation System ==========

            // --- Animator (kept on root for backward compat; Live2D_Model has its own) ---
            var animator = root.GetComponent<Animator>();
            if (animator == null) animator = root.AddComponent<Animator>();
            animator.applyRootMotion = false;
            animator.updateMode = AnimatorUpdateMode.UnscaledTime;

            // Try to assign the Animator Controller
            string ctrlPath = "Assets/Resources/FoxAnimator.controller";
            var ctrl = AssetDatabase.LoadAssetAtPath<AnimatorController>(ctrlPath);
            if (ctrl != null)
                animator.runtimeAnimatorController = ctrl;

            // --- CubismParameterDriver (backward compat; Live2D_Model has its own) ---
#if CUBISM_SDK_PRESENT
            var driver = root.GetComponent<CubismParameterDriver>();
            if (driver == null) driver = root.AddComponent<CubismParameterDriver>();
#endif

            // --- FoxEmotionController (backward compat; Live2D_Model has its own) ---
#if CUBISM_SDK_PRESENT
            var emotion = root.GetComponent<FoxEmotionController>();
            if (emotion == null) emotion = root.AddComponent<FoxEmotionController>();
#endif

            // --- FoxAnimationController (backward compat; Live2D_Model has its own) ---
#if CUBISM_SDK_PRESENT
            var animCtrl = root.GetComponent<FoxAnimationController>();
            if (animCtrl == null) animCtrl = root.AddComponent<FoxAnimationController>();
#endif

            // --- PetAnimationManager (dual-model switching) ---
            var petAnimMgr = root.GetComponent<PetAnimationManager>();
            if (petAnimMgr == null) petAnimMgr = root.AddComponent<PetAnimationManager>();

            // ========== Phase 3: Voice Pipeline ==========

            // --- MicrophoneCapture ---
            var mic = root.GetComponent<MicrophoneCapture>();
            if (mic == null) mic = root.AddComponent<MicrophoneCapture>();

            // --- VoiceActivityDetector ---
            var vad = root.GetComponent<VoiceActivityDetector>();
            if (vad == null) vad = root.AddComponent<VoiceActivityDetector>();

            // --- WakeWordDetector ---
            var wake = root.GetComponent<WakeWordDetector>();
            if (wake == null) wake = root.AddComponent<WakeWordDetector>();

            // --- BackendClient ---
            var backend = root.GetComponent<BackendClient>();
            if (backend == null) backend = root.AddComponent<BackendClient>();

            // --- VoiceManager ---
            var voiceMgr = root.GetComponent<VoiceManager>();
            if (voiceMgr == null) voiceMgr = root.AddComponent<VoiceManager>();

            // --- MockVoicePipeline (for offline testing) ---
            var mock = root.GetComponent<MockVoicePipeline>();
            if (mock == null) mock = root.AddComponent<MockVoicePipeline>();

            // ========== Phase 5: TTS + LipSync ==========

            // --- AudioSource (for TTS playback) ---
            var audioSrc = root.GetComponent<AudioSource>();
            if (audioSrc == null) audioSrc = root.AddComponent<AudioSource>();
            audioSrc.playOnAwake = false;
            audioSrc.loop = false;
            audioSrc.spatialBlend = 0f;
            audioSrc.bypassEffects = true;
            audioSrc.bypassListenerEffects = true;
            audioSrc.bypassReverbZones = true;

            // --- TTSPlayer ---
            var ttsPlayer = root.GetComponent<TTSPlayer>();
            if (ttsPlayer == null) ttsPlayer = root.AddComponent<TTSPlayer>();

            // --- LipSync ---
            var lipSync = root.GetComponent<LipSync>();
            if (lipSync == null) lipSync = root.AddComponent<LipSync>();

            // --- Audio2Face (advanced lip sync from audio amplitude) ---
            var a2f = root.GetComponent<Audio2Face>();
            if (a2f == null) a2f = root.AddComponent<Audio2Face>();

            // ========== Phase 6: PAD Emotion + Data Store ==========

            // --- PADEmotionEngine ---
            var padEngine = root.GetComponent<PADEmotionEngine>();
            if (padEngine == null) padEngine = root.AddComponent<PADEmotionEngine>();

            // --- AppLifecycle (data persistence) ---
            var lifecycle = root.GetComponent<AppLifecycle>();
            if (lifecycle == null) lifecycle = root.AddComponent<AppLifecycle>();

            // ========== Phase 7: Sound Effects ==========

            // --- SoundEffectManager ---
            var sfx = root.GetComponent<SoundEffectManager>();
            if (sfx == null) sfx = root.AddComponent<SoundEffectManager>();

            // ========== Phase 1: Fox & Interaction ==========

            // --- FoxPlaceholder (container for model children) ---
            GameObject foxGo = CreateOrGet("FoxPlaceholder");
            foxGo.transform.SetParent(root.transform, false);
            foxGo.transform.localPosition = new Vector3(0f, 0f, 0f);

            // --- Create model child GameObject ---
            GameObject live2DGo = CreateOrGetChild(foxGo, "Live2D_Model");
            live2DGo.transform.localPosition = Vector3.zero;
            live2DGo.transform.localScale = Vector3.one * 0.5f; // scale down to fit camera
            live2DGo.SetActive(false); // hidden until PetAnimationManager activates it

            bool usingCubismModel = false;
#if CUBISM_SDK_PRESENT
            // Try to find an imported Cubism model prefab
            // Priority: YouXiaoMiao (v5 Core 6) → any CubismModel prefab
            var cubismPrefab = AssetDatabase.LoadAssetAtPath<GameObject>(
                "Assets/Live2D/Models/YouXiaoMiao/悠小喵.prefab");
            if (cubismPrefab == null)
                cubismPrefab = FindCubismModelPrefab();
            if (cubismPrefab != null)
            {
                // --- Clean up old 2D fallback leftover from a previous setup ---
                var oldSr = foxGo.GetComponent<SpriteRenderer>();
                if (oldSr != null) Object.DestroyImmediate(oldSr);
                var oldCol2D = foxGo.GetComponent<BoxCollider2D>();
                if (oldCol2D != null) Object.DestroyImmediate(oldCol2D);

                // Clear any old children of Live2D_Model
                foreach (Transform child in live2DGo.transform)
                    Object.DestroyImmediate(child.gameObject);

                // Instantiate Cubism model under Live2D_Model
                var modelInstance = (GameObject)PrefabUtility.InstantiatePrefab(cubismPrefab, live2DGo.transform);
                modelInstance.transform.localPosition = Vector3.zero;
                modelInstance.transform.localScale = Vector3.one;
                modelInstance.name = cubismPrefab.name;

                // Ensure CubismUpdateController exists
                var updateCtrl = live2DGo.GetComponentInChildren<CubismUpdateController>();
                if (updateCtrl == null && modelInstance.GetComponent<CubismModel>() != null)
                    modelInstance.AddComponent<CubismUpdateController>();

                // Add CubismRaycastable for click detection
                var raycastable = modelInstance.GetComponent<CubismRaycastable>();
                if (raycastable == null)
                    modelInstance.AddComponent<CubismRaycastable>();

                // --- Live2D_Model animation stack ---
                SetupLive2DModelComponents(live2DGo, ctrl);

                usingCubismModel = true;
                live2DGo.SetActive(true);
                Debug.Log($"[AstralFox] Using Cubism model: {cubismPrefab.name} (under Live2D_Model)");
            }
#endif
            if (!usingCubismModel)
            {
                // Fallback: character portrait sprite
                SpriteRenderer sr = foxGo.GetComponent<SpriteRenderer>();
                if (sr == null) sr = foxGo.AddComponent<SpriteRenderer>();
                sr.sortingOrder = 1;

                if (sr.sprite == null)
                {
                    // Load character portrait (acceptable white bg for demo)
                    var tex = AssetDatabase.LoadAssetAtPath<Texture2D>(
                        "Assets/Textures/character_portrait.jpg");
                    if (tex != null)
                    {
                        sr.sprite = Sprite.Create(tex,
                            new Rect(0, 0, tex.width, tex.height),
                            new Vector2(0.5f, 0.5f), 300f);
                        Debug.Log("[AstralFox] Using character portrait.");
                    }
                    else
                    {
                        sr.sprite = CreatePlaceholderSprite();
                    }
                }

                var col = foxGo.GetComponent<BoxCollider2D>();
                if (col == null) col = foxGo.AddComponent<BoxCollider2D>();
                col.isTrigger = false;
                col.size = new Vector2(2f, 3f);

                // Still set up Live2D_Model with animation components (for when model is imported later)
                SetupLive2DModelComponents(live2DGo, ctrl);
            }

            // --- FoxSimpleMovement ---
            var movement = root.GetComponent<FoxSimpleMovement>();
            if (movement == null) movement = root.AddComponent<FoxSimpleMovement>();

            // --- FoxInteraction ---
            var fi = root.GetComponent<FoxInteraction>();
            if (fi == null) fi = root.AddComponent<FoxInteraction>();

            // --- Configure Player Settings ---
            ConfigurePlayerSettings();

            // --- Mark scene dirty (Edit Mode only) ---
            if (!EditorApplication.isPlayingOrWillChangePlaymode)
            {
                EditorSceneManager.MarkSceneDirty(activeScene);
            }

            string animStatus = (ctrl != null)
                ? "Animator Controller: assigned"
                : "Animator Controller: NOT FOUND — run AstralFox > Setup Animator Controller first";

            Debug.Log("[AstralFox] Scene setup complete!\n" +
                      "  Root: AstralFoxRoot\n" +
                      "    ├── Main Camera (ortho, magenta bg)\n" +
                      "    ├── TransparentWindow\n" +
                      "    ├── DesktopCameraSetup\n" +
                      "    ├── PetAnimationManager\n" +
                      "    ├── Live2DAnimator\n" +
                      "    ├── FoxInteraction\n" +
                      "    ├── FoxSimpleMovement\n" +
                      "    ├── MicrophoneCapture\n" +
                      "    ├── VoiceActivityDetector\n" +
                      "    ├── WakeWordDetector (mock: F12 to trigger)\n" +
                      "    ├── BackendClient\n" +
                      "    ├── TTSPlayer\n" +
                      "    ├── LipSync\n" +
                      "    ├── VoiceManager\n" +
                      "    ├── PADEmotionEngine (pleasure/arousal/dominance)\n" +
                      "    ├── AppLifecycle (data persistence)\n" +
                      "    ├── SoundEffectManager\n" +
                      "    ├── AudioSource (TTS)\n" +
                      "    ├── MockVoicePipeline\n" +
                      "    └── FoxPlaceholder (container)\n" +
                      "        └── Live2D_Model ← Cubism prefab + Live2DAnimator\n" +
                      "              + CubismParameterDriver + FoxAnimationController\n" +
                      "              + FoxEmotionController + Animator (FoxAnimator.controller)\n" +
                      $"  {animStatus}\n\n" +
                      "Voice pipeline: Microphone → VAD → WakeWord → Backend → TTSPlayer → LipSync → Mouth\n" +
                      "Emotion: PAD(3D) → PetEmotion(5 states) → parameter/morph animation + Particle color\n" +
                      "Storage: JSON file-based, auto-save on quit\n" +
                      "SFX: Procedural placeholder sounds (replace with real audio files)\n" +
                      "Interrupt: Mic level > threshold during TTS → stop playback → listen again\n" +
                      "Mock mode: Press F12 to simulate wake word, speak to test VAD");
        }

        private static GameObject CreateOrGet(string name)
        {
            GameObject go = GameObject.Find(name);
            if (go == null)
            {
                go = new GameObject(name);
                Undo.RegisterCreatedObjectUndo(go, "Create " + name);
            }
            return go;
        }

        private static GameObject CreateOrGetChild(GameObject parent, string name)
        {
            Transform existing = parent.transform.Find(name);
            if (existing != null) return existing.gameObject;
            GameObject go = new GameObject(name);
            Undo.RegisterCreatedObjectUndo(go, "Create " + name);
            go.transform.SetParent(parent.transform, false);
            return go;
        }

        private static void SetupLive2DModelComponents(GameObject live2DGo, AnimatorController ctrl)
        {
            // Animator (on Live2D_Model, with FoxAnimator controller)
            var modelAnimator = live2DGo.GetComponent<Animator>();
            if (modelAnimator == null) modelAnimator = live2DGo.AddComponent<Animator>();
            modelAnimator.applyRootMotion = false;
            modelAnimator.updateMode = AnimatorUpdateMode.UnscaledTime;
            if (ctrl != null && modelAnimator.runtimeAnimatorController == null)
                modelAnimator.runtimeAnimatorController = ctrl;

            // CubismParameterDriver
#if CUBISM_SDK_PRESENT
            var modelDriver = live2DGo.GetComponent<CubismParameterDriver>();
            if (modelDriver == null) modelDriver = live2DGo.AddComponent<CubismParameterDriver>();
#endif

            // FoxEmotionController
#if CUBISM_SDK_PRESENT
            var modelEmotion = live2DGo.GetComponent<FoxEmotionController>();
            if (modelEmotion == null) modelEmotion = live2DGo.AddComponent<FoxEmotionController>();
#endif

            // FoxAnimationController
#if CUBISM_SDK_PRESENT
            var modelAnimCtrl = live2DGo.GetComponent<FoxAnimationController>();
            if (modelAnimCtrl == null) modelAnimCtrl = live2DGo.AddComponent<FoxAnimationController>();
#endif

            // Live2DAnimator (IPetAnimator adapter)
            var live2DAnim = live2DGo.GetComponent<Live2DAnimator>();
            if (live2DAnim == null) live2DAnim = live2DGo.AddComponent<Live2DAnimator>();
        }

        /// <summary>
        /// Creates a fallback sprite when no Live2D model is available.
        /// Draws a chibi anime girl (星尘) with silver-white hair, star-blue accents,
        /// and ether crystal pendant — procedurally.
        /// </summary>
        private static Sprite CreatePlaceholderSprite()
        {
            int size = 512;
            Texture2D tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
            var colors = new Color[size * size];
            for (int i = 0; i < colors.Length; i++) colors[i] = Color.clear;

            float cx = size * 0.5f;
            float hy = size * 0.42f; // head center Y

            // 星尘 color palette
            Color skinClr    = new Color(0.98f, 0.90f, 0.84f, 1f); // warm peachy
            Color skinShade  = new Color(0.90f, 0.80f, 0.74f, 1f); // neck shadow
            Color hairClr    = new Color(0.86f, 0.89f, 0.95f, 1f); // silver-white
            Color hairShade  = new Color(0.78f, 0.81f, 0.88f, 1f); // hair shadow
            Color hairTipClr = new Color(0.50f, 0.65f, 0.88f, 1f); // star-blue tips
            Color eyeBase    = new Color(0.40f, 0.58f, 0.88f, 1f); // star-blue iris
            Color eyeDark    = new Color(0.15f, 0.18f, 0.30f, 1f); // eye outline/pupil
            Color eyeSparkle = new Color(0.95f, 0.90f, 0.60f, 1f); // gold star highlight
            Color mouthClr   = new Color(0.80f, 0.48f, 0.48f, 0.7f); // soft pink
            Color blushClr   = new Color(0.96f, 0.65f, 0.65f, 0.35f); // cheek blush
            Color outfitClr  = new Color(0.22f, 0.24f, 0.40f, 1f); // dark navy outfit
            Color outfitAcc  = new Color(0.45f, 0.60f, 0.86f, 1f); // star-blue trim
            Color pendantGlow = new Color(0.20f, 0.88f, 0.82f, 0.9f); // ether crystal
            Color starClr    = new Color(0.88f, 0.82f, 0.55f, 1f); // gold particles
            Color starClr2   = new Color(0.55f, 0.70f, 0.92f, 0.8f); // blue particles

            void SetPixelSafe(int x, int y, Color c)
            {
                if (x < 0 || x >= size || y < 0 || y >= size) return;
                var e = colors[y * size + x];
                float sa = c.a;
                colors[y * size + x] = new Color(
                    e.r + (c.r - e.r) * sa, e.g + (c.g - e.g) * sa,
                    e.b + (c.b - e.b) * sa, Mathf.Max(e.a, c.a));
            }

            void FillEllipse(float ox, float oy, float rx, float ry, Color c)
            {
                for (int py = 0; py < size; py++)
                    for (int px = 0; px < size; px++)
                        if (((px - ox) * (px - ox) / (rx * rx) + (py - oy) * (py - oy) / (ry * ry)) <= 1f)
                            SetPixelSafe(px, py, c);
            }

            void FillCircle(float ox, float oy, float r, Color c)
            {
                float rsq = r * r;
                for (int py = 0; py < size; py++)
                    for (int px = 0; px < size; px++)
                        if ((px - ox) * (px - ox) + (py - oy) * (py - oy) <= rsq)
                            SetPixelSafe(px, py, c);
            }

            // ── Hair (back layer — long flowing strands) ──
            // Left hair mass
            FillEllipse(cx - size * 0.14f, hy - size * 0.01f, size * 0.13f, size * 0.28f, hairClr);
            // Right hair mass
            FillEllipse(cx + size * 0.14f, hy - size * 0.01f, size * 0.13f, size * 0.28f, hairClr);
            // Back hair (behind head)
            FillEllipse(cx, hy - size * 0.02f, size * 0.16f, size * 0.25f, hairClr);

            // ── Body / outfit (below head) ──
            FillEllipse(cx, hy + size * 0.30f, size * 0.11f, size * 0.12f, outfitClr);
            // Collar / shoulders
            FillEllipse(cx, hy + size * 0.18f, size * 0.14f, size * 0.06f, outfitClr);
            // Star-blue trim on collar
            for (int py = (int)(hy + size * 0.13f); py < (int)(hy + size * 0.17f); py++)
                for (int px = (int)(cx - size * 0.10f); px < (int)(cx + size * 0.10f); px++)
                {
                    float dx = px - cx, dy = py - (hy + size * 0.16f);
                    if (dx * dx / (size * 0.07f * size * 0.07f) + dy * dy / (size * 0.015f * size * 0.015f) <= 1f)
                        SetPixelSafe(px, py, outfitAcc);
                }

            // ── Neck ──
            FillEllipse(cx, hy + size * 0.12f, size * 0.04f, size * 0.05f, skinShade);

            // ── Head / face ──
            float headRx = size * 0.17f;
            float headRy = size * 0.19f;
            FillEllipse(cx, hy, headRx, headRy, skinClr);

            // ── Hair (top / bangs) ──
            // Main bangs covering forehead
            FillEllipse(cx, hy - size * 0.13f, size * 0.18f, size * 0.08f, hairClr);
            // Side bangs
            FillEllipse(cx - size * 0.13f, hy - size * 0.07f, size * 0.07f, size * 0.10f, hairClr);
            FillEllipse(cx + size * 0.13f, hy - size * 0.07f, size * 0.07f, size * 0.10f, hairClr);
            // Bang trim (star-blue tips on bottom edge of bangs)
            for (int py = (int)(hy - size * 0.09f); py < (int)(hy - size * 0.05f); py++)
                for (int px = (int)(cx - size * 0.16f); px < (int)(cx + size * 0.16f); px++)
                {
                    float dx = (px - cx) / (size * 0.16f);
                    float dy = (py - (hy - size * 0.08f)) / (size * 0.06f);
                    if (Mathf.Abs(dx * dx * 2f + dy * dy) < 0.5f &&
                        colors[py * size + px].r > 0.7f) // only on hair pixels
                        SetPixelSafe(px, py, hairTipClr);
                }

            // ── Eyes (large anime-style) ──
            float eyeY = hy - size * 0.01f;
            float eyeSpacing = size * 0.07f;
            float eyeW = size * 0.045f;
            float eyeH = size * 0.06f;

            void DrawAnimeEye(float ex, float ey)
            {
                // Eye white
                FillEllipse(ex, ey, eyeW, eyeH, Color.white);
                // Iris
                FillCircle(ex, ey + size * 0.005f, eyeW * 0.65f, eyeBase);
                // Pupil
                FillCircle(ex, ey + size * 0.005f, eyeW * 0.30f, eyeDark);
                // Upper lash line
                for (int py = (int)(ey - eyeH); py < (int)(ey + eyeH); py++)
                    for (int px = (int)(ex - eyeW); px < (int)(ex + eyeW); px++)
                    {
                        float dx = px - ex, dy = py - ey;
                        if (Mathf.Abs(dy + eyeH * 0.2f) < size * 0.004f &&
                            dx * dx / (eyeW * eyeW) + dy * dy / (eyeH * eyeH) <= 1.1f &&
                            dy < 0)
                            SetPixelSafe(px, py, eyeDark);
                    }
                // Primary highlight
                FillCircle(ex - eyeW * 0.15f, ey - eyeH * 0.20f, eyeW * 0.18f, Color.white);
                // Star-shaped sparkle highlight (small)
                FillCircle(ex + eyeW * 0.25f, ey - eyeH * 0.10f, eyeW * 0.10f, eyeSparkle);
            }

            DrawAnimeEye(cx - eyeSpacing, eyeY);
            DrawAnimeEye(cx + eyeSpacing, eyeY);

            // ── Eyebrows (soft arcs) ──
            for (int i = 0; i < 2; i++)
            {
                float bx = cx + (i == 0 ? -eyeSpacing : eyeSpacing);
                float by = eyeY - eyeH - size * 0.015f;
                for (int py = (int)(by - size * 0.005f); py < (int)(by + size * 0.01f); py++)
                    for (int px = (int)(bx - eyeW * 0.5f); px < (int)(bx + eyeW * 0.5f); px++)
                    {
                        float dx = px - bx, dy = py - by;
                        float arch = -Mathf.Abs(dx) * 0.2f;
                        if (Mathf.Abs(dy - arch) < size * 0.003f && Mathf.Abs(dx) < eyeW * 0.7f)
                            SetPixelSafe(px, py, hairShade);
                    }
            }

            // ── Blush ──
            float blushY = eyeY + eyeH * 0.6f;
            FillEllipse(cx - eyeSpacing * 1.5f, blushY, eyeW * 0.8f, eyeH * 0.3f, blushClr);
            FillEllipse(cx + eyeSpacing * 1.5f, blushY, eyeW * 0.8f, eyeH * 0.3f, blushClr);

            // ── Mouth (soft smile) ──
            float mouthY = hy + size * 0.07f;
            for (int py = 0; py < size; py++)
                for (int px = 0; px < size; px++)
                {
                    float mx = px - cx, my = py - mouthY;
                    float curve = mx * mx * 0.0015f;
                    if (Mathf.Abs(my - curve - size * 0.003f) < size * 0.003f &&
                        Mathf.Abs(mx) < size * 0.03f && my > -size * 0.01f)
                        SetPixelSafe(px, py, mouthClr);
                }
            // Tiny nose hint
            FillCircle(cx, hy + size * 0.03f, size * 0.006f, new Color(0.8f, 0.7f, 0.65f, 0.3f));

            // ── Ether crystal pendant (chest) ──
            float pendantY = hy + size * 0.19f;
            // Crystal shape (diamond-ish)
            for (int py = (int)(pendantY - size * 0.025f); py < (int)(pendantY + size * 0.025f); py++)
                for (int px = (int)(cx - size * 0.02f); px < (int)(cx + size * 0.02f); px++)
                {
                    float dx = Mathf.Abs(px - cx), dy = Mathf.Abs(py - pendantY);
                    if (dx / (size * 0.018f) + dy / (size * 0.025f) <= 1f)
                        SetPixelSafe(px, py, pendantGlow);
                }
            // Crystal core highlight
            FillCircle(cx, pendantY - size * 0.005f, size * 0.008f, Color.white);

            // ── Hair tips (star-blue gradient on flowing side strands) ──
            // Left side strand tips
            for (int py = (int)(hy + size * 0.18f); py < (int)(hy + size * 0.28f); py++)
                for (int px = (int)(cx - size * 0.22f); px < (int)(cx - size * 0.06f); px++)
                {
                    float dy = (py - (hy + size * 0.18f)) / (size * 0.10f);
                    float grad = Mathf.Clamp01(dy);
                    if (colors[py * size + px].r > 0.8f && colors[py * size + px].b > 0.8f) // only on hair
                        SetPixelSafe(px, py, new Color(
                            hairClr.r + (hairTipClr.r - hairClr.r) * grad,
                            hairClr.g + (hairTipClr.g - hairClr.g) * grad,
                            hairClr.b + (hairTipClr.b - hairClr.b) * grad,
                            1f));
                }
            // Right side strand tips
            for (int py = (int)(hy + size * 0.18f); py < (int)(hy + size * 0.28f); py++)
                for (int px = (int)(cx + size * 0.06f); px < (int)(cx + size * 0.22f); px++)
                {
                    float dy = (py - (hy + size * 0.18f)) / (size * 0.10f);
                    float grad = Mathf.Clamp01(dy);
                    if (colors[py * size + px].r > 0.8f && colors[py * size + px].b > 0.8f)
                        SetPixelSafe(px, py, new Color(
                            hairClr.r + (hairTipClr.r - hairClr.r) * grad,
                            hairClr.g + (hairTipClr.g - hairClr.g) * grad,
                            hairClr.b + (hairTipClr.b - hairClr.b) * grad,
                            1f));
                }

            // ── Star particles (AstralFox motif) ──
            void DrawStar(float sx, float sy, float r, Color sc)
            {
                for (int py = 0; py < size; py++)
                    for (int px = 0; px < size; px++)
                    {
                        float dx = px - sx, dy = py - sy;
                        float dist = Mathf.Sqrt(dx * dx + dy * dy);
                        if (dist > r) continue;
                        float angle = Mathf.Atan2(dy, dx);
                        float seg = Mathf.Repeat(angle + Mathf.PI * 0.5f, Mathf.PI * 2f / 5f);
                        if (dist < (seg < Mathf.PI * 2f / 10f ? r : r * 0.4f))
                            SetPixelSafe(px, py, sc);
                    }
            }
            DrawStar(cx - size * 0.22f, hy - size * 0.32f, size * 0.020f, starClr);
            DrawStar(cx + size * 0.20f, hy - size * 0.30f, size * 0.025f, starClr);
            DrawStar(cx + size * 0.08f, hy - size * 0.36f, size * 0.016f, starClr);
            DrawStar(cx - size * 0.10f, hy + size * 0.35f, size * 0.018f, starClr2);
            DrawStar(cx + size * 0.15f, hy + size * 0.32f, size * 0.015f, starClr2);
            DrawStar(cx + size * 0.25f, hy + size * 0.05f, size * 0.012f, starClr);
            DrawStar(cx - size * 0.26f, hy + size * 0.08f, size * 0.010f, starClr2);

            // Write texture
            tex.SetPixels(colors);
            tex.Apply();

            string path = "Assets/Textures/FoxPlaceholder.png";
            byte[] pngData = tex.EncodeToPNG();
            System.IO.File.WriteAllBytes(path, pngData);
            AssetDatabase.Refresh();

            TextureImporter importer = AssetImporter.GetAtPath(path) as TextureImporter;
            if (importer != null)
            {
                importer.textureType = TextureImporterType.Sprite;
                importer.spritePixelsPerUnit = 100;
                importer.filterMode = FilterMode.Bilinear;
                importer.SaveAndReimport();
            }

            return AssetDatabase.LoadAssetAtPath<Sprite>(path);
        }

#if CUBISM_SDK_PRESENT
        private static GameObject FindCubismModelPrefab()
        {
            // Search for imported Cubism model prefabs
            var guids = AssetDatabase.FindAssets("t:Prefab");
            foreach (var guid in guids)
            {
                var path = AssetDatabase.GUIDToAssetPath(guid);
                var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
                if (prefab != null && prefab.GetComponentInChildren<CubismModel>() != null)
                {
                    return prefab;
                }
            }
            return null;
        }
#endif

        private static void ConfigurePlayerSettings()
        {
            // Ensure the window is set up for transparency
            PlayerSettings.runInBackground = true;
            PlayerSettings.visibleInBackground = true;
            PlayerSettings.resizableWindow = false;
            PlayerSettings.fullScreenMode = FullScreenMode.Windowed;

            // Use DX11 for best compatibility
            // PlayerSettings.SetGraphicsAPIs() ... would go here but let's keep it simple

            Debug.Log("[AstralFox] Player Settings configured: runInBackground=true, windowed mode");
        }
    }
}
