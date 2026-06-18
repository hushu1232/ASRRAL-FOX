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
        StreamingOutputPolicy policy = StreamingOutputPolicy.QqPrivateText with
        {
            MinBufferedCharacters = 1,
        };
        StreamingOutputSegmenter segmenter = new(policy);

        Assert.That(segmenter.Push("我看到了"), Is.Empty);
        Assert.That(segmenter.Push("。后面继续"), Is.EqualTo(new[] { "我看到了。" }));
        Assert.That(segmenter.Flush(), Is.EqualTo(new[] { "后面继续" }));
    }

    [Test]
    public void Push_QqGroupText_DoesNotCutBeforeSentenceBoundary()
    {
        StreamingOutputSegmenter segmenter = new(StreamingOutputPolicy.QqGroupText);
        string incompleteSentence = "abcdefghijklmnopqrstuvwxyz0123456789abcdefghij";

        Assert.That(segmenter.Push(incompleteSentence), Is.Empty);
        Assert.That(segmenter.Flush(), Is.EqualTo(new[] { incompleteSentence }));
    }

    [Test]
    public void Push_QqGroupText_KeepsMediumMultiSentenceReplyTogether()
    {
        StreamingOutputSegmenter segmenter = new(StreamingOutputPolicy.QqGroupText);
        string reply = "这是第一段完整但不需要单独发送的说明文字，它只是整条回复的一部分。第二句继续补充，不应该为了制造流式效果拆成两条。";

        Assert.That(segmenter.Push(reply), Is.Empty);
        Assert.That(segmenter.Flush(), Is.EqualTo(new[] { reply }));
    }

    [Test]
    public void Push_ShortSentenceMode_FlushesWhenBufferReachesMaxCharacters()
    {
        StreamingOutputPolicy policy = StreamingOutputPolicy.QqGroupText with
        {
            Mode = StreamingOutputMode.ShortSentence,
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
