using System.Collections.Generic;
using UnityEngine;

namespace AstralFox.Animation
{
    /// <summary>
    /// Enum-based parameter index for zero-allocation parameter access.
    /// Use <see cref="FoxParamId"/> string constants for dictionary lookups (init only).
    /// Use <see cref="FoxParam"/> enum values for per-frame SetParameter/GetParameter calls.
    /// </summary>
    public enum FoxParam
    {
        // Head angles
        ParamAngleX, ParamAngleY, ParamAngleZ,
        // Body angles
        ParamBodyAngleX, ParamBodyAngleY, ParamBodyAngleZ,
        // Eyes
        ParamEyeLOpen, ParamEyeROpen, ParamEyeBallX, ParamEyeBallY,
        // Brows
        ParamBrowLY, ParamBrowRY, ParamBrowLAngle, ParamBrowRAngle,
        // Mouth
        ParamMouthOpenY, ParamMouthForm,
        // Ears
        ParamEarL, ParamEarR,
        // Tail
        ParamTail,
        // Breath
        ParamBreath,
        // Hair
        ParamHairFront, ParamHairSideL, ParamHairSideR,

        COUNT // ← must be last: gives array size
    }

    /// <summary>
    /// Live2D parameter IDs for AI-generated models (AstralFox Rigging Pipeline).
    /// ───────────────────────────────────────────────
    /// ALIGNED with the Cubism bridge output (cubism_bridge/moc3_encoder.py).
    /// Parameters follow the standardized naming convention:
    ///   ParamAngleX/Y/Z, ParamBodyAngleX/Y/Z, ParamEyeLOpen/ROpen,
    ///   ParamEyeBallX/Y, ParamBrowLY/RY, ParamMouthOpenY/Form,
    ///   ParamBreath, ParamEarL/R, ParamTail, ParamHairFront/SideL/SideR
    /// ───────────────────────────────────────────────
    /// Legacy model notes:
    ///   - CatTail: ears=ParamHairFront/Back, tail=Param2/3  (deprecated)
    ///   - Senko: parameters auto-detected at runtime via Cubism SDK
    ///   - Current mapping targets AI-generated models (human_female template)
    /// </summary>
    public static class FoxParamId
    {
        // --- Head (Standard Cubism) ---
        public const string AngleX = "ParamAngleX";
        public const string AngleY = "ParamAngleY";
        public const string AngleZ = "ParamAngleZ";

        // --- Body ---
        // AI-generated models support dedicated body params.
        // CubismParameterDriver auto-falls back to AngleX/Y if absent.
        public const string ParamBodyAngleX = "ParamBodyAngleX";
        public const string ParamBodyAngleY = "ParamBodyAngleY";
        public const string ParamBodyAngleZ = "ParamBodyAngleZ";

        public const string BodyAngleX = ParamBodyAngleX;
        public const string BodyAngleY = ParamBodyAngleY;
        public const string BodyAngleZ = ParamBodyAngleZ;

        public const string BodyAngleXFallback = "ParamAngleX";
        public const string BodyAngleYFallback = "ParamAngleY";
        public const string BodyAngleZFallback = "ParamAngleZ";

        // --- Eyes (Standard Cubism) ---
        public const string EyeLOpen = "ParamEyeLOpen";
        public const string EyeROpen = "ParamEyeROpen";
        public const string EyeBallX = "ParamEyeBallX";
        public const string EyeBallY = "ParamEyeBallY";
        public const string EyeSmileL = "ParamEyeLOpen";   // fallback: model has no dedicated smile params
        public const string EyeSmileR = "ParamEyeROpen";

        // --- Eyebrows (Standard Cubism) ---
        public const string BrowLY = "ParamBrowLY";
        public const string BrowRY = "ParamBrowRY";
        public const string BrowLAngle = "ParamBrowLAngle";
        public const string BrowRAngle = "ParamBrowRAngle";

        // --- Mouth (Standard Cubism) ---
        public const string MouthOpenY = "ParamMouthOpenY";
        public const string MouthForm = "ParamMouthForm";

        // --- Ears (AI-generated model: dedicated ear params) ---
        public const string EarL = "ParamEarL";            // left ear perk
        public const string EarR = "ParamEarR";            // right ear perk
        public const string EarLRotate = "ParamEarL";      // fallback: no separate rotate param
        public const string EarRRotate = "ParamEarR";

