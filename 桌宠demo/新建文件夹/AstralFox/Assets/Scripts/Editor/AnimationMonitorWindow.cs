using UnityEditor;
using UnityEngine;
using AstralFox.Animation;
using AnimationCtrl = AstralFox.Animation.FoxAnimationController;
using EmotionCtrl = AstralFox.Animation.FoxEmotionController;

namespace AstralFox.Editor
{
    /// <summary>
    /// Real-time animation parameter monitor for interview demos.
    /// Shows Live2D parameter values, state machine transitions, and emotion blending
    /// in a dockable Editor window.
    ///
    /// Menu: AstralFox → Animation Monitor
    /// </summary>
    public sealed class AnimationMonitorWindow : EditorWindow
    {
        private Vector2 _scrollPos;
        private bool _isPaused;
        private float _lastRepaintTime;

        // Tracked components
        private AnimationCtrl _animCtrl;
        private EmotionCtrl _emotionCtrl;
        private CubismParameterDriver _driver;

        // State colors
        private static readonly Color IdleColor     = new(0.4f, 0.8f, 0.4f);
        private static readonly Color ListenColor   = new(0.3f, 0.6f, 1.0f);
        private static readonly Color SpeakColor    = new(1.0f, 0.6f, 0.2f);
        private static readonly Color SleepColor    = new(0.5f, 0.4f, 0.8f);
        private static readonly Color DragColor     = new(0.9f, 0.4f, 0.4f);
        private static readonly Color GreetColor    = new(1.0f, 0.8f, 0.2f);
        private static readonly Color DefaultColor  = Color.gray;

        // Parameter display names (readable Chinese)
        private static readonly (string id, string label)[] _trackedParams =
        {
            ("ParamBodyAngleX", "身体前后倾"),
            ("ParamBodyAngleY", "身体左右倾"),
            ("ParamBodyAngleZ", "身体旋转"),
            ("ParamAngleX",     "头部点头"),
            ("ParamAngleY",     "头部转"),
            ("ParamAngleZ",     "头部歪"),
            ("ParamEyeLOpen",   "左眼开度"),
            ("ParamEyeROpen",   "右眼开度"),
            ("ParamEyeBallX",   "眼球X"),
            ("ParamEyeBallY",   "眼球Y"),
            ("ParamBrowLY",     "左眉Y"),
            ("ParamBrowRY",     "右眉Y"),
            ("ParamMouthOpenY", "嘴张开"),
            ("ParamBreath",     "呼吸"),
            ("ParamEarL",       "左耳"),
            ("ParamEarR",       "右耳"),
            ("ParamTail",       "尾巴"),
        };

        [MenuItem("AstralFox/Animation Monitor")]
        public static void ShowWindow()
        {
            var window = GetWindow<AnimationMonitorWindow>("动画监视器");
            window.minSize = new Vector2(320, 480);
            window.Show();
        }

        private void OnEnable()
        {
            EditorApplication.update += RepaintOnUpdate;
        }

        private void OnDisable()
        {
            EditorApplication.update -= RepaintOnUpdate;
        }

        private void RepaintOnUpdate()
        {
            if (_isPaused) return;
            if (Time.realtimeSinceStartup - _lastRepaintTime > 0.1f) // 10Hz refresh
            {
                _lastRepaintTime = Time.realtimeSinceStartup;
                Repaint();
            }
        }

        private void OnGUI()
        {
            if (!Application.isPlaying)
            {
                EditorGUILayout.HelpBox("进入 Play Mode 后查看实时动画参数。", MessageType.Info);
                return;
            }

            FindComponents();
            DrawToolbar();
            DrawStateMachine();
            DrawEmotion();
            DrawParameters();
        }

        private void FindComponents()
        {
            if (_animCtrl == null)
                _animCtrl = FindObjectOfType<AnimationCtrl>();
            if (_emotionCtrl == null)
                _emotionCtrl = FindObjectOfType<EmotionCtrl>();
            if (_driver == null)
                _driver = FindObjectOfType<CubismParameterDriver>();
        }

        private void DrawToolbar()
        {
            EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);
            GUILayout.Label("⏵ 运行中", EditorStyles.miniLabel);
            GUILayout.FlexibleSpace();
            _isPaused = GUILayout.Toggle(_isPaused, _isPaused ? "▶ 继续" : "⏸ 暂停", EditorStyles.toolbarButton);
            if (GUILayout.Button("🔄 刷新", EditorStyles.toolbarButton))
            {
                _animCtrl = null; _emotionCtrl = null; _driver = null;
            }
            EditorGUILayout.EndHorizontal();
        }

        // ── State Machine ──────────────────────────────────────────

