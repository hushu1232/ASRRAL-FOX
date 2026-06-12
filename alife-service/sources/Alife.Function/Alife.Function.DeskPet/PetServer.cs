using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Alife.Function.Emotion;
using Alife.Platform;

namespace Alife.Function.DeskPet;

public record PetClientStartInfo(string FileName, string Arguments, string WorkingDirectory);

public class PetServer : IAsyncDisposable, IEmotionParameterSink
{
    public event Action<string>? OnInput;
    public event Action<string>? OnInteracted;
    public event Action<Dictionary<string, ParamInfo>>? OnParamsReceived;
    public event Action<CatalogEvent>? OnCatalogReceived;
    public event Action<RendererErrorEvent>? OnRendererError;

    public IEnumerable<string> SupportedExpressions => metadata.Expressions;
    public IDictionary<string, (string Group, int Index)> SupportedMotions => metadata.Motions;
    public IEnumerable<string> SupportedActions => GetSupportedActionNames(metadata);

    public PetServer(string modelName)
    {
        string modelJsonPath = ResolveModelJsonPath(AlifePath.OutputsFolderPath, modelName);
        metadata = PetModelMetadata.Load(modelJsonPath);

        PetClientStartInfo clientStartInfo = ResolveClientStartInfo(
            AlifePath.OutputsFolderPath,
            modelJsonPath,
            preferDll: true);

        nativeProcess = new Process {
            StartInfo = new ProcessStartInfo {
                FileName = clientStartInfo.FileName,
                Arguments = clientStartInfo.Arguments,
                UseShellExecute = false,
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                StandardInputEncoding = new UTF8Encoding(false),
                StandardOutputEncoding = new UTF8Encoding(false),
                CreateNoWindow = true,
                WorkingDirectory = clientStartInfo.WorkingDirectory
            }
        };
        nativeProcess.Start();
        ProcessTracker.Track(nativeProcess);

        nativeProcess.BeginErrorReadLine();
        nativeProcess.ErrorDataReceived += (_, e) => {
            if (e.Data != null)
                AlifeTerminal.LogWarning($"[PetProcess Error] {e.Data}");
        };

        petProcess = new PetProcess(nativeProcess.StandardInput, nativeProcess.StandardOutput);
        petProcess.OutputReceived += OnEventReceived;
        petProcess.ListenOutput();
    }

    public async ValueTask DisposeAsync()
    {
        ResetInteractions();
        if (nativeProcess.HasExited == false)
        {
            nativeProcess.Kill();
            nativeProcess.Dispose();
        }
        petProcess.Dispose();
        await Task.CompletedTask;
    }

    public async Task WaitReadyAsync()
    {
        using CancellationTokenSource cancellationTokenSource = new(TimeSpan.FromSeconds(10));
        await using CancellationTokenRegistration registration = cancellationTokenSource.Token.Register(
            () => readyTask.TrySetException(new TimeoutException("Unable to connect to DeskPet client.")));
        await readyTask.Task;
    }

    public void ShowBubble(string text) => petProcess.SendInput(new BubbleCommand(text));

    public void HideBubble() => petProcess.SendInput(new HideBubbleCommand());

    public void PlayExpression(string? id) => petProcess.SendInput(new PlayExpressionCommand(id));

    public void PlayMotion(string group, int index) => petProcess.SendInput(new MotionCommand(group, index));
    public void SendStatus(bool working) => petProcess.SendInput(new StatusCommand(working));
    public void SetParam(string id, float value) => petProcess.SendInput(new ParamCommand(id, value));
    public void SetParams(Dictionary<string, float> parameters) => petProcess.SendInput(new ParamsCommand(parameters));
    public void SetLipSync(float value) => petProcess.SendInput(new LipSyncCommand(value));
    public void SetIdleCycle(bool enabled, Dictionary<string, float>? parameters = null) => petProcess.SendInput(new IdleCycleCommand(enabled, parameters));
    public void RequestParams() => petProcess.SendInput(new GetParamsCommand());
    public void RequestCatalog() => petProcess.SendInput(new GetCatalogCommand());

