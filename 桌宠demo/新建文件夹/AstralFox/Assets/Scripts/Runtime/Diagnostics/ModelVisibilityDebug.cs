using UnityEngine;
using UnityEngine.Rendering;

namespace AstralFox.Diagnostics
{
    /// <summary>
    /// Diagnostic tool: logs camera setup, model state, and all renderers in the scene
    /// to help debug "model not visible in Game view" issues.
    /// Attach to any GameObject or add at runtime via AddComponent.
    /// </summary>
    public sealed class ModelVisibilityDebug : MonoBehaviour
    {
        private void Start()
        {
            // Delay to let all other Start() methods complete first
            Invoke(nameof(RunDiagnostic), 1f);
        }

        private void RunDiagnostic()
        {
            Debug.Log("=== Model Visibility Diagnostic ===");

            // 1. Camera info
            var cam = Camera.main;
            if (cam == null)
            {
                Debug.LogError("[DIAG] CRITICAL: No camera tagged 'MainCamera'!");
                return;
            }

            Debug.Log($"[DIAG] Camera: {cam.name}");
            Debug.Log($"  Position: {cam.transform.position}, Rotation: {cam.transform.eulerAngles}");
            Debug.Log($"  ClearFlags: {cam.clearFlags}, BG: {cam.backgroundColor}");
            Debug.Log($"  Orthographic: {cam.orthographic}, Size: {cam.orthographicSize}");
            Debug.Log($"  FOV: {cam.fieldOfView}, Near: {cam.nearClipPlane}, Far: {cam.farClipPlane}");
            Debug.Log($"  Depth: {cam.depth}, CullingMask: {cam.cullingMask}");
            Debug.Log($"  TargetTexture: {(cam.targetTexture != null ? cam.targetTexture.name : "null (rendering to screen)")}");

            // AudioListener check
            var audioListener = FindObjectOfType<AudioListener>();
            Debug.Log(audioListener != null
                ? $"[DIAG] AudioListener: {audioListener.name}, enabled={audioListener.enabled}"
                : "[DIAG] CRITICAL: No AudioListener in scene! Audio will NOT be heard.");
            var audioSrc = FindObjectOfType<AudioSource>();
            Debug.Log(audioSrc != null
                ? $"[DIAG] AudioSource: {audioSrc.name}, volume={audioSrc.volume}, mute={audioSrc.mute}, spatialBlend={audioSrc.spatialBlend}"
                : "[DIAG] No AudioSource found (will be created by TTSPlayer).");

            // 2. URP additional camera data
            var urpData = cam.GetComponent<UnityEngine.Rendering.Universal.UniversalAdditionalCameraData>();
            if (urpData != null)
            {
                Debug.Log($"[DIAG] URP Camera Data:");
                Debug.Log($"  RenderPostProcessing: {urpData.renderPostProcessing}");
                Debug.Log($"  RenderShadows: {urpData.renderShadows}");
                Debug.Log($"  Antialiasing: {urpData.antialiasing}");
            }

            // 3. Check FoxPlaceholder
            var fox = GameObject.Find("FoxPlaceholder");
            if (fox == null)
            {
                Debug.LogError("[DIAG] CRITICAL: FoxPlaceholder not found!");
            }
            else
            {
                Debug.Log($"[DIAG] FoxPlaceholder: active={fox.activeSelf}, pos={fox.transform.position}, children={fox.transform.childCount}");
                for (int i = 0; i < fox.transform.childCount; i++)
                {
                    var child = fox.transform.GetChild(i);
                    Debug.Log($"  Child[{i}]: {child.name}, active={child.gameObject.activeSelf}, pos={child.localPosition}, scale={child.localScale}");
                }
            }

            // 4. Check Live2DAnimator
            var l2d = FindObjectOfType<Animation.Live2DAnimator>();
            if (l2d == null)
            {
                Debug.LogError("[DIAG] CRITICAL: No Live2DAnimator in scene!");
            }
            else
            {
                Debug.Log($"[DIAG] Live2DAnimator: active={l2d.gameObject.activeSelf}, enabled={l2d.enabled}, ready={l2d.IsReady}");
            }

            // 5. All MeshRenderers + their materials (summary only)
            var renderers = FindObjectsOfType<MeshRenderer>(includeInactive: true);
            int visibleCount = 0;
            var shadersSeen = new System.Collections.Generic.HashSet<string>();
            foreach (var r in renderers)
            {
                if (r.gameObject.activeInHierarchy && r.enabled) visibleCount++;
                if (r.materials.Length > 0 && r.materials[0] != null)
                    shadersSeen.Add(r.materials[0].shader.name);
            }
            Debug.Log($"[DIAG] MeshRenderers: {visibleCount}/{renderers.Length} visible. Shaders: [{string.Join(", ", shadersSeen)}]");

            // 5b. Material property diagnostic on first model renderer
            var firstModelRenderer = default(MeshRenderer);
            if (fox != null && fox.transform.childCount > 0)
            {
                var modelRenderers = fox.transform.GetChild(0).GetComponentsInChildren<MeshRenderer>(includeInactive: false);
                foreach (var mr in modelRenderers)
                {
                    if (mr.enabled && mr.gameObject.activeInHierarchy && mr.materials.Length > 0 && mr.materials[0] != null)
                    {
                        firstModelRenderer = mr;
                        break;
                    }
                }
            }
            if (firstModelRenderer != null)
            {
                var mat = firstModelRenderer.materials[0];
                Debug.Log($"[DIAG] Sample material '{mat.name}' on '{firstModelRenderer.name}':");
                Debug.Log($"  shader={mat.shader.name}");
                var mainTex = mat.GetTexture("_MainTex");
                Debug.Log($"  _MainTex={(mainTex != null ? $"{mainTex.name} ({mainTex.width}x{mainTex.height})" : "NULL")}");
                Debug.Log($"  cubism_ModelOpacity={mat.GetFloat("cubism_ModelOpacity")}");
                Debug.Log($"  _SrcColor={mat.GetInt("_SrcColor")} _DstColor={mat.GetInt("_DstColor")} _SrcAlpha={mat.GetInt("_SrcAlpha")} _DstAlpha={mat.GetInt("_DstAlpha")}");
                Debug.Log($"  renderQueue={mat.renderQueue} culling={firstModelRenderer.shadowCastingMode}");
                // Check vertex colors by trying to read the mesh
                var mf = firstModelRenderer.GetComponent<MeshFilter>();
                if (mf != null && mf.sharedMesh != null)
                {
                    var colors = mf.sharedMesh.colors;
                    Debug.Log($"  mesh={mf.sharedMesh.name} verts={mf.sharedMesh.vertexCount} triangles={mf.sharedMesh.triangles.Length/3} vertexColors={(colors != null && colors.Length > 0 ? $"yes({colors.Length}), first=({colors[0].r:F3},{colors[0].g:F3},{colors[0].b:F3},{colors[0].a:F3})" : "none")}");
                }
                // Check if any enabled keyword suggests masking
                var keywords = mat.enabledKeywords;
                if (keywords != null && keywords.Length > 0)
                {
                    var kwNames = new string[keywords.Length];
                    for (int i = 0; i < keywords.Length; i++) kwNames[i] = keywords[i].name;
                    Debug.Log($"  enabledKeywords=[{string.Join(", ", kwNames)}]");
                }
            }

            // 6. Check if any mesh is in camera view
            if (fox != null && fox.transform.childCount > 0)
            {
                var modelChild = fox.transform.GetChild(0);
                var modelRenderers = modelChild.GetComponentsInChildren<MeshRenderer>(includeInactive: true);
                int insideCount = 0, behindCount = 0, outsideCount = 0;
                string firstShader = null;

                foreach (var mr in modelRenderers)
                {
                    if (firstShader == null && mr.materials.Length > 0 && mr.materials[0] != null)
                        firstShader = mr.materials[0].shader.name;

                    if (mr.enabled && mr.gameObject.activeInHierarchy)
                    {
                        Vector3 vp = cam.WorldToViewportPoint(mr.bounds.center);
                        if (vp.z > 0 && vp.x >= 0 && vp.x <= 1 && vp.y >= 0 && vp.y <= 1)
                            insideCount++;
                        else if (vp.z <= 0)
                            behindCount++;
                        else
                            outsideCount++;
                    }
                }
                var bounds = modelChild.GetComponentsInChildren<MeshRenderer>(includeInactive: true);
                // Calculate combined bounding box
                Bounds? combined = null;
                foreach (var mr in bounds)
                {
                    if (combined == null) combined = mr.bounds;
                    else combined.Value.Encapsulate(mr.bounds);
                }
                Debug.Log($"[DIAG] Model '{modelChild.name}': {modelRenderers.Length} renderers, " +
                    $"shader={(firstShader ?? "null")}, " +
                    $"frustum: {insideCount} in / {behindCount} behind / {outsideCount} outside, " +
                    $"active={modelChild.gameObject.activeSelf}, " +
                    $"pos={modelChild.position}, " +
                    $"bounds center={(combined.HasValue ? combined.Value.center.ToString() : "N/A")}");
            }

            // 7. Check Canvas/UI overlays
            var canvases = FindObjectsOfType<Canvas>(includeInactive: true);
            Debug.Log($"[DIAG] Canvases in scene: {canvases.Length}");
            foreach (var cv in canvases)
            {
                Debug.Log($"  [{cv.name}] renderMode={cv.renderMode}, sortingOrder={cv.sortingOrder}, " +
                    $"active={cv.gameObject.activeSelf}, enabled={cv.enabled}");
            }

            // 8. Check rendering pipeline
            Debug.Log($"[DIAG] Render Pipeline: {GraphicsSettings.currentRenderPipeline?.name ?? "Built-in"}");
            Debug.Log($"[DIAG] Quality Level: {QualitySettings.names[QualitySettings.GetQualityLevel()]}");

            // 9. Check lights (Built-in RP needs lights for Standard shader)
            var lights = FindObjectsOfType<Light>(includeInactive: true);
            int directionalLights = 0;
            foreach (var l in lights)
            {
                if (l.type == LightType.Directional && l.enabled && l.gameObject.activeInHierarchy)
                    directionalLights++;
            }
            Debug.Log($"[DIAG] Lights: {lights.Length} total, {directionalLights} active directional");
            if (directionalLights == 0)
                Debug.LogWarning("[DIAG] WARNING: No active directional light! Standard shader objects will render black.");

            // 10. Audio diagnostic
            Debug.Log("[DIAG] Audio State: " +
                $"ListenerPause={AudioListener.pause}, " +
                $"Volume={AudioListener.volume}, " +
                $"SampleRate={AudioSettings.outputSampleRate}, " +
                $"SpeakerMode={AudioSettings.speakerMode}");

            // Check all AudioSources
            var audioSources = FindObjectsOfType<AudioSource>(includeInactive: true);
            Debug.Log($"[DIAG] AudioSources in scene: {audioSources.Length}");
            foreach (var src in audioSources)
            {
                Debug.Log($"  [{src.name}] enabled={src.enabled}, " +
                    $"volume={src.volume}, mute={src.mute}, " +
                    $"playOnAwake={src.playOnAwake}, isPlaying={src.isPlaying}, " +
                    $"clip={(src.clip != null ? src.clip.name : "null")}");
            }

            // 11. Play test tone to verify audio hardware
            PlayTestTone();

            Debug.Log("=== Diagnostic Complete ===");
        }

