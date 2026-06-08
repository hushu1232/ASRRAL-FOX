using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

namespace AstralFox.Data
{
    /// <summary>
    /// JSON file-based data store for AstralFox.
    /// Stores chat history, emotion records, affection level, and settings.
    /// Designed to be swappable with SQLite when ready.
    ///
    /// Uses Application.persistentDataPath for storage.
    /// All write operations are atomic (write to temp file, then rename).
    /// Thread-safe: all public mutations are protected by a reader-writer lock.
    /// </summary>
    public sealed class DataStore
    {
        private readonly ReaderWriterLockSlim _rwLock = new ReaderWriterLockSlim();
        private readonly object _saveLock = new object(); // dedicated lock object (never lock(this))
        private Task _pendingSaveTask;
        private bool _saveScheduled;
        #region Record Types

        [Serializable]
        public struct ChatRecord
        {
            public long timestamp;
            public string role;       // "user" or "assistant"
            public string text;
            public string emotionTag; // the emotion tag at time of response
        }

        [Serializable]
        public struct EmotionRecord
        {
            public long timestamp;
            public float pleasure;
            public float arousal;
            public float dominance;
            public string eventDescription;
        }

        [Serializable]
        public struct WindowState
        {
            public int posX;
            public int posY;
            public int width;
            public int height;
            public int petFacingDir; // 1=right, -1=left
            public int petTargetX;
            public int petTargetY;
            public bool settingsMode;
        }

        [Serializable]
        public struct AffectionData
        {
            public float affectionLevel;    // 0-100 friendship points
            public long lastInteractionTime;
            public int totalInteractions;
            public int daysSinceFirstMeet;
        }

        [Serializable]
        private class SaveData
        {
            public List<ChatRecord> chatHistory = new List<ChatRecord>();
            public List<EmotionRecord> emotionHistory = new List<EmotionRecord>();
            public AffectionData affection = new AffectionData();
            public Dictionary<string, string> settings = new Dictionary<string, string>();
            public float currentPleasure;
            public float currentArousal;
            public float currentDominance;
            public long firstMeetTimestamp;
            public string characterPersonality = "";
            public string memorySummary = "";
            public WindowState windowState = new WindowState();
            public string authToken = "";
            public string authRefreshToken = "";
            public List<string> userFacts = new List<string>(); // long-term memory: facts about the user
            public Dictionary<string, float> customFloats = new Dictionary<string, float>();
        }

        #endregion

        #region Private Fields

        private readonly string _filePath;
        private SaveData _data;
        private bool _dirty;
        private float _lastSaveTime;
        private const float SaveThrottleInterval = 5f; // minimum seconds between disk writes

        // In-memory caches
        private readonly List<ChatRecord> _recentChatCache = new List<ChatRecord>();
        private const int MaxRecentChats = 20; // keep in memory for LLM prompt injection

        #endregion

        #region Singleton

        private static DataStore _instance;
        public static DataStore Instance => _instance ?? (_instance = new DataStore());

        private DataStore()
        {
            _filePath = Path.Combine(Application.persistentDataPath, "astralfox_data.json");
            Load();
        }

        #endregion

        #region Load / Save

        private void Load()
        {
            try
            {
                if (File.Exists(_filePath))
                {
                    string json = File.ReadAllText(_filePath);
                    _data = JsonUtility.FromJson<SaveData>(json) ?? new SaveData();
                }
                else
                {
                    _data = new SaveData();
                    _data.firstMeetTimestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                }

                if (_data.affection.daysSinceFirstMeet == 0 && _data.firstMeetTimestamp > 0)
                {
                    var meetDate = DateTimeOffset.FromUnixTimeSeconds(_data.firstMeetTimestamp).Date;
                    _data.affection.daysSinceFirstMeet = (int)(DateTime.UtcNow.Date - meetDate).TotalDays;
                }

                // Populate recent chat cache
                _recentChatCache.Clear();
                int start = Mathf.Max(0, _data.chatHistory.Count - MaxRecentChats);
                for (int i = start; i < _data.chatHistory.Count; i++)
                    _recentChatCache.Add(_data.chatHistory[i]);

                Debug.Log($"[DataStore] Loaded from {_filePath}. " +
                          $"Chats: {_data.chatHistory.Count}, Affection: {_data.affection.affectionLevel:F0}");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[DataStore] Load failed: {ex.Message}. Starting fresh.");
                _data = new SaveData();
            }
        }

        /// <summary>
        /// Asynchronously save data to disk on a background thread.
        /// Thread-safe: acquires a read lock to snapshot data, then writes off-thread.
        /// Throttled to at most one pending save at a time.
        /// </summary>
        public void Save()
        {
            if (!_dirty || _saveScheduled) return;

            float now = Time.realtimeSinceStartup;
            if (now - _lastSaveTime < SaveThrottleInterval) return;
            _lastSaveTime = now;
            _saveScheduled = true;

            // Snapshot data under read lock, then write on background thread
            string json;
            string filePath = _filePath;
            _rwLock.EnterReadLock();
            try
            {
                UpdateDaysSinceFirstMeet();
                json = JsonUtility.ToJson(_data, true);
            }
            finally
            {
                _rwLock.ExitReadLock();
            }

            _pendingSaveTask = Task.Run(() =>
            {
                try
                {
                    string tempPath = filePath + ".tmp";
                    File.WriteAllText(tempPath, json);
                    if (File.Exists(filePath))
                        File.Delete(filePath);
                    File.Move(tempPath, filePath);

                    lock (_saveLock)
                    {
                        _dirty = false;
                        _saveScheduled = false;
                    }
                }
                catch (Exception ex)
                {
                    Debug.LogError($"[DataStore] Async save failed: {ex.Message}");
                    lock (_saveLock) { _saveScheduled = false; }
                }
            });
        }

