using NUnit.Framework;
using UnityEngine;
using System.IO;

/// <summary>
/// Verify DataStore auth token encryption roundtrips correctly.
/// </summary>
public class DataStoreEncryptionTests
{
    [Test]
    public void AuthTokens_ShouldRoundtrip()
    {
        // Arrange
        string accessToken = "test-access-token-12345";
        string refreshToken = "test-refresh-token-67890";

        // Act
        AstralFox.Data.DataStore.Instance.SaveAuthTokens(accessToken, refreshToken);
        string loadedAccess = AstralFox.Data.DataStore.Instance.LoadAccessToken();
        string loadedRefresh = AstralFox.Data.DataStore.Instance.LoadRefreshToken();

        // Assert
        Assert.AreEqual(accessToken, loadedAccess,
            "Access token should survive encryption roundtrip.");
        Assert.AreEqual(refreshToken, loadedRefresh,
            "Refresh token should survive encryption roundtrip.");
    }

    [Test]
    public void AuthTokens_ShouldNotBeStoredAsPlaintext()
    {
        // Arrange
        string token = "sensitive-token-value";
        AstralFox.Data.DataStore.Instance.SaveAuthTokens(token, "");
        AstralFox.Data.DataStore.Instance.Save(); // flush to disk

        // Act: read the raw JSON file
        string path = Path.Combine(Application.persistentDataPath, "astralfox_data.json");
        Assert.IsTrue(File.Exists(path), "Data file should exist after save.");

        string rawJson = File.ReadAllText(path);

        // Assert: plaintext token should NOT appear in the file
        Assert.IsFalse(rawJson.Contains(token),
            "Auth token should NOT appear in plaintext in the data file.");
    }

    [Test]
    public void EmptyTokens_ShouldReturnEmpty()
    {
        AstralFox.Data.DataStore.Instance.SaveAuthTokens("", "");
        Assert.AreEqual("", AstralFox.Data.DataStore.Instance.LoadAccessToken());
        Assert.AreEqual("", AstralFox.Data.DataStore.Instance.LoadRefreshToken());
    }
}
