using System.Collections.Generic;
using UnityEditor;
using UnityEditor.Animations;
using UnityEngine;

namespace AstralFox.Editor.Animation
{
    /// <summary>
    /// Creates and configures the Unity Animator Controller for AstralFox.
    /// The Animator provides state management and BlendTree-based emotion mixing,
    /// while actual Live2D parameter values are driven by FoxAnimationController at runtime.
    ///
    /// Usage: AstralFox > Setup Animator Controller
    /// </summary>
    public static class FoxAnimatorSetup
    {
        private const string ControllerPath = "Assets/Resources/FoxAnimator.controller";
        private const string MenuPath = "AstralFox/Setup Animator Controller";

        private static readonly string[] StateNames =
            { "Idle", "Listening", "Speaking", "Sleep", "Dragging" };

        [MenuItem(MenuPath, false, 1)]
        public static void CreateAnimatorController()
        {
            // Ensure directories exist
            if (!AssetDatabase.IsValidFolder("Assets/Animations"))
                AssetDatabase.CreateFolder("Assets", "Animations");
            if (!AssetDatabase.IsValidFolder("Assets/Resources"))
                AssetDatabase.CreateFolder("Assets", "Resources");

            // Create or replace controller
            AnimatorController controller = AnimatorController.CreateAnimatorControllerAtPath(ControllerPath);
            if (controller == null)
            {
                Debug.LogError("[FoxAnimatorSetup] Failed to create Animator Controller.");
                return;
            }

            // Add parameters
            controller.AddParameter("State", AnimatorControllerParameterType.Int);
            controller.AddParameter("EmotionWeight", AnimatorControllerParameterType.Float);
            controller.AddParameter("MouthOpen", AnimatorControllerParameterType.Float);
            controller.AddParameter("IsDragging", AnimatorControllerParameterType.Bool);
            controller.AddParameter("IsSleeping", AnimatorControllerParameterType.Bool);

            // Get the base layer
            var baseLayer = controller.layers[0];
            var stateMachine = baseLayer.stateMachine;

            // Create all states
            var states = new Dictionary<string, AnimatorState>();
            var defaultClip = GetOrCreateDefaultClip();

            foreach (string name in StateNames)
            {
                AnimatorState state = stateMachine.AddState(name);
                state.motion = defaultClip;
                state.writeDefaultValues = false;
                states[name] = state;
            }

            // Set Idle as default
            stateMachine.defaultState = states["Idle"];

            // Create transitions based on State integer parameter
            // The State parameter values: 0=Idle, 1=Listening, 2=Speaking, 3=Sleep, 4=Dragging

            // From Idle → others
            CreateConditionalTransition(states["Idle"], states["Listening"],
                ("State", AnimatorConditionMode.Equals, 1f));
            CreateConditionalTransition(states["Idle"], states["Speaking"],
                ("State", AnimatorConditionMode.Equals, 2f));
            CreateConditionalTransition(states["Idle"], states["Sleep"],
                ("State", AnimatorConditionMode.Equals, 3f));
            CreateConditionalTransition(states["Idle"], states["Dragging"],
                ("State", AnimatorConditionMode.Equals, 4f));

            // From Listening → others
            CreateConditionalTransition(states["Listening"], states["Idle"],
                ("State", AnimatorConditionMode.Equals, 0f));
            CreateConditionalTransition(states["Listening"], states["Speaking"],
                ("State", AnimatorConditionMode.Equals, 2f));
            CreateConditionalTransition(states["Listening"], states["Dragging"],
                ("State", AnimatorConditionMode.Equals, 4f));

            // From Speaking → others
            CreateConditionalTransition(states["Speaking"], states["Idle"],
                ("State", AnimatorConditionMode.Equals, 0f));
            CreateConditionalTransition(states["Speaking"], states["Listening"],
                ("State", AnimatorConditionMode.Equals, 1f));
            CreateConditionalTransition(states["Speaking"], states["Dragging"],
                ("State", AnimatorConditionMode.Equals, 4f));

            // From Sleep → others
            CreateConditionalTransition(states["Sleep"], states["Idle"],
                ("State", AnimatorConditionMode.Equals, 0f));
            CreateConditionalTransition(states["Sleep"], states["Listening"],
                ("State", AnimatorConditionMode.Equals, 1f));
            CreateConditionalTransition(states["Sleep"], states["Dragging"],
                ("State", AnimatorConditionMode.Equals, 4f));

            // From Dragging → others
            CreateConditionalTransition(states["Dragging"], states["Idle"],
                ("State", AnimatorConditionMode.Equals, 0f));
            CreateConditionalTransition(states["Dragging"], states["Listening"],
                ("State", AnimatorConditionMode.Equals, 1f));

            // Add BlendTrees to Idle, Listening for emotion blending
            CreateEmotionBlendTree(states["Idle"], defaultClip, controller);
            CreateEmotionBlendTree(states["Listening"], defaultClip, controller);

            // Save
            EditorUtility.SetDirty(controller);
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            Debug.Log($"[FoxAnimatorSetup] Animator Controller created at {ControllerPath}\n" +
                      $"  States: {string.Join(", ", StateNames)}\n" +
                      $"  Parameters: State(int), EmotionWeight(float), MouthOpen(float), IsDragging(bool), IsSleeping(bool)\n" +
                      $"  BlendTrees on Idle/Listening for emotion blending.");
        }

