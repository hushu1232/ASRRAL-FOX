using System.Collections.Generic;
using UnityEngine;

namespace AstralFox
{
    /// <summary>
    /// Right-click context menu for quickly switching between built-in Live2D models.
    /// Provides instant visual model switching without opening browser settings.
    /// </summary>
    public sealed class QuickModelSwitch : MonoBehaviour
    {
        [Header("Menu Settings")]
        [SerializeField, Range(100f, 300f)]
        private float _menuWidth = 200f;

        [SerializeField, Range(18f, 32f)]
        private float _itemHeight = 24f;

        private bool _showMenu;
        private Rect _menuRect;
        private int _hoveredIndex = -1;
        private FoxInteraction _interaction;

        private static readonly List<(string name, string path, string source)> Models = new()
        {
            ("CatTail 猫尾", "/models/CatTail/cattail.model3.json", "内置"),
            ("AK-12 少女前线", "/models/GirlsFrontline/AK12/normal.model3.json", "少女前线"),
            ("M4A1 少女前线", "/models/GirlsFrontline/M4A1/normal.model3.json", "少女前线"),
            ("HK416 少女前线", "/models/GirlsFrontline/HK416/normal.model3.json", "少女前线"),
            ("AR-15 少女前线", "/models/GirlsFrontline/AR15/normal.model3.json", "少女前线"),
            ("AN-94 少女前线", "/models/GirlsFrontline/AN94/normal.model3.json", "少女前线"),
            ("Enterprise 企业", "/models/AzurLane/Enterprise/qiye_7.model3.json", "碧蓝航线"),
            ("Belfast 贝尔法斯特", "/models/AzurLane/Belfast/beierfasite_2.model3.json", "碧蓝航线"),
            ("Atago 爱宕", "/models/AzurLane/Atago/aidang_2.model3.json", "碧蓝航线"),
            ("Akagi 赤城", "/models/AzurLane/Akagi/chicheng_5.model3.json", "碧蓝航线"),
        };

        private void Awake()
        {
            _interaction = GetComponent<FoxInteraction>();
        }

        private void Update()
        {
            // Right-click on pet → show menu
            if (Input.GetMouseButtonDown(1) && _interaction != null)
            {
                Vector2 mousePos = Input.mousePosition;
                // Check if mouse is near the pet (simple proximity check)
                if (IsNearPet(mousePos))
                {
                    _showMenu = !_showMenu;
                    if (_showMenu)
                    {
                        _menuRect = new Rect(mousePos.x, Screen.height - mousePos.y, _menuWidth, Models.Count * _itemHeight + 8);
                    }
                }
                else if (_showMenu)
                {
                    _showMenu = false;
                }
            }

            // Left-click outside menu → close
            if (_showMenu && Input.GetMouseButtonDown(0))
            {
                Vector2 mp = new Vector2(Input.mousePosition.x, Screen.height - Input.mousePosition.y);
                if (!_menuRect.Contains(mp))
                    _showMenu = false;
            }
        }

        private bool IsNearPet(Vector2 mousePos)
        {
            if (_interaction == null) return false;
            Vector3 petScreen = Camera.main != null
                ? Camera.main.WorldToScreenPoint(transform.position)
                : Vector3.zero;
            return Vector2.Distance(mousePos, petScreen) < 120f;
        }

        private void OnGUI()
        {
            if (!_showMenu) return;

            // Semi-transparent background
            GUI.Box(_menuRect, "", MakeStyle(new Color(0.12f, 0.1f, 0.18f, 0.92f)));

            float y = _menuRect.y + 4;
            string currentSource = "";
            for (int i = 0; i < Models.Count; i++)
            {
                var (name, path, source) = Models[i];

                // Section header
                if (source != currentSource)
                {
                    currentSource = source;
                    GUI.Label(new Rect(_menuRect.x + 8, y, _menuWidth - 16, 18),
                        $"── {source} ──", MakeLabelStyle(new Color(0.5f, 0.4f, 0.7f), 10));
                    y += 18;
                }

                Rect itemRect = new Rect(_menuRect.x + 4, y, _menuWidth - 8, _itemHeight);
                bool hover = itemRect.Contains(Event.current.mousePosition);

                Color bgColor = hover ? new Color(0.25f, 0.2f, 0.35f, 0.9f) : Color.clear;
                if (hover)
                {
                    GUI.Box(itemRect, "", MakeStyle(bgColor));
                    _hoveredIndex = i;
                }

                GUI.Label(new Rect(itemRect.x + 4, itemRect.y, itemRect.width - 8, itemRect.height),
                    name, MakeLabelStyle(hover ? Color.white : new Color(0.75f, 0.7f, 0.85f), 12));

                if (hover && Event.current.type == EventType.MouseDown)
                {
                    SwitchModel(path);
                    _showMenu = false;
                }

                y += _itemHeight;
            }
        }

        private void SwitchModel(string modelPath)
        {
            var config = Config.ConfigManager.Instance?.CurrentConfig;
            if (config != null)
            {
                config.model_path = modelPath;
                Config.ConfigManager.Instance?.SaveConfig(config);
                Debug.Log($"[QuickModelSwitch] Switched to: {modelPath}");
            }

            // Reload the Live2D model
            var animManager = Animation.PetAnimationManager.Instance;
            if (animManager != null && animManager.Live2D != null)
            {
                animManager.Live2D.ReloadModel(modelPath);
            }
        }

        private static GUIStyle MakeStyle(Color bg)
        {
            var s = new GUIStyle(GUI.skin.box);
            var tex = new Texture2D(1, 1);
            tex.SetPixel(0, 0, bg); tex.Apply();
            s.normal.background = tex;
            return s;
        }

        private static GUIStyle MakeLabelStyle(Color color, int size)
        {
            var s = new GUIStyle(GUI.skin.label);
            s.normal.textColor = color;
            s.fontSize = size;
            return s;
        }
    }
}
