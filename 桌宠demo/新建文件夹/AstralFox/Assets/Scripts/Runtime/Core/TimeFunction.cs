using System;
using System.Threading.Tasks;
using UnityEngine;

namespace AstralFox.Core
{
    /// <summary>
    /// Example pluggable function: get current time.
    /// Demonstrates the IFoxFunction interface pattern.
    ///
    /// Register with: FunctionRegistry.Instance.Register(new TimeFunction());
    /// </summary>
    public sealed class TimeFunction : IFoxFunction
    {
        public string Name => "get_current_time";

        public string Description => "Get the current local time. Use when the user asks what time it is.";

        public string ParametersSchema => @"{
            ""type"": ""object"",
            ""properties"": {
                ""timezone_offset"": {
                    ""type"": ""number"",
                    ""description"": ""Optional timezone offset in hours. Defaults to local time.""
                }
            }
        }";

        public Task<string> Execute(string jsonArguments)
        {
            var now = DateTime.Now;
            var result = $"现在是 {now:yyyy年M月d日 HH:mm:ss}，星期{new[] { "日", "一", "二", "三", "四", "五", "六" }[(int)now.DayOfWeek]}。";
            Debug.Log($"[TimeFunction] Executed: {result}");
            return Task.FromResult(result);
        }
    }
}
