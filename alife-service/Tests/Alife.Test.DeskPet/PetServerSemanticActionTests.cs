using Alife.Function.DeskPet;

namespace Alife.Test.DeskPet;

public class PetServerSemanticActionTests
{
    [Test]
    public void MetadataExposesSemanticActionNames()
    {
        PetModelMetadata metadata = new();
        metadata.Interactions["cry"] =
        [
            new InteractionItem { Exp = "ku" }
        ];
        metadata.Interactions["idle"] =
        [
            new InteractionItem { Mtn = new MotionRef("default", 0) }
        ];

        string[] names = PetServer.GetSupportedActionNames(metadata).ToArray();

        Assert.That(names, Is.EquivalentTo(new[] { "cry", "idle" }));
    }
}
