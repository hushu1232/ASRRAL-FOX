using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using AstralFox.Diagnostics;
using UnityEngine;

namespace AstralFox.Config
{
    /// <summary>
    /// Encrypted configuration manager for AstralFox.
    ///
    /// Storage: Application.persistentDataPath/config.enc
    /// Encryption: DPAPI (Windows, user-bound) or AES-256-CBC + HMAC-SHA256 (fallback).
    /// Backward-compatible: reads old PBKDF2(deviceId) format and auto-upgrades.
    ///
    /// Usage:
    ///   var cfg = ConfigManager.Instance.CurrentConfig;
    ///   cfg.character_name = "小星";
    ///   ConfigManager.Instance.SaveConfig(cfg);
    /// </summary>
    public sealed class ConfigManager
    {
        #region Singleton

        private static ConfigManager _instance;
        public static ConfigManager Instance => _instance ?? (_instance = new ConfigManager());

        #endregion

        #region Events

        public event Action<AppConfig> OnConfigChanged;

        #endregion

        #region Constants

        private const int Pbkdf2Iterations = 100_000;
        private const int KeySizeBytes = 32;       // AES-256
        private const int IvSizeBytes = 16;         // AES block size
        private const int HmacSizeBytes = 32;       // SHA-256
        private const int FileVersion = 2; // v2 = DPAPI (or random-salt AES fallback)
        private const int HeaderSize = 4;

        // Fixed salt mixed with device ID (DO NOT CHANGE after initial deployment)
        private static readonly byte[] FixedSalt = Encoding.UTF8.GetBytes(
            "AstralFox.Config.Salt.v1!@#STARDUST_FOX_2024");

        #endregion

        #region Fields

        private readonly string _filePath;
        private AppConfig _currentConfig;
        private readonly object _lock = new object();

        #endregion

        #region Constructor

        private ConfigManager()
        {
            try
            {
                _filePath = Path.Combine(Application.persistentDataPath, "config.enc");
                Load();
            }
            catch (Exception ex)
            {
                Debug.LogError($"[ConfigManager] Init failed: {ex.Message}. Using default config.");
                Diagnostics.CrashHandler.LogError($"ConfigManager init failed: {ex.Message}", ex.StackTrace);
                _filePath = Path.Combine(Path.GetTempPath(), "AstralFox_config.enc");
                _currentConfig = new AppConfig();
            }
        }

        #endregion

        #region Properties

        public AppConfig CurrentConfig
        {
            get
            {
                lock (_lock)
                    return _currentConfig.Clone();
            }
        }

        /// <summary>Direct reference to current config (use with care, call Save after modifying).</summary>
        internal AppConfig CurrentConfigRef
        {
            get
            {
                lock (_lock)
                    return _currentConfig;
            }
        }

        #endregion

        #region Public API

        /// <summary>Save config to encrypted file and notify subscribers.</summary>
        public void SaveConfig(AppConfig config)
        {
            if (config == null) return;

            lock (_lock)
            {
                _currentConfig = config.Clone();
                _currentConfig.RepairMissingFields();
            }

            try
            {
                string json = JsonUtility.ToJson(_currentConfig, true);
                byte[] plaintext = Encoding.UTF8.GetBytes(json);
                byte[] encrypted = Encrypt(plaintext);
                File.WriteAllBytes(_filePath, encrypted);

                Debug.Log($"[ConfigManager] Config saved to {_filePath}");
                OnConfigChanged?.Invoke(_currentConfig.Clone());
            }
            catch (Exception ex)
            {
                Debug.LogError($"[ConfigManager] Save failed: {ex.Message}");
            }
        }

        /// <summary>Reload config from disk, discarding unsaved changes.</summary>
        public void ReloadConfig()
        {
            Load();
        }

        /// <summary>Check if an encrypted config file exists.</summary>
        public bool ConfigFileExists => File.Exists(_filePath);

