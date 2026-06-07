using System.Threading.Tasks;

namespace AstralFox.Core
{
    /// <summary>
    /// Pluggable function tool for the AI pet.
    /// Register implementations via FunctionRegistry to extend
    /// the pet's capabilities (weather, search, reminders, etc.).
    ///
    /// Inspired by Alife's Plugin architecture and OpenAI function calling.
    /// </summary>
    public interface IFoxFunction
    {
        /// <summary>Unique function name (used as LLM function name).</summary>
        string Name { get; }

        /// <summary>Human-readable description for the LLM.</summary>
        string Description { get; }

        /// <summary>JSON Schema for the function parameters.</summary>
        string ParametersSchema { get; }

        /// <summary>Execute the function with JSON arguments.</summary>
        Task<string> Execute(string jsonArguments);
    }
}
