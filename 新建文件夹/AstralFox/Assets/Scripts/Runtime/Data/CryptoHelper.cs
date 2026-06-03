using System;
using System.Security.Cryptography;

namespace AstralFox.Data
{
    /// <summary>
    /// Platform-adaptive data protection helper.
    ///
    /// Windows:  DPAPI (ProtectedData) — user-bound, OS-managed key.
    /// Fallback: AES-256-CBC + HMAC-SHA256 with PBKDF2(deviceId + random salt).
    ///
    /// Unlike ConfigManager's old scheme, the fallback uses a RANDOM salt
    /// stored in PlayerPrefs (not a hardcoded constant), so the key material
    /// cannot be derived from source code alone.
    /// </summary>
    internal static class CryptoHelper
    {
        private const int SaltLength = 32;
        private const int KeyLength = 32;
        private const int IvLength = 16;
        private const int HmacLength = 32;
        private const int Pbkdf2Iterations = 100_000;
        private const string SaltPrefsKey = "__crypto_salt";

        #region Public API

        /// <summary>Encrypt plaintext bytes. Returns ciphertext with embedded IV + HMAC.</summary>
        public static byte[] Protect(byte[] plaintext)
        {
            if (plaintext == null || plaintext.Length == 0)
                return Array.Empty<byte>();

#if UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN
            try
            {
                return System.Security.Cryptography.ProtectedData.Protect(
                    plaintext, null, System.Security.Cryptography.DataProtectionScope.CurrentUser);
            }
            catch
            {
                // DPAPI unavailable (unlikely on Windows) — fall through to AES
            }
#endif
            return ProtectFallback(plaintext);
        }

        /// <summary>Decrypt ciphertext produced by Protect().</summary>
        public static byte[] Unprotect(byte[] ciphertext)
        {
            if (ciphertext == null || ciphertext.Length == 0)
                return Array.Empty<byte>();

#if UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN
            try
            {
                return System.Security.Cryptography.ProtectedData.Unprotect(
                    ciphertext, null, System.Security.Cryptography.DataProtectionScope.CurrentUser);
            }
            catch
            {
                // May fail if user profile changed — fall through to AES fallback
            }
#endif
            return UnprotectFallback(ciphertext);
        }

        #endregion

        #region AES-256-CBC + HMAC-SHA256 Fallback

        private static byte[] GetOrCreateSalt()
        {
            string saved = UnityEngine.PlayerPrefs.GetString(SaltPrefsKey, "");
            if (!string.IsNullOrEmpty(saved))
            {
                try { return Convert.FromBase64String(saved); }
                catch { /* corrupted, regenerate */ }
            }

            byte[] salt = new byte[SaltLength];
            using (var rng = RandomNumberGenerator.Create())
                rng.GetBytes(salt);

            UnityEngine.PlayerPrefs.SetString(SaltPrefsKey, Convert.ToBase64String(salt));
            UnityEngine.PlayerPrefs.Save();
            return salt;
        }

        private static byte[] DeriveKey(byte[] salt)
        {
            string deviceId = UnityEngine.SystemInfo.deviceUniqueIdentifier;
            using var pbkdf2 = new Rfc2898DeriveBytes(
                deviceId, salt, Pbkdf2Iterations, HashAlgorithmName.SHA256);
            return pbkdf2.GetBytes(KeyLength * 2); // 64 bytes: first 32 = AES, last 32 = HMAC
        }