        private static void CreateConditionalTransition(
            AnimatorState from, AnimatorState to,
            params (string param, AnimatorConditionMode mode, float threshold)[] conditions)
        {
            var transition = from.AddTransition(to);
            transition.hasExitTime = false;
            transition.exitTime = 0f;
            transition.duration = 0.15f;

            foreach (var (param, mode, threshold) in conditions)
            {
                transition.AddCondition(mode, threshold, param);
            }
        }

        private static void CreateEmotionBlendTree(
            AnimatorState state, Motion defaultClip, AnimatorController controller)
        {
            var smileClip = GetOrCreateSmileClip();

            // Create a BlendTree that blends between Neutral (0) and Emotional (1)
            var blendTree = new BlendTree
            {
                name = $"{state.name}_EmotionBlend",
                blendParameter = "EmotionWeight",
                blendType = BlendTreeType.Simple1D,
                minThreshold = 0f,
                maxThreshold = 1f,
                useAutomaticThresholds = true,
            };

            // Neutral pose (EmotionWeight=0): default clip with subtle idle curves
            // Emotional pose (EmotionWeight=1): smile clip with higher emotion parameters
            // FoxAnimationController drives Live2D params in code; these clips
            // provide Animator-level blending that complements code-driven motion.
            blendTree.AddChild(defaultClip, 0f);
            blendTree.AddChild(smileClip, 1f);

            // Add MouthOpen layer for lip sync compatibility
            var mouthLayer = new BlendTree
            {
                name = $"{state.name}_MouthLayer",
                blendParameter = "MouthOpen",
                blendType = BlendTreeType.Simple1D,
                minThreshold = 0f,
                maxThreshold = 1f,
                useAutomaticThresholds = true,
            };
            mouthLayer.AddChild(defaultClip, 0f);
            mouthLayer.AddChild(smileClip, 1f);

            state.motion = blendTree;
        }

        /// <summary>Get or create animation clips for state placeholders and emotion blending.</summary>
        private static AnimationClip GetOrCreateDefaultClip()
        {
            const string clipPath = "Assets/Animations/AstralFox_DefaultPose.anim";

            var existingClip = AssetDatabase.LoadAssetAtPath<AnimationClip>(clipPath);
            if (existingClip != null) return existingClip;

            var clip = new AnimationClip
            {
                name = "AstralFox_DefaultPose",
                frameRate = 30f,
            };

            // Add a subtle idle curve so the clip is non-empty and can drive parameters
            // These curves are additive with the code-driven FoxAnimationController parameters
            AnimationUtility.SetEditorCurve(clip,
                EditorCurveBinding.FloatCurve("", typeof(Animator), "EmotionWeight"),
                AnimationCurve.Constant(0f, 1f / 30f, 0f));
            AnimationUtility.SetEditorCurve(clip,
                EditorCurveBinding.FloatCurve("", typeof(Animator), "MouthOpen"),
                AnimationCurve.Constant(0f, 1f / 30f, 0f));

            AssetDatabase.CreateAsset(clip, clipPath);
            return clip;
        }

        /// <summary>Get or create a smile/emotional pose clip for emotion blend target.</summary>
        private static AnimationClip GetOrCreateSmileClip()
        {
            const string clipPath = "Assets/Animations/AstralFox_SmilePose.anim";

            var existingClip = AssetDatabase.LoadAssetAtPath<AnimationClip>(clipPath);
            if (existingClip != null) return existingClip;

            var clip = new AnimationClip
            {
                name = "AstralFox_SmilePose",
                frameRate = 30f,
            };

            // Smile pose: higher EmotionWeight, slightly open mouth
            AnimationUtility.SetEditorCurve(clip,
                EditorCurveBinding.FloatCurve("", typeof(Animator), "EmotionWeight"),
                AnimationCurve.Constant(0f, 1f / 30f, 1f));
            AnimationUtility.SetEditorCurve(clip,
                EditorCurveBinding.FloatCurve("", typeof(Animator), "MouthOpen"),
                AnimationCurve.Constant(0f, 1f / 30f, 0.15f));

            AssetDatabase.CreateAsset(clip, clipPath);
            return clip;
        }
    }
}
