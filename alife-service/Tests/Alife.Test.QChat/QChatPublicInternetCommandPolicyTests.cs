using Alife.Function.QChat;
using NUnit.Framework;

namespace Alife.Test.QChat;

[TestFixture]
public sealed class QChatPublicInternetCommandPolicyTests
{
    [TestCase("/search dotnet release news", QChatPublicInternetCommandKind.Search, "dotnet release news")]
    [TestCase(" /SEARCH dotnet release news ", QChatPublicInternetCommandKind.Search, "dotnet release news")]
    [TestCase("/search    dotnet release news", QChatPublicInternetCommandKind.Search, "dotnet release news")]
    [TestCase("/rag internet safety boundary", QChatPublicInternetCommandKind.RagQuery, "internet safety boundary")]
    public void Parse_AcceptsPublicCommands(string text, QChatPublicInternetCommandKind kind, string query)
    {
        QChatPublicInternetCommand command = QChatPublicInternetCommandPolicy.Parse(text);

        Assert.Multiple(() =>
        {
            Assert.That(command.Kind, Is.EqualTo(kind));
            Assert.That(command.Query, Is.EqualTo(query));
        });
    }

    [TestCase("/qchat search test")]
    [TestCase("/qchat rag status")]
    [TestCase("hello")]
    [TestCase("")]
    [TestCase(null)]
    [TestCase("/search ")]
    [TestCase("/rag")]
    public void Parse_DoesNotTreatQChatOrOrdinaryTextAsPublicInternetCommand(string? text)
    {
        QChatPublicInternetCommand command = QChatPublicInternetCommandPolicy.Parse(text);

        Assert.That(command.Kind, Is.EqualTo(QChatPublicInternetCommandKind.None));
    }

    [TestCase("[CQ:at,qq=999] 帮我搜一下 dotnet release news", "dotnet release news")]
    [TestCase("[CQ:at,qq=999] 查一下 GPT-SoVITS 声音克隆", "GPT-SoVITS 声音克隆")]
    [TestCase("[CQ:at,qq=999] 联网看看 agent-browser 是什么", "agent-browser 是什么")]
    [TestCase("[CQ:at,qq=999] 找一下 Moss TTS 资料", "Moss TTS 资料")]
    [TestCase("[CQ:at,qq=999] 最新 .NET 发布情况", ".NET 发布情况")]
    public void ParseMessage_GroupMentionWithSearchIntentReturnsSearch(string rawMessage, string query)
    {
        QChatPublicInternetCommand command = QChatPublicInternetCommandPolicy.ParseMessage(
            OneBotMessageType.Group,
            botId: 999,
            rawMessage,
            OneBotSegment.GetPlainText(rawMessage));

        Assert.Multiple(() =>
        {
            Assert.That(command.Kind, Is.EqualTo(QChatPublicInternetCommandKind.Search));
            Assert.That(command.Query, Is.EqualTo(query));
        });
    }

    [TestCase("[CQ:at,qq=999] 你在吗")]
    [TestCase("[CQ:at,qq=999] 今天好累")]
    [TestCase("[CQ:at,qq=999] 你怎么看这个问题")]
    [TestCase("[CQ:at,qq=999] 查看白名单状态")]
    [TestCase("帮我搜一下 dotnet release news")]
    [TestCase("[CQ:at,qq=1000] 帮我搜一下 dotnet release news")]
    public void ParseMessage_DoesNotTreatOrdinaryOrUnmentionedTextAsSearch(string rawMessage)
    {
        QChatPublicInternetCommand command = QChatPublicInternetCommandPolicy.ParseMessage(
            OneBotMessageType.Group,
            botId: 999,
            rawMessage,
            OneBotSegment.GetPlainText(rawMessage));

        Assert.That(command.Kind, Is.EqualTo(QChatPublicInternetCommandKind.None));
    }

    [Test]
    public void ParseMessage_PrivateSearchIntentDoesNotTriggerSemanticPublicSearch()
    {
        QChatPublicInternetCommand command = QChatPublicInternetCommandPolicy.ParseMessage(
            OneBotMessageType.Private,
            botId: 999,
            "[CQ:at,qq=999] 帮我搜一下 dotnet release news",
            "帮我搜一下 dotnet release news");

        Assert.That(command.Kind, Is.EqualTo(QChatPublicInternetCommandKind.None));
    }

    [TestCase(QChatSenderRole.Owner)]
    [TestCase(QChatSenderRole.GroupMember)]
    public void Evaluate_AllowsEnabledSearchForAuthorizedSenderRoles(QChatSenderRole senderRole)
    {
        QChatPublicInternetCommandDecision decision = QChatPublicInternetCommandPolicy.Evaluate(
            CreateContext(senderRole, QChatPublicInternetCommandKind.Search));

        Assert.Multiple(() =>
        {
            Assert.That(decision.Allowed, Is.True);
            Assert.That(decision.Reason, Is.EqualTo("allowed"));
        });
    }

    [Test]
    public void Evaluate_DeniesPrivateGuest()
    {
        QChatPublicInternetCommandDecision decision = QChatPublicInternetCommandPolicy.Evaluate(
            CreateContext(QChatSenderRole.PrivateGuest, QChatPublicInternetCommandKind.Search));

        Assert.Multiple(() =>
        {
            Assert.That(decision.Allowed, Is.False);
            Assert.That(decision.Reason, Is.EqualTo("public_internet_sender_not_allowed"));
        });
    }