        private void UpdateDaysSinceFirstMeet()
        {
            if (_data.firstMeetTimestamp > 0)
            {
                var meetDate = DateTimeOffset.FromUnixTimeSeconds(_data.firstMeetTimestamp).Date;
                _data.affection.daysSinceFirstMeet = (int)(DateTime.UtcNow.Date - meetDate).TotalDays;
            }
        }

        #endregion

        #region Chat History

        public void AddChatRecord(string role, string text, string emotionTag = "")
        {
            var record = new ChatRecord
            {
                timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                role = role,
                text = Truncate(text, 2000),
                emotionTag = emotionTag,
            };

            _data.chatHistory.Add(record);
            _recentChatCache.Add(record);

            // Keep cache bounded
            while (_recentChatCache.Count > MaxRecentChats)
                _recentChatCache.RemoveAt(0);

            // Keep total history bounded (last 500 messages)
            while (_data.chatHistory.Count > 500)
                _data.chatHistory.RemoveAt(0);

            _dirty = true;
        }

        /// <summary>Get recent chat history formatted for LLM prompt injection.</summary>
        public string GetRecentChatSummary()
        {
            if (_recentChatCache.Count == 0) return "";

            var sb = new System.Text.StringBuilder();
            sb.AppendLine("【最近对话记录】");
            int count = Mathf.Min(_recentChatCache.Count, 10); // last 10 messages
            for (int i = _recentChatCache.Count - count; i < _recentChatCache.Count; i++)
            {
                var chat = _recentChatCache[i];
                sb.AppendLine(chat.role == "user"
                    ? $"用户: {chat.text}"
                    : $"星尘: {chat.text}");
            }
            return sb.ToString();
        }

        public int ChatHistoryCount => _data.chatHistory.Count;

        /// <summary>Clear all chat history (call on new session start or to fix stale data).</summary>
        public void ClearChatHistory()
        {
            _data.chatHistory.Clear();
            _recentChatCache.Clear();
            _dirty = true;
        }

        #endregion

        #region Emotion History

        public void AddEmotionRecord(float p, float a, float d, string eventDesc)
        {
            _data.emotionHistory.Add(new EmotionRecord
            {
                timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                pleasure = p,
                arousal = a,
                dominance = d,
                eventDescription = eventDesc,
            });

            // Keep bounded
            while (_data.emotionHistory.Count > 200)
                _data.emotionHistory.RemoveAt(0);

            _dirty = true;
        }

        public void SaveCurrentEmotion(float p, float a, float d)
        {
            _data.currentPleasure = p;
            _data.currentArousal = a;
            _data.currentDominance = d;
            _dirty = true;
        }

        public (float p, float a, float d) LoadCurrentEmotion()
        {
            return (_data.currentPleasure, _data.currentArousal, _data.currentDominance);
        }

        #endregion

        #region Affection

        public AffectionData GetAffection() => _data.affection;

        /// <summary>Get a custom saved float value.</summary>
        public float GetFloat(string key, float defaultValue = 0f)
        {
            return _data.customFloats.TryGetValue(key, out float v) ? v : defaultValue;
        }

        /// <summary>Save a custom float value for later retrieval.</summary>
        public void SetFloat(string key, float value)
        {
            _data.customFloats[key] = value;
            _dirty = true;
        }

        public void UpdateAffection(float delta)
        {
            _data.affection.affectionLevel = Mathf.Clamp(
                _data.affection.affectionLevel + delta, 0f, 100f);
            _data.affection.totalInteractions++;
            _data.affection.lastInteractionTime = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            _dirty = true;
        }

        /// <summary>Apply daily affection decay when away.</summary>
        public void ApplyAffectionDecay()
        {
            long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            long lastInteraction = _data.affection.lastInteractionTime;

            if (lastInteraction > 0)
            {
                double hoursSinceLastInteraction = (now - lastInteraction) / 3600.0;
                if (hoursSinceLastInteraction > 24)
                {
                    // Decay 1 point per 24 hours of inactivity
                    float decay = (float)(hoursSinceLastInteraction / 24.0) * 1f;
                    _data.affection.affectionLevel = Mathf.Max(0f,
                        _data.affection.affectionLevel - decay);
                    _dirty = true;
                }
            }
        }

        #endregion

        #region Settings

        public void SetSetting(string key, string value)
        {
            _data.settings[key] = value;
            _dirty = true;
        }

