using System.Threading.Tasks;
using Microsoft.SemanticKernel.ChatCompletion;

public abstract class HistoryCompressor
{
    public abstract Task<string?> Compress(ChatHistory history, string prompt);
}
