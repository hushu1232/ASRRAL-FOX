using Alife.Function.Memory;

namespace Alife.Test.Framework;

public class MemoryStorageConsistencyTests
{
    [Test]
    public async Task RepairConsistencyAsync_RecreatesMissingArchiveFileFromDatabase()
    {
        string rootPath = CreateTempRoot();
        await using MemoryStorage storage = new(rootPath, new FakeVectorizer());
        DateTimeOffset now = DateTimeOffset.Parse("2026-06-14T10:00:00+08:00");

        await storage.SaveAsync("3-db-only", 3, "repairable summary", "repairable content", now, now);
        string archivePath = Path.Combine(rootPath, "L3", "3-db-only.txt");
        File.Delete(archivePath);

        MemoryStorageConsistencyReport report = await storage.RepairConsistencyAsync();

        Assert.That(report.MissingArchiveFiles, Is.EqualTo(1));
        Assert.That(report.RepairedArchiveFiles, Is.EqualTo(1));
        Assert.That(File.Exists(archivePath), Is.True);
        string? loaded = await storage.LoadAsync(3, "3-db-only");
        Assert.That(loaded, Does.Contain("repairable summary"));
        Assert.That(loaded, Does.Contain("repairable content"));
    }

    [Test]
    public async Task StartupScanReportsMissingIndexRecordAndRepairReindexesArchiveFile()
    {
        string rootPath = CreateTempRoot();
        DateTimeOffset now = DateTimeOffset.Parse("2026-06-14T10:00:00+08:00");

        await using (MemoryStorage storage = new(rootPath, new FakeVectorizer()))
        {
            await storage.SaveAsync("3-file-only", 3, "orphan archive summary", "orphan archive content", now, now);
        }

        foreach (string dbFile in Directory.GetFiles(rootPath, "memory_index*"))
            File.Delete(dbFile);

        await using MemoryStorage repairedStorage = new(rootPath, new FakeVectorizer());

        Assert.That(repairedStorage.LastConsistencyReport.MissingIndexRecords, Is.EqualTo(1));

        MemoryStorageConsistencyReport repairReport = await repairedStorage.RepairConsistencyAsync();
        Assert.That(repairReport.MissingIndexRecords, Is.EqualTo(1));
        Assert.That(repairReport.RepairedIndexRecords, Is.EqualTo(1));

        (List<SearchResult> results, int total) = await repairedStorage.SearchAsync(
            3,
            "orphan",
            null,
            topK: 5,
            offset: 0,
            searchMode: MemorySearchMode.Keyword,
            includePermanent: false);

        Assert.That(total, Is.EqualTo(1));
        Assert.That(results.Single().Name, Is.EqualTo("3-file-only"));
    }

    static string CreateTempRoot()
    {
        string rootPath = Path.Combine(Path.GetTempPath(), "alife-memory-consistency-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(rootPath);
        return rootPath;
    }

    sealed class FakeVectorizer : ITextVectorizer
    {
        public Task<float[]> VectorizeAsync(string text)
        {
            float[] vector = new float[512];
            vector[0] = text.Length;
            return Task.FromResult(vector);
        }
    }
}