        private void PlayTestTone()
        {
            try
            {
                int sampleRate = AudioSettings.outputSampleRate;
                float duration = 1.0f;
                int samples = (int)(sampleRate * duration);
                var clip = AudioClip.Create("TestTone", samples, 1, sampleRate, false);
                var data = new float[samples];
                int half = samples / 2;
                for (int i = 0; i < half; i++)
                    data[i] = Mathf.Sin(2f * Mathf.PI * 440f * i / sampleRate) * 0.6f;
                for (int i = half; i < samples; i++)
                    data[i] = Mathf.Sin(2f * Mathf.PI * 880f * i / sampleRate) * 0.6f;
                clip.SetData(data, 0);

                Debug.Log($"[DIAG] TestTone: clip created: {clip.samples} samples, {clip.frequency}Hz, {clip.channels}ch, length={clip.length}s");

                var go = new GameObject("__TestTonePlayer__");
                go.hideFlags = HideFlags.HideAndDontSave;
                var audioSource = go.AddComponent<AudioSource>();
                audioSource.clip = clip;
                audioSource.volume = 1.0f;
                audioSource.spatialBlend = 0f;
                audioSource.bypassEffects = true;
                audioSource.bypassListenerEffects = true;
                audioSource.bypassReverbZones = true;
                audioSource.Play();

                Debug.Log($"[DIAG] TestTone: AudioSource.Play() called, isPlaying={audioSource.isPlaying}, " +
                    $"time={audioSource.time}, clip={audioSource.clip?.name}, " +
                    $"outputSampleRate={AudioSettings.outputSampleRate}, " +
                    $"driver={AudioSettings.driverCapabilities}");

                // Also try PlayClipAtPoint as fallback
                AudioSource.PlayClipAtPoint(clip, Vector3.zero, 1.0f);
                Debug.Log("[DIAG] TestTone: PlayClipAtPoint also called as fallback.");

                Destroy(go, duration + 1.0f);
            }
            catch (System.Exception e)
            {
                Debug.LogError($"[DIAG] TestTone FAILED: {e.GetType().Name}: {e.Message}\n{e.StackTrace}");
            }
        }
    }
}
