using System.IO;
using Alife.Function.QChat;
using NUnit.Framework;

namespace Alife.Test.QChat;

[TestFixture]
public sealed class QChatVoiceProfileRouterTests
{
    [Test]
    public void DefaultProfilesContainXiayuAndMixu()
    {
        QChatVoiceProfileConfig config = QChatVoiceProfileConfig.CreateDefault();

        QChatVoiceProfile xiayu = config.Profiles.Single(profile => profile.AgentId == "xiayu");
        QChatVoiceProfile mixu = config.Profiles.Single(profile => profile.AgentId == "mixu");

        Assert.Multiple(() =>
        {
            Assert.That(xiayu.BotId, Is.EqualTo(2905391496));
            Assert.That(xiayu.VoiceId, Is.EqualTo("xiayu"));
            Assert.That(xiayu.ReferenceAudioPath, Does.EndWith(Path.Combine("Runtime", "TTS", "voices", "xiayu", "ref.wav")));
            Assert.That(mixu.BotId, Is.EqualTo(3340947887));
            Assert.That(mixu.VoiceId, Is.EqualTo("mixu"));
            Assert.That(mixu.ReferenceAudioPath, Does.EndWith(Path.Combine("Runtime", "TTS", "voices", "mixu", "ref.wav")));
        });
    }

    [Test]
    public void ResolvePrefersBotIdOverAgentId()
    {
        QChatVoiceProfileConfig config = new()
        {
            Profiles =
            [
                new QChatVoiceProfile
                {
                    AgentId = "mixu",
                    BotId = 2905391496,
                    VoiceId = "bot-match"
                },
                new QChatVoiceProfile
                {
                    AgentId = "xiayu",
                    BotId = 0,
                    VoiceId = "agent-match"
                }
            ]
        };

        QChatVoiceProfileDecision decision = QChatVoiceProfileRouter.Resolve(config, "xiayu", 2905391496);

        Assert.Multiple(() =>
        {
            Assert.That(decision.Kind, Is.EqualTo(QChatVoiceProfileDecisionKind.Allow));
            Assert.That(decision.Profile?.VoiceId, Is.EqualTo("bot-match"));
            Assert.That(decision.Reason, Is.EqualTo("bot_id_profile_matched"));
        });
    }

    [Test]
    public void ResolveFallsBackToAgentIdWhenBotIdDoesNotMatch()
    {
        QChatVoiceProfileConfig config = new()
        {
            Profiles =
            [
                new QChatVoiceProfile
                {
                    AgentId = "mixu",
                    BotId = 3340947887,
                    VoiceId = "mixu"
                }
            ]
        };

        QChatVoiceProfileDecision decision = QChatVoiceProfileRouter.Resolve(config, "mixu", 0);

        Assert.Multiple(() =>
        {
            Assert.That(decision.Kind, Is.EqualTo(QChatVoiceProfileDecisionKind.Allow));
            Assert.That(decision.Profile?.VoiceId, Is.EqualTo("mixu"));
            Assert.That(decision.Reason, Is.EqualTo("agent_id_profile_matched"));
        });
    }

    [Test]
    public void ResolveDeniesDisabledProfile()
    {
        QChatVoiceProfileConfig config = new()
        {
            Profiles =
            [
                new QChatVoiceProfile
                {
                    AgentId = "xiayu",
                    BotId = 2905391496,
                    VoiceId = "xiayu",
                    Enabled = false
                }
            ]
        };

        QChatVoiceProfileDecision decision = QChatVoiceProfileRouter.Resolve(config, "xiayu", 2905391496);

        Assert.Multiple(() =>
        {
            Assert.That(decision.Kind, Is.EqualTo(QChatVoiceProfileDecisionKind.Deny));
            Assert.That(decision.Profile, Is.Null);
            Assert.That(decision.Reason, Is.EqualTo("voice_profile_disabled"));
        });
    }

    [Test]
    public void ResolveDeniesWhenNoProfileMatches()
    {
        QChatVoiceProfileDecision decision = QChatVoiceProfileRouter.Resolve(
            QChatVoiceProfileConfig.CreateDefault(),
            "unknown",
            123);

        Assert.Multiple(() =>
        {
            Assert.That(decision.Kind, Is.EqualTo(QChatVoiceProfileDecisionKind.Deny));
            Assert.That(decision.Reason, Is.EqualTo("voice_profile_not_found"));
        });
    }

    [Test]
    public void ResolveDeniesWhenProfilesListIsNull()
    {
        QChatVoiceProfileConfig config = new()
        {
            Profiles = null!
        };

        QChatVoiceProfileDecision decision = QChatVoiceProfileRouter.Resolve(config, "xiayu", 2905391496);

        Assert.Multiple(() =>
        {
            Assert.That(decision.Kind, Is.EqualTo(QChatVoiceProfileDecisionKind.Deny));
            Assert.That(decision.Profile, Is.Null);
            Assert.That(decision.Reason, Is.EqualTo("voice_profile_not_found"));
        });
    }

    [Test]
    public void ResolveSkipsNullProfilesAndUsesValidMatch()
    {
        QChatVoiceProfileConfig config = new()
        {
            Profiles =
            [
                null!,
                new QChatVoiceProfile
                {
                    AgentId = "mixu",
                    BotId = 3340947887,
                    VoiceId = "mixu"
                }
            ]
        };

        QChatVoiceProfileDecision decision = QChatVoiceProfileRouter.Resolve(config, "mixu", 0);

        Assert.Multiple(() =>
        {
            Assert.That(decision.Kind, Is.EqualTo(QChatVoiceProfileDecisionKind.Allow));
            Assert.That(decision.Profile?.VoiceId, Is.EqualTo("mixu"));
            Assert.That(decision.Reason, Is.EqualTo("agent_id_profile_matched"));
        });
    }

    [Test]
    public void TextClaimCannotSwitchVoiceProfile()
    {
        QChatVoiceProfileDecision decision = QChatVoiceProfileRouter.Resolve(
            QChatVoiceProfileConfig.CreateDefault(),
            "xiayu",
            2905391496);

        Assert.Multiple(() =>
        {
            Assert.That(decision.Kind, Is.EqualTo(QChatVoiceProfileDecisionKind.Allow));
            Assert.That(decision.Profile?.VoiceId, Is.EqualTo("xiayu"));
        });
    }
}
