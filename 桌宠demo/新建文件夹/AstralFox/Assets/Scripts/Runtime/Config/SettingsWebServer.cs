using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using UnityEngine;

namespace AstralFox.Config
{
    /// <summary>
    /// Lightweight HTTP server using raw TcpListener (HttpListener not in Unity .NET shim).
    /// Listens on localhost:18920, serves a single-page config editor,
    /// and exposes REST API for reading/writing AppConfig.
    /// </summary>
    public sealed class SettingsWebServer
    {
        private static SettingsWebServer _instance;
        public static SettingsWebServer Instance => _instance ?? (_instance = new SettingsWebServer());

        private TcpListener _listener;
        private Thread _thread;
        private volatile bool _running;
        private volatile bool _exitRequested;
        private readonly int _port = 18920;
        private readonly object _modelsLock = new object();
        private readonly HashSet<string> _availableModelPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        private string _availableModelsJson = "[]";
        private string _streamingAssetsPath = "";

        public bool ExitRequested => _exitRequested;

        public void Start()
        {
            if (_running) return;

            RefreshAvailableModels();
            LoadHtmlPage();

            _running = true;
            _exitRequested = false;
            _thread = new Thread(ListenLoop)
            {
                IsBackground = true,
                Name = "SettingsWebServer"
            };
            _thread.Start();

            Debug.Log($"[SettingsWeb] Server starting on http://localhost:{_port}/");
        }

        public void Stop()
        {
            _running = false;
            try { _listener?.Stop(); } catch { }
            _thread?.Join(3000);
            Debug.Log("[SettingsWeb] Server stopped.");
        }

        private void ListenLoop()
        {
            try
            {
                _listener = new TcpListener(IPAddress.Loopback, _port);
                _listener.Start();

                while (_running)
                {
                    if (_listener.Server.Poll(50000, SelectMode.SelectRead))
                    {
                        var client = _listener.AcceptTcpClient();
                        ThreadPool.QueueUserWorkItem(HandleClient, client);
                    }
                }
            }
            catch (SocketException ex)
            {
                if (_running)
                    Debug.LogError($"[SettingsWeb] Socket error: {ex.Message}");
            }
            catch (Exception ex)
            {
                if (_running)
                    Debug.LogError($"[SettingsWeb] Server error: {ex.Message}");
            }
            finally
            {
                try { _listener?.Stop(); } catch { }
            }
        }

