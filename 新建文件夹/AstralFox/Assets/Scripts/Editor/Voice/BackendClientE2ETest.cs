using System;
using System.Collections;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace AstralFox.Editor.Voice
{
    /// <summary>
    /// Manual E2E test runner for BackendClient -> BFF WebSocket protocol.
    ///
    /// Usage:
    ///   1. Start the Python BFF:  cd backend &amp;&amp; python main.py
    ///   2. In Tuanjie Editor:     AstralFox -> Run BackendClient E2E Test
    ///   3. Watch the Console for [PASS] / [FAIL] results
    /// </summary>
    public static class BackendClientE2ETest
    {
        private const string MenuPath = "AstralFox/Run BackendClient E2E Test";
        private const string BFF_URL = "ws://localhost:8765/ws/chat";
        private const float Timeout = 15f;

        [MenuItem(MenuPath, false, 100)]
        public static void RunE2E()
        {
            try
            {
                Debug.Log("==========================================");
                Debug.Log("[E2E] BackendClient -> BFF E2E Test");
                Debug.Log("[E2E] Make sure the BFF is running: python main.py");
                Debug.Log("==========================================");

                if (Application.isPlaying)
                {
                    Debug.LogWarning("[E2E] Already in Play Mode. Exiting first...");
                    EditorApplication.ExitPlaymode();
                    return;
                }

                // Create a fresh scene (don't modify the user's scene)
                var originalScene = SceneManager.GetActiveScene().path;
                var testScene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                Debug.Log($"[E2E] Created test scene (original: {originalScene})");

                // Create the test runner GameObject
                var runnerGo = new GameObject("__E2E_TestRunner__");
                var runner = runnerGo.AddComponent<E2ETestBehaviour>();
                runner.originalScene = originalScene;
                runner.bffUrl = BFF_URL;
                runner.timeout = Timeout;
                Debug.Log("[E2E] Test runner created, entering Play Mode...");

                // Enter Play Mode - the test runs automatically in E2ETestBehaviour.Start()
                EditorApplication.EnterPlaymode();
            }
            catch (Exception ex)
            {
                Debug.LogError($"[E2E] Fatal error: {ex.Message}\n{ex.StackTrace}");
            }
        }
    }

    /// <summary>
    /// MonoBehaviour that runs the E2E test in Play Mode and auto-exits.
    /// </summary>
    public class E2ETestBehaviour : MonoBehaviour
    {
        public string originalScene;
        public string bffUrl;
        public float timeout;

        private AstralFox.Voice.BackendClient _client;
        private int _pass;
        private int _fail;
        private bool _started;

        private void Start()
        {
            if (_started) return;
            _started = true;
            StartCoroutine(RunTests());
        }

        private IEnumerator RunTests()
        {
            Debug.Log("[E2E] Starting tests in 1 second...");
            yield return new WaitForSeconds(1f);

            // -- Create BackendClient --
            var go = new GameObject("__TestClient__");
            _client = go.AddComponent<AstralFox.Voice.BackendClient>();
            SetPrivate("_serverUrl", bffUrl);
            SetPrivate("_autoConnect", false);
            SetPrivate("_logMessages", false);
            Debug.Log("[E2E] BackendClient created");

            // -- Test 1: Connection --
            Debug.Log("\n--- Test 1: Connection ---");
            bool connected = false;
            _client.OnConnectionChanged += (c) => connected = c;
            yield return Await(_client.ConnectAsync(), "ConnectAsync");
            yield return WaitUntil(() => connected, 5f, "Connection event");
            Check(connected && _client.IsConnected, "WebSocket connected to BFF");

            if (!_client.IsConnected)
            {
                Debug.LogError("[E2E] Cannot proceed - BFF not reachable. Is `python main.py` running?");
                yield return new WaitForSeconds(2f);
                ExitTest(originalScene);
                yield break;
            }

            // -- Test 2: Ping/Pong --
            Debug.Log("\n--- Test 2: Ping/Pong ---");
            bool pingErr = false;
            _client.OnError += (_) => pingErr = true;
            yield return Await(_client.SendTextAsync("{\"type\":\"ping\"}"), "SendPing");
            yield return new WaitForSeconds(2f);
            Check(!pingErr, "Ping/Pong roundtrip (no error)");

            // -- Test 3: Full Pipeline --
            Debug.Log("\n--- Test 3: Full ASR->LLM->TTS Pipeline ---");
            var types = new System.Collections.Generic.HashSet<string>();
            string llm = null;
            int ttsChunks = 0;
            bool ttsDone = false, err = false;

            _client.OnFinalTranscript += (_) => { lock (types) types.Add("final_transcript"); };
            _client.OnLLMResponse += (t) => { lock (types) { types.Add("llm_response"); llm = t; } };
            _client.OnTTSAudio += (_, __) => { lock (types) types.Add("tts_audio"); ttsChunks++; };
            _client.OnTTSDone += () => { lock (types) { types.Add("tts_done"); ttsDone = true; } };
            _client.OnError += (_) => err = true;

            string eos = "{\"type\":\"end_of_speech\",\"emotion_context\":\"开心, 精力充沛\","
                + "\"personality\":\"温柔的狐狸少女\",\"character_name\":\"星尘\","
                + "\"memory_summary\":\"\",\"chat_history\":\"\","
                + "\"character_backstory\":\"\",\"character_extra\":\"\"}";
            yield return Await(_client.SendTextAsync(eos), "SendEOS");
            yield return WaitUntil(() => ttsDone, timeout, "TTS completion");

            Check(!err, "No server error");
            Check(types.Contains("final_transcript"), "final_transcript received");
            Check(types.Contains("llm_response"), "llm_response received");
            bool hasTag = llm != null && (
                llm.StartsWith("[happy]") || llm.StartsWith("[sad]") ||
                llm.StartsWith("[shy]") || llm.StartsWith("[angry]") ||
                llm.StartsWith("[neutral]") || llm.Contains("cmd:"));
            Check(hasTag, $"Emotion tag in LLM response: {(llm != null && llm.Length > 50 ? llm.Substring(0, 50) : llm ?? "null")}...");
            Check(ttsChunks > 0, $"TTS audio chunks: {ttsChunks}");
            Check(types.Contains("tts_done"), "tts_done received");

            // -- Test 4: TTS Audio Integrity --
            Debug.Log("\n--- Test 4: TTS Audio Integrity ---");
            int totalBytes = 0, totalChunks = 0;
            bool done2 = false;
            _client.OnTTSAudio += (_, p) => { totalChunks++; totalBytes += (p != null ? p.Length : 0); };
            _client.OnTTSDone += () => done2 = true;
            yield return Await(_client.SendTextAsync(eos), "SendEOS2");
            yield return WaitUntil(() => done2, timeout, "Second TTS done");
            Check(totalChunks > 0, $"Chunks: {totalChunks}");
            Check(totalBytes > 0, $"PCM bytes: {totalBytes}");
            Check(totalBytes % 2 == 0, "PCM 16-bit (even byte count)");

            // -- Test 5: Health Endpoint --
            Debug.Log("\n--- Test 5: Health Endpoint ---");
            using (var www = UnityEngine.Networking.UnityWebRequest.Get("http://localhost:8765/health"))
            {
                www.timeout = 5;
                yield return www.SendWebRequest();
                bool healthOk = www.result != UnityEngine.Networking.UnityWebRequest.Result.ConnectionError;
                Check(healthOk, $"Health reachable: {www.downloadHandler.text}");
            }

            // -- Summary --
            Debug.Log("\n==========================================");
            Debug.Log($"[E2E] Results: {_pass} PASS, {_fail} FAIL");
            Debug.Log("==========================================");

            yield return new WaitForSeconds(1f);
            ExitTest(originalScene);
        }

        private void Check(bool condition, string message)
        {
            if (condition) { Debug.Log($"  [PASS] {message}"); _pass++; }
            else { Debug.LogError($"  [FAIL] {message}"); _fail++; }
        }

        private void SetPrivate(string name, object value)
        {
            var f = typeof(AstralFox.Voice.BackendClient).GetField(name,
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            if (f != null) f.SetValue(_client, value);
        }

        private static IEnumerator Await(System.Threading.Tasks.Task task, string label)
        {
            float e = 0f;
            while (!task.IsCompleted && !task.IsFaulted && !task.IsCanceled)
            {
                if (e >= 10f) { Debug.LogError($"  [TIMEOUT] {label}"); yield break; }
                e += Time.deltaTime;
                yield return null;
            }
            if (task.IsFaulted)
                Debug.LogError($"  [FAULT] {label}: {task.Exception?.InnerException?.Message}");
        }

        private static IEnumerator WaitUntil(Func<bool> cond, float timeout, string label)
        {
            float e = 0f;
            while (!cond())
            {
                if (e >= timeout) { Debug.LogError($"  [TIMEOUT] {label}"); yield break; }
                e += Time.deltaTime;
                yield return null;
            }
        }

        private void ExitTest(string returnScene)
        {
            EditorApplication.ExitPlaymode();
            EditorApplication.delayCall += () =>
            {
                if (!string.IsNullOrEmpty(returnScene) && System.IO.File.Exists(returnScene))
                    EditorSceneManager.OpenScene(returnScene);
            };
        }
    }
}
