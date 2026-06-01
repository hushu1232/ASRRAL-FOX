using System;
using System.Collections.Generic;
using UnityEngine;

namespace AstralFox.Config
{
    /// <summary>
    /// Parses command line arguments on startup.
    ///
    /// Supported arguments:
    ///   --settings      Open the settings/control panel on startup
    ///   --minimized     Start minimized to tray
    ///   --help          Show help in log
    ///
    /// Usage: AstralFox.exe --settings
    ///        AstralFox.exe --settings --minimized
    /// </summary>
    public sealed class CommandLineArgs
    {
        #region Singleton

        private static CommandLineArgs _instance;
        public static CommandLineArgs Instance => _instance ?? (_instance = new CommandLineArgs());

        private CommandLineArgs()
        {
            Parse(Environment.GetCommandLineArgs());
        }

        #endregion

        #region Properties

        public bool OpenSettings { get; private set; }
        public bool StartMinimized { get; private set; }
        public bool ShowHelp { get; private set; }
        public bool NoTransparent { get; private set; }
        public bool DiagnosticMode { get; private set; }
        public IReadOnlyList<string> RawArgs => _rawArgs;

        #endregion

        #region Fields

        private string[] _rawArgs = Array.Empty<string>();

        #endregion

        #region Parsing

        private void Parse(string[] args)
        {
            _rawArgs = args;
            var flags = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (string arg in args)
            {
                string a = arg.Trim().ToLowerInvariant();
                switch (a)
                {
                    case "--settings":
                    case "-s":
                        OpenSettings = true;
                        flags.Add(a);
                        break;
                    case "--minimized":
                    case "-m":
                        StartMinimized = true;
                        flags.Add(a);
                        break;
                    case "--help":
                    case "-h":
                    case "/?":
                        ShowHelp = true;
                        flags.Add(a);
                        break;
                    case "--no-transparent":
                    case "-nt":
                        NoTransparent = true;
                        flags.Add(a);
                        break;
                    case "--diag":
                    case "-d":
                        DiagnosticMode = true;
                        flags.Add(a);
                        break;
                }
            }

            if (flags.Count > 0)
            {
                Debug.Log($"[CmdLine] Parsed flags: {string.Join(", ", flags)}");
            }

            if (ShowHelp)
            {
                Debug.Log(
                    "AstralFox 星尘 — 桌面 AI 宠物\n" +
                    "参数:\n" +
                    "  --settings, -s       启动时打开配置面板\n" +
                    "  --minimized, -m      启动时最小化到系统托盘\n" +
                    "  --no-transparent, -nt  禁用透明窗口 (调试用)\n" +
                    "  --diag, -d           诊断模式 — 输出诊断日志到桌面\n" +
                    "  --help, -h           显示此帮助");
            }
        }

        #endregion
    }
}
