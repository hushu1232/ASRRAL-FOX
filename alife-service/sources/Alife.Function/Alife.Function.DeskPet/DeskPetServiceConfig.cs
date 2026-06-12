namespace Alife.Function.DeskPet;

public record DeskPetServiceConfig
{
    public string ModelName { get; set; } = "MoNv";
    public bool EnableEmotionParameterSync { get; set; } = true;
    public int EmotionSyncIntervalMilliseconds { get; set; } = 250;
}
