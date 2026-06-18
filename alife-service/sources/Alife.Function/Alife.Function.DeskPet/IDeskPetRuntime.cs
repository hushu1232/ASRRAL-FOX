using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Alife.Function.Emotion;

namespace Alife.Function.DeskPet;

public interface IDeskPetRuntime : IAsyncDisposable, IEmotionParameterSink
{
    event Action<string>? OnInput;
    event Action<string>? OnInteracted;
    IEnumerable<string> SupportedExpressions { get; }
    IDictionary<string, (string Group, int Index)> SupportedMotions { get; }
    IEnumerable<string> SupportedActions { get; }
    Task WaitReadyAsync();
    void ShowBubble(string text);
    void HideBubble();
    void PlayExpression(string? id);
    void PlayMotion(string group, int index);
    bool TryPlayInteraction(string actionName);
    void SendStatus(bool working);
    Task MoveAsync(double x, double y, int duration);
    Task<(double x, double y)> GetPositionAsync();
}
