using System;
using System.Collections.Concurrent;
using UnityEngine;

namespace AstralFox.Config
{
    /// <summary>
    /// Thread-safe dispatcher for running actions on the Unity main thread.
    /// Used by TrayIconManager and other background-thread components.
    ///
    /// Must be placed on a GameObject that persists (DontDestroyOnLoad).
    /// </summary>
    public sealed class UnityMainThreadDispatcher : MonoBehaviour
    {
        private static readonly ConcurrentQueue<Action> _queue = new ConcurrentQueue<Action>();

        #region Singleton

        private static UnityMainThreadDispatcher _instance;
        public static UnityMainThreadDispatcher Instance
        {
            get
            {
                if (_instance == null)
                {
                    var go = new GameObject("UnityMainThreadDispatcher");
                    _instance = go.AddComponent<UnityMainThreadDispatcher>();
                    DontDestroyOnLoad(go);
                }
                return _instance;
            }
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        private static void AutoInitialize()
        {
            if (_instance == null)
            {
                var go = new GameObject("UnityMainThreadDispatcher");
                _instance = go.AddComponent<UnityMainThreadDispatcher>();
                DontDestroyOnLoad(go);
            }
        }

        #endregion

        #region Public API

        public static void Enqueue(Action action)
        {
            if (action == null) return;
            _queue.Enqueue(action);
        }

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            if (_instance != null && _instance != this)
            {
                Destroy(gameObject);
                return;
            }
            _instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private void Update()
        {
            // Process all queued actions (limit per frame to avoid spikes)
            int processed = 0;
            while (processed < 100 && _queue.TryDequeue(out Action action))
            {
                try
                {
                    action?.Invoke();
                }
                catch (Exception ex)
                {
                    Debug.LogError($"[Dispatcher] Error in queued action: {ex}");
                }
                processed++;
            }
        }

        #endregion
    }
}
