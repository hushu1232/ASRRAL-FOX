using UnityEngine;

namespace AstralFox.Animation
{
    /// <summary>
    /// Live2D parameter IDs for the CatTail Q-version cat model.
    /// ───────────────────────────────────────────────
    /// Standard Cubism params (available on all models):
    ///   ParamAngleX/Y/Z, ParamEyeLOpen/ROpen, ParamEyeBallX/Y,
    ///   ParamBrowLY/RY, ParamBrowLAngle/RAngle, ParamMouthOpenY, ParamBreath
    /// ───────────────────────────────────────────────
    /// CatTail-specific params (verified against cattail.model3.json):
    ///   Ears:  ParamHairFront (left ear), ParamHairBack (right ear),
    ///          ParamHairSide (left ear rotate), Param (right ear rotate)
    ///   Tail:  Param2 (tail swing/wag), Param3 (tail curl)
    /// ───────────────────────────────────────────────
    /// Body params fall back to head AngleX/Y since the CatTail model
    /// may not export separate body parameters. If body params exist
    /// in the .moc3, switch BodyAngle* to "ParamBodyAngle*".
    /// </summary>
    public static class FoxParamId
    {
        // --- Head (Standard Cubism) ---
        public const string AngleX = "ParamAngleX";
        public const string AngleY = "ParamAngleY";
        public const string AngleZ = "ParamAngleY";  // model has no AngleZ; reuse AngleY

        // --- Body (prefer body-specific params, fall back to head params) ---
        // Standard Cubism body parameters (available on some models)
        public const string ParamBodyAngleX = "ParamBodyAngleX";
        public const string ParamBodyAngleY = "ParamBodyAngleY";
        public const string ParamBodyAngleZ = "ParamBodyAngleZ";

        // Fallback: use head params if body params not detected at runtime
        public const string BodyAngleX = ParamBodyAngleX;  // primary: body param
        public const string BodyAngleY = ParamBodyAngleY;
        public const string BodyAngleZ = ParamBodyAngleZ;

        /// <summary>
        /// Fallback constants used when the model lacks body parameters.
        /// CubismParameterDriver checks HasParameter() at init and swaps if needed.
        /// </summary>
        public const string BodyAngleXFallback = "ParamAngleX";
        public const string BodyAngleYFallback = "ParamAngleY";
        public const string BodyAngleZFallback = "ParamAngleY";

        // --- Eyes (Standard Cubism) ---
        public const string EyeLOpen = "ParamEyeLOpen";
        public const string EyeROpen = "ParamEyeROpen";
        public const string EyeBallX = "ParamEyeBallX";
        public const string EyeBallY = "ParamEyeBallY";
        public const string EyeSmileL = "ParamEyeLOpen";   // fallback: no smile params
        public const string EyeSmileR = "ParamEyeROpen";

        // --- Eyebrows (Standard Cubism) ---
        public const string BrowLY = "ParamBrowLY";
        public const string BrowRY = "ParamBrowRY";
        public const string BrowLAngle = "ParamBrowLAngle";
        public const string BrowRAngle = "ParamBrowRAngle";

        // --- Mouth (Standard Cubism) ---
        public const string MouthOpenY = "ParamMouthOpenY";
        public const string MouthForm = "ParamMouthOpenY"; // fallback: no mouth form

        // --- Ears (CatTail: mapped to hair sway params) ---
        public const string EarL = "ParamHairFront";       // left ear position
        public const string EarR = "ParamHairBack";        // right ear position
        public const string EarLRotate = "ParamHairSide";  // left ear rotation
        public const string EarRRotate = "Param";          // right ear rotation (generic)

        // --- Tail (CatTail-specific) ---
        public const string TailSwing = "Param2";          // tail horizontal swing
        public const string TailCurl = "Param3";           // tail curl/vertical
        public const string TailWag = "Param2";            // tail wag (shares swing param)

        // --- Arms / Paws (fallback to head for now) ---
        public const string ArmL = "ParamAngleX";
        public const string ArmR = "ParamAngleY";

        // --- Breathing / Idle (Standard Cubism) ---
        public const string Breath = "ParamBreath";

        // --- Emotion blends (visually driven via eye/brow since model lacks dedicated emotion params) ---
        public const string EmotionHappy = "ParamBrowLAngle";
        public const string EmotionSad = "ParamBrowLY";
        public const string EmotionShy = "ParamBrowRY";
        public const string EmotionAngry = "ParamBrowRAngle";

        // --- Blush (reuse breath param) ---
        public const string Blush = "ParamBreath";

        /// <summary>All custom emotion parameters.</summary>
        public static readonly string[] EmotionParams =
            { EmotionHappy, EmotionSad, EmotionShy, EmotionAngry };

        /// <summary>Core parameters needed for basic animation. Model must have at least these.</summary>
        public static readonly string[] RequiredParams =
            { AngleX, AngleY, EyeLOpen, EyeROpen, MouthOpenY, Breath };
    }
}
