using System;
using System.Security.Cryptography;

namespace AstralFox.Data
{
    internal static class CryptoHelper
    {
        private const int SaltLength = 32;
        private const int KeyLength = 32;
        private const int IvLength = 16;
        private const int HmacLength = 32;
        private const int Pbkdf2Iterations = 100_000;
        private const string SaltPrefsKey = "__crypto_salt";

        // DPAPI disabled: Tuanjie doesn't auto-reference System.Security.dll.
        // AES-256-CBC + HMAC-SHA256 fallback is used on all platforms.

        public static byte[] Protect(byte[] plaintext)
        {
            if (plaintext == null || plaintext.Length == 0)
                return Array.Empty<byte>();
            return ProtectFallback(plaintext);
        }

        public static byte[] Unprotect(byte[] ciphertext)
        {
            if (ciphertext == null || ciphertext.Length == 0)
                return Array.Empty<byte>();
            return UnprotectFallback(ciphertext);
        }

        #region AES-256-CBC + HMAC-SHA256 Fallback

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

            byte[] hmac;
            using (var hmacAlg = new HMACSHA256(hmacKey))
            {
                byte[] combined = new byte[iv.Length + ciphertext.Length];
                Buffer.BlockCopy(iv, 0, combined, 0, iv.Length);
                Buffer.BlockCopy(ciphertext, 0, combined, iv.Length, ciphertext.Length);
                hmac = hmacAlg.ComputeHash(combined);
            }

            byte[] result = new byte[salt.Length + iv.Length + hmac.Length + ciphertext.Length];
            Buffer.BlockCopy(salt, 0, result, 0, salt.Length);
            Buffer.BlockCopy(iv, 0, result, salt.Length, iv.Length);
            Buffer.BlockCopy(hmac, 0, result, salt.Length + iv.Length, hmac.Length);
            Buffer.BlockCopy(ciphertext, 0, result, salt.Length + iv.Length + hmac.Length, ciphertext.Length);
            return result;
        }

        private static byte[] UnprotectFallback(byte[] data)
        {
            if (data.Length < SaltLength + IvLength + HmacLength + 16)
                return Array.Empty<byte>();

            byte[] salt = new byte[SaltLength];
            byte[] iv = new byte[IvLength];
            byte[] hmac = new byte[HmacLength];
            Buffer.BlockCopy(data, 0, salt, 0, SaltLength);
            Buffer.BlockCopy(data, SaltLength, iv, 0, IvLength);
            Buffer.BlockCopy(data, SaltLength + IvLength, hmac, 0, HmacLength);
            int cipherLen = data.Length - SaltLength - IvLength - HmacLength;
            byte[] ciphertext = new byte[cipherLen];
            Buffer.BlockCopy(data, SaltLength + IvLength + HmacLength, ciphertext, 0, cipherLen);

            byte[] keyMaterial = DeriveKey(salt);
            byte[] hmacKey = new byte[KeyLength];
            Buffer.BlockCopy(keyMaterial, KeyLength, hmacKey, 0, KeyLength);

            using (var hmacAlg = new HMACSHA256(hmacKey))
            {
                byte[] combined = new byte[iv.Length + ciphertext.Length];
                Buffer.BlockCopy(iv, 0, combined, 0, iv.Length);
                Buffer.BlockCopy(ciphertext, 0, combined, iv.Length, ciphertext.Length);
                if (!ConstantTimeEquals(hmac, hmacAlg.ComputeHash(combined)))
                    return Array.Empty<byte>();
            }

            byte[] aesKey = new byte[KeyLength];
            Buffer.BlockCopy(keyMaterial, 0, aesKey, 0, KeyLength);

            using (var aes = Aes.Create())
            {
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
        }

        private static byte[] GetOrCreateSalt()
        {
            string stored = UnityEngine.PlayerPrefs.GetString(SaltPrefsKey, "");
            if (!string.IsNullOrEmpty(stored) && stored.Length >= SaltLength * 2)
            {
                byte[] salt = new byte[SaltLength];
                for (int i = 0; i < SaltLength; i++)
                    salt[i] = Convert.ToByte(stored.Substring(i * 2, 2), 16);
                return salt;
            }
            byte[] newSalt = new byte[SaltLength];
            using (var rng = RandomNumberGenerator.Create())
                rng.GetBytes(newSalt);
            string hex = BitConverter.ToString(newSalt).Replace("-", "");
            UnityEngine.PlayerPrefs.SetString(SaltPrefsKey, hex);
            UnityEngine.PlayerPrefs.Save();
            return newSalt;
        }

        private static byte[] DeriveKey(byte[] salt)
        {
            string deviceId = UnityEngine.SystemInfo.deviceUniqueIdentifier;
            using var pbkdf2 = new Rfc2898DeriveBytes(deviceId, salt, Pbkdf2Iterations, HashAlgorithmName.SHA256);
            return pbkdf2.GetBytes(KeyLength * 2);
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
