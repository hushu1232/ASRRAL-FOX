using Alife.Function.DeskPet;

namespace Alife.Test.DeskPet;

public class DeskPetServiceConfigTests
{
    [Test]
    public void DefaultModelNameIsMoNv()
    {
        DeskPetServiceConfig config = new();

        Assert.That(config.ModelName, Is.EqualTo("MoNv"));
    }
}