        private void DrawStateMachine()
        {
            if (_animCtrl == null) return;

            GUILayout.Space(8);
            GUILayout.Label("状态机 (FoxAnimationController)", EditorStyles.boldLabel);

            var state = _animCtrl.CurrentState;
            Color color = state switch
            {
                AnimationCtrl.FoxState.Idle      => IdleColor,
                AnimationCtrl.FoxState.Listening => ListenColor,
                AnimationCtrl.FoxState.Speaking  => SpeakColor,
                AnimationCtrl.FoxState.Sleep     => SleepColor,
                AnimationCtrl.FoxState.Dragging  => DragColor,
                AnimationCtrl.FoxState.Greeting  => GreetColor,
                _ => DefaultColor,
            };

            // Big state badge
            var rect = EditorGUILayout.GetControlRect(false, 40);
            EditorGUI.DrawRect(rect, color * 0.3f);
            var style = new GUIStyle(EditorStyles.boldLabel)
            {
                alignment = TextAnchor.MiddleCenter,
                fontSize = 18,
                normal = { textColor = color }
            };
            EditorGUI.LabelField(rect, $"⚡ {state}", style);

            // State bar
            EditorGUILayout.Space(4);
            EditorGUILayout.BeginHorizontal();
            DrawStateButton("Idle",      AnimationCtrl.FoxState.Idle,      IdleColor);
            DrawStateButton("Listen",    AnimationCtrl.FoxState.Listening, ListenColor);
            DrawStateButton("Speak",     AnimationCtrl.FoxState.Speaking,  SpeakColor);
            DrawStateButton("Sleep",     AnimationCtrl.FoxState.Sleep,     SleepColor);
            DrawStateButton("Drag",      AnimationCtrl.FoxState.Dragging,  DragColor);
            DrawStateButton("Greet",     AnimationCtrl.FoxState.Greeting,  GreetColor);
            EditorGUILayout.EndHorizontal();
        }

        private void DrawStateButton(string label, AnimationCtrl.FoxState state, Color color)
        {
            bool isCurrent = _animCtrl.CurrentState == state;
            var oldColor = GUI.backgroundColor;
            GUI.backgroundColor = isCurrent ? color : Color.gray * 0.5f;
            if (GUILayout.Button(label, GUILayout.Height(24)))
                _animCtrl.SetState(state);
            GUI.backgroundColor = oldColor;
        }

        // ── Emotion ────────────────────────────────────────────────

        private void DrawEmotion()
        {
            if (_emotionCtrl == null) return;

            GUILayout.Space(8);
            GUILayout.Label("表情 (FoxEmotionController)", EditorStyles.boldLabel);

            var emotion = _emotionCtrl.CurrentEmotion;
            EditorGUILayout.BeginHorizontal();
            DrawEmotionButton("中性",  EmotionCtrl.FoxEmotion.Neutral, emotion);
            DrawEmotionButton("开心",  EmotionCtrl.FoxEmotion.Happy,   emotion);
            DrawEmotionButton("悲伤",  EmotionCtrl.FoxEmotion.Sad,     emotion);
            DrawEmotionButton("害羞",  EmotionCtrl.FoxEmotion.Shy,     emotion);
            DrawEmotionButton("生气",  EmotionCtrl.FoxEmotion.Angry,   emotion);
            EditorGUILayout.EndHorizontal();
        }

        private void DrawEmotionButton(string label, EmotionCtrl.FoxEmotion emotion,
            EmotionCtrl.FoxEmotion current)
        {
            bool isCurrent = emotion == current;
            var oldColor = GUI.backgroundColor;
            GUI.backgroundColor = isCurrent ? new Color(1f, 0.6f, 0.8f) : Color.gray * 0.5f;
            if (GUILayout.Button(label, GUILayout.Height(24)))
                _emotionCtrl.SetEmotion(emotion);
            GUI.backgroundColor = oldColor;
        }

        // ── Parameters ─────────────────────────────────────────────

        private void DrawParameters()
        {
            if (_driver == null || !_driver.IsReady)
            {
                EditorGUILayout.HelpBox("CubismParameterDriver 未就绪。请确认 Live2D 模型已加载。", MessageType.Warning);
                return;
            }

            GUILayout.Space(8);
            GUILayout.Label($"Cubism 参数 ({_driver.ParameterCount} total)", EditorStyles.boldLabel);

            _scrollPos = EditorGUILayout.BeginScrollView(_scrollPos);

            foreach (var (id, label) in _trackedParams)
            {
                if (!_driver.HasParameter(id)) continue;

                float value = _driver.GetParameter(id);
                float min = _driver.GetParameterMin(id);
                float max = _driver.GetParameterMax(id);

                EditorGUILayout.BeginHorizontal();
                EditorGUILayout.LabelField(label, GUILayout.Width(80));

                // Slider
                float newVal = EditorGUILayout.Slider(value, min, max, GUILayout.ExpandWidth(true));
                if (!Mathf.Approximately(newVal, value))
                    _driver.SetParameterImmediate(id, newVal);

                // Numeric value
                EditorGUILayout.LabelField(value.ToString("F2"), GUILayout.Width(45));
                EditorGUILayout.EndHorizontal();
            }

            EditorGUILayout.EndScrollView();
        }
    }
}
