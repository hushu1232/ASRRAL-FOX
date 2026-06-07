using System;
using System.Buffers;
using UnityEngine;

namespace AstralFox.Voice
{
    /// <summary>
    /// Shared audio conversion utilities. Uses ArrayPool internally to minimize GC pressure.
    /// All methods that allocate return arrays that should be returned via <see cref="ReturnBuffer"/>.
    ///
    /// Usage:
    ///   float[] samples = AudioUtility.ConvertPCM16ToFloat(pcmBytes);
    ///   // ... use samples ...
    ///   AudioUtility.ReturnBuffer(samples);
    /// </summary>
    public static class AudioUtility
    {
        /// <summary>
        /// Convert PCM16 byte array to normalized float samples (-1..1).
        /// Returns ArrayPool-allocated buffer. MUST call ReturnBuffer() after use.
        /// </summary>
        public static float[] ConvertPCM16ToFloat(byte[] pcm16)
        {
            int sampleCount = pcm16.Length / 2;
            float[] samples = ArrayPool<float>.Shared.Rent(sampleCount);
            for (int i = 0; i < sampleCount; i++)
            {
                short s = (short)(pcm16[i * 2] | (pcm16[i * 2 + 1] << 8));
                samples[i] = s / 32768f;
            }
            // Fill remaining rented slots with 0 to avoid stale data
            for (int i = sampleCount; i < samples.Length; i++)
                samples[i] = 0f;
            return samples;
        }

        /// <summary>
        /// Convert float samples (-1..1) to PCM16 byte array.
        /// Returns ArrayPool-allocated buffer. MUST call ReturnBuffer() after use.
        /// </summary>
        public static byte[] ConvertToPCM16(float[] samples)
        {
            byte[] pcm = ArrayPool<byte>.Shared.Rent(samples.Length * 2);
            for (int i = 0; i < samples.Length; i++)
            {
                short s = (short)(Mathf.Clamp(samples[i], -1f, 1f) * 32767f);
                pcm[i * 2] = (byte)(s & 0xFF);
                pcm[i * 2 + 1] = (byte)((s >> 8) & 0xFF);
            }
            return pcm;
        }

        /// <summary>
        /// Find the "data" chunk offset in a WAV byte array.
        /// Returns -1 if not found.
        /// </summary>
        public static int FindDataChunk(byte[] wav)
        {
            int pos = 12;
            while (pos + 8 <= wav.Length)
            {
                string chunkId = System.Text.Encoding.ASCII.GetString(wav, pos, 4);
                if (chunkId == "data") return pos;
                int chunkSize = BitConverter.ToInt32(wav, pos + 4);
                pos += 8 + chunkSize;
            }
            return -1;
        }

        /// <summary>
        /// Simple linear-interpolation sample rate conversion.
        /// Returns ArrayPool-allocated buffer. MUST call ReturnBuffer() after use.
        /// </summary>
        public static float[] ResampleSimple(float[] input, int fromRate, int toRate)
        {
            if (fromRate == toRate)
            {
                // Return a copy so caller can always call ReturnBuffer
                float[] copy = ArrayPool<float>.Shared.Rent(input.Length);
                Array.Copy(input, copy, input.Length);
                return copy;
            }
            float ratio = (float)fromRate / toRate;
            int outputLen = Mathf.RoundToInt(input.Length / ratio);
            float[] output = ArrayPool<float>.Shared.Rent(outputLen);
            for (int i = 0; i < outputLen; i++)
            {
                float srcIdx = i * ratio;
                int idx0 = Mathf.FloorToInt(srcIdx);
                int idx1 = Mathf.Min(idx0 + 1, input.Length - 1);
                output[i] = Mathf.Lerp(input[idx0], input[idx1], srcIdx - idx0);
            }
            return output;
        }

        /// <summary>
        /// Return an array previously obtained from any AudioUtility method.
        /// Safe to call with null.
        /// </summary>
        public static void ReturnBuffer<T>(T[] buffer)
        {
            if (buffer == null) return;
            if (buffer is float[] floatBuf)
                ArrayPool<float>.Shared.Return(floatBuf, clearArray: false);
            else if (buffer is byte[] byteBuf)
                ArrayPool<byte>.Shared.Return(byteBuf, clearArray: false);
        }
    }
}
