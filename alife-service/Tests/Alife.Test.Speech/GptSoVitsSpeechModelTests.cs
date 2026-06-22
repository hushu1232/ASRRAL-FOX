using Alife.Function.Speech;
using System.Net;
using System.Text.Json;

namespace Alife.Test.Speech;

public class GptSoVitsSpeechModelTests
{
    [Test]
    public void Config_DefaultsTargetLocalApiAndXiayuVoice()
    {
        var config = new GptSoVitsSpeechModelConfig();

        Assert.Multiple(() =>
        {
            Assert.That(config.ApiBaseUrl, Is.EqualTo("http://127.0.0.1:9880"));
            Assert.That(config.VoiceId, Is.EqualTo("xiayu"));
            Assert.That(config.TextLanguage, Is.EqualTo("zh"));
            Assert.That(config.PromptLanguage, Is.EqualTo("zh"));
            Assert.That(config.MediaType, Is.EqualTo("wav"));
            Assert.That(config.MaxTextChars, Is.EqualTo(120));
            Assert.That(config.EnableCache, Is.True);
            Assert.That(config.AllowPersonaFallbackToEdgeTts, Is.False);
        });
    }

    [Test]
    public async Task GenerateSpeechFileAsync_EmptyText_ReturnsNullWithoutHttpCall()
    {
        var handler = new RecordingHandler();
        var model = CreateModel(handler, CreateVoiceFolder());

        string? result = await model.GenerateSpeechFileAsync("   ");

        Assert.Multiple(() =>
        {
            Assert.That(result, Is.Null);
            Assert.That(handler.Calls, Is.EqualTo(0));
        });
    }

    [Test]
    public async Task GenerateSpeechFileAsync_TextLongerThanMaxTextChars_ReturnsNullWithoutHttpCall()
    {
        var handler = new RecordingHandler();
        var model = CreateModel(handler, CreateVoiceFolder(), config => config.MaxTextChars = 3);

        string? result = await model.GenerateSpeechFileAsync("1234");

        Assert.Multiple(() =>
        {
            Assert.That(result, Is.Null);
            Assert.That(handler.Calls, Is.EqualTo(0));
        });
    }

    [Test]
    public async Task GenerateSpeechFileAsync_MissingReferenceAudio_ReturnsNullWithoutHttpCall()
    {
        var voiceFolder = CreateVoiceFolder(writeReferenceAudio: false);
        var handler = new RecordingHandler();
        var model = CreateModel(handler, voiceFolder);

        string? result = await model.GenerateSpeechFileAsync("hello");

        Assert.Multiple(() =>
        {
            Assert.That(result, Is.Null);
            Assert.That(handler.Calls, Is.EqualTo(0));
        });
    }

    [Test]
    public async Task GenerateSpeechFileAsync_SuccessfulWavResponse_WritesFileAndReturnsExistingPath()
    {
        var handler = new RecordingHandler();
        var model = CreateModel(handler, CreateVoiceFolder());

        string? result = await model.GenerateSpeechFileAsync("hello");

        Assert.Multiple(() =>
        {
            Assert.That(result, Is.Not.Null);
            Assert.That(File.Exists(result!), Is.True);
            Assert.That(new FileInfo(result!).Length, Is.GreaterThan(0));
            Assert.That(handler.Calls, Is.EqualTo(1));
        });
    }

    [Test]
    public async Task GenerateSpeechFileAsync_SameTextTwice_ReturnsSameCachedPathWithoutSecondHttpCall()
    {
        var handler = new RecordingHandler();
        var model = CreateModel(handler, CreateVoiceFolder());

        string? first = await model.GenerateSpeechFileAsync("hello");
        string? second = await model.GenerateSpeechFileAsync("hello");

        Assert.Multiple(() =>
        {
            Assert.That(second, Is.EqualTo(first));
            Assert.That(handler.Calls, Is.EqualTo(1));
        });
    }

    [Test]
    public async Task GenerateSpeechFileAsync_ZeroByteCachedFile_RegeneratesInsteadOfReturningPoisonedCache()
    {
        var handler = new RecordingHandler
        {
            ResponseBytes = []
        };
        var model = CreateModel(handler, CreateVoiceFolder());

        string? first = await model.GenerateSpeechFileAsync("hello");

        handler.ResponseBytes = [0x52, 0x49, 0x46, 0x46, 0x01];
        string? second = await model.GenerateSpeechFileAsync("hello");

        Assert.Multiple(() =>
        {
            Assert.That(first, Is.Null);
            Assert.That(second, Is.Not.Null);
            Assert.That(new FileInfo(second!).Length, Is.GreaterThan(0));
            Assert.That(handler.Calls, Is.EqualTo(2));
        });
    }

