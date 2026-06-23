using Alife.Function.Agent;

namespace Alife.Function.QChat;

public static class QChatWebResearchFormatter
{
    public static string Format(AgentWebResearchResult result)
    {
        if (result.Success == false)
            return result.Answer;

        return result.Answer;
    }
}
