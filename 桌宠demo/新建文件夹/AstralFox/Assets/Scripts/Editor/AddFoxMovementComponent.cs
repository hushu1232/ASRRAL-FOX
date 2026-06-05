using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace AstralFox.Editor
{
    /// <summary>
    /// 一次性工具：将 FoxSimpleMovement 组件添加到场景中的 AstralFoxRoot。
    /// 用法：Tuanjie.exe -quit -batchmode -nographics -projectPath ...
    ///   -executeMethod AstralFox.Editor.AddFoxMovementComponent.AddToScene
    /// </summary>
    public static class AddFoxMovementComponent
    {
        public static void AddToScene()
        {
            // 打开 SampleScene
            string scenePath = "Assets/Scenes/SampleScene.scene";
            Scene scene = EditorSceneManager.OpenScene(scenePath, OpenSceneMode.Single);

            // 查找 AstralFoxRoot
            GameObject foxRoot = null;
            foreach (var root in scene.GetRootGameObjects())
            {
                if (root.name == "AstralFoxRoot")
                {
                    foxRoot = root;
                    break;
                }
            }

            if (foxRoot == null)
            {
                Debug.LogError("[AddFoxMovement] AstralFoxRoot not found!");
                EditorApplication.Exit(1);
                return;
            }

            // 检查是否已存在
            var existing = foxRoot.GetComponent<FoxSimpleMovement>();
            if (existing != null)
            {
                Debug.Log("[AddFoxMovement] FoxSimpleMovement already exists. Skipping.");
                EditorSceneManager.SaveScene(scene);
                EditorApplication.Exit(0);
                return;
            }

            // 添加组件
            foxRoot.AddComponent<FoxSimpleMovement>();
            Debug.Log("[AddFoxMovement] FoxSimpleMovement added to AstralFoxRoot.");

            // 保存场景
            EditorSceneManager.MarkSceneDirty(scene);
            EditorSceneManager.SaveScene(scene);
            Debug.Log("[AddFoxMovement] Scene saved.");

            EditorApplication.Exit(0);
        }
    }
}
