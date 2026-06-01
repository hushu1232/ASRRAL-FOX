using System;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

namespace AstralFox.Config
{
    /// <summary>
    /// HTTP client syncing AstralFox with the Avatar Web Management System.
    /// Fetches pet configuration on startup and periodically syncs back.
    /// Uses JsonUtility for all JSON parsing/serialization.
    /// Supports JWT refresh token flow for seamless re-auth.
    /// </summary>
    public sealed class PetApiClient : MonoBehaviour
    {
        #region Inspector

        [Header("Web Management API")]
        [SerializeField, Tooltip("Base URL of the avatar web management system.")]
        private string _baseUrl = "http://localhost:3000";

        [Header("Auth")]
        [SerializeField] private string _email = "demo@example.com";
        [SerializeField] private string _password = "demo1234";

        [Header("Behaviour")]
        [SerializeField, Tooltip("Fetch config on startup.")]
        private bool _fetchOnStart = true;

        [SerializeField, Tooltip("Seconds between config syncs. 0 = disable.")]
        private float _syncIntervalSec = 300f;

        [SerializeField, Tooltip("Log API calls to console.")]
        private bool _verboseLogging = true;

        #endregion

        #region Runtime State

        private string _accessToken;
        private string _refreshToken;
        private Coroutine _syncRoutine;

        public PetConfigData LastFetchedConfig { get; private set; }
        public bool IsLoggedIn => !string.IsNullOrEmpty(_accessToken);
        public bool LastFetchSuccess { get; private set; }

        public event Action<PetConfigData> OnConfigFetched;
        public event Action<string> OnFetchError;

        #endregion

        #region Unity Lifecycle

        private void Start()
        {
            // Restore saved tokens so we can skip login on restart
            _accessToken = Data.DataStore.Instance.LoadAccessToken();
            _refreshToken = Data.DataStore.Instance.LoadRefreshToken();

            if (_fetchOnStart)
                StartCoroutine(FetchConfigWithDelay(1f));

            if (_syncIntervalSec > 0)
                _syncRoutine = StartCoroutine(PeriodicSync());
        }

        private void OnDestroy()
        {
            if (_syncRoutine != null)
                StopCoroutine(_syncRoutine);
        }

        #endregion

        #region Public API

        public void FetchConfig() => StartCoroutine(FetchConfigRoutine());
        public void SaveConfig(PetConfigData config) => StartCoroutine(SaveConfigRoutine(config));

        /// <summary>
        /// Fetch full pet config from the sync endpoint (includes decrypted API keys,
        /// model path, mapped assets). Preferred startup endpoint for the Unity client.
        /// </summary>
        public void FetchSyncConfig() => StartCoroutine(FetchSyncConfigRoutine());

        public void Login(string email = null, string password = null)
        {
            if (!string.IsNullOrEmpty(email)) _email = email;
            if (!string.IsNullOrEmpty(password)) _password = password;
            StartCoroutine(LoginRoutine());
        }

        #endregion

        #region Coroutines

        private IEnumerator FetchConfigWithDelay(float delay)
        {
            yield return new WaitForSeconds(delay);
            yield return EnsureAuth();
            if (IsLoggedIn)
                yield return FetchConfigRoutine();
        }

        private IEnumerator PeriodicSync()
        {
            while (true)
            {
                yield return new WaitForSeconds(_syncIntervalSec);
                if (IsLoggedIn)
                    yield return FetchConfigRoutine();
            }
        }

        /// <summary>Ensure we have a valid token. Try refresh first, then login.</summary>
        private IEnumerator EnsureAuth()
        {
            if (IsLoggedIn) yield break;

            // Try refresh token first
            if (!string.IsNullOrEmpty(_refreshToken))
            {
                yield return RefreshTokenRoutine();
                if (IsLoggedIn) yield break;
            }

            // Fall back to full login
            yield return LoginRoutine();
        }

