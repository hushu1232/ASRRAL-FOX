using System;
using UnityEngine;

namespace AstralFox
{
    /// <summary>
    /// Mock implementation of ITransparentWindow for Editor and batchmode.
    /// No actual window manipulation — logs to console for debugging.
    /// </summary>
    public sealed class EditorMockTransparentWindow : ITransparentWindow
    {
        private bool _active;
        private bool _clickThrough;
        private bool _alwaysOnTop;
        private int _x, _y;
        private int _width = 400, _height = 500;

        public bool IsActive => _active;

        public event Action<int, int> OnWindowMoved;

        public void SetActive(bool active)
        {
            _active = active;
            Debug.Log($"[MockWindow] SetActive({active})");
        }

        public void SetClickThrough(bool clickThrough)
        {
            _clickThrough = clickThrough;
        }

        public void SetAlwaysOnTop(bool topMost)
        {
            _alwaysOnTop = topMost;
        }

        public (int x, int y) GetPosition() => (_x, _y);

        public void SetPosition(int x, int y)
        {
            _x = x;
            _y = y;
            OnWindowMoved?.Invoke(x, y);
        }

        public (int width, int height) GetSize() => (_width, _height);
    }
}
