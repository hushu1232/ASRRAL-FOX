using Alife.Framework;

namespace Alife.Test.Framework;

public class StreamingOutputSegmenterTests
{
    [Test]
    public void Push_TokenMode_ReturnsEachIncomingFragment()
    {
        StreamingOutputSegmenter segmenter = new(StreamingOutputPolicy.Token);

        Assert.That(segmenter.Push("你"), Is.EqualTo(new[] { "你" }));
        Assert.That(segmenter.Push("好"), Is.EqualTo(new[] { "好" }));
        Assert.That(segmenter.Flush(), Is.Empty);
    }

    [Test]
    public void Push_SentenceMode_BuffersUntilSentenceBoundary()
    {
        StreamingOutputSegmenter segmenter = new(StreamingOutputPolicy.QqPrivateText);

        Assert.That(segmenter.Push("我看到了"), Is.Empty);
        Assert.That(segmenter.Push("。后面继续"), Is.EqualTo(new[] { "我看到了。" }));
        Assert.That(segmenter.Flush(), Is.EqualTo(new[] { "后面继续" }));
    }

    [Test]
    public void Push_ShortSentenceMode_FlushesWhenBufferReachesMaxCharacters()
    {
        StreamingOutputPolicy policy = StreamingOutputPolicy.QqGroupText with
        {
            MaxBufferedCharacters = 6,
            MinBufferedCharacters = 1,
        };
        StreamingOutputSegmenter segmenter = new(policy);

        Assert.That(segmenter.Push("abcdef"), Is.EqualTo(new[] { "abcdef" }));
        Assert.That(segmenter.Flush(), Is.Empty);
    }

    [Test]
    public void Push_DoesNotSplitOpenCqCode()
    {
        StreamingOutputPolicy policy = StreamingOutputPolicy.QqGroupText with
        {
            MaxBufferedCharacters = 12,
            MinBufferedCharacters = 1,
        };
        StreamingOutputSegmenter segmenter = new(policy);

        Assert.That(segmenter.Push("[CQ:at,qq=1"), Is.Empty);
        Assert.That(segmenter.Push("234]你好。"), Is.EqualTo(new[] { "[CQ:at,qq=1234]你好。" }));
        Assert.That(segmenter.Flush(), Is.Empty);
    }

    [Test]
    public void Push_DisabledMode_BuffersUntilFlush()
    {
        StreamingOutputSegmenter segmenter = new(StreamingOutputPolicy.Disabled);

        Assert.That(segmenter.Push("第一段。"), Is.Empty);
        Assert.That(segmenter.Push("第二段。"), Is.Empty);
        Assert.That(segmenter.Flush(), Is.EqualTo(new[] { "第一段。第二段。" }));
    }
}
