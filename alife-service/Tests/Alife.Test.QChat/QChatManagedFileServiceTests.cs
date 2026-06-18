using System.IO;
using System.IO.Compression;
using System.Text;
using Alife.Function.Agent;
using Alife.Function.QChat;
using NUnit.Framework;

namespace Alife.Test.QChat;

[TestFixture]
public class QChatManagedFileServiceTests
{
    [Test]
    public async Task RegisterAsyncStoresPendingFileWithoutDownloading()
    {
        string root = CreateTempRoot();
        QChatManagedFileService service = new(root, (_, _) => throw new InvalidOperationException("download should not run"));

        QChatManagedFileRecord record = await service.RegisterAsync(new QChatManagedFileRegistration(
            MessageType: OneBotMessageType.Private,
            SenderId: 1001,
            GroupId: 0,
            FileId: "qq-file-1",
            OriginalName: "notes.txt",
            Size: 12,
            Url: "https://example.invalid/notes.txt"));

        Assert.That(record.Status, Is.EqualTo(QChatManagedFileStatus.Pending));
        Assert.That(record.OriginalName, Is.EqualTo("notes.txt"));
        Assert.That(record.LocalPath, Is.Null);
        Assert.That(File.Exists(Path.Combine(root, "pending-index.json")), Is.True);
        Assert.That(Directory.Exists(Path.Combine(root, "downloads")), Is.False);
    }

    [Test]
    public async Task DownloadAsyncSavesApprovedTextFileIntoManagedFolderAndReturnsPreview()
    {
        string root = CreateTempRoot();
        QChatManagedFileService service = new(root, (_, _) => Task.FromResult(Encoding.UTF8.GetBytes("hello from file")));
        QChatManagedFileRecord record = await service.RegisterAsync(new QChatManagedFileRegistration(
            MessageType: OneBotMessageType.Private,
            SenderId: 1001,
            GroupId: 0,
            FileId: "qq-file-2",
            OriginalName: "notes.txt",
            Size: 15,
            Url: "https://example.invalid/notes.txt"));

        QChatManagedFileOperationResult result = await service.DownloadAsync(record.Id);

        Assert.That(result.Success, Is.True);
        Assert.That(result.Record!.Status, Is.EqualTo(QChatManagedFileStatus.Downloaded));
        Assert.That(result.Record.LocalPath, Does.StartWith(root));
        Assert.That(File.Exists(result.Record.LocalPath!), Is.True);
        Assert.That(await File.ReadAllTextAsync(result.Record.LocalPath!), Is.EqualTo("hello from file"));
        Assert.That(result.TextPreview, Does.Contain("hello from file"));
    }

    [Test]
    public async Task DeleteAsyncRemovesManagedDownloadedFile()
    {
        string root = CreateTempRoot();
        QChatManagedFileService service = new(root, (_, _) => Task.FromResult(Encoding.UTF8.GetBytes("delete me")));
        QChatManagedFileRecord record = await service.RegisterAsync(new QChatManagedFileRegistration(
            MessageType: OneBotMessageType.Private,
            SenderId: 1001,
            GroupId: 0,
            FileId: "qq-file-3",
            OriginalName: "delete.txt",
            Size: 9,
            Url: "https://example.invalid/delete.txt"));
        QChatManagedFileOperationResult downloaded = await service.DownloadAsync(record.Id);

        QChatManagedFileOperationResult deleted = await service.DeleteAsync(record.Id);

        Assert.That(deleted.Success, Is.True);
        Assert.That(File.Exists(downloaded.Record!.LocalPath!), Is.False);
        Assert.That(deleted.Record!.Status, Is.EqualTo(QChatManagedFileStatus.Deleted));
    }

    [Test]
    public async Task DeleteAsync_NonOwnerGroupUserRequiresApproval()
    {
        string root = CreateTempRoot();
        QChatManagedFileService service = new(root, (_, _) => Task.FromResult(Encoding.UTF8.GetBytes("keep me")));
        QChatManagedFileRecord record = await service.RegisterAsync(new QChatManagedFileRegistration(
            MessageType: OneBotMessageType.Group,
            SenderId: 2002,
            GroupId: 3003,
            FileId: "qq-file-permission",
            OriginalName: "note.txt",
            Size: 7,
            Url: "https://example.invalid/note.txt"));
        QChatManagedFileOperationResult downloaded = await service.DownloadAsync(record.Id);
        AgentPermissionGate gate = new(new AgentPermissionPolicy(new AgentPermissionConfig
        {
            OwnerUserIds = [3045846738],
            RequireConfirmationForHighRisk = true
        }));

        QChatManagedFileOperationResult deleted = await service.DeleteAsync(
            record.Id,
            actorUserId: 2002,
            source: AgentRequestSource.GroupChat,
            permissionGate: gate);

        Assert.That(deleted.Success, Is.False);
        Assert.That(deleted.Message, Does.Contain("owner"));
        Assert.That(File.Exists(downloaded.Record!.LocalPath!), Is.True);
        Assert.That((await service.ListAsync()).Single(item => item.Id == record.Id).Status, Is.EqualTo(QChatManagedFileStatus.Downloaded));
    }

    [Test]
    public async Task DownloadAsyncExtractsDocxTextPreview()
    {
        string root = CreateTempRoot();
        byte[] docx = CreateMinimalDocx("docx phrase");
        QChatManagedFileService service = new(root, (_, _) => Task.FromResult(docx));
        QChatManagedFileRecord record = await service.RegisterAsync(new QChatManagedFileRegistration(
            MessageType: OneBotMessageType.Private,
            SenderId: 1001,
            GroupId: 0,
            FileId: "qq-file-4",
            OriginalName: "report.docx",
            Size: docx.Length,
            Url: "https://example.invalid/report.docx"));

        QChatManagedFileOperationResult result = await service.DownloadAsync(record.Id);

        Assert.That(result.Success, Is.True);
        Assert.That(result.TextPreview, Does.Contain("docx phrase"));
    }

    [Test]
    public async Task DownloadAsyncSanitizesPathTraversalFileName()
    {
        string root = CreateTempRoot();
        QChatManagedFileService service = new(root, (_, _) => Task.FromResult(Encoding.UTF8.GetBytes("safe")));
        QChatManagedFileRecord record = await service.RegisterAsync(new QChatManagedFileRegistration(
            MessageType: OneBotMessageType.Group,
            SenderId: 1001,
            GroupId: 2002,
            FileId: "qq-file-5",
            OriginalName: @"..\evil.txt",
            Size: 4,
            Url: "https://example.invalid/evil.txt"));

        QChatManagedFileOperationResult result = await service.DownloadAsync(record.Id);

        Assert.That(result.Success, Is.True);
        Assert.That(result.Record!.LocalPath, Does.StartWith(root));
        Assert.That(Path.GetFileName(result.Record.LocalPath!), Is.EqualTo("evil.txt"));
    }

    static string CreateTempRoot()
    {
        string root = Path.Combine(Path.GetTempPath(), "alife-qchat-managed-files-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        return root;
    }

    static byte[] CreateMinimalDocx(string text)
    {
        using MemoryStream stream = new();
        using (ZipArchive archive = new(stream, ZipArchiveMode.Create, leaveOpen: true))
        {
            ZipArchiveEntry entry = archive.CreateEntry("word/document.xml");
            using StreamWriter writer = new(entry.Open(), Encoding.UTF8);
            writer.Write($"""
                          <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                          <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
                            <w:body>
                              <w:p><w:r><w:t>{text}</w:t></w:r></w:p>
                            </w:body>
                          </w:document>
                          """);
        }

        return stream.ToArray();
    }
}