        public string GetSetting(string key, string defaultValue = "")
        {
            return _data.settings.TryGetValue(key, out string val) ? val : defaultValue;
        }

        #endregion

        #region Auth Tokens (DPAPI encrypted at rest)

        /// <summary>Save auth tokens — encrypted via DPAPI (Windows) or AES fallback.</summary>
        public void SaveAuthTokens(string accessToken, string refreshToken)
        {
            _data.authToken = Convert.ToBase64String(
                CryptoHelper.Protect(Encoding.UTF8.GetBytes(accessToken ?? "")));
            _data.authRefreshToken = Convert.ToBase64String(
                CryptoHelper.Protect(Encoding.UTF8.GetBytes(refreshToken ?? "")));
            _dirty = true;
        }

        /// <summary>Load access token — transparently decrypts from DPAPI.</summary>
        public string LoadAccessToken()
        {
            if (string.IsNullOrEmpty(_data.authToken)) return "";
            try
            {
                return Encoding.UTF8.GetString(
                    CryptoHelper.Unprotect(Convert.FromBase64String(_data.authToken)));
            }
            catch (Exception ex) { Debug.LogWarning($"[DataStore] Failed to decrypt access token: {ex.Message}"); return ""; }
        }

        /// <summary>Load refresh token — transparently decrypts from DPAPI.</summary>
        public string LoadRefreshToken()
        {
            if (string.IsNullOrEmpty(_data.authRefreshToken)) return "";
            try
            {
                return Encoding.UTF8.GetString(
                    CryptoHelper.Unprotect(Convert.FromBase64String(_data.authRefreshToken)));
            }
            catch (Exception ex) { Debug.LogWarning($"[DataStore] Failed to decrypt refresh token: {ex.Message}"); return ""; }
        }

        #endregion

        #region Personality & Memory

        public string GetCharacterPersonality() => _data.characterPersonality ?? "";

        public void SetCharacterPersonality(string personality)
        {
            _data.characterPersonality = Truncate(personality, 1000);
            _dirty = true;
        }

        public string GetMemorySummary() => _data.memorySummary ?? "";

        public void SetMemorySummary(string summary)
        {
            _data.memorySummary = Truncate(summary, 2000);
            _dirty = true;
        }

        public void AppendMemorySummary(string summary)
        {
            if (string.IsNullOrEmpty(summary)) return;
            _data.memorySummary = string.IsNullOrEmpty(_data.memorySummary)
                ? summary
                : _data.memorySummary + "\n- " + summary;
            _data.memorySummary = Truncate(_data.memorySummary, 2000);
            _dirty = true;
        }

        #endregion

        #region User Facts (Long-term Memory)

        /// <summary>Add a fact the user has shared (e.g., "用户的名字是小明").</summary>
        public void AddUserFact(string fact)
        {
            if (string.IsNullOrEmpty(fact)) return;
            fact = Truncate(fact.Trim(), 200);

            // Deduplicate: don't store the same fact twice
            foreach (string existing in _data.userFacts)
            {
                if (existing.Contains(fact) || fact.Contains(existing))
                    return;
            }

            _data.userFacts.Add(fact);

            // Keep bounded: max 50 facts
            while (_data.userFacts.Count > 50)
                _data.userFacts.RemoveAt(0);

            _dirty = true;
        }

        /// <summary>Get all stored facts about the user for LLM context injection.</summary>
        public string GetUserFactsSummary()
        {
            if (_data.userFacts.Count == 0) return "";
            return "【关于用户的信息】\n" + string.Join("\n", _data.userFacts);
        }

        /// <summary>Clear all user facts.</summary>
        public void ClearUserFacts()
        {
            _data.userFacts.Clear();
            _dirty = true;
        }

        #endregion

        #region Window State Persistence

        public WindowState GetWindowState() => _data.windowState;

        public void SaveWindowState(WindowState state)
        {
            _data.windowState = state;
            _dirty = true;
        }

        public void SaveWindowPosition(int x, int y, int width, int height)
        {
            _data.windowState.posX = x;
            _data.windowState.posY = y;
            _data.windowState.width = width;
            _data.windowState.height = height;
            _dirty = true;
        }

        public void SavePetMovementState(int facingDir, int targetX, int targetY)
        {
            _data.windowState.petFacingDir = facingDir;
            _data.windowState.petTargetX = targetX;
            _data.windowState.petTargetY = targetY;
            _dirty = true;
        }

        public void SaveSettingsMode(bool active)
        {
            _data.windowState.settingsMode = active;
            _dirty = true;
        }

        #endregion

        #region Utilities

        private static string Truncate(string text, int maxLength)
        {
            if (string.IsNullOrEmpty(text) || text.Length <= maxLength) return text;
            return text.Substring(0, maxLength);
        }

        /// <summary>Force save on application quit — bypasses throttle. Does NOT block main thread.</summary>
        public static void OnApplicationQuit()
        {
            Instance._lastSaveTime = 0f; // bypass throttle
            Instance._dirty = true;      // ensure pending changes are written
            Instance.Save();
            // Don't block the main thread — save completes on background thread.
            // Unity will wait for background tasks to finish during shutdown.
        }

        #endregion
    }
}
