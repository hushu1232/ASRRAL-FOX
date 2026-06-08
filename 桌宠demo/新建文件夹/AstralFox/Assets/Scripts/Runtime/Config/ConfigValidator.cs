using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using Debug = UnityEngine.Debug;

namespace AstralFox.Config
{
    /// <summary>
    /// Connection validator for Azure Speech, OpenAI, and ffmpeg.
    /// All tests run on background threads; results are dispatched to the main thread.
    /// </summary>
    public static class ConfigValidator
    {
        #region Result Types

        public enum TestStatus { NotRun, Running, Success, Failure }

        public struct TestResult
        {
            public TestStatus Status;
            public string Message;
            public long LatencyMs;
        }

        public struct AllResults
        {
            public TestResult Azure;
            public TestResult OpenAI;
            public TestResult Ffmpeg;

            public bool AllPassed =>
                Azure.Status == TestStatus.Success &&
                OpenAI.Status == TestStatus.Success &&
                (Ffmpeg.Status == TestStatus.Success || Ffmpeg.Status == TestStatus.NotRun);
        }

        #endregion

        #region Public API

        /// <summary>
        /// Run all connectivity tests.
        /// On main thread: progressCallback is invoked as each test completes.
        /// On complete: doneCallback is invoked with all results.
        /// </summary>
        public static async System.Threading.Tasks.Task RunAllTestsAsync(
            AppConfig config,
            Action<string, TestStatus> progressCallback,
            Action<AllResults> doneCallback)
        {
            var results = new AllResults();
            var ctx = SynchronizationContext.Current;

            // ── Azure ──────────────────────────────────────────
            Report(ctx, progressCallback, "Azure", TestStatus.Running);
            results.Azure = await TestAzureAsync(config);
            Report(ctx, progressCallback, "Azure", results.Azure.Status);

            // ── OpenAI ─────────────────────────────────────────
            Report(ctx, progressCallback, "OpenAI", TestStatus.Running);
            results.OpenAI = await TestOpenAIAsync(config);
            Report(ctx, progressCallback, "OpenAI", results.OpenAI.Status);

            // ── ffmpeg ─────────────────────────────────────────
            if (!string.IsNullOrWhiteSpace(config.ffmpeg_path))
            {
                Report(ctx, progressCallback, "ffmpeg", TestStatus.Running);
                results.Ffmpeg = await TestFfmpegAsync(config.ffmpeg_path);
                Report(ctx, progressCallback, "ffmpeg", results.Ffmpeg.Status);
            }
            else
            {
                results.Ffmpeg = new TestResult
                {
                    Status = TestStatus.NotRun,
                    Message = "ffmpeg 路径未设置，已跳过。"
                };
                Report(ctx, progressCallback, "ffmpeg", TestStatus.NotRun);
            }

            ctx?.Post(_ => doneCallback?.Invoke(results), null);
        }

        #endregion

        #region Individual Tests

        /// <summary>Test Azure Speech Service by requesting an auth token.</summary>
        public static async Task<TestResult> TestAzureAsync(AppConfig config)
        {
            var sw = Stopwatch.StartNew();

            try
            {
                if (string.IsNullOrWhiteSpace(config.azure_speech_key))
                {
                    sw.Stop();
                    return new TestResult
                    {
                        Status = TestStatus.Failure,
                        Message = "Azure Speech Key 未填写。",
                        LatencyMs = sw.ElapsedMilliseconds
                    };
                }

                string url = $"https://{config.azure_speech_region}.api.cognitive.microsoft.com/" +
                             "sts/v1.0/issuetoken";

                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
                using var http = new HttpClient();

                var req = new HttpRequestMessage(HttpMethod.Post, url);
                req.Headers.Add("Ocp-Apim-Subscription-Key", config.azure_speech_key);
                req.Content = new ByteArrayContent(Array.Empty<byte>());
                req.Content.Headers.ContentType =
                    new System.Net.Http.Headers.MediaTypeHeaderValue("application/x-www-form-urlencoded");

                var resp = await http.SendAsync(req, cts.Token);
                sw.Stop();

                if (resp.IsSuccessStatusCode)
                {
                    return new TestResult
                    {
                        Status = TestStatus.Success,
                        Message = $"Azure 连接成功！(区域: {config.azure_speech_region})",
                        LatencyMs = sw.ElapsedMilliseconds
                    };
                }

                string body = await resp.Content.ReadAsStringAsync();
                return new TestResult
                {
                    Status = TestStatus.Failure,
                    Message = $"Azure 返回 {(int)resp.StatusCode} {resp.ReasonPhrase}。请检查 Key 和区域。",
                    LatencyMs = sw.ElapsedMilliseconds
                };
            }
            catch (TaskCanceledException)
            {
                sw.Stop();
                return new TestResult
                {
                    Status = TestStatus.Failure,
                    Message = "Azure 连接超时（10秒）。请检查网络或区域设置。",
                    LatencyMs = sw.ElapsedMilliseconds
                };
            }
            catch (Exception ex)
            {
                sw.Stop();
                return new TestResult
                {
                    Status = TestStatus.Failure,
                    Message = $"Azure 连接失败: {ex.Message}",
                    LatencyMs = sw.ElapsedMilliseconds
                };
            }
        }