        private IEnumerator LoginRoutine()
        {
            var payload = $"{{\"email\":\"{EscapeJson(_email)}\",\"password\":\"{EscapeJson(_password)}\"}}";
            var body = Encoding.UTF8.GetBytes(payload);

            using var req = new UnityWebRequest($"{_baseUrl}/api/auth/login", "POST");
            req.uploadHandler = new UploadHandlerRaw(body);
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");

            yield return req.SendWebRequest();

            if (req.result != UnityWebRequest.Result.Success)
            {
                var err = $"Login failed: {req.responseCode} {req.error}";
                if (_verboseLogging) Debug.LogWarning($"[PetApiClient] {err}");
                OnFetchError?.Invoke(err);
                yield break;
            }

            var json = req.downloadHandler.text;
            var response = JsonUtility.FromJson<LoginResponse>(json);

            if (response == null || !response.success)
            {
                var err = "Login failed: " + (response?.error ?? "unknown error");
                if (_verboseLogging) Debug.LogWarning($"[PetApiClient] {err}");
                OnFetchError?.Invoke(err);
                yield break;
            }

            _accessToken = response.data?.accessToken ?? "";
            _refreshToken = ExtractCookieValue(req.GetResponseHeader("Set-Cookie"), "refreshToken");
            PersistTokens();

            if (_verboseLogging)
                Debug.Log($"[PetApiClient] Logged in as {_email}");
        }

        private IEnumerator RefreshTokenRoutine()
        {
            if (string.IsNullOrEmpty(_refreshToken)) yield break;

            using var req = new UnityWebRequest($"{_baseUrl}/api/auth/refresh", "POST");
            req.uploadHandler = new UploadHandlerRaw(Array.Empty<byte>());
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");
            req.SetRequestHeader("Cookie", $"refreshToken={_refreshToken}");

            yield return req.SendWebRequest();

            if (req.result != UnityWebRequest.Result.Success)
            {
                if (_verboseLogging) Debug.Log("[PetApiClient] Token refresh failed — will re-login.");
                _accessToken = null;
                _refreshToken = null;
                PersistTokens();
                yield break;
            }

            var json = req.downloadHandler.text;
            var response = JsonUtility.FromJson<LoginResponse>(json);

            if (response == null || !response.success || string.IsNullOrEmpty(response.data?.accessToken))
            {
                if (_verboseLogging) Debug.Log("[PetApiClient] Token refresh invalid — will re-login.");
                _accessToken = null;
                _refreshToken = null;
                PersistTokens();
                yield break;
            }

            _accessToken = response.data.accessToken;
            var newRefresh = ExtractCookieValue(req.GetResponseHeader("Set-Cookie"), "refreshToken");
            if (!string.IsNullOrEmpty(newRefresh))
                _refreshToken = newRefresh;
            PersistTokens();

            if (_verboseLogging)
                Debug.Log("[PetApiClient] Token refreshed successfully.");
        }

        private IEnumerator FetchConfigRoutine()
        {
            yield return EnsureAuth();
            if (!IsLoggedIn) yield break;

            using var req = UnityWebRequest.Get($"{_baseUrl}/api/pet/config");
            req.SetRequestHeader("Authorization", $"Bearer {_accessToken}");

            yield return req.SendWebRequest();

            if (req.result == UnityWebRequest.Result.Success)
            {
                var json = req.downloadHandler.text;
                var response = JsonUtility.FromJson<ConfigResponse>(json);

                if (response != null && response.success && response.data != null)
                {
                    LastFetchedConfig = ConvertFromJson(response.data);
                    LastFetchSuccess = true;

                    if (_verboseLogging)
                        Debug.Log($"[PetApiClient] Config fetched: v{LastFetchedConfig.version}, " +
                                  $"{LastFetchedConfig.params_entries?.Length ?? 0} params, " +
                                  $"{LastFetchedConfig.equippedParts?.Length ?? 0} parts");

                    ApplyConfigToModel(LastFetchedConfig);
                    ApplyCharacterSettings(LastFetchedConfig);
                    OnConfigFetched?.Invoke(LastFetchedConfig);
                }
                else
                {
                    var msg = response?.error ?? "unknown error";
                    if (_verboseLogging) Debug.LogWarning($"[PetApiClient] Config fetch error: {msg}");
                }
            }
            else if (req.responseCode == 401 || req.responseCode == 403)
            {
                // Token expired — refresh then retry once
                _accessToken = null;
                yield return EnsureAuth();
                if (IsLoggedIn)
                    yield return FetchConfigRoutine();
            }
            else
            {
                var err = $"Config fetch failed: {req.responseCode} {req.error}";
                if (_verboseLogging) Debug.LogWarning($"[PetApiClient] {err}");
                LastFetchSuccess = false;
                OnFetchError?.Invoke(err);
            }
        }

