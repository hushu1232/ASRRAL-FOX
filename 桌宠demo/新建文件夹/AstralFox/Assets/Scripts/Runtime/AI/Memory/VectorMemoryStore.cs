using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace AstralFox.AI.Memory
{
    /// <summary>
    /// Simple keyword-overlap memory store.
    /// Uses Jaccard similarity over tokenized keywords for retrieval.
    ///
    /// Production path: replace with embedding-based vector search (e.g. OpenAI embeddings).
    /// </summary>
    public class VectorMemoryStore : IMemoryStore
    {
        private readonly Dictionary<string, MemoryEntry> _store = new();
        private const int MaxMemories = 200;

        public int Count => _store.Count;

        public void Remember(string key, string value, float importance = 0.5f)
        {
            var entry = new MemoryEntry
            {
                Key = key,
                Value = value,
                CreatedAt = DateTime.Now,
                LastAccessedAt = DateTime.Now,
                Importance = Mathf.Clamp01(importance),
            };

            _store[key] = entry;

            // Evict least important if over limit
            if (_store.Count > MaxMemories)
            {
                var toRemove = _store.Values
                    .OrderBy(e => e.Importance)
                    .ThenBy(e => e.LastAccessedAt)
                    .First();
                _store.Remove(toRemove.Key);
            }
        }

        public string Recall(string key)
        {
            if (_store.TryGetValue(key, out var entry))
            {
                entry.LastAccessedAt = DateTime.Now;
                _store[key] = entry;
                return entry.Value;
            }
            return null;
        }

        public List<MemoryEntry> SearchRelevant(string query, int topK = 5)
        {
            if (string.IsNullOrEmpty(query) || _store.Count == 0)
                return new List<MemoryEntry>();

            var queryTokens = Tokenize(query);
            if (queryTokens.Length == 0)
                return _store.Values.OrderByDescending(e => e.Importance).Take(topK).ToList();

            // Jaccard similarity: |A ∩ B| / |A ∪ B|
            var scored = _store.Values.Select(entry =>
            {
                var entryTokens = Tokenize(entry.Key + " " + entry.Value);
                var intersection = queryTokens.Intersect(entryTokens).Count();
                var union = queryTokens.Union(entryTokens).Count();
                var similarity = union > 0 ? (float)intersection / union : 0f;

                // Boost by importance
                var score = similarity * 0.7f + entry.Importance * 0.3f;
                return (entry, score);
            });

            return scored
                .OrderByDescending(x => x.score)
                .Take(topK)
                .Select(x =>
                {
                    x.entry.LastAccessedAt = DateTime.Now;
                    return x.entry;
                })
                .ToList();
        }

        public void Forget(string key) => _store.Remove(key);

        public List<MemoryEntry> GetAll() => _store.Values.OrderByDescending(e => e.CreatedAt).ToList();

        public List<(string key, string value)> ExtractFacts(string message)
        {
            var facts = new List<(string, string)>();

            if (string.IsNullOrEmpty(message)) return facts;

            var lower = message.ToLowerInvariant();

            // Pattern: "我叫/我是 X" → user_name
            foreach (var pattern in new[] { "我叫", "我是", "我的名字是", "叫我" })
            {
                var idx = lower.IndexOf(pattern);
                if (idx >= 0)
                {
                    var after = message.Substring(idx + pattern.Length).Trim();
                    var name = after.Split(new[] { ' ', '，', '。', '！', '？', '.', '!', '?' }, 2)[0].Trim();
                    if (name.Length > 0 && name.Length < 20)
                        facts.Add(("user_name", name));
                }
            }

            // Pattern: "我在学/我喜欢/我不喜欢 X"
            foreach (var (pattern, key) in new[] {
                ("我在学", "user_learning"),
                ("我在做", "user_working_on"),
                ("我喜欢", "user_likes"),
                ("我不喜欢", "user_dislikes"),
                ("我住在", "user_location"),
                ("我是做", "user_job"),
            })
            {
                var idx = lower.IndexOf(pattern);
                if (idx >= 0)
                {
                    var after = message.Substring(idx + pattern.Length).Trim();
                    var fact = after.Split(new[] { ' ', '，', '。', '！', '？', '.', '!', '?' }, 2)[0].Trim();
                    if (fact.Length > 0 && fact.Length < 50)
                        facts.Add((key, fact));
                }
            }

            // Pattern: "记住 X" → explicit memory
            var rememberIdx = lower.IndexOf("记住");
            if (rememberIdx >= 0)
            {
                var content = message.Substring(rememberIdx + 2).Trim();
                if (content.Length > 0 && content.Length < 100)
                    facts.Add(("explicit_memory", content));
            }

            return facts;
        }

        private static string[] Tokenize(string text)
        {
            if (string.IsNullOrEmpty(text)) return new string[0];

            return text.ToLowerInvariant()
                .Split(new[] { ' ', '，', '。', '！', '？', '.', '!', '?', '、', '\n', '\r', '\t' },
                    StringSplitOptions.RemoveEmptyEntries)
                .Where(t => t.Length >= 1)
                .Distinct()
                .ToArray();
        }
    }
}
