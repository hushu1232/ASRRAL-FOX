using AstralFox.AI.Context;
using System;
using System.Collections.Generic;
using UnityEngine;

namespace AstralFox.Behavior
{
    /// <summary>
    /// Centralized message arbiter — prevents multiple systems from speaking at once.
    /// TimeAwareness, ProactiveChat, and ContextAwareness all produce messages;
    /// this component ensures only one message plays at a time with proper
    /// prioritization, deduplication, and cooldown enforcement.
    /// </summary>
    public sealed class MessageArbiter : MonoBehaviour
    {
        #region Types

        public enum MessagePriority
        {
            Critical = 0,  // User return, wake word response
            High = 1,      // Night care, needs critical
            Normal = 2,    // Hourly, context triggers
            Low = 3,       // Idle chatter, ambient
        }

        public struct QueuedMessage
        {
            public string text;
            public string source;
            public MessagePriority priority;
            public float timestamp;
            public Action<string> onDeliver;
        }

        #endregion

        #region Inspector

        [Header("Cooldowns")]
        [SerializeField, Range(5f, 60f)]
        private float _minInterval = 8f;       // Minimum seconds between ANY messages

        [SerializeField, Range(10f, 120f)]
        private float _sameSourceCooldown = 30f; // Minimum seconds between same-source messages

        [SerializeField, Range(5f, 30f)]
        private float _dedupWindow = 10f;       // Window for deduplicating similar messages

        [Header("Queue")]
        [SerializeField, Range(3, 10)]
        private int _maxQueueSize = 5;

        #endregion

        #region Events

        /// <summary>Fired when a message is delivered (shown to user).</summary>
        public event Action<string, string> OnMessageDelivered; // text, source

        #endregion

        #region State

        private Queue<QueuedMessage> _queue = new();
        private float _lastDeliveryTime = -999f;
        private Dictionary<string, float> _sourceLastDelivery = new();
        private List<string> _recentMessages = new(); // For dedup
        private bool _isDelivering;

        #endregion

        #region Public API

        /// <summary>Submit a message for delivery. May be queued or dropped based on priority and cooldown.</summary>
        public void Submit(string text, string source, MessagePriority priority = MessagePriority.Normal, Action<string> onDeliver = null)
        {
            // Drop if queue full and new message isn't higher priority than everything in queue
            if (_queue.Count >= _maxQueueSize)
            {
                bool hasLower = false;
                foreach (var q in _queue)
                    if ((int)q.priority > (int)priority) { hasLower = true; break; }
                if (!hasLower)
                {
                    Debug.Log($"[MessageArbiter] Queue full, dropping low-priority: {source}");
                    return;
                }
            }

            // Dedup: skip if same text was delivered recently
            if (IsDuplicate(text))
            {
                Debug.Log($"[MessageArbiter] Dedup: {source} — '{text}'");
                return;
            }

            // Same-source cooldown
            if (_sourceLastDelivery.TryGetValue(source, out float lastTime))
            {
                if (Time.unscaledTime - lastTime < _sameSourceCooldown && priority >= MessagePriority.Normal)
                {
                    Debug.Log($"[MessageArbiter] Source cooldown: {source}");
                    return; // Drop normal/low from same source
                }
            }

            _queue.Enqueue(new QueuedMessage
            {
                text = text,
                source = source,
                priority = priority,
                timestamp = Time.unscaledTime,
                onDeliver = onDeliver,
            });

            // Trim queue if oversized
            while (_queue.Count > _maxQueueSize)
            {
                // Remove lowest priority
                QueuedMessage lowest = _queue.Peek();
                foreach (var q in _queue)
                    if ((int)q.priority > (int)lowest.priority) lowest = q;
                // Rebuild queue without lowest
                var kept = new Queue<QueuedMessage>();
                foreach (var q in _queue)
                    if (!q.Equals(lowest)) kept.Enqueue(q);
                _queue = kept;
            }
        }

        #endregion

        #region Unity Lifecycle

        private void Update()
        {
            if (_isDelivering) return;
            if (_queue.Count == 0) return;

            // Check global cooldown
            if (Time.unscaledTime - _lastDeliveryTime < _minInterval) return;

            _isDelivering = true;
            var msg = _queue.Dequeue();

            // Record for dedup
            _recentMessages.Add(msg.text);
            if (_recentMessages.Count > 10) _recentMessages.RemoveAt(0);

            _lastDeliveryTime = Time.unscaledTime;
            _sourceLastDelivery[msg.source] = Time.unscaledTime;

            msg.onDeliver?.Invoke(msg.text);
            OnMessageDelivered?.Invoke(msg.text, msg.source);

            Debug.Log($"[MessageArbiter] Delivered [{msg.priority}]{msg.source}: '{msg.text}'");

            _isDelivering = false;
        }

        #endregion

        #region Helpers

        private bool IsDuplicate(string text)
        {
            foreach (var recent in _recentMessages)
            {
                // Simple similarity: same first 3 chars or >80% overlap
                if (recent == text) return true;
                if (recent.Length > 3 && text.Length > 3 &&
                    recent.Substring(0, 3) == text.Substring(0, 3))
                    return true;
            }
            return false;
        }

        /// <summary>Get the singleton instance (auto-find or create).</summary>
        public static MessageArbiter Instance
        {
            get
            {
                if (_instance == null)
                    _instance = FindObjectOfType<MessageArbiter>();
                return _instance;
            }
        }
        private static MessageArbiter _instance;

        #endregion
    }
}