        private void HandleClient(object state)
        {
            var client = (TcpClient)state;
            try
            {
                using (client)
                using (var stream = client.GetStream())
                {
                    // Read entire HTTP request into buffer (up to 64KB)
                    var buf = new byte[65536];
                    int total = 0;
                    stream.ReadTimeout = 5000;

                    // Read until we have the full headers
                    int headerEnd = -1;
                    byte[] headerEndMarker = { 0x0D, 0x0A, 0x0D, 0x0A }; // \r\n\r\n
                    while (total < buf.Length)
                    {
                        int n = stream.Read(buf, total, buf.Length - total);
                        if (n == 0) break;
                        total += n;

                        // Search for header terminator
                        for (int i = 0; i <= total - 4; i++)
                        {
                            if (buf[i] == 0x0D && buf[i+1] == 0x0A && buf[i+2] == 0x0D && buf[i+3] == 0x0A)
                            {
                                headerEnd = i + 4;
                                break;
                            }
                        }
                        if (headerEnd > 0) break;
                    }

                    if (headerEnd < 0) return;

                    // Parse headers as text
                    string headerText = Encoding.UTF8.GetString(buf, 0, headerEnd);
                    var headerLines = headerText.Split(new[] { "\r\n" }, StringSplitOptions.None);
                    if (headerLines.Length < 1) return;

                    var parts = headerLines[0].Split(' ');
                    if (parts.Length < 2) return;
                    string method = parts[0];
                    string path = parts[1];

                    // Find Content-Length
                    int contentLength = 0;
                    for (int i = 1; i < headerLines.Length; i++)
                    {
                        if (headerLines[i].StartsWith("Content-Length:", StringComparison.OrdinalIgnoreCase))
                        {
                            var colonIdx = headerLines[i].IndexOf(':');
                            if (colonIdx >= 0)
                                int.TryParse(headerLines[i].Substring(colonIdx + 1).Trim(), out contentLength);
                        }
                    }

                    // Read remaining body bytes if needed
                    int bodyStart = headerEnd;
                    while (total < bodyStart + contentLength)
                    {
                        int n = stream.Read(buf, total, bodyStart + contentLength - total);
                        if (n == 0) break;
                        total += n;
                    }

                    string body = "";
                    if (contentLength > 0 && total >= bodyStart + contentLength)
                    {
                        body = Encoding.UTF8.GetString(buf, bodyStart, contentLength);
                    }

                    Debug.Log($"[SettingsWeb] {method} {path}");

                    // Route
                    string responseBody;
                    string contentType;
                    int statusCode;

                    try
                    {
                        switch (path)
                        {
                            case "/":
                                responseBody = HtmlPage;
                                contentType = "text/html; charset=utf-8";
                                statusCode = 200;
                                break;

                            case "/api/config":
                                if (method == "GET")
                                {
                                    var cfg = ConfigManager.Instance.CurrentConfig;
                                    var json = JsonUtility.ToJson(cfg, true);
                                    // Inject available_models before the last }
                                    json = json.TrimEnd().TrimEnd('}').TrimEnd() + ",\n  \"available_models\": " + GetAvailableModelsJson() + "\n}";
                                    responseBody = json;
                                    contentType = "application/json; charset=utf-8";
                                    statusCode = 200;
                                }
                                else if (method == "POST")
                                {
                                    var cfg = JsonUtility.FromJson<AppConfig>(body);
                                    if (cfg != null)
                                    {
                                        var requestedModelPath = cfg.model_path;
                                        if (TryGetCachedExistingModelPath(cfg.model_path, out var normalizedModelPath))
                                        {
                                            cfg.model_path = normalizedModelPath;
                                        }
                                        else
                                        {
                                            var previousPath = ConfigManager.Instance.CurrentConfig?.model_path;
                                            if (TryGetCachedExistingModelPath(previousPath, out var previousNormalizedPath))
                                                cfg.model_path = previousNormalizedPath;
                                            else
                                                cfg.model_path = new AppConfig().model_path;

                                            Debug.LogWarning($"[SettingsWeb] Ignored unavailable model path from web UI: {requestedModelPath}");
                                        }

                                        ConfigManager.Instance.SaveConfig(cfg);
                                        Data.DataStore.Instance.SetCharacterPersonality(cfg.character_personality);
                                        responseBody = "{\"ok\":true}";
                                        contentType = "application/json; charset=utf-8";
                                        statusCode = 200;
                                        Debug.Log("[SettingsWeb] Config saved via web UI.");
                                    }
                                    else
                                    {
                                        responseBody = "{\"error\":\"Invalid JSON\"}";
                                        contentType = "application/json";
                                        statusCode = 400;
                                    }
                                }
                                else
                                {
                                    responseBody = "{\"error\":\"Method not allowed\"}";
                                    contentType = "application/json";
                                    statusCode = 405;
                                }
                                break;

                            case "/api/reset":
                                if (method == "POST")
                                {
                                    ConfigManager.Instance.SaveConfig(new AppConfig());
                                    responseBody = "{\"ok\":true}";
                                    contentType = "application/json; charset=utf-8";
                                    statusCode = 200;
                                    Debug.Log("[SettingsWeb] Config reset to defaults.");
                                }
                                else
                                {
                                    responseBody = "{\"error\":\"Method not allowed\"}";
                                    contentType = "application/json";
                                    statusCode = 405;
                                }
                                break;

                            case "/api/exit":
                                if (method == "POST")
                                {
                                    _exitRequested = true;
                                    responseBody = "{\"ok\":true}";
                                    contentType = "application/json; charset=utf-8";
                                    statusCode = 200;
                                    Debug.Log("[SettingsWeb] Exit requested.");
                                }
                                else
                                {
                                    responseBody = "{\"error\":\"Method not allowed\"}";
                                    contentType = "application/json";
                                    statusCode = 405;
                                }
                                break;

                            default:
                                responseBody = "{\"error\":\"Not found\"}";
                                contentType = "application/json";
                                statusCode = 404;
                                break;
                        }
                    }
                    catch (Exception ex)
                    {
                        responseBody = $"{{\"error\":\"{EscapeJson(ex.Message)}\"}}";
                        contentType = "application/json";
                        statusCode = 500;
                    }

                    // Write HTTP response
                    var statusText = statusCode == 200 ? "OK" :
                                     statusCode == 400 ? "Bad Request" :
                                     statusCode == 404 ? "Not Found" :
                                     statusCode == 405 ? "Method Not Allowed" : "Internal Server Error";
                    var responseBytes = Encoding.UTF8.GetBytes(responseBody);
                    var header = Encoding.UTF8.GetBytes(
                        $"HTTP/1.1 {statusCode} {statusText}\r\n" +
                        $"Content-Type: {contentType}\r\n" +
                        $"Content-Length: {responseBytes.Length}\r\n" +
                        "Connection: close\r\n" +
                        "Access-Control-Allow-Origin: *\r\n" +
                        "\r\n");

                    stream.Write(header, 0, header.Length);
                    stream.Write(responseBytes, 0, responseBytes.Length);
                    stream.Flush();
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"[SettingsWeb] Client error: {ex.Message}");
            }
        }

