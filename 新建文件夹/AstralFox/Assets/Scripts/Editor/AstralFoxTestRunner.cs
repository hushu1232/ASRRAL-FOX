using System;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using AstralFox.Animation;

namespace AstralFox.Editor
{
    /// <summary>
    /// Automated test — run via: Tuanjie.exe -batchmode -quit -projectPath ... -executeMethod AstralFox.Editor.AstralFoxTestRunner.Run
    /// </summary>
    public static class AstralFoxTestRunner
    {
        private static int _failCount;
        private static int _passCount;

        private static void Check(bool condition, string name)
        {
            if (condition) { Debug.Log($"  [PASS] {name}"); _passCount++; }
            else { Debug.LogError($"  [FAIL] {name}"); _failCount++; }
        }

        public static void Run()
        {
            Debug.Log("=== [AstralFox Test] Start ===");

            // Open scene or create new
            var scene = SceneManager.GetActiveScene();
            if (string.IsNullOrEmpty(scene.path))
            {
                scene = EditorSceneManager.NewScene(NewSceneSetup.DefaultGameObjects);
                Debug.Log("[Test] Created new scene");
            }
            Debug.Log($"[Test] Scene: {scene.name} ({scene.path})");

            // Run setup
            AstralFoxSceneSetup.SetupScene();
            Debug.Log("[Test] SetupScene complete");

            // --- Check AstralFoxRoot ---
            var root = GameObject.Find("AstralFoxRoot");
            Check(root != null, "AstralFoxRoot exists");

            if (root != null)
            {
                var comps = root.GetComponents<Component>();
                Debug.Log($"[Test] AstralFoxRoot has {comps.Length} components:");
                foreach (var c in comps)
                    if (c != null) Debug.Log($"[Test]   - {c.GetType().Name}");
            }

            // --- Check FoxPlaceholder ---
            var foxGo = GameObject.Find("FoxPlaceholder");
            Check(foxGo != null, "FoxPlaceholder exists");

            // --- Check Live2D_Model ---
            var live2DGo = foxGo != null ? foxGo.transform.Find("Live2D_Model")?.gameObject : null;
            Check(live2DGo != null, "Live2D_Model exists under FoxPlaceholder");

            // --- Check Live2D model and animation components ---
            if (live2DGo != null)
            {
#if CUBISM_SDK_PRESENT
                var cubismModel = live2DGo.GetComponentInChildren<Live2D.Cubism.Core.CubismModel>();
                Check(cubismModel != null, "CubismModel in Live2D_Model");

                var renderCtrl = live2DGo.GetComponentInChildren<Live2D.Cubism.Rendering.CubismRenderController>();
                Check(renderCtrl != null, "CubismRenderController in Live2D_Model");

                if (renderCtrl != null)
                {
                    var renderers = renderCtrl.Renderers;
                    Check(renderers != null && renderers.Length > 0,
                        $"Renderers initialized ({(renderers != null ? renderers.Length.ToString() : "null")})");

                    var drawableRens = renderCtrl.DrawableRenderers;
                    Check(drawableRens != null && drawableRens.Length > 0,
                        $"DrawableRenderers set ({(drawableRens != null ? drawableRens.Length.ToString() : "null")})");
                }
#endif

                var live2DAnimator = live2DGo.GetComponent<Live2DAnimator>();
                Check(live2DAnimator != null, "Live2DAnimator on Live2D_Model");

                var modelAnimCtrl = live2DGo.GetComponent<FoxAnimationController>();
                Check(modelAnimCtrl != null, "FoxAnimationController on Live2D_Model");

                var modelEmotion = live2DGo.GetComponent<FoxEmotionController>();
                Check(modelEmotion != null, "FoxEmotionController on Live2D_Model");

                var modelDriver = live2DGo.GetComponent<CubismParameterDriver>();
                Check(modelDriver != null, "CubismParameterDriver on Live2D_Model");

                var modelAnimator = live2DGo.GetComponent<Animator>();
                Check(modelAnimator != null, "Animator on Live2D_Model");
            }

            // --- Check backward-compat components on root ---
            if (root != null)
            {
                var rootAnimator = root.GetComponent<Animator>();
                Check(rootAnimator != null, "Animator on AstralFoxRoot");

                if (rootAnimator != null)
                    Check(rootAnimator.runtimeAnimatorController != null, "Animator Controller assigned");
            }

            // --- Check PetAnimationManager ---
            var petAnimMgr = root != null ? root.GetComponent<PetAnimationManager>() : null;
            Check(petAnimMgr != null, "PetAnimationManager on AstralFoxRoot");

            // --- Check Main Camera ---
            var camGo = GameObject.Find("Main Camera");
            Check(camGo != null, "Main Camera exists");
            if (camGo != null)
                Check(camGo.GetComponent<Camera>() != null, "Main Camera has Camera component");

            // --- Check Player Settings ---
            Debug.Log($"[Test] PlayerSettings.runInBackground = {PlayerSettings.runInBackground}");
            Check(PlayerSettings.runInBackground, "runInBackground enabled");
            Debug.Log($"[Test] PlayerSettings.visibleInBackground = {PlayerSettings.visibleInBackground}");
            Check(PlayerSettings.visibleInBackground, "visibleInBackground enabled");

            // --- Summary ---
            Debug.Log($"=== [AstralFox Test] Done: {_passCount} passed, {_failCount} failed ===");
            EditorApplication.Exit(_failCount > 0 ? 1 : 0);
        }
    }
}