        private static byte[] ProtectFallback(byte[] plaintext)
        {
            byte[] salt = GetOrCreateSalt();
            byte[] keyMaterial = DeriveKey(salt);

            byte[] aesKey = new byte[KeyLength];
            byte[] hmacKey = new byte[KeyLength];
            Buffer.BlockCopy(keyMaterial, 0, aesKey, 0, KeyLength);
            Buffer.BlockCopy(keyMaterial, KeyLength, hmacKey, 0, KeyLength);

            byte[] iv = new byte[IvLength];
            using (var rng = RandomNumberGenerator.Create())
                rng.GetBytes(iv);

            byte[] ciphertext;
            using (var aes = Aes.Create())
            {
                aes.Key = aesKey;
                aes.IV = iv;
                aes.Mode = CipherMode.CBC;
                aes.Padding = PaddingMode.PKCS7;

                using var ms = new System.IO.MemoryStream();
                using (var cs = new CryptoStream(ms, aes.CreateEncryptor(), CryptoStreamMode.Write))
                    cs.Write(plaintext, 0, plaintext.Length);
                ciphertext = ms.ToArray();
            }

            // Encrypt-then-MAC: HMAC over IV + ciphertext
            byte[] hmac;
            using (var hmacsha = new HMACSHA256(hmacKey))
            {
                byte[] combined = new byte[IvLength + ciphertext.Length];
                Buffer.BlockCopy(iv, 0, combined, 0, IvLength);
                Buffer.BlockCopy(ciphertext, 0, combined, IvLength, ciphertext.Length);
                hmac = hmacsha.ComputeHash(combined);
            }

            // Pack: [salt:32][IV:16][HMAC:32][ciphertext:N]
            byte[] output = new byte[SaltLength + IvLength + HmacLength + ciphertext.Length];
            Buffer.BlockCopy(salt, 0, output, 0, SaltLength);
            Buffer.BlockCopy(iv, 0, output, SaltLength, IvLength);
            Buffer.BlockCopy(hmac, 0, output, SaltLength + IvLength, HmacLength);
            Buffer.BlockCopy(ciphertext, 0, output, SaltLength + IvLength + HmacLength, ciphertext.Length);
            return output;
        }

        private static byte[] UnprotectFallback(byte[] data)
        {
            int minLen = SaltLength + IvLength + HmacLength + 16; // at least one AES block
            if (data.Length < minLen)
                throw new FormatException("Ciphertext too short.");

            byte[] salt = new byte[SaltLength];
            byte[] iv = new byte[IvLength];
            byte[] hmac = new byte[HmacLength];
            byte[] ciphertext = new byte[data.Length - SaltLength - IvLength - HmacLength];

            Buffer.BlockCopy(data, 0, salt, 0, SaltLength);
            Buffer.BlockCopy(data, SaltLength, iv, 0, IvLength);
            Buffer.BlockCopy(data, SaltLength + IvLength, hmac, 0, HmacLength);
            Buffer.BlockCopy(data, SaltLength + IvLength + HmacLength, ciphertext, 0, ciphertext.Length);

            byte[] keyMaterial = DeriveKey(salt);
            byte[] aesKey = new byte[KeyLength];
            byte[] hmacKey = new byte[KeyLength];
            Buffer.BlockCopy(keyMaterial, 0, aesKey, 0, KeyLength);
            Buffer.BlockCopy(keyMaterial, KeyLength, hmacKey, 0, KeyLength);

            // Verify HMAC
            using (var hmacsha = new HMACSHA256(hmacKey))
            {
                byte[] combined = new byte[IvLength + ciphertext.Length];
                Buffer.BlockCopy(iv, 0, combined, 0, IvLength);
                Buffer.BlockCopy(ciphertext, 0, combined, IvLength, ciphertext.Length);
                byte[] expected = hmacsha.ComputeHash(combined);

                if (!ConstantTimeEquals(hmac, expected))
                    throw new CryptographicException("Data integrity check failed.");
            }

            using var aes = Aes.Create();
            aes.Key = aesKey;
            aes.IV = iv;
            aes.Mode = CipherMode.CBC;
            aes.Padding = PaddingMode.PKCS7;

            using var ms = new System.IO.MemoryStream(ciphertext);
            using var cs = new CryptoStream(ms, aes.CreateDecryptor(), CryptoStreamMode.Read);
            using var result = new System.IO.MemoryStream();
            cs.CopyTo(result);
            return result.ToArray();
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
    }
}