        /// <summary>Test OpenAI API by listing models.</summary>
        public static async Task<TestResult> TestOpenAIAsync(AppConfig config)
        {
            var sw = Stopwatch.StartNew();

            try
            {
                if (string.IsNullOrWhiteSpace(config.openai_api_key))
                {
                    sw.Stop();
                    return new TestResult
                    {
                        Status = TestStatus.Failure,
                        Message = "OpenAI API Key 未填写。",
                        LatencyMs = sw.ElapsedMilliseconds
                    };
                }

                string baseUrl = string.IsNullOrWhiteSpace(config.openai_base_url)
                    ? "https://api.openai.com/v1"
                    : config.openai_base_url.TrimEnd('/');

                string url = $"{baseUrl}/models";

                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
                using var http = new HttpClient();

                var req = new HttpRequestMessage(HttpMethod.Get, url);
                req.Headers.Add("Authorization", $"Bearer {config.openai_api_key}");

                var resp = await http.SendAsync(req, cts.Token);
                sw.Stop();

                if (resp.IsSuccessStatusCode)
                {
                    return new TestResult
                    {
                        Status = TestStatus.Success,
                        Message = $"OpenAI 连接成功！(Base URL: {baseUrl})",
                        LatencyMs = sw.ElapsedMilliseconds
                    };
                }

                string body = await resp.Content.ReadAsStringAsync();
                return new TestResult
                {
                    Status = TestStatus.Failure,
                    Message = $"OpenAI 返回 {(int)resp.StatusCode} {resp.ReasonPhrase}。请检查 Key 和 Base URL。",
                    LatencyMs = sw.ElapsedMilliseconds
                };
            }
            catch (TaskCanceledException)
            {
                sw.Stop();
                return new TestResult
                {
                    Status = TestStatus.Failure,
                    Message = "OpenAI 连接超时（10秒）。请检查网络或 Base URL。",
                    LatencyMs = sw.ElapsedMilliseconds
                };
            }
            catch (Exception ex)
            {
                sw.Stop();
                return new TestResult
                {
                    Status = TestStatus.Failure,
                    Message = $"OpenAI 连接失败: {ex.Message}",
                    LatencyMs = sw.ElapsedMilliseconds
                };
            }
        }

        /// <summary>Test ffmpeg by running ffmpeg -version.</summary>
        public static Task<TestResult> TestFfmpegAsync(string ffmpegPath)
        {
            return Task.Run(() =>
            {
                var sw = Stopwatch.StartNew();
                try
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = ffmpegPath,
                        Arguments = "-version",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true,
                    };

                    using var proc = Process.Start(psi);
                    string output = proc.StandardOutput.ReadToEnd();
                    proc.WaitForExit(5000);

                    sw.Stop();

                    if (proc.ExitCode == 0 && output.Contains("ffmpeg version"))
                    {
                        string firstLine = output.Split('\n')[0].Trim();
                        return new TestResult
                        {
                            Status = TestStatus.Success,
                            Message = $"ffmpeg 可用: {firstLine}",
                            LatencyMs = sw.ElapsedMilliseconds
                        };
                    }

                    return new TestResult
                    {
                        Status = TestStatus.Failure,
                        Message = $"ffmpeg 执行异常 (ExitCode={proc.ExitCode})。请检查路径是否正确。",
                        LatencyMs = sw.ElapsedMilliseconds
                    };
                }
                catch (Win32Exception)
                {
                    sw.Stop();
                    return new TestResult
                    {
                        Status = TestStatus.Failure,
                        Message = $"找不到可执行文件: {ffmpegPath}",
                        LatencyMs = sw.ElapsedMilliseconds
                    };
                }
                catch (Exception ex)
                {
                    sw.Stop();
                    return new TestResult
                    {
                        Status = TestStatus.Failure,
                        Message = $"ffmpeg 测试失败: {ex.Message}",
                        LatencyMs = sw.ElapsedMilliseconds
                    };
                }
            });
        }

        #endregion

        #region Helpers

        private static void Report(
            SynchronizationContext ctx,
            Action<string, TestStatus> callback,
            string service,
            TestStatus status)
        {
            ctx?.Post(_ => callback?.Invoke(service, status), null);
        }

        #endregion
    }
}
