using UnityEngine;

namespace AstralFox.Animation
{
    /// <summary>
    /// Abstraction layer for driving animation parameters on the fox model.
    /// Allows swapping between Live2D Cubism and fallback (Sprite) without
    /// changing the animation controller logic.
    /// </summary>
    public interface IFoxParameterDriver
    {
        /// <summary>Set a float parameter value (clamped to model's min/max range).</summary>
        void SetParameter(string paramId, float value);

        /// <summary>Set a float parameter value immediately without smoothing.</summary>
        void SetParameterImmediate(string paramId, float value);

        /// <summary>Get the current value of a parameter.</summary>
        float GetParameter(string paramId);

        /// <summary>Check if the model has a specific parameter.</summary>
        bool HasParameter(string paramId);

        /// <summary>Get the minimum value for a parameter.</summary>
        float GetParameterMin(string paramId);

        /// <summary>Get the maximum value for a parameter.</summary>
        float GetParameterMax(string paramId);

        /// <summary>Default value (neutral pose) for a parameter.</summary>
        float GetParameterDefault(string paramId);

        /// <summary>Total number of parameters on the model.</summary>
        int ParameterCount { get; }

        /// <summary>Whether the driver is ready (model is loaded).</summary>
        bool IsReady { get; }
    }
}