        private IEnumerator SaveConfigRoutine(PetConfigData config)
        {
            yield return EnsureAuth();
            if (!IsLoggedIn) yield break;

            var jsonData = ConvertToJson(config);
            var payload = JsonUtility.ToJson(jsonData);
            var body = Encoding.UTF8.GetBytes(payload);

            using var req = new UnityWebRequest($"{_baseUrl}/api/pet/config", "POST");
            req.uploadHandler = new UploadHandlerRaw(body);
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");
            req.SetRequestHeader("Authorization", $"Bearer {_accessToken}");

            yield return req.SendWebRequest();

            if (req.result == UnityWebRequest.Result.Success)
            {
                var json = req.downloadHandler.text;
                var response = JsonUtility.FromJson<SaveConfigResponse>(json);
                if (_verboseLogging)
                    Debug.Log($"[PetApiClient] Config saved: {(response != null && response.success ? "OK" : "Failed")}");
            }
            else if (req.responseCode == 401 || req.responseCode == 403)
            {
                _accessToken = null;
                yield return EnsureAuth();
                if (IsLoggedIn)
                    yield return SaveConfigRoutine(config);
            }
            else
            {
                if (_verboseLogging)
                    Debug.LogWarning($"[PetApiClient] Config save failed: {req.responseCode} {req.error}");
            }
        }

        private IEnumerator FetchSyncConfigRoutine()
        {
            yield return EnsureAuth();
            if (!IsLoggedIn) yield break;

            using var req = UnityWebRequest.Get($"{_baseUrl}/api/pet/sync");
            req.SetRequestHeader("Authorization", $"Bearer {_accessToken}");

            yield return req.SendWebRequest();

            if (req.result == UnityWebRequest.Result.Success)
            {
                var json = req.downloadHandler.text;
                var response = JsonUtility.FromJson<SyncConfigResponse>(json);

                if (response != null && response.success && response.data != null)
                {
                    var sync = response.data;
                    if (_verboseLogging)
                        Debug.Log($"[PetApiClient] Sync config fetched: " +
                                  $"name={sync.petName}, model={sync.animationModel}, " +
                                  $"params={sync.@params?.Length ?? 0} entries, " +
                                  $"hasAzureSpeech={!string.IsNullOrEmpty(sync.azureSpeechKey)}, " +
                                  $"hasOpenAI={!string.IsNullOrEmpty(sync.openaiApiKey)}, " +
                                  $"assets={sync.mappedAssets?.Length ?? 0}");

                    // Apply API keys to local AppConfig
                    var mgr = ConfigManager.Instance;
                    if (mgr != null)
                    {
                        var cfg = mgr.CurrentConfig;
                        bool changed = false;

                        if (!string.IsNullOrEmpty(sync.azureSpeechKey) && cfg.azure_speech_key != sync.azureSpeechKey)
                        { cfg.azure_speech_key = sync.azureSpeechKey; changed = true; }
                        if (!string.IsNullOrEmpty(sync.azureSpeechRegion) && cfg.azure_speech_region != sync.azureSpeechRegion)
                        { cfg.azure_speech_region = sync.azureSpeechRegion; changed = true; }
                        if (!string.IsNullOrEmpty(sync.openaiApiKey) && cfg.openai_api_key != sync.openaiApiKey)
                        { cfg.openai_api_key = sync.openaiApiKey; changed = true; }
                        if (!string.IsNullOrEmpty(sync.openaiBaseUrl) && cfg.openai_base_url != sync.openaiBaseUrl)
                        { cfg.openai_base_url = sync.openaiBaseUrl; changed = true; }
                        if (!string.IsNullOrEmpty(sync.petName) && cfg.character_name != sync.petName)
                        { cfg.character_name = sync.petName; changed = true; }
                        if (!string.IsNullOrEmpty(sync.modelPath) && cfg.model_path != sync.modelPath)
                        { cfg.model_path = sync.modelPath; changed = true; }

                        if (changed)
                        {
                            mgr.SaveConfig(cfg);
                            if (_verboseLogging)
                                Debug.Log("[PetApiClient] AppConfig updated from sync endpoint.");
                        }
                    }

                    // Also fetch regular config to apply model params
                    yield return FetchConfigRoutine();
                }
            }
            else if (req.responseCode == 401 || req.responseCode == 403)
            {
                _accessToken = null;
                yield return EnsureAuth();
                if (IsLoggedIn)
                    yield return FetchSyncConfigRoutine();
            }
            else
            {
                var err = $"Sync config fetch failed: {req.responseCode} {req.error}";
                if (_verboseLogging) Debug.LogWarning($"[PetApiClient] {err}");
                // Fall back to regular config fetch
                yield return FetchConfigRoutine();
            }
        }

