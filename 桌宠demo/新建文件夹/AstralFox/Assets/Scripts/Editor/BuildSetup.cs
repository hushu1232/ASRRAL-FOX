using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine.SceneManagement;

namespace AstralFox.Editor
{
    /// <summary>
    /// Pre-build hook that ensures the scene has all required GameObjects
    /// before building the standalone player. Also used by batchmode.
    /// </summary>
    public static class BuildSetup
    {
        [MenuItem("AstralFox/Setup Scene For Build")]
        public static void SetupSceneForBuild()
        {
            // Ensure we have a scene open
            var scene = SceneManager.GetActiveScene();
            if (!scene.isDirty && scene.name == "SampleScene")
            {
                // Force setup
            }

            // Run full scene setup
            AstralFoxSceneSetup.SetupScene();

            // Run Animator Controller setup
            Animation.FoxAnimatorSetup.CreateAnimatorController();

            // Save the scene
            EditorSceneManager.SaveScene(scene, "Assets/Scenes/SampleScene.scene");
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            UnityEngine.Debug.Log("[BuildSetup] Scene setup complete and saved.");
        }

        /// <summary>
        /// Build the standalone Windows player. Callable from batchmode:
        /// Tuanjie.exe -quit -batchmode -projectPath ... -executeMethod AstralFox.Editor.BuildSetup.Build
        /// </summary>
        public static void Build()
        {
            SetupSceneForBuild();

            BuildPlayerOptions options = new BuildPlayerOptions
            {
                scenes = new[] { "Assets/Scenes/SampleScene.scene" },
                locationPathName = "Build/AstralFox.exe",
                target = BuildTarget.StandaloneWindows64,
                options = BuildOptions.None,
            };

            var report = BuildPipeline.BuildPlayer(options);
            if (report.summary.result == UnityEditor.Build.Reporting.BuildResult.Succeeded)
                UnityEngine.Debug.Log("[BuildSetup] Build succeeded!");
            else
                UnityEngine.Debug.LogError($"[BuildSetup] Build failed: {report.summary}");
        }
    }
}