    public bool TryPlayInteraction(string actionName)
    {
        if (metadata.Interactions.TryGetValue(actionName, out List<InteractionItem>? pool) == false || pool.Count == 0)
            return false;

        InteractionItem item = pool[Random.Shared.Next(pool.Count)];
        if (string.IsNullOrWhiteSpace(item.Exp) == false)
            PlayExpression(item.Exp);
        if (item.Mtn != null)
            PlayMotion(item.Mtn.Group, item.Mtn.Index);
        if (string.IsNullOrWhiteSpace(item.Text) == false)
            ShowBubble(item.Text);
        return true;
    }

    public async Task MoveAsync(double x, double y, int duration)
    {
        petProcess.SendInput(new WindowMoveCommand(x, y, duration));
        await Task.Delay(duration + 200);
    }

    public async Task<(double x, double y)> GetPositionAsync()
    {
        positionTask = new TaskCompletionSource<(double, double)>(TaskCreationOptions.RunContinuationsAsynchronously);
        petProcess.SendInput(new GetPositionCommand());

        Task completedTask = await Task.WhenAny(positionTask.Task, Task.Delay(2000));
        if (completedTask == positionTask.Task)
        {
            (double x, double y) result = await positionTask.Task;
            positionTask = null;
            return result;
        }

        positionTask = null;
        throw new TimeoutException("Timed out while getting DeskPet position.");
    }

    public void ResetInteractions()
    {
        positionTask?.TrySetCanceled();
    }

    public static string ResolveModelJsonPath(string outputsFolderPath, string modelName)
    {
        string modelFolder = Path.Combine(outputsFolderPath, "Alife.DeskPet.Client", "wwwroot", "model", modelName);
        string manifestPath = Path.Combine(modelFolder, "alife.model.json");
        if (File.Exists(manifestPath))
            return manifestPath;

        return Path.Combine(modelFolder, $"{modelName}.model3.json");
    }

    public static IEnumerable<string> GetSupportedActionNames(PetModelMetadata metadata)
    {
        return metadata.Interactions.Keys.OrderBy(name => name, StringComparer.OrdinalIgnoreCase);
    }

    public static PetClientStartInfo ResolveClientStartInfo(
        string outputsFolderPath,
        string modelJsonPath,
        string? dotnetPath = null,
        bool preferDll = false)
    {
        string clientFolder = Path.Combine(outputsFolderPath, "Alife.DeskPet.Client");
        string exePath = Path.Combine(clientFolder, "Alife.DeskPet.Client.exe");
        string dllPath = Path.Combine(clientFolder, "Alife.DeskPet.Client.dll");

        if (preferDll == false && File.Exists(exePath))
            return new PetClientStartInfo(exePath, modelJsonPath, clientFolder);

        if (File.Exists(dllPath))
        {
            dotnetPath ??= FindDotnetPath();
            return new PetClientStartInfo(dotnetPath, $"\"{dllPath}\" \"{modelJsonPath}\"", clientFolder);
        }

        if (File.Exists(exePath))
            return new PetClientStartInfo(exePath, modelJsonPath, clientFolder);

        throw new FileNotFoundException($"Cannot find DeskPet client executable or dll in {clientFolder}");
    }

    static string FindDotnetPath()
    {
        string localDotnet = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ".dotnet",
            "dotnet.exe");
        if (File.Exists(localDotnet))
            return localDotnet;

        return "dotnet";
    }

    readonly Process nativeProcess;
    readonly PetProcess petProcess;
    readonly PetModelMetadata metadata;
    readonly TaskCompletionSource readyTask = new();
    TaskCompletionSource<(double, double)>? positionTask;

    void OnEventReceived(IpcEvent ev)
    {
        switch (ev)
        {
            case ReadyEvent: readyTask.TrySetResult(); break;
            case InputEvent input: OnInput?.Invoke(input.Text); break;
            case InteractionEvent interaction: OnInteracted?.Invoke(interaction.Interaction); break;
            case PositionEvent position: positionTask?.TrySetResult((position.X, position.Y)); break;
            case ParamsListEvent paramsList: OnParamsReceived?.Invoke(paramsList.Params); break;
            case CatalogEvent catalog: OnCatalogReceived?.Invoke(catalog); break;
            case RendererErrorEvent error: OnRendererError?.Invoke(error); break;
        }
    }
}