        #endregion

        #region Token Persistence

        private void PersistTokens()
        {
            Data.DataStore.Instance.SaveAuthTokens(_accessToken, _refreshToken);
        }

        #endregion

        #region Model Application

        private void ApplyConfigToModel(PetConfigData config)
        {
            var animator = Animation.PetAnimationManager.Instance?.CurrentAnimator;
            if (animator == null)
            {
                if (_verboseLogging)
                    Debug.Log("[PetApiClient] No PetAnimationManager/CurrentAnimator — skipping param sync.");
                return;
            }

            int applied = 0;

            // Apply blendshape/parameter entries via IPetAnimator
            if (config.params_entries != null)
            {
                foreach (var entry in config.params_entries)
                {
                    switch (entry.key)
                    {
                        case "MouthOpen": animator.SetMouthOpen(entry.value); applied++; break;
                        case "EyeOpen": animator.SetEyeOpen(entry.value); applied++; break;
                        case "TailWag": animator.SetTailWag(entry.value); applied++; break;
                        case "TailSwing": animator.SetTailSwing(entry.value); applied++; break;
                        case "EarL": animator.SetEarPose(entry.value, 0f); applied++; break;
                        case "EarR": animator.SetEarPose(0f, entry.value); applied++; break;
                    }
                }
            }

            // Apply body params
            if (config.body_params_entries != null)
            {
                float bx = 0f, by = 0f, bz = 0f;
                foreach (var entry in config.body_params_entries)
                {
                    switch (entry.key)
                    {
                        case "AngleX": bx = entry.value; break;
                        case "AngleY": by = entry.value; break;
                        case "AngleZ": bz = entry.value; break;
                    }
                }
                animator.SetBodyPose(bx, by, bz);
                applied++;
            }

            if (_verboseLogging)
                Debug.Log($"[PetApiClient] Applied config params via IPetAnimator ({animator.GetType().Name}).");
        }

        private void ApplyCharacterSettings(PetConfigData config)
        {
            if (config.character == null) return;

            var mgr = ConfigManager.Instance;
            if (mgr == null) return;

            var cfg = mgr.CurrentConfig;
            bool changed = false;

            if (!string.IsNullOrEmpty(config.character.name) && cfg.character_name != config.character.name)
            { cfg.character_name = config.character.name; changed = true; }
            if (!string.IsNullOrEmpty(config.character.personality) && cfg.character_personality != config.character.personality)
            { cfg.character_personality = config.character.personality; changed = true; }
            if (!string.IsNullOrEmpty(config.character.backstory) && cfg.character_backstory != config.character.backstory)
            { cfg.character_backstory = config.character.backstory; changed = true; }

            if (changed)
            {
                mgr.SaveConfig(cfg);
                if (_verboseLogging)
                    Debug.Log("[PetApiClient] Character settings synced from web.");
            }
        }

        #endregion

        #region Type Conversion