    [Test]
    public async Task GenerateSpeechFileAsync_UsesNewCacheEntryWhenReferenceAudioChanges()
    {
        var voiceFolder = CreateVoiceFolder();
        var refAudioPath = Path.Combine(voiceFolder, "ref.wav");
        var handler = new RecordingHandler();
        var model = CreateModel(handler, voiceFolder);

        string? first = await model.GenerateSpeechFileAsync("hello");

        File.WriteAllBytes(refAudioPath, [0x52, 0x49, 0x46, 0x46, 0x02, 0x03]);
        File.SetLastWriteTimeUtc(refAudioPath, DateTime.UtcNow.AddMinutes(1));

        string? second = await model.GenerateSpeechFileAsync("hello");

        Assert.Multiple(() =>
        {
            Assert.That(second, Is.Not.EqualTo(first));
            Assert.That(handler.Calls, Is.EqualTo(2));
        });
    }

    [Test]
    public async Task GenerateSpeechFileAsync_PostBodyContainsRequiredFields()
    {
        var voiceFolder = CreateVoiceFolder(promptText: "reference prompt");
        var handler = new RecordingHandler();
        var model = CreateModel(handler, voiceFolder, config =>
        {
            config.TextLanguage = "en";
            config.PromptLanguage = "zh";
            config.BatchSize = 2;
            config.MediaType = "wav";
        });

        await model.GenerateSpeechFileAsync("hello");

        using JsonDocument document = JsonDocument.Parse(handler.Body);
        JsonElement root = document.RootElement;

        Assert.Multiple(() =>
        {
            Assert.That(root.GetProperty("text").GetString(), Is.EqualTo("hello"));
            Assert.That(root.GetProperty("text_lang").GetString(), Is.EqualTo("en"));
            Assert.That(root.GetProperty("ref_audio_path").GetString(), Is.EqualTo(Path.Combine(voiceFolder, "ref.wav")));
            Assert.That(root.GetProperty("prompt_text").GetString(), Is.EqualTo("reference prompt"));
            Assert.That(root.GetProperty("prompt_lang").GetString(), Is.EqualTo("zh"));
            Assert.That(root.GetProperty("batch_size").GetInt32(), Is.EqualTo(2));
            Assert.That(root.GetProperty("media_type").GetString(), Is.EqualTo("wav"));
            Assert.That(root.GetProperty("streaming_mode").GetBoolean(), Is.False);
        });
    }

    [Test]
    public async Task GenerateSpeechFileAsync_ConfiguredOggMediaType_StillRequestsWavAndReturnsWavPath()
    {
        var handler = new RecordingHandler();
        var model = CreateModel(handler, CreateVoiceFolder(), config => config.MediaType = "ogg");

        string? result = await model.GenerateSpeechFileAsync("hello");

        using JsonDocument document = JsonDocument.Parse(handler.Body);

        Assert.Multiple(() =>
        {
            Assert.That(result, Does.EndWith(".wav"));
            Assert.That(document.RootElement.GetProperty("media_type").GetString(), Is.EqualTo("wav"));
        });
    }

    [Test]
    public async Task Dispose_DoesNotDisposeInjectedHttpClient()
    {
        var handler = new RecordingHandler();
        using var httpClient = new HttpClient(handler);
        var model = new GptSoVitsSpeechModel(httpClient: httpClient)
        {
            Configuration = new GptSoVitsSpeechModelConfig
            {
                ApiBaseUrl = "http://localhost:9880",
                VoiceRootPath = CreateVoiceFolder()
            }
        };

        ((IDisposable)model).Dispose();
        using HttpResponseMessage response = await httpClient.GetAsync("http://localhost:9880/ping");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
    }

    static GptSoVitsSpeechModel CreateModel(
        RecordingHandler handler,
        string voiceFolder,
        Action<GptSoVitsSpeechModelConfig>? configure = null)
    {
        var config = new GptSoVitsSpeechModelConfig
        {
            ApiBaseUrl = "http://localhost:9880",
            VoiceRootPath = voiceFolder,
            EnableCache = true
        };
        configure?.Invoke(config);

        var model = new GptSoVitsSpeechModel(httpClient: new HttpClient(handler))
        {
            Configuration = config
        };
        return model;
    }

    static string CreateVoiceFolder(bool writeReferenceAudio = true, string promptText = "")
    {
        string folder = Path.Combine(TestContext.CurrentContext.WorkDirectory, "gpt-sovits-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(folder);

        if (writeReferenceAudio)
            File.WriteAllBytes(Path.Combine(folder, "ref.wav"), [0x52, 0x49, 0x46, 0x46]);

        if (promptText.Length > 0)
            File.WriteAllText(Path.Combine(folder, "ref.txt"), promptText);

        return folder;
    }

    sealed class RecordingHandler : HttpMessageHandler
    {
        public int Calls { get; private set; }
        public string Body { get; private set; } = "";
        public byte[] ResponseBytes { get; set; } = [0x52, 0x49, 0x46, 0x46, 0x01];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Calls++;
            Body = request.Content is null ? "" : await request.Content.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new ByteArrayContent(ResponseBytes)
            };
        }
    }
}
