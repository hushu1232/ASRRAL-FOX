using UnityEngine;

namespace AstralFox.Animation
{
    /// <summary>
    /// Data-driven idle behavior definition for the fox pet.
    /// Replaces 12 hardcoded DriveXxx() functions in FoxAnimationController
    /// with a single parameterized DriveBehavior() method.
    ///
    /// Create new behaviors via: Assets → Create → AstralFox → Idle Behavior
    /// Assign to FoxAnimationController's IdleBehaviors array in the Inspector.
    ///
    /// Each parameter curve maps time (0→1 normalized over the behavior's duration)
    /// to a Cubism parameter value. The system automatically interpolates and
    /// calls EndCurrentBehavior() when time reaches 1.0.
    /// </summary>
    [CreateAssetMenu(fileName = "IdleBehavior_New", menuName = "AstralFox/Idle Behavior", order = 1)]
    public sealed class IdleBehaviorDef : ScriptableObject
    {
        [Header("Identity")]
        [Tooltip("Unique name for logging (e.g., 'Scratch', 'Stretch').")]
        public string behaviorName = "New Behavior";

        [Tooltip("Duration in seconds for one complete cycle.")]
        [Range(0.2f, 5f)]
        public float duration = 1.5f;

        [Tooltip("Higher weight = more likely to be randomly selected.")]
        [Range(0f, 10f)]
        public float weight = 1f;

        [Header("Body")]
        [Tooltip("Body angle X over time (forward/backward lean).")]
        public AnimationCurve bodyAngleX = AnimationCurve.Constant(0, 1, 0);

        [Tooltip("Body angle Y over time (left/right tilt).")]
        public AnimationCurve bodyAngleY = AnimationCurve.Constant(0, 1, 0);

        [Tooltip("Body angle Z over time (rotation/twist).")]
        public AnimationCurve bodyAngleZ = AnimationCurve.Constant(0, 1, 0);

        [Header("Head")]
        [Tooltip("Head angle X (nod up/down).")]
        public AnimationCurve headAngleX = AnimationCurve.Constant(0, 1, 0);

        [Tooltip("Head angle Y (turn left/right).")]
        public AnimationCurve headAngleY = AnimationCurve.Constant(0, 1, 0);

        [Tooltip("Head angle Z (tilt).")]
        public AnimationCurve headAngleZ = AnimationCurve.Constant(0, 1, 0);

        [Header("Ears")]
        [Tooltip("Left ear perk (positive = up, negative = down).")]
        public AnimationCurve earL = AnimationCurve.Constant(0, 1, 0);

        [Tooltip("Right ear perk (positive = up, negative = down).")]
        public AnimationCurve earR = AnimationCurve.Constant(0, 1, 0);

        [Header("Tail")]
        [Tooltip("Tail wag intensity (0-1).")]
        public AnimationCurve tailWag = AnimationCurve.Constant(0, 1, 0);

        [Tooltip("Tail side-to-side swing.")]
        public AnimationCurve tailSwing = AnimationCurve.Constant(0, 1, 0);

        [Tooltip("Tail curl (0=straight, 1=fully curled).")]
        public AnimationCurve tailCurl = AnimationCurve.Constant(0, 1, 0);

        [Header("Arms")]
        [Tooltip("Left arm position.")]
        public AnimationCurve armL = AnimationCurve.Constant(0, 1, 0);

        [Tooltip("Right arm position.")]
        public AnimationCurve armR = AnimationCurve.Constant(0, 1, 0);

        [Header("Eyes")]
        [Tooltip("Left eye openness (1=fully open, 0=closed). Overrides idle state.")]
        public AnimationCurve eyeLOpen = AnimationCurve.Constant(0, 1, 1);

        [Tooltip("Right eye openness (1=fully open, 0=closed). Overrides idle state.")]
        public AnimationCurve eyeROpen = AnimationCurve.Constant(0, 1, 1);

        [Header("Advanced")]
        [Tooltip("Extra evaluation frequency multiplier (higher = more keyframes evaluated per frame).")]
        [Range(1f, 5f)]
        public float frequencyMultiplier = 1f;

        /// <summary>Evaluate all curves at normalized time t (0→1).</summary>
        public void Evaluate(float t, IFoxParameterDriver driver)
        {
            float phase = t * frequencyMultiplier;

            driver.SetParameter(FoxParamId.BodyAngleX, bodyAngleX.Evaluate(phase));
            driver.SetParameter(FoxParamId.BodyAngleY, bodyAngleY.Evaluate(phase));
            driver.SetParameter(FoxParamId.BodyAngleZ, bodyAngleZ.Evaluate(phase));
            driver.SetParameter(FoxParamId.AngleX,     headAngleX.Evaluate(phase));
            driver.SetParameter(FoxParamId.AngleY,     headAngleY.Evaluate(phase));
            driver.SetParameter(FoxParamId.AngleZ,     headAngleZ.Evaluate(phase));
            driver.SetParameter(FoxParamId.EarL,       earL.Evaluate(phase));
            driver.SetParameter(FoxParamId.EarR,       earR.Evaluate(phase));
            driver.SetParameter(FoxParamId.TailWag,    tailWag.Evaluate(phase));
            driver.SetParameter(FoxParamId.TailSwing,  tailSwing.Evaluate(phase));
            driver.SetParameter(FoxParamId.TailCurl,   tailCurl.Evaluate(phase));
            driver.SetParameter(FoxParamId.ArmL,       armL.Evaluate(phase));
            driver.SetParameter(FoxParamId.ArmR,       armR.Evaluate(phase));
            driver.SetParameter(FoxParamId.EyeLOpen,   eyeLOpen.Evaluate(phase));
            driver.SetParameter(FoxParamId.EyeROpen,   eyeROpen.Evaluate(phase));
        }
    }
}