        // --- Tail (AI-generated model: single tail param) ---
        public const string TailSwing = "ParamTail";       // horizontal swing
        public const string TailCurl = "ParamTail";        // curl (shared with swing)
        public const string TailWag = "ParamTail";         // wag intensity (shared)

        // --- Arms / Paws ---
        // AI-generated models lack dedicated arm params. Fall back to head angles.
        public const string ArmL = "ParamAngleX";
        public const string ArmR = "ParamAngleY";

        // --- Hair (AI-generated model: available but not primary animation targets) ---
        public const string HairFront = "ParamHairFront";
        public const string HairSideL = "ParamHairSideL";
        public const string HairSideR = "ParamHairSideR";

        // --- Breathing / Idle (Standard Cubism) ---
        public const string Breath = "ParamBreath";

        // --- Emotion blends ---
        // AI-generated models use brow + mouth for emotion expression.
        public const string EmotionHappy = "ParamBrowLAngle";
        public const string EmotionSad = "ParamBrowLY";
        public const string EmotionShy = "ParamBrowRY";
        public const string EmotionAngry = "ParamBrowRAngle";

        // --- Blush (reuse breath param — model lacks separate blush) ---
        public const string Blush = "ParamBreath";

        /// <summary>All custom emotion parameters.</summary>
        public static readonly string[] EmotionParams =
            { EmotionHappy, EmotionSad, EmotionShy, EmotionAngry };

        /// <summary>Core parameters needed for basic animation. Model must have at least these.</summary>
        public static readonly string[] RequiredParams =
            { AngleX, AngleY, AngleZ, EyeLOpen, EyeROpen, MouthOpenY, Breath };

        /// <summary>All AI-generated model parameters that map to AstralFox animation features.</summary>
        public static readonly string[] AstralFoxParams =
        {
            AngleX, AngleY, AngleZ,
            BodyAngleX, BodyAngleY, BodyAngleZ,
            EyeLOpen, EyeROpen, EyeBallX, EyeBallY,
            BrowLY, BrowRY, BrowLAngle, BrowRAngle,
            MouthOpenY, MouthForm,
            EarL, EarR,
            TailWag, TailSwing, TailCurl,
            Breath,
            HairFront, HairSideL, HairSideR,
        };

        // ── String → FoxParam enum lookup (built once, used per-frame) ──

        /// <summary>
        /// Maps Cubism parameter string IDs to <see cref="FoxParam"/> enum values.
        /// Built at static init time. Used by CubismParameterDriver to convert
        /// string lookups to O(1) array accesses.
        /// </summary>
        public static readonly Dictionary<string, FoxParam> StringToEnum = new()
        {
            { AngleX, FoxParam.ParamAngleX },
            { AngleY, FoxParam.ParamAngleY },
            { AngleZ, FoxParam.ParamAngleZ },
            { ParamBodyAngleX, FoxParam.ParamBodyAngleX },
            { ParamBodyAngleY, FoxParam.ParamBodyAngleY },
            { ParamBodyAngleZ, FoxParam.ParamBodyAngleZ },
            { EyeLOpen, FoxParam.ParamEyeLOpen },
            { EyeROpen, FoxParam.ParamEyeROpen },
            { EyeBallX, FoxParam.ParamEyeBallX },
            { EyeBallY, FoxParam.ParamEyeBallY },
            { BrowLY, FoxParam.ParamBrowLY },
            { BrowRY, FoxParam.ParamBrowRY },
            { BrowLAngle, FoxParam.ParamBrowLAngle },
            { BrowRAngle, FoxParam.ParamBrowRAngle },
            { MouthOpenY, FoxParam.ParamMouthOpenY },
            { MouthForm, FoxParam.ParamMouthForm },
            { EarL, FoxParam.ParamEarL },
            { EarR, FoxParam.ParamEarR },
            { "ParamTail", FoxParam.ParamTail },
            { Breath, FoxParam.ParamBreath },
            { HairFront, FoxParam.ParamHairFront },
            { HairSideL, FoxParam.ParamHairSideL },
            { HairSideR, FoxParam.ParamHairSideR },
        };

        /// <summary>
        /// Reverse lookup: FoxParam → Cubism SDK string ID.
        /// Built at static init time for Cubism SDK bridge.
        /// </summary>
        public static readonly string[] EnumToString;

        static FoxParamId()
        {
            int count = (int)FoxParam.COUNT;
            EnumToString = new string[count];
            foreach (var kv in StringToEnum)
            {
                EnumToString[(int)kv.Value] = kv.Key;
            }
        }
    }
}