        private static PetConfigData ConvertFromJson(ConfigDataJson src)
        {
            return new PetConfigData
            {
                version = src.version,
                params_entries = src.@params ?? new ParamEntry[0],
                body_params_entries = src.body_params ?? new ParamEntry[0],
                equippedParts = src.equipped_parts ?? new EquippedPartData[0],
                character = src.character ?? new CharacterData
                {
                    name = "星尘",
                    personality = "",
                    backstory = "",
                },
            };
        }

        private static ConfigDataJson ConvertToJson(PetConfigData src)
        {
            return new ConfigDataJson
            {
                version = src.version,
                @params = src.params_entries ?? new ParamEntry[0],
                body_params = src.body_params_entries ?? new ParamEntry[0],
                equipped_parts = src.equippedParts ?? new EquippedPartData[0],
                material_overrides = "",
            };
        }

        #endregion

        #region Utility

        private static string ExtractCookieValue(string setCookie, string cookieName)
        {
            if (string.IsNullOrEmpty(setCookie)) return null;
            var search = $"{cookieName}=";
            var idx = setCookie.IndexOf(search, StringComparison.Ordinal);
            if (idx < 0) return null;
            idx += search.Length;
            var end = setCookie.IndexOf(';', idx);
            if (end < 0) end = setCookie.Length;
            return setCookie.Substring(idx, end - idx);
        }

        private static string EscapeJson(string s)
        {
            if (string.IsNullOrEmpty(s)) return s;
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"");
        }

        #endregion

        #region JSON Response Types (internal — match API keys exactly)

        [Serializable]
        private class LoginResponse
        {
            public bool success;
            public string error;
            public LoginData data;
        }

        [Serializable]
        private class LoginData
        {
            public string accessToken;
            public UserData user;
        }

        [Serializable]
        private class UserData
        {
            public string id;
            public string email;
            public string username;
            public string avatar_url;
            public string role;
        }

        [Serializable]
        private class ConfigResponse
        {
            public bool success;
            public string error;
            public ConfigDataJson data;
        }

        /// <summary>Internal JSON wire type. Field names match API keys exactly.</summary>
        [Serializable]
        private class ConfigDataJson
        {
            public int version;
            public ParamEntry[] @params;
            public ParamEntry[] body_params;
            public EquippedPartData[] equipped_parts;
            public string material_overrides;
            public CharacterData character;
        }

        [Serializable]
        private class SaveConfigResponse
        {
            public bool success;
            public string error;
            public SaveConfigData data;
        }

        [Serializable]
        private class SaveConfigData
        {
            public int version;
        }

        [Serializable]
        private sealed class SyncConfigResponse
        {
            public bool success;
            public string error;
            public SyncConfigData data;
        }

        /// <summary>Full pet config from /api/pet/sync (includes decrypted API keys).</summary>
        [Serializable]
        private sealed class SyncConfigData
        {
            public int version;
            public string petName;
            public string personality;
            public string backstory;
            public string animationModel;
            public string azureSpeechKey;
            public string azureSpeechRegion;
            public string openaiApiKey;
            public string openaiBaseUrl;
            public string ffmpegPath;
            public float idleTimeout;
            public float wanderInterval;
            public string avatarId;
            public string modelPath;
            public ParamEntry[] @params;
            public ParamEntry[] bodyParams;
            public EquippedPartData[] equippedParts;
            public SyncAssetMapping[] mappedAssets;
        }

        [Serializable]
        private sealed class SyncAssetMapping
        {
            public string slotName;
            public string assetId;
            public string assetType;
        }

        #endregion

        #region Public Types (stable API)

        [Serializable]
        public sealed class PetConfigData
        {
            public int version;
            public ParamEntry[] params_entries;
            public ParamEntry[] body_params_entries;
            public EquippedPartData[] equippedParts;
            public CharacterData character;
        }

        [Serializable]
        public sealed class ParamEntry
        {
            public string key;
            public float value;
        }

        [Serializable]
        public sealed class EquippedPartData
        {
            public string slot;
            public string part_id;
        }

        [Serializable]
        public sealed class CharacterData
        {
            public string name;
            public string personality;
            public string backstory;
        }

        #endregion
    }
}