        #region HTML Page

        private static string _htmlPageCache;

        private static string HtmlPage
        {
            get { return _htmlPageCache ?? FallbackHtmlPage; }
        }

        private static void LoadHtmlPage()
        {
            try
            {
                string path = Path.Combine(Application.streamingAssetsPath, "settings.html");
                if (File.Exists(path))
                {
                    _htmlPageCache = File.ReadAllText(path, Encoding.UTF8);
                    Debug.Log($"[SettingsWeb] Loaded settings HTML from {path}");
                    return;
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[SettingsWeb] Failed to load HTML from StreamingAssets: {ex.Message}");
            }
            _htmlPageCache = FallbackHtmlPage;
        }

        private const string FallbackHtmlPage = @"<!DOCTYPE html>
<html lang=""zh-CN"">
<head>
<meta charset=""UTF-8"">
<meta name=""viewport"" content=""width=device-width,initial-scale=1"">
<title>星尘 · 系统设置</title>
<style>
/* ── Design Tokens (OLED Dark + Cinematic + Glassmorphism) ── */
:root{
  --bg-deep:#09090F;
  --bg-card:#12122A;
  --border-subtle:rgba(124,111,240,0.10);
  --accent:#5c8de3;
  --accent-soft:#7C6FF0;
  --accent-glow:rgba(92,141,227,0.18);
  --text:#E8E8F0;
  --text-muted:#8A8DA8;
  --text-dim:#5E6080;
  --danger:#EF4444;
  --danger-glow:rgba(239,68,68,0.15);
  --success:#22C55E;
  --input-bg:#0D0D1F;
  --radius:10px;
  --radius-sm:6px;
  --font-stack:'Segoe UI','Noto Sans SC','Microsoft YaHei',system-ui,sans-serif;
}

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

body{
  font-family:var(--font-stack);
  background:
    radial-gradient(ellipse 80% 60% at 50% -10%,rgba(92,141,227,0.06) 0%,transparent 60%),
    radial-gradient(ellipse 60% 50% at 85% 80%,rgba(124,111,240,0.04) 0%,transparent 50%),
    var(--bg-deep);
  color:var(--text);
  display:flex;justify-content:center;align-items:flex-start;
  min-height:100vh;padding:24px 16px 40px;
  -webkit-font-smoothing:antialiased;
}

.container{max-width:680px;width:100%}

/* ── Header ── */
.header{
  display:flex;align-items:center;gap:12px;
  padding:6px 0 8px;margin-bottom:20px;
}
.header-icon{
  width:36px;height:36px;border-radius:10px;
  background:linear-gradient(135deg,var(--accent),var(--accent-soft));
  display:flex;align-items:center;justify-content:center;
  font-size:18px;box-shadow:0 4px 14px var(--accent-glow);
}
h1{font-size:20px;font-weight:700;color:var(--text);letter-spacing:-0.3px}

/* ── Section Cards ── */
.section{
  background:var(--bg-card);
  border:1px solid var(--border-subtle);
  border-radius:var(--radius);
  padding:20px 22px 16px;margin-bottom:14px;
  position:relative;overflow:hidden;
  transition:border-color .3s;
}
.section:hover{border-color:rgba(92,141,227,0.18)}
.section::before{
  content:'';
  position:absolute;top:0;left:0;right:0;height:1px;
  background:linear-gradient(90deg,transparent,rgba(92,141,227,0.3),transparent);
  opacity:0;transition:opacity .3s;
}
.section:hover::before{opacity:1}

/* ── Section Header ── */
.sec-header{display:flex;align-items:baseline;gap:10px;margin-bottom:4px}
h2{font-size:14px;font-weight:700;color:var(--text);letter-spacing:-0.2px}
.sec-dot{
  width:6px;height:6px;border-radius:50%;flex-shrink:0;
  background:var(--accent);box-shadow:0 0 8px var(--accent-glow);
}
.subtitle{font-size:11px;color:var(--text-muted);margin-bottom:14px;margin-left:16px}

/* ── Form Row ── */
.row{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.row label{
  min-width:85px;font-size:12px;font-weight:500;
  color:var(--text-muted);text-align:right;cursor:pointer;
  user-select:none;letter-spacing:0.1px;
}
.row input,.row textarea{
  flex:1;background:var(--input-bg);
  border:1px solid rgba(255,255,255,0.07);border-radius:var(--radius-sm);
  color:var(--text);padding:9px 12px;font-size:13px;font-family:inherit;
  outline:none;transition:border-color .2s,box-shadow .2s;
}
.row input:focus,.row textarea:focus{
  border-color:var(--accent);
  box-shadow:0 0 0 3px var(--accent-glow);
}
.row textarea{min-height:68px;resize:vertical;line-height:1.5}
.row .short{flex:0 0 110px}

/* ── Eye Toggle ── */
.eye-btn{
  background:var(--input-bg);border:1px solid rgba(255,255,255,0.07);
  border-radius:var(--radius-sm);color:var(--text-muted);
  cursor:pointer;padding:8px 14px;font-size:12px;font-weight:500;
  white-space:nowrap;user-select:none;font-family:inherit;
  transition:all .2s;
}
.eye-btn:hover{background:#1A1A38;color:var(--text);border-color:rgba(255,255,255,0.12)}

/* ── Radio Pill Toggles ── */
.radio-group{display:flex;gap:0}
.radio-pill{
  position:relative;cursor:pointer;
  padding:8px 18px;font-size:12px;font-weight:500;
  color:var(--text-muted);background:var(--input-bg);
  border:1px solid rgba(255,255,255,0.07);
  user-select:none;transition:all .2s;
}
.radio-pill:first-child{border-radius:var(--radius-sm) 0 0 var(--radius-sm)}
.radio-pill:last-child{border-radius:0 var(--radius-sm) var(--radius-sm) 0}
.radio-pill.is-checked{
  background:#1A1A40;color:var(--text);
  border-color:var(--accent);z-index:1;
  box-shadow:0 0 12px var(--accent-glow);
}
.radio-pill:hover:not(.is-checked){color:var(--text);background:#161632}
.radio-pill input{position:absolute;opacity:0;pointer-events:none}

/* ── Actions Bar ── */
.actions{
  display:flex;gap:10px;align-items:center;
  padding:18px 0 8px;position:sticky;bottom:0;
  background:linear-gradient(180deg,transparent 0%,var(--bg-deep) 40%);
}
.actions .spacer{flex:1}
.btn{
  padding:10px 22px;border-radius:var(--radius-sm);border:1px solid transparent;
  cursor:pointer;font-size:13px;font-weight:600;font-family:inherit;
  letter-spacing:0.2px;transition:all .2s;
}
.btn:active{transform:scale(0.97)}
.btn-save{
  background:var(--accent);color:#fff;
  box-shadow:0 4px 16px var(--accent-glow);
}
.btn-save:hover{box-shadow:0 6px 24px rgba(92,141,227,0.3);transform:translateY(-1px)}
.btn-reset{
  background:transparent;color:var(--text-muted);border-color:rgba(255,255,255,0.07);
}
.btn-reset:hover{color:var(--danger);border-color:var(--danger-glow);background:rgba(239,68,68,0.05)}
.btn-exit{
  background:transparent;color:var(--text-dim);border-color:rgba(255,255,255,0.05);
}
.btn-exit:hover{color:var(--text-muted);border-color:rgba(255,255,255,0.1)}

/* ── Toast ── */
.toast{
  position:fixed;top:20px;right:20px;padding:10px 20px;border-radius:var(--radius-sm);
  font-size:12px;font-weight:600;font-family:var(--font-stack);z-index:999;
  opacity:0;transform:translateY(-8px);
  transition:opacity .25s,transform .25s;
  pointer-events:none;letter-spacing:0.2px;
}
.toast.is-show{opacity:1;transform:translateY(0)}
.toast.ok{background:#166534;color:#BBF7D0;border:1px solid rgba(34,197,94,0.3)}
.toast.err{background:#7F1D1D;color:#FECACA;border:1px solid rgba(239,68,68,0.3)}

/* ── Model Hint ── */
.model-hint{
  font-size:11px;color:var(--text-dim);margin-top:6px;margin-left:97px;
  display:flex;align-items:center;gap:6px;line-height:1.5;
}
.model-hint::before{content:'';width:3px;height:3px;border-radius:50%;background:var(--text-dim);flex-shrink:0}

/* ── Model Selector ── */
.model-select{
  flex:1;background:var(--input-bg);
  border:1px solid rgba(255,255,255,0.07);border-radius:var(--radius-sm);
  color:var(--text);padding:9px 12px;font-size:13px;font-family:inherit;
  outline:none;cursor:pointer;transition:border-color .2s,box-shadow .2s;
  appearance:none;-webkit-appearance:none;
  background-image:url(""data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238A8DA8' d='M6 8L1 3h10z'/%3E%3C/svg%3E"");
  background-repeat:no-repeat;background-position:right 12px center;
  padding-right:32px;
}
.model-select:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow)}
.model-select option{background:var(--bg-card);color:var(--text);padding:8px}
.model-select optgroup{font-style:normal;font-weight:700;color:var(--accent);font-size:12px}

.model-info{
  flex:1;padding:8px 12px;border-radius:var(--radius-sm);
  background:var(--input-bg);border:1px solid rgba(255,255,255,0.04);
  font-size:11px;color:var(--text-muted);line-height:1.6;
}
.model-info strong{color:var(--text)}
.model-info .mi-tag{
  display:inline-block;padding:1px 6px;border-radius:3px;
  font-size:9px;font-weight:600;margin-left:4px;
}
.mi-tag.live2d{background:rgba(92,141,227,0.2);color:var(--accent)}
.mi-tag.local{background:rgba(34,197,94,0.15);color:var(--success)}
.mi-tag.cdn{background:rgba(255,165,0,0.15);color:#f0a040}
</style>
</head>
<body>
<div class=""container"">
<div class=""header"">
<div class=""header-icon"">&#x2605;</div>
<h1>星尘 · 系统设置</h1>
</div>

<div class=""section"">
<div class=""sec-header""><div class=""sec-dot""></div><h2>Azure 语音服务</h2></div>
<p class=""subtitle"">语音识别 (ASR)  ·  免费层每月 5 小时</p>
<div class=""row""><label for=""azure_key"">Speech Key</label><input id=""azure_key"" type=""password"" placeholder=""输入 Azure Speech Key...""><button class=""eye-btn"" onclick=""toggleEye('azure_key',this)"">显示</button></div>
<div class=""row""><label for=""azure_region"">区域</label><input id=""azure_region"" placeholder=""eastasia""></div>
</div>

<div class=""section"">
<div class=""sec-header""><div class=""sec-dot""></div><h2>OpenAI 对话服务</h2></div>
<p class=""subtitle"">大语言模型 (LLM)  ·  支持官方 API 与第三方中转</p>
<div class=""row""><label for=""openai_key"">API Key</label><input id=""openai_key"" type=""password"" placeholder=""输入 OpenAI API Key...""><button class=""eye-btn"" onclick=""toggleEye('openai_key',this)"">显示</button></div>
<div class=""row""><label for=""openai_url"">Base URL</label><input id=""openai_url"" placeholder=""https://api.openai.com/v1""></div>
</div>

<div class=""section"">
<div class=""sec-header""><div class=""sec-dot""></div><h2>角色设定</h2></div>
<p class=""subtitle"">自定义星尘的性格、名字和背景故事</p>
<div class=""row""><label for=""char_name"">名字</label><input id=""char_name"" placeholder=""星尘""></div>
<div class=""row""><label for=""char_personality"">性格</label><textarea id=""char_personality"" placeholder=""活泼可爱，好奇心强...""></textarea></div>
<div class=""row""><label for=""char_backstory"">背景故事</label><textarea id=""char_backstory"" placeholder=""""></textarea></div>
<div class=""row""><label for=""char_extra"">其他补充</label><textarea id=""char_extra"" placeholder=""(可选)""></textarea></div>
</div>

<div class=""section"">
<div class=""sec-header""><div class=""sec-dot""></div><h2>模型选择</h2></div>
<p class=""subtitle"">选择桌宠使用的 Live2D 模型（需自行准备模型文件 · 重启生效）</p>
<div class=""row""><label>当前模型</label>
<select id=""model_select"" class=""model-select"" onchange=""onModelSelect()"">
<option value="""">加载中...</option>
</select>
</div>
<div class=""row"" id=""model_info_row"" style=""display:none"">
<label></label>
<div class=""model-info"" id=""model_info""></div>
</div>
<p class=""model-hint"" id=""model_hint"">模型文件请放入 StreamingAssets/Models/ 对应目录。来源标注为""CDN""的模型需从 live2d-widget 的 CDN 仓库自行下载。</p>
</div>

<div class=""section"">
<div class=""sec-header""><div class=""sec-dot""></div><h2>ffmpeg 工具</h2></div>
<p class=""subtitle"">音频格式转换 (可选)  ·  不影响核心功能</p>
<div class=""row""><label for=""ffmpeg_path"">ffmpeg 路径</label><input id=""ffmpeg_path"" placeholder=""C:\ffmpeg\bin\ffmpeg.exe"" readonly></div>
</div>

<div class=""actions"">
<button class=""btn btn-exit"" onclick=""doExit()"">退出</button>
<span class=""spacer""></span>
<button class=""btn btn-reset"" onclick=""doReset()"">重置</button>
<button class=""btn btn-save"" onclick=""doSave()"">保存配置</button>
</div>
</div>

<div id=""toast"" class=""toast""></div>

<script>
/* ── Model Registry ── */
let availableModels=[];

function buildModelSelect(models, currentPath){
  const sel=document.getElementById('model_select');
  sel.innerHTML='';

  const groups={};
  models.forEach(m=>{
    const cat=m.source||'其他模型';
    if(!groups[cat])groups[cat]=[];
    groups[cat].push(m);
  });

  const order=['AI管线','内置','少女前线','碧蓝航线','用户自定义','其他模型'];
  order.forEach(cat=>{
    if(!groups[cat])return;
    const og=document.createElement('optgroup');
    og.label=cat;
    groups[cat].forEach(m=>{
      const opt=document.createElement('option');
      opt.value=m.path;
      opt.textContent=m.name;
      opt.dataset.id=m.id;
      opt.dataset.type=m.type;
      opt.dataset.description=m.description;
      opt.dataset.source=m.source;
        opt.dataset.complexity=m.complexity||'';
        opt.dataset.drawables=m.drawables||'';
      if(m.path===currentPath)opt.selected=true;
      og.appendChild(opt);
    });
    sel.appendChild(og);
  });
}

function onModelSelect(){
  const sel=document.getElementById('model_select');
  const opt=sel.selectedOptions[0];
  if(!opt||!opt.dataset.id)return;
  const row=document.getElementById('model_info_row');
  const info=document.getElementById('model_info');
  const hint=document.getElementById('model_hint');

  const type=opt.dataset.type||'live2d';
  const source=opt.dataset.source||'';
  const isLocalModel=source==='内置'||source==='AI管线';
  const desc=opt.dataset.description||'';
  const tagType=type==='live2d'?'<span class=""mi-tag live2d"">Live2D</span>':'';
  const tagSrc=isLocalModel
    ?'<span class=""mi-tag local"">内置</span>'
    :source==='CDN / 自行下载'
      ?'<span class=""mi-tag cdn"">需下载</span>'
      :'<span class=""mi-tag local"">自定义</span>';
  const comp=opt.dataset.complexity||'';
  const compLabel=comp==='light'?'<span class=""mi-tag"" style=""background:rgba(34,197,94,0.15);color:#22C55E"">轻量</span>'
    :comp==='high'?'<span class=""mi-tag"" style=""background:rgba(239,68,68,0.15);color:#EF4444"">高配</span>'
    :comp==='standard'?'<span class=""mi-tag"" style=""background:rgba(92,141,227,0.15);color:#5c8de3"">标准</span>'
    :'';
  const drawCnt=opt.dataset.drawables||'';

  info.innerHTML='<strong>'+opt.textContent+'</strong> '+tagType+tagSrc+compLabel
    +'<br>路径: <code style=""color:var(--text-dim)"">'+opt.value+'</code>'
    +(drawCnt?'  Drawables: <span style=""color:var(--text-dim)"">'+drawCnt+'</span>':'')
    +(desc?'<br>'+desc:'');
  row.style.display='flex';

  hint.textContent=isLocalModel
    ?(comp==='high'
      ?'此模型复杂度较高，建议在性能较好的设备上使用。'
      :'此模型已内置，无需额外下载。')
    :'模型文件请放入 StreamingAssets/'+opt.value+'。下载后可能需要转换为 Cubism 3+ 格式。';
}

/* ── Config ── */
async function loadConfig(){
  try{
    const r=await fetch('/api/config');
    if(!r.ok)throw new Error(r.status);
    const c=await r.json();

    if(c.available_models&&c.available_models.length){
      availableModels=c.available_models;
      buildModelSelect(c.available_models, c.model_path||'');
      onModelSelect();
    }

    setVal('azure_key',c.azure_speech_key);
    setVal('azure_region',c.azure_speech_region);
    setVal('openai_key',c.openai_api_key);
    setVal('openai_url',c.openai_base_url);
    setVal('char_name',c.character_name);
    setVal('char_personality',c.character_personality);
    setVal('char_backstory',c.character_backstory);
    setVal('char_extra',c.character_extra);
    setVal('ffmpeg_path',c.ffmpeg_path);
  }catch(e){
    toast('加载配置失败: '+e.message,'err');
  }
}

function setVal(id,v){const e=document.getElementById(id);if(e)e.value=v||''}
function collect(){
  return{
    azure_speech_key:document.getElementById('azure_key').value,
    azure_speech_region:document.getElementById('azure_region').value||'eastasia',
    openai_api_key:document.getElementById('openai_key').value,
    openai_base_url:document.getElementById('openai_url').value||'https://api.openai.com/v1',
    character_name:document.getElementById('char_name').value||'星尘',
    character_personality:document.getElementById('char_personality').value,
    character_backstory:document.getElementById('char_backstory').value,
    character_extra:document.getElementById('char_extra').value,
    ffmpeg_path:document.getElementById('ffmpeg_path').value,
    animation_model:'live2d',
    model_path:document.getElementById('model_select').value||(availableModels[0]?.path||'Models/generated/model.model3.json'),
    config_version:1
  };
}

async function doSave(){
  try{
    const r=await fetch('/api/config',{method:'POST',body:JSON.stringify(collect())});
    if(!r.ok)throw new Error(r.status);
    toast('配置已保存','ok');
  }catch(e){toast('保存失败: '+e.message,'err')}
}

async function doReset(){
  if(!confirm('确定要恢复所有默认设置吗？'))return;
  try{
    const r=await fetch('/api/reset',{method:'POST'});
    if(!r.ok)throw new Error(r.status);
    await loadConfig();
    toast('已恢复默认设置','ok');
  }catch(e){toast('重置失败: '+e.message,'err')}
}

async function doExit(){
  try{await fetch('/api/exit',{method:'POST'})}catch(e){}
  window.close();
}

function toggleEye(id,btn){
  const el=document.getElementById(id);
  if(el.type==='password'){el.type='text';btn.textContent='隐藏'}
  else{el.type='password';btn.textContent='显示'}
}

function toast(msg,type){
  const t=document.getElementById('toast');
  t.textContent=msg;t.className='toast '+type+' is-show';
  setTimeout(function(){t.classList.remove('is-show')},2500);
}

loadConfig();
</script>
</body>
</html>";

        #endregion

        #region Available Models

        private void RefreshAvailableModels()
        {
            _streamingAssetsPath = Application.streamingAssetsPath;
            var models = PetModelRegistry.Instance.GetAvailableModels();
            var json = BuildAvailableModelsJson(models);

            lock (_modelsLock)
            {
                _availableModelPaths.Clear();
                foreach (var model in models)
                    _availableModelPaths.Add(model.modelPath);

                _availableModelsJson = json;
            }
        }

        private string GetAvailableModelsJson()
        {
            lock (_modelsLock)
                return _availableModelsJson;
        }

        private bool TryGetCachedExistingModelPath(string modelPath, out string normalizedPath)
        {
            normalizedPath = PetModelRegistry.NormalizeModelPath(modelPath);
            if (string.IsNullOrEmpty(normalizedPath))
                return false;

            lock (_modelsLock)
            {
                if (_availableModelPaths.Contains(normalizedPath))
                    return true;
            }

            if (string.IsNullOrEmpty(_streamingAssetsPath))
                return false;

            var fullPath = Path.Combine(
                _streamingAssetsPath,
                normalizedPath.Replace('/', Path.DirectorySeparatorChar));

            return File.Exists(fullPath);
        }

        private static string BuildAvailableModelsJson(IReadOnlyList<PetModelRegistry.ModelEntry> models)
        {
            var sb = new StringBuilder();
            sb.Append('[');

            for (int i = 0; i < models.Count; i++)
            {
                var model = models[i];
                if (i > 0)
                    sb.Append(',');

                sb.Append("\n    { ");
                AppendJsonProperty(sb, "id", model.id);
                sb.Append(", ");
                AppendJsonProperty(sb, "name", model.displayName);
                sb.Append(", ");
                AppendJsonProperty(sb, "type", "live2d");
                sb.Append(", ");
                AppendJsonProperty(sb, "path", model.modelPath);
                sb.Append(", ");
                AppendJsonProperty(sb, "description", model.description ?? "");
                sb.Append(", ");
                AppendJsonProperty(sb, "source", model.source);
                sb.Append(", ");
                AppendJsonProperty(sb, "complexity", model.complexity.ToString().ToLowerInvariant());
                sb.Append(", \"drawables\": ");
                sb.Append(model.drawables);
                sb.Append(" }");
            }

            if (models.Count > 0)
                sb.Append('\n');

            sb.Append("  ]");
            return sb.ToString();
        }

        private static void AppendJsonProperty(StringBuilder sb, string name, string value)
        {
            sb.Append('"');
            sb.Append(EscapeJson(name));
            sb.Append("\": \"");
            sb.Append(EscapeJson(value ?? ""));
            sb.Append('"');
        }

        private static string EscapeJson(string value)
        {
            if (string.IsNullOrEmpty(value))
                return string.Empty;

            var sb = new StringBuilder(value.Length + 8);
            foreach (var c in value)
            {
                switch (c)
                {
                    case '\\':
                        sb.Append("\\\\");
                        break;
                    case '"':
                        sb.Append("\\\"");
                        break;
                    case '\n':
                        sb.Append("\\n");
                        break;
                    case '\r':
                        sb.Append("\\r");
                        break;
                    case '\t':
                        sb.Append("\\t");
                        break;
                    default:
                        sb.Append(c);
                        break;
                }
            }
            return sb.ToString();
        }

        #endregion
    }
}
