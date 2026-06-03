using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using AstralFox.Voice;
using System.Collections;

/// <summary>
/// Critical-path tests for VoiceManager's five-state voice pipeline.
/// </summary>
public class VoiceManagerStateMachineTests
{
    private GameObject _go;
    private VoiceManager _vm;

    [SetUp]
    public void SetUp()
    {
        _go = new GameObject("TestVoiceManager");
        _go.AddComponent<MicrophoneCapture>();
        _go.AddComponent<VoiceActivityDetector>();
        _go.AddComponent<WakeWordDetector>();
        // BackendClient is replaced by MockVoicePipeline in editor tests — skip for now
        _go.AddComponent<TTSPlayer>();
        _vm = _go.AddComponent<VoiceManager>();
    }

    [TearDown]
    public void TearDown()
    {
        if (_go != null)
            Object.DestroyImmediate(_go);
    }

    [UnityTest]
    public IEnumerator ProcessingTimeout_ShouldTriggerUserNotification()
    {
        // Arrange: simulate wake word → listening → recording → processing
        _vm.SimulateWakeWord();

        // Manually advance to Processing state (bypassing VAD + recording)
        var field = typeof(VoiceManager).GetField("_stateTimer",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        var setState = typeof(VoiceManager).GetMethod("SetState",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);

        // Simulate entering Processing state
        // We can't easily call private SetState, so use the public SimulateWakeWord
        // and let time advance naturally

        bool notificationReceived = false;
        string receivedMessage = "";
        _vm.OnUserNotification += (msg) =>
        {
            notificationReceived = true;
            receivedMessage = msg;
        };

        // Manually force to Processing
        // Use reflection to set state and timer
        var stateField = typeof(VoiceManager).GetField("CurrentState",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        var timerField = typeof(VoiceManager).GetField("_stateTimer",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);

        // Force state to Processing with timer above timeout
        if (setState != null && timerField != null)
        {
            setState.Invoke(_vm, new object[] { VoiceManager.VoiceState.Processing });
            // Set the processing timeout to 0 so next Update triggers timeout
            var timeoutField = typeof(VoiceManager).GetField("_processingTimeout",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            if (timeoutField != null)
                timeoutField.SetValue(_vm, 0f);
        }

        // Act: let one Update frame run
        yield return null;

        // Assert: notification should have fired
        Assert.IsTrue(notificationReceived, "OnUserNotification should fire on processing timeout.");
        Assert.IsNotEmpty(receivedMessage, "Notification message should not be empty.");
    }

    [UnityTest]
    public IEnumerator IdleState_ShouldNotTriggerAnyTimeout()
    {
        bool notificationReceived = false;
        _vm.OnUserNotification += (_) => notificationReceived = true;

        // Stay in Idle for multiple frames
        for (int i = 0; i < 5; i++)
            yield return null;

        Assert.IsFalse(notificationReceived, "Idle state should not trigger notifications.");
    }
}
