using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace AstralFox.Core
{
    /// <summary>
    /// Singleton registry for pluggable AI function tools.
    /// All IFoxFunction implementations register here at startup.
    /// The LLM service queries GetAll() to construct the function list.
    ///
    /// Usage:
    ///   FunctionRegistry.Instance.Register(new WeatherFunction());
    ///   var tools = FunctionRegistry.Instance.GetAll();
    /// </summary>
    public sealed class FunctionRegistry
    {
        #region Singleton

        public static FunctionRegistry Instance { get; } = new();

        #endregion

        private readonly List<IFoxFunction> _functions = new();
        private readonly Dictionary<string, IFoxFunction> _byName = new();

        private FunctionRegistry() { }

        /// <summary>Register a function. Call during initialization.</summary>
        public void Register(IFoxFunction function)
        {
            if (function == null) return;
            if (_byName.ContainsKey(function.Name))
            {
                Debug.LogWarning($"[FunctionRegistry] Duplicate function: {function.Name}");
                return;
            }

            _functions.Add(function);
            _byName[function.Name] = function;
            Debug.Log($"[FunctionRegistry] Registered: {function.Name}");
        }

        /// <summary>Unregister a function by name.</summary>
        public void Unregister(string name)
        {
            if (!_byName.TryGetValue(name, out var fn)) return;
            _functions.Remove(fn);
            _byName.Remove(name);
            Debug.Log($"[FunctionRegistry] Unregistered: {name}");
        }

        /// <summary>Get all registered functions.</summary>
        public IReadOnlyList<IFoxFunction> GetAll() => _functions.AsReadOnly();

        /// <summary>Find a function by name.</summary>
        public IFoxFunction Find(string name) =>
            _byName.TryGetValue(name, out var fn) ? fn : null;

        /// <summary>Get count of registered functions.</summary>
        public int Count => _functions.Count;
    }
}
