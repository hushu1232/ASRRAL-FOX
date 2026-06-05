using System;

namespace AstralFox
{
    /// <summary>
    /// Cross-platform abstraction for desktop transparent window.
    /// Win32 implementation uses UpdateLayeredWindow + chroma key.
    /// Editor/mock implementation is a no-op for batchmode testing.
    /// </summary>
    public interface ITransparentWindow
    {
        /// <summary>Whether the transparent overlay is active.</summary>
        bool IsActive { get; }

        /// <summary>Enable or disable the transparent overlay mode.</summary>
        void SetActive(bool active);

        /// <summary>Set the click-through state (true = clicks pass through to desktop).</summary>
        void SetClickThrough(bool clickThrough);

        /// <summary>Set always-on-top state.</summary>
        void SetAlwaysOnTop(bool topMost);

        /// <summary>Get current window position in screen coordinates.</summary>
        (int x, int y) GetPosition();

        /// <summary>Set window position in screen coordinates.</summary>
        void SetPosition(int x, int y);

        /// <summary>Get window size.</summary>
        (int width, int height) GetSize();

        /// <summary>Fired when the window is moved by the user.</summary>
        event Action<int, int> OnWindowMoved;
    }
}