        /// <summary>
        /// Export all data as a portable, password-encrypted backup file.
        /// Uses PBKDF2(userPassword, randomSalt, 200k iterations) → AES-256-CBC + HMAC.
        /// </summary>
        public static byte[] ExportEncryptedBackup(string password)
        {
            // Gather all data
            var config = Instance.CurrentConfig;
            var dataFile = Path.Combine(Application.persistentDataPath, "astralfox_data.json");

            var backup = new System.Collections.Generic.Dictionary<string, string>
            {
                ["config"] = JsonUtility.ToJson(config, true),
                ["data"] = File.Exists(dataFile) ? File.ReadAllText(dataFile) : "{}",
                ["version"] = "1",
                ["exported_at"] = DateTimeOffset.UtcNow.ToString("o"),
            };

            string json = JsonUtility.ToJson(new ExportPayload
            {
                config_json = backup["config"],
                data_json = backup["data"],
                version = backup["version"],
                exported_at = backup["exported_at"],
            });

            byte[] plaintext = Encoding.UTF8.GetBytes(json);

            // Derive key from password
            byte[] salt = new byte[32];
            using (var rng = RandomNumberGenerator.Create())
                rng.GetBytes(salt);

            byte[] keyMaterial;
            using (var pbkdf2 = new Rfc2898DeriveBytes(password, salt, 200_000, HashAlgorithmName.SHA256))
                keyMaterial = pbkdf2.GetBytes(64); // 32 AES + 32 HMAC

            byte[] aesKey = new byte[32];
            byte[] hmacKey = new byte[32];
            Buffer.BlockCopy(keyMaterial, 0, aesKey, 0, 32);
            Buffer.BlockCopy(keyMaterial, 32, hmacKey, 0, 32);

            byte[] iv = new byte[16];
            using (var rng = RandomNumberGenerator.Create())
                rng.GetBytes(iv);

            byte[] ciphertext;
            using (var aes = Aes.Create())
            {
                aes.Key = aesKey;
                aes.IV = iv;
                aes.Mode = CipherMode.CBC;
                aes.Padding = PaddingMode.PKCS7;
                using var ms = new MemoryStream();
                using (var cs = new CryptoStream(ms, aes.CreateEncryptor(), CryptoStreamMode.Write))
                    cs.Write(plaintext, 0, plaintext.Length);
                ciphertext = ms.ToArray();
            }

            byte[] hmac;
            using (var hmacAlg = new HMACSHA256(hmacKey))
            {
                byte[] combined = new byte[iv.Length + ciphertext.Length];
                Buffer.BlockCopy(iv, 0, combined, 0, iv.Length);
                Buffer.BlockCopy(ciphertext, 0, combined, iv.Length, ciphertext.Length);
                hmac = hmacAlg.ComputeHash(combined);
            }

            // Pack: [salt:32][IV:16][HMAC:32][ciphertext:N]
            byte[] output = new byte[32 + 16 + 32 + ciphertext.Length];
            Buffer.BlockCopy(salt, 0, output, 0, 32);
            Buffer.BlockCopy(iv, 0, output, 32, 16);
            Buffer.BlockCopy(hmac, 0, output, 48, 32);
            Buffer.BlockCopy(ciphertext, 0, output, 80, ciphertext.Length);
            return output;
        }

        /// <summary>Import data from a password-encrypted backup file.</summary>
        public static bool ImportEncryptedBackup(string password, byte[] backupData)
        {
            if (backupData.Length < 96) return false; // min: salt+IV+HMAC+1 block

            try
            {
                byte[] salt = new byte[32];
                byte[] iv = new byte[16];
                byte[] hmac = new byte[32];
                byte[] ciphertext = new byte[backupData.Length - 80];
                Buffer.BlockCopy(backupData, 0, salt, 0, 32);
                Buffer.BlockCopy(backupData, 32, iv, 0, 16);
                Buffer.BlockCopy(backupData, 48, hmac, 0, 32);
                Buffer.BlockCopy(backupData, 80, ciphertext, 0, ciphertext.Length);

                byte[] keyMaterial;
                using (var pbkdf2 = new Rfc2898DeriveBytes(password, salt, 200_000, HashAlgorithmName.SHA256))
                    keyMaterial = pbkdf2.GetBytes(64);

                byte[] hmacKey = new byte[32];
                Buffer.BlockCopy(keyMaterial, 32, hmacKey, 0, 32);

                // Verify HMAC
                using (var hmacAlg = new HMACSHA256(hmacKey))
                {
                    byte[] combined = new byte[16 + ciphertext.Length];
                    Buffer.BlockCopy(iv, 0, combined, 0, 16);
                    Buffer.BlockCopy(ciphertext, 0, combined, 16, ciphertext.Length);
                    if (!ConstantTimeEquals(hmac, hmacAlg.ComputeHash(combined)))
                        return false;
                }

                byte[] aesKey = new byte[32];
                Buffer.BlockCopy(keyMaterial, 0, aesKey, 0, 32);

                byte[] plaintext;
                using (var aes = Aes.Create())
                {
                    aes.Key = aesKey;
                    aes.IV = iv;
                    aes.Mode = CipherMode.CBC;
                    aes.Padding = PaddingMode.PKCS7;
                    using var ms = new MemoryStream(ciphertext);
                    using var cs = new CryptoStream(ms, aes.CreateDecryptor(), CryptoStreamMode.Read);
                    using var result = new MemoryStream();
                    cs.CopyTo(result);
                    plaintext = result.ToArray();
                }

                string json = Encoding.UTF8.GetString(plaintext);
                var payload = JsonUtility.FromJson<ExportPayload>(json);
                if (payload == null) return false;

                // Restore config
                var config = JsonUtility.FromJson<AppConfig>(payload.config_json);
                if (config != null)
                    Instance.SaveConfig(config);

                // Restore data
                string dataPath = Path.Combine(Application.persistentDataPath, "astralfox_data.json");
                File.WriteAllText(dataPath, payload.data_json ?? "{}");

                // Reload
                Instance.ReloadConfig();
                Data.DataStore.Instance.OnApplicationQuit(); // force re-read

                Debug.Log("[ConfigManager] Backup imported successfully.");
                return true;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[ConfigManager] Import failed: {ex.Message}");
                return false;
            }
        }

