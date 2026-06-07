using UnityEditor;
using UnityEngine;
using Live2D.Cubism.Core;
using Live2D.Cubism.Framework.Json;

namespace AstralFox.Editor
{
    /// <summary>
    /// Test: Create a minimal Cubism model using SDK API,
    /// output parameter/part/drawable info to verify data flow.
    /// Menu: AstralFox -> Test Moc3 Creation
    /// </summary>
    public static class Moc3TestCreator
    {
        [MenuItem("AstralFox/Test Moc3 Creation")]
        public static void Run()
        {
            // Try loading our generated model through SDK
            var model3Path = "Assets/Live2D/Models/Generated/model.model3.json";
            var model3Json = CubismModel3Json.LoadAtPath(model3Path);
            if (model3Json == null)
            {
                Debug.LogError($"[Moc3Test] Failed to load: {model3Path}");
                return;
            }

            Debug.Log($"[Moc3Test] Loaded model3.json: Moc={model3Json.FileReferences.Moc}");

            // Try creating moc (with consistency bypass)
            var mocBytes = model3Json.Moc3;
            if (mocBytes == null)
            {
                Debug.LogError("[Moc3Test] Moc3 bytes are null!");
                return;
            }
            Debug.Log($"[Moc3Test] Moc3 bytes: {mocBytes.Length} bytes");
            
            // Read version
            var version = System.BitConverter.ToUInt32(mocBytes, 4);
            Debug.Log($"[Moc3Test] Moc version header: {version}");

            // Try to create moc with bypass
            var moc = CubismMoc.CreateFrom(mocBytes, shouldCheckMocConsistency: false);
            if (moc == null)
            {
                Debug.LogError("[Moc3Test] CubismMoc.CreateFrom returned null!");
                return;
            }
            Debug.Log($"[Moc3Test] Moc created! Latest version: {CubismMoc.LatestVersion}, This moc version: {moc.Version}");

            // Try to instantiate model
            var model = CubismModel.InstantiateFrom(moc);
            if (model == null)
            {
                Debug.LogError("[Moc3Test] CubismModel.InstantiateFrom returned null!");
                return;
            }

            Debug.Log($"[Moc3Test] Model instantiated!");
            Debug.Log($"  Parameters: {model.Parameters?.Length ?? 0}");
            Debug.Log($"  Parts: {model.Parts?.Length ?? 0}");
            Debug.Log($"  Drawables: {model.Drawables?.Length ?? 0}");

            if (model.Parameters != null && model.Parameters.Length > 0)
            {
                Debug.Log("  First 5 params:");
                for (int i = 0; i < System.Math.Min(5, model.Parameters.Length); i++)
                {
                    var p = model.Parameters[i];
                    Debug.Log($"    [{i}] {p.Id}: min={p.MinimumValue} max={p.MaximumValue} default={p.DefaultValue}");
                }
            }

            if (model.Parts != null && model.Parts.Length > 0)
            {
                Debug.Log("  First 5 parts:");
                for (int i = 0; i < System.Math.Min(5, model.Parts.Length); i++)
                {
                    Debug.Log($"    [{i}] {model.Parts[i].Id}");
                }
            }

            // Cleanup
            Object.DestroyImmediate(model.gameObject);
            Debug.Log("[Moc3Test] Done.");
        }
    }
}