    [Test]
    public void Evaluate_DeniesUnknownSenderRole()
    {
        QChatPublicInternetCommandDecision decision = QChatPublicInternetCommandPolicy.Evaluate(
            CreateContext((QChatSenderRole)999, QChatPublicInternetCommandKind.Search));

        Assert.Multiple(() =>
        {
            Assert.That(decision.Allowed, Is.False);
            Assert.That(decision.Reason, Is.EqualTo("public_internet_sender_not_allowed"));
        });
    }

    [Test]
    public void Evaluate_DeniesDisabledSearch()
    {
        QChatPublicInternetCommandDecision decision = QChatPublicInternetCommandPolicy.Evaluate(
            CreateContext(
                QChatSenderRole.GroupMember,
                QChatPublicInternetCommandKind.Search,
                enablePublicSearch: false));

        Assert.Multiple(() =>
        {
            Assert.That(decision.Allowed, Is.False);
            Assert.That(decision.Reason, Is.EqualTo("public_search_disabled"));
        });
    }

    [Test]
    public void Evaluate_AllowsEnabledRagQuery()
    {
        QChatPublicInternetCommandDecision decision = QChatPublicInternetCommandPolicy.Evaluate(
            CreateContext(QChatSenderRole.GroupMember, QChatPublicInternetCommandKind.RagQuery));

        Assert.Multiple(() =>
        {
            Assert.That(decision.Allowed, Is.True);
            Assert.That(decision.Reason, Is.EqualTo("allowed"));
        });
    }

    [Test]
    public void Evaluate_DeniesGroupMemberRagQueryWhenDisabled()
    {
        QChatPublicInternetCommandDecision decision = QChatPublicInternetCommandPolicy.Evaluate(
            CreateContext(
                QChatSenderRole.GroupMember,
                QChatPublicInternetCommandKind.RagQuery,
                enablePublicRagQuery: false));

        Assert.Multiple(() =>
        {
            Assert.That(decision.Allowed, Is.False);
            Assert.That(decision.Reason, Is.EqualTo("public_rag_disabled"));
        });
    }

    [Test]
    public void Evaluate_DeniesGroupMemberSearchWhenGroupMemberPublicSearchIsDisabledInRouter()
    {
        QChatPublicInternetCommandDecision decision = QChatPublicInternetCommandPolicy.Evaluate(
            new QChatPublicInternetCommandContext(
                QChatSenderRole.GroupMember,
                QChatPublicInternetCommandKind.Search,
                "query",
                100,
                EnablePublicSearch: true,
                EnablePublicRagQuery: true,
                AllowGroupMemberPublicSearch: false,
                AllowGroupMemberExternalRagQuery: true));

        Assert.Multiple(() =>
        {
            Assert.That(decision.Allowed, Is.False);
            Assert.That(decision.Reason, Is.EqualTo("group_member_public_search_disabled"));
        });
    }

    [Test]
    public void Evaluate_DeniesNone()
    {
        QChatPublicInternetCommandDecision decision = QChatPublicInternetCommandPolicy.Evaluate(
            CreateContext(QChatSenderRole.GroupMember, QChatPublicInternetCommandKind.None));

        Assert.Multiple(() =>
        {
            Assert.That(decision.Allowed, Is.False);
            Assert.That(decision.Reason, Is.EqualTo("not_public_internet_command"));
        });
    }

    [Test]
    public void Evaluate_AllowsQueryExactlyAtLimit()
    {
        QChatPublicInternetCommandDecision decision = QChatPublicInternetCommandPolicy.Evaluate(
            CreateContext(
                QChatSenderRole.GroupMember,
                QChatPublicInternetCommandKind.Search,
                query: "  12345  ",
                maxQueryChars: 5));

        Assert.Multiple(() =>
        {
            Assert.That(decision.Allowed, Is.True);
            Assert.That(decision.Reason, Is.EqualTo("allowed"));
        });
    }

    [Test]
    public void Evaluate_DeniesQueryOverLimit()
    {
        QChatPublicInternetCommandDecision decision = QChatPublicInternetCommandPolicy.Evaluate(
            CreateContext(
                QChatSenderRole.GroupMember,
                QChatPublicInternetCommandKind.Search,
                query: "123456",
                maxQueryChars: 5));

        Assert.Multiple(() =>
        {
            Assert.That(decision.Allowed, Is.False);
            Assert.That(decision.Reason, Is.EqualTo("public_query_too_long"));
        });
    }

    [Test]
    public void Evaluate_TreatsNonPositiveMaxQueryCharsAsOne()
    {
        QChatPublicInternetCommandDecision decision = QChatPublicInternetCommandPolicy.Evaluate(
            CreateContext(
                QChatSenderRole.GroupMember,
                QChatPublicInternetCommandKind.Search,
                query: "12",
                maxQueryChars: 0));

        Assert.Multiple(() =>
        {
            Assert.That(decision.Allowed, Is.False);
            Assert.That(decision.Reason, Is.EqualTo("public_query_too_long"));
        });
    }

    static QChatPublicInternetCommandContext CreateContext(
        QChatSenderRole senderRole,
        QChatPublicInternetCommandKind kind,
        string query = "query",
        int maxQueryChars = 100,
        bool enablePublicSearch = true,
        bool enablePublicRagQuery = true)
    {
        return new QChatPublicInternetCommandContext(
            senderRole,
            kind,
            query,
            maxQueryChars,
            enablePublicSearch,
            enablePublicRagQuery);
    }
}