        [Serializable]
        private class ExportPayload
        {
            public string config_json;
            public string data_json;
            public string version;
            public string exported_at;
        }

        #endregion

        #region Load (with error recovery)

        private void Load()
        {
            lock (_lock)
            {
                if (File.Exists(_filePath))
                {
                    try
                    {
                        byte[] encrypted = File.ReadAllBytes(_filePath);
                        byte[] plaintext = Decrypt(encrypted);
                        string json = Encoding.UTF8.GetString(plaintext);
                        _currentConfig = JsonUtility.FromJson<AppConfig>(json) ?? new AppConfig();

                        bool repaired = _currentConfig.RepairMissingFields();
                        if (repaired)
                        {
                            Debug.Log("[ConfigManager] Repaired missing fields in config. Saving...");
                            SaveCurrentImmediate();
                        }

                        Debug.Log(FormatConfigLog(_currentConfig));
                        return;
                    }
                    catch (Exception ex)
                    {
                        Debug.LogError($"[ConfigManager] Failed to load config: {ex.Message}. " +
                                       "Creating default config.");
                    }
                }

                // First run or corrupted file — use defaults
                _currentConfig = new AppConfig();
                Debug.Log("[ConfigManager] Using default config (first run or corrupted file). " +
                          _currentConfig.NeedsFirstTimeSetup);
            }
        }

        private void SaveCurrentImmediate()
        {
            try
            {
                string json = JsonUtility.ToJson(_currentConfig, true);
                byte[] encrypted = Encrypt(Encoding.UTF8.GetBytes(json));
                File.WriteAllBytes(_filePath, encrypted);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[ConfigManager] Auto-save failed: {ex.Message}");
            }
        }

        #endregion

        #region Encryption (DPAPI on Windows, AES-CBC-HMAC fallback)

        private byte[] Encrypt(byte[] plaintext)
        {
            byte[] protectedData = AstralFox.Data.CryptoHelper.Protect(plaintext);

            // Pack: [version:4][protectedData:N]
            byte[] output = new byte[HeaderSize + protectedData.Length];
            Buffer.BlockCopy(BitConverter.GetBytes(FileVersion), 0, output, 0, HeaderSize);
            Buffer.BlockCopy(protectedData, 0, output, HeaderSize, protectedData.Length);
            return output;
        }

        private byte[] Decrypt(byte[] data)
        {
            if (data.Length < HeaderSize)
                throw new FormatException("Config file is too short or corrupted.");

            int version = BitConverter.ToInt32(data, 0);

            int payloadLen = data.Length - HeaderSize;
            byte[] payload = new byte[payloadLen];
            Buffer.BlockCopy(data, HeaderSize, payload, 0, payloadLen);

            if (version == 2)
            {
                // DPAPI / random-salt AES fallback
                return AstralFox.Data.CryptoHelper.Unprotect(payload);
            }
            else if (version == 1)
            {
                // Legacy format: PBKDF2(deviceId + hardcoded salt). Read then auto-upgrade.
                byte[] plaintext = DecryptLegacy(payload);
                // Auto-upgrade to v2 on next save
                return plaintext;
            }

            throw new NotSupportedException($"Unsupported config version: {version}");
        }

        // ── Legacy v1 decryption (PBKDF2 + hardcoded salt) ────────
        // Kept for backward compatibility. Auto-upgrades to v2 on next save.

        private static readonly byte[] FixedSalt = Encoding.UTF8.GetBytes(
            "AstralFox.Config.Salt.v1!@#STARDUST_FOX_2024");

