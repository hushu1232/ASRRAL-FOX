using UnityEngine;

namespace AstralFox.Animation
{
    /// <summary>
    /// Animation state enum shared across all pet model types.
    /// Maps 1:1 to FoxAnimationController.FoxState for backward compatibility.
    /// </summary>
    public enum PetAnimationState
    {
        Idle,
        Listening,
        Speaking,
        Sleep,
        Dragging,
        Greeting,
    }

    /// <summary>
    /// Emotion enum shared across all pet model types.
    /// Maps 1:1 to FoxEmotionController.FoxEmotion for backward compatibility.
    /// </summary>
    public enum PetEmotion
    {
        Neutral,
        Happy,
        Sad,
        Shy,
        Angry
    }

    /// <summary>
    /// Model type identifier. Currently Live2D only.
    /// Enum retained for future multi-engine support.
    /// </summary>
    public enum PetModelType
    {
        Live2D
    }

    /// <summary>
    /// High-level animation abstraction for pet models.
    /// Each model backend implements this interface so that all game
    /// modules can drive animation without knowing the underlying SDK.
    /// </summary>
    public interface IPetAnimator
    {
        // ── Lifecycle ───────────────────────────────────────────

        /// <summary>Whether the animator has been initialized and the model is loaded.</summary>
        bool IsReady { get; }

        /// <summary>Show or hide the model GameObject.</summary>
        void SetVisible(bool visible);

        /// <summary>Return the root GameObject of this model (for scene hierarchy queries).</summary>
        GameObject GetGameObject();

        // ── State machine ───────────────────────────────────────

        /// <summary>Current animation state.</summary>
        PetAnimationState CurrentState { get; }

        /// <summary>Transition to a new animation state.</summary>
        void SetState(PetAnimationState state);

        // ── Event callbacks (driven by external modules) ────────

        /// <summary>Called when the user starts dragging the pet.</summary>
        void OnDragStart();

        /// <summary>Called when the user releases the pet after dragging.</summary>
        void OnDragEnd();

        /// <summary>Called when the wake word is detected.</summary>
        void OnWakeWord();

        /// <summary>Called when TTS playback begins (mouth starts moving).</summary>
        void OnSpeakingStart();

        /// <summary>Called when TTS playback ends.</summary>
        void OnSpeakingEnd();

        // ── Expression ──────────────────────────────────────────

        /// <summary>Set the emotional expression with smooth transition.</summary>
        void SetEmotion(PetEmotion emotion);

        // ── Parameter driving ───────────────────────────────────

        /// <summary>Set mouth openness for lip sync (0 = closed, 1 = wide open).</summary>
        void SetMouthOpen(float value);

        /// <summary>Set eye openness for blinking (0 = closed, 1 = open).</summary>
        void SetEyeOpen(float value);

        /// <summary>Set body rotation angles for walk/idle animation.</summary>
        void SetBodyPose(float angleX, float angleY, float angleZ);

        /// <summary>Set tail wag intensity (0 = still, 1 = full wag).</summary>
        void SetTailWag(float value);

        /// <summary>Set tail swing offset (-1 to 1).</summary>
        void SetTailSwing(float value);

        /// <summary>Set ear pose (-1 = pinned back, 0 = neutral, 1 = perked).</summary>
        void SetEarPose(float left, float right);

        // ── Per-frame update ────────────────────────────────────

        /// <summary>
        /// Drive per-frame animation logic (idle motion, blinking, breath).
        /// Called by PetAnimationManager each frame.
        /// </summary>
        void UpdateAnimator(float deltaTime);
    }
}
