using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using System.IO;
using System.Linq;

namespace AstralFox.Editor
{
    /// <summary>
    /// Headless build entry point.
    /// Called via: -executeMethod AstralFox.Editor.BatchBuild.Build
    /// </summary>
    public static class BatchBuild
    {
        public static void Build()
        {
            // Ensure output directory
            string outputPath = Path.Combine(
                Directory.GetParent(UnityEngine.Application.dataPath).FullName,
                "Build", "AstralFox.exe");

            Directory.CreateDirectory(Path.GetDirectoryName(outputPath));

            // Determine which scene to build
            string scenePath;
            bool isNewScene = false;

            if (EditorBuildSettings.scenes.Length > 0 &&
                EditorBuildSettings.scenes[0].enabled)
            {
                scenePath = EditorBuildSettings.scenes[0].path;
            }
            else
            {
                // Fallback: find any .unity scene in the project
                var guids = AssetDatabase.FindAssets("t:Scene");
                var scenes = guids
                    .Select(g => AssetDatabase.GUIDToAssetPath(g))
                    .Where(p => !p.Contains("/Library/") && !p.Contains("/PackageCache/"))
                    .ToArray();

                if (scenes.Length == 0)
                {
                    // Create a new scene
                    scenePath = "Assets/Scenes/Main.unity";
                    string dir = Path.GetDirectoryName(scenePath);
                    if (!Directory.Exists(dir))
                        Directory.CreateDirectory(dir);

                    Scene newScene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                    AstralFoxSceneSetup.SetupScene();
                    EditorSceneManager.SaveScene(newScene, scenePath);
                    isNewScene = true;
                    UnityEngine.Debug.Log($"[BatchBuild] Created new scene: {scenePath}");
                }
                else
                {
                    scenePath = scenes[0];
                    UnityEngine.Debug.Log($"[BatchBuild] Using first available scene: {scenePath}");
                }
            }

            if (!isNewScene)
            {
                // Open and set up the scene
                Scene scene = EditorSceneManager.OpenScene(scenePath);
                AstralFoxSceneSetup.SetupScene();
                EditorSceneManager.SaveScene(scene, scenePath);
            }

            // Ensure scene is in build settings
            bool alreadyInSettings = EditorBuildSettings.scenes.Any(s => s.path == scenePath);
            if (!alreadyInSettings)
            {
                var list = EditorBuildSettings.scenes.ToList();
                list.Insert(0, new EditorBuildSettingsScene(scenePath, true));
                EditorBuildSettings.scenes = list.ToArray();
            }

            Debug.Log($"[BatchBuild] Building scene: {scenePath}");

            BuildPlayerOptions opts = new BuildPlayerOptions
            {
                scenes = new[] { scenePath },
                locationPathName = outputPath,
                target = BuildTarget.StandaloneWindows64,
                options = BuildOptions.None
            };

            var report = BuildPipeline.BuildPlayer(opts);

            if (report.summary.result == UnityEditor.Build.Reporting.BuildResult.Succeeded)
            {
                UnityEngine.Debug.Log($"[BatchBuild] Success: {outputPath}");
            }
            else
            {
                UnityEngine.Debug.LogError($"[BatchBuild] Failed: {report.summary.totalErrors} errors");
                EditorApplication.Exit(1);
            }
        }
    }
}
