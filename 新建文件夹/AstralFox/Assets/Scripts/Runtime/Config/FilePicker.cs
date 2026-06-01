using System;
using System.Runtime.InteropServices;
using UnityEngine;

namespace AstralFox.Config
{
    /// <summary>
    /// Cross-platform file open dialog.
    /// - Editor: uses EditorUtility.OpenFilePanel
    /// - Windows Standalone: uses Win32 GetOpenFileNameW
    /// - Fallback: manual path input (no native dialog available)
    /// </summary>
    public static class FilePicker
    {
#if UNITY_EDITOR
        public static string OpenFile(string title, string extension)
        {
            string path = UnityEditor.EditorUtility.OpenFilePanel(
                title, "", extension);
            return string.IsNullOrEmpty(path) ? null : path;
        }

#elif UNITY_STANDALONE_WIN
        public static string OpenFile(string title, string extension)
        {
            var ofn = new OpenFileName();
            ofn.structSize = Marshal.SizeOf(ofn);
            ofn.filter = $"{extension} files\0*.{extension}\0All files\0*.*\0\0";
            ofn.file = new string(new char[512]);
            ofn.maxFile = ofn.file.Length;
            ofn.title = title;
            ofn.flags = 0x00080000 | 0x00001000 | 0x00000800 | 0x00000008;
            // OFN_EXPLORER | OFN_FILEMUSTEXIST | OFN_PATHMUSTEXIST | OFN_NOCHANGEDIR

            if (GetOpenFileName(ref ofn))
                return ofn.file.TrimEnd('\0');

            return null;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
        private struct OpenFileName
        {
            public int structSize;
            public IntPtr dlgOwner;
            public IntPtr instance;
            public string filter;
            public string customFilter;
            public int maxCustFilter;
            public int filterIndex;
            public string file;
            public int maxFile;
            public string fileTitle;
            public int maxFileTitle;
            public string initialDir;
            public string title;
            public int flags;
            public short fileOffset;
            public short fileExtension;
            public string defExt;
            public IntPtr custData;
            public IntPtr hook;
            public string templateName;
            public IntPtr reservedPtr;
            public int reservedInt;
            public int flagsEx;
        }

        [DllImport("comdlg32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        private static extern bool GetOpenFileName(ref OpenFileName ofn);

#else
        public static string OpenFile(string title, string extension)
        {
            Debug.LogWarning("[FilePicker] Native file dialog not available on this platform. " +
                           "Please enter the path manually.");
            return null;
        }
#endif
    }
}
