using System;
using System.Collections.Generic;

namespace AstralFox.AI.Memory
{
    /// <summary>
    /// A single memory entry in the store.
    /// </summary>
    [Serializable]
    public struct MemoryEntry
    {
        public string Key;
        public string Value;
        public DateTime CreatedAt;
        public DateTime LastAccessedAt;
        public float Importance; // 0-1, higher = more important
    }

    /// <summary>
    /// Long-term memory store for the AI pet companion.
    /// Stores facts about the user (name, preferences, etc.) and
    /// retrieves relevant memories for conversation context.
    ///
    /// Inspired by Alife's Memory module architecture.
    /// </summary>
    public interface IMemoryStore
    {
        /// <summary>Store a fact with optional importance.</summary>
        void Remember(string key, string value, float importance = 0.5f);

        /// <summary>Recall a specific fact by key.</summary>
        string Recall(string key);

        /// <summary>Search for memories relevant to a query.</summary>
        List<MemoryEntry> SearchRelevant(string query, int topK = 5);

        /// <summary>Remove a specific memory.</summary>
        void Forget(string key);

        /// <summary>Get all stored memories.</summary>
        List<MemoryEntry> GetAll();

        /// <summary>Total number of stored memories.</summary>
        int Count { get; }

        /// <summary>Extract implicit facts from a conversation message.</summary>
        List<(string key, string value)> ExtractFacts(string message);
    }
}
