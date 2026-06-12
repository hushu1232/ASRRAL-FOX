using System.IO;
using System.Text.Json;
using Alife.Function.DeskPet;

namespace Alife.Test.DeskPet;

public class PetProcessLive2DProtocolTests
{
    [Test]
    public void Live2DParameterCommandsSerializeToPetJsProtocol()
    {
        AssertCommandJson(
            new ParamCommand("ParamAngleX", 12.5f),
            """{"$type":"param","Id":"ParamAngleX","Value":12.5}""");
        AssertCommandJson(
            new ParamsCommand(new Dictionary<string, float>
            {
                ["ParamAngleX"] = 10f,
                ["ParamEyeLOpen"] = 0.5f
            }),
            """{"$type":"params","Params":{"ParamAngleX":10,"ParamEyeLOpen":0.5}}""");
        AssertCommandJson(
            new LipSyncCommand(0.75f),
            """{"$type":"lip-sync","Value":0.75}""");
        AssertCommandJson(
            new IdleCycleCommand(false, new Dictionary<string, float>
            {
                ["blinkInterval"] = 3000f
            }),
            """{"$type":"idle-cycle","Enabled":false,"Params":{"blinkInterval":3000}}""");
        AssertCommandJson(
            new GetParamsCommand(),
            """{"$type":"get-params"}""");
        AssertCommandJson(
            new GetCatalogCommand(),
            """{"$type":"get-catalog"}""");
    }

    [Test]
    public void ParamsListEventDeserializesFromPetJsProtocol()
    {
        const string json = """
            {
              "$type": "params-list",
              "params": {
                "ParamAngleX": { "value": 12, "min": -30, "max": 30 },
                "ParamEyeLOpen": { "value": 0.5, "min": 0, "max": 1 }
              }
            }
            """;

        IpcEvent? ipcEvent = JsonSerializer.Deserialize<IpcEvent>(json, PetProcess.JsonOptions);

        Assert.That(ipcEvent, Is.TypeOf<ParamsListEvent>());
        ParamsListEvent paramsListEvent = (ParamsListEvent)ipcEvent!;
        Assert.That(paramsListEvent.Params["ParamAngleX"].Value, Is.EqualTo(12f));
        Assert.That(paramsListEvent.Params["ParamAngleX"].Min, Is.EqualTo(-30f));
        Assert.That(paramsListEvent.Params["ParamAngleX"].Max, Is.EqualTo(30f));
        Assert.That(paramsListEvent.Params["ParamEyeLOpen"].Value, Is.EqualTo(0.5f));
    }

    [Test]
    public void PreviewCatalogEventDeserializesFromPetJsProtocol()
    {
        const string json = """
            {
              "$type": "catalog",
              "expressions": [
                { "name": "哭哭", "file": "exp/哭哭.exp3.json" }
              ],
              "motions": [
                { "name": "常规", "group": "exp", "index": 0, "file": "exp/常规.motion3.json", "loop": true }
              ]
            }
            """;

        IpcEvent? ipcEvent = JsonSerializer.Deserialize<IpcEvent>(json, PetProcess.JsonOptions);

        Assert.That(ipcEvent, Is.TypeOf<CatalogEvent>());
        CatalogEvent catalogEvent = (CatalogEvent)ipcEvent!;
        Assert.That(catalogEvent.Expressions.Single().Name, Is.EqualTo("哭哭"));
        Assert.That(catalogEvent.Motions.Single().Name, Is.EqualTo("常规"));
        Assert.That(catalogEvent.Motions.Single().Group, Is.EqualTo("exp"));
        Assert.That(catalogEvent.Motions.Single().Loop, Is.True);
    }

    [Test]
    public void RendererErrorEventDeserializesFromPetJsProtocol()
    {
        const string json = """
            {
              "$type": "renderer-error",
              "operation": "motion",
              "message": "Motion not found"
            }
            """;

        IpcEvent? ipcEvent = JsonSerializer.Deserialize<IpcEvent>(json, PetProcess.JsonOptions);

        Assert.That(ipcEvent, Is.TypeOf<RendererErrorEvent>());
        RendererErrorEvent rendererErrorEvent = (RendererErrorEvent)ipcEvent!;
        Assert.That(rendererErrorEvent.Operation, Is.EqualTo("motion"));
        Assert.That(rendererErrorEvent.Message, Is.EqualTo("Motion not found"));
    }

    static void AssertCommandJson(IpcCommand command, string expectedJson)
    {
        using StringWriter writer = new();
        using StringReader reader = new("");
        using PetProcess process = new(writer, reader);

        process.SendInput(command);

        Assert.That(writer.ToString().Trim(), Is.EqualTo(expectedJson));
    }
}