        private byte[] DecryptLegacy(byte[] data)
        {
            if (data.Length < IvSizeBytes + HmacSizeBytes + 16)
                throw new FormatException("Legacy config data too short.");

            byte[] iv = new byte[IvSizeBytes];
            byte[] hmac = new byte[HmacSizeBytes];
            Buffer.BlockCopy(data, 0, iv, 0, IvSizeBytes);
            Buffer.BlockCopy(data, IvSizeBytes, hmac, 0, HmacSizeBytes);

            int cipherLen = data.Length - IvSizeBytes - HmacSizeBytes;
            byte[] ciphertext = new byte[cipherLen];
            Buffer.BlockCopy(data, IvSizeBytes + HmacSizeBytes, ciphertext, 0, cipherLen);

            byte[] key = DeriveLegacyKey();
            byte[] expectedHmac = ComputeHmac(key, iv, ciphertext);
            if (!ConstantTimeEquals(hmac, expectedHmac))
                throw new CryptographicException("Config file integrity check failed (HMAC mismatch).");

            using var aes = Aes.Create();
            aes.Key = key;
            aes.IV = iv;
            aes.Mode = CipherMode.CBC;
            aes.Padding = PaddingMode.PKCS7;
            using var ms = new MemoryStream(ciphertext);
            using var cs = new CryptoStream(ms, aes.CreateDecryptor(), CryptoStreamMode.Read);
            using var result = new MemoryStream();
            cs.CopyTo(result);
            return result.ToArray();
        }

        private byte[] DeriveLegacyKey()
        {
            string deviceId = SystemInfo.deviceUniqueIdentifier;
            byte[] salt = new byte[FixedSalt.Length + Encoding.UTF8.GetByteCount(deviceId)];
            Buffer.BlockCopy(FixedSalt, 0, salt, 0, FixedSalt.Length);
            Encoding.UTF8.GetBytes(deviceId, 0, deviceId.Length, salt, FixedSalt.Length);
            using var pbkdf2 = new Rfc2898DeriveBytes(deviceId, salt, Pbkdf2Iterations, HashAlgorithmName.SHA256);
            return pbkdf2.GetBytes(KeySizeBytes);
        }

        private static byte[] ComputeHmac(byte[] key, byte[] iv, byte[] ciphertext)
        {
            using var hmacAlg = new HMACSHA256(key);
            byte[] combined = new byte[iv.Length + ciphertext.Length];
            Buffer.BlockCopy(iv, 0, combined, 0, iv.Length);
            Buffer.BlockCopy(ciphertext, 0, combined, iv.Length, ciphertext.Length);
            return hmacAlg.ComputeHash(combined);
        }

        private static bool ConstantTimeEquals(byte[] a, byte[] b)
        {
            if (a.Length != b.Length) return false;
            int diff = 0;
            for (int i = 0; i < a.Length; i++)
                diff |= a[i] ^ b[i];
            return diff == 0;
        }

        #endregion

        #region Log Masking

        internal static string FormatConfigLog(AppConfig cfg)
        {
            var sb = new StringBuilder();
            sb.AppendLine("[ConfigManager] Current configuration:");
            sb.AppendLine($"  Azure Key:    {MaskKey(cfg.azure_speech_key)}");
            sb.AppendLine($"  Azure Region: {cfg.azure_speech_region}");
            sb.AppendLine($"  OpenAI Key:   {MaskKey(cfg.openai_api_key)}");
            sb.AppendLine($"  OpenAI URL:   {cfg.openai_base_url}");
            sb.AppendLine($"  ffmpeg:       {(string.IsNullOrEmpty(cfg.ffmpeg_path) ? "(not set)" : cfg.ffmpeg_path)}");
            sb.AppendLine($"  Name:         {cfg.character_name}");
            sb.AppendLine($"  Personality:  {TruncateLog(cfg.character_personality, 40)}");
            sb.AppendLine($"  Backstory:    {TruncateLog(cfg.character_backstory, 40)}");
            sb.AppendLine($"  Anim Model:   {cfg.model_path}");
            return sb.ToString();
        }

        public static string MaskKey(string key)
        {
            if (string.IsNullOrEmpty(key)) return "(not set)";
            if (key.Length <= 8) return "***";
            return key.Substring(0, 4) + "****" + key.Substring(key.Length - 4);
        }

        internal static string TruncateLog(string text, int maxLen)
        {
            if (string.IsNullOrEmpty(text)) return "(empty)";
            return text.Length <= maxLen ? text : text.Substring(0, maxLen) + "...";
        }

        #endregion
    }
}
