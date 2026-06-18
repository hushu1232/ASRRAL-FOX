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
        private Camera _cachedCamera;
        private GUIStyle _menuBackgroundStyle;
        private GUIStyle _hoverBackgroundStyle;
        private GUIStyle _sectionLabelStyle;
        private GUIStyle _itemLabelStyle;
        private GUIStyle _itemHoverLabelStyle;
        private Texture2D _menuBackgroundTexture;
        private Texture2D _hoverBackgroundTexture;
        private readonly List<Config.PetModelRegistry.ModelEntry> _availableModels = new();

        private void Awake()
        {
            _interaction = GetComponent<FoxInteraction>();
            _cachedCamera = Camera.main;
            RefreshModelList();
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
                        RefreshModelList();
                        var menuHeight = CalculateMenuHeight();
                        _menuRect = new Rect(
                            Mathf.Clamp(mousePos.x, 4f, Mathf.Max(4f, Screen.width - _menuWidth - 4f)),
                            Mathf.Clamp(Screen.height - mousePos.y, 4f, Mathf.Max(4f, Screen.height - menuHeight - 4f)),
                            _menuWidth,
                            menuHeight);
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
            Vector3 petScreen = _cachedCamera != null
                ? _cachedCamera.WorldToScreenPoint(transform.position)
                : Vector3.zero;
            return Vector2.Distance(mousePos, petScreen) < 120f;
        }

        private void OnGUI()
        {
            if (!_showMenu) return;
            if (_menuBackgroundStyle == null) BuildStyles();

            // Semi-transparent background
            GUI.Box(_menuRect, "", _menuBackgroundStyle);

            float y = _menuRect.y + 4;
            _hoveredIndex = -1;

            if (_availableModels.Count == 0)
            {
                GUI.Label(new Rect(_menuRect.x + 8, y + 4, _menuWidth - 16, _itemHeight),
                    "No local Live2D models found", _itemLabelStyle);
                return;
            }

            string currentSource = "";
            for (int i = 0; i < _availableModels.Count; i++)
            {
                var model = _availableModels[i];

                // Section header
                if (model.source != currentSource)
                {
                    currentSource = model.source;
                    GUI.Label(new Rect(_menuRect.x + 8, y, _menuWidth - 16, 18),
                        $"-- {model.source} --", _sectionLabelStyle);
                    y += 18;
                }

                Rect itemRect = new Rect(_menuRect.x + 4, y, _menuWidth - 8, _itemHeight);
                bool hover = itemRect.Contains(Event.current.mousePosition);

                if (hover)
                {
                    GUI.Box(itemRect, "", _hoverBackgroundStyle);
                    _hoveredIndex = i;
                }

                GUI.Label(new Rect(itemRect.x + 4, itemRect.y, itemRect.width - 8, itemRect.height),
                    model.displayName, hover ? _itemHoverLabelStyle : _itemLabelStyle);

                if (hover && Event.current.type == EventType.MouseDown && Event.current.button == 0)
                {
                    SwitchModel(model.modelPath);
                    _showMenu = false;
                    Event.current.Use();
                }

                y += _itemHeight;
            }
        }

        private void OnDestroy()
        {
            if (_menuBackgroundTexture != null) Destroy(_menuBackgroundTexture);
            if (_hoverBackgroundTexture != null) Destroy(_hoverBackgroundTexture);
        }

        private void SwitchModel(string modelPath)
        {
            if (!Config.PetModelRegistry.TryGetExistingModelPath(modelPath, out var normalizedPath))
            {
                Debug.LogWarning($"[QuickModelSwitch] Ignored unavailable model path: {modelPath}");
                return;
            }

            var config = Config.ConfigManager.Instance?.CurrentConfig;
            if (config != null)
            {
                config.model_path = normalizedPath;
                Config.ConfigManager.Instance?.SaveConfig(config);
                Debug.Log($"[QuickModelSwitch] Selected model for next restart: {normalizedPath}");
            }

            var animManager = Animation.PetAnimationManager.Instance;
            if (animManager != null && animManager.Live2D != null)
            {
                animManager.Live2D.ReloadModel(normalizedPath);
            }
        }

        private void RefreshModelList()
        {
            _availableModels.Clear();
            var models = Config.PetModelRegistry.Instance.GetAvailableModels();
            foreach (var model in models)
                _availableModels.Add(model);
        }

        private float CalculateMenuHeight()
        {
            if (_availableModels.Count == 0)
                return _itemHeight + 12f;

            float height = 8f;
            string currentSource = "";
            foreach (var model in _availableModels)
            {
                if (model.source != currentSource)
                {
                    currentSource = model.source;
                    height += 18f;
                }
                height += _itemHeight;
            }
            return height;
        }

        private void BuildStyles()
        {
            _menuBackgroundTexture = MakeTexture(new Color(0.12f, 0.1f, 0.18f, 0.92f));
            _hoverBackgroundTexture = MakeTexture(new Color(0.25f, 0.2f, 0.35f, 0.9f));

            _menuBackgroundStyle = new GUIStyle(GUI.skin.box);
            _menuBackgroundStyle.normal.background = _menuBackgroundTexture;

            _hoverBackgroundStyle = new GUIStyle(GUI.skin.box);
            _hoverBackgroundStyle.normal.background = _hoverBackgroundTexture;

            _sectionLabelStyle = MakeLabelStyle(new Color(0.5f, 0.4f, 0.7f), 10);
            _itemLabelStyle = MakeLabelStyle(new Color(0.75f, 0.7f, 0.85f), 12);
            _itemHoverLabelStyle = MakeLabelStyle(Color.white, 12);
        }

        private static Texture2D MakeTexture(Color bg)
        {
            var tex = new Texture2D(1, 1);
            tex.SetPixel(0, 0, bg);
            tex.Apply();
            return tex;
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
