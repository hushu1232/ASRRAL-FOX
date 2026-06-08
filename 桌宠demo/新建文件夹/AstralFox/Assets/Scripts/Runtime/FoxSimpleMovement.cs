using AstralFox.Platform;
using UnityEngine;

namespace AstralFox
{
    /// <summary>
    /// 桌面宠物窗口管理。
    ///
    /// 保留功能：
    /// - 鼠标拖拽暂停（拖拽时动画暂停，松开后恢复）
    /// - 窗口位置持久化（每 10 秒保存）
    /// - 启动时恢复上次窗口位置
    ///
    /// 已移除功能：
    /// - 桌面自动漫游（随机行走/小跑）
    /// - 点击目的地移动
    /// - 用户空闲主动靠近光标
    /// - Mouse hook 线程
    ///
    /// 桌面漫游已移除 —— 角色保持在启动位置，仅支持鼠标拖拽移动窗口。
    /// 背景采用逐像素透明（TransparentWindow + UpdateLayeredWindow），保持桌面融合效果。
    /// </summary>
    [RequireComponent(typeof(TransparentWindow))]
    [RequireComponent(typeof(Animation.PADEmotionEngine))]
    public sealed class FoxSimpleMovement : MonoBehaviour
    {
        #region Inspector

        [Header("拖拽恢复")]
        [SerializeField, Range(0.5f, 5f), Tooltip("拖拽结束后恢复动画的冷却时间(秒)")]
        private float _dragRecoveryDelay = 1.5f;

        [Header("转身")]
        [SerializeField]
        private bool _flipModelOnTurn = true;

        [SerializeField, Range(0.05f, 0.5f)]
        private float _turnSpeed = 0.15f;

        #endregion

        #region 状态定义

        public enum MoveState
        {
            Idle,    // 正常待机
            Paused   // 拖拽中 / 语音 / 睡眠 暂停
        }

        #endregion

        #region 私有字段

        private TransparentWindow _tw;
        private Animation.PADEmotionEngine _padEngine;

        private MoveState _state = MoveState.Idle;
        private Vector2Int _windowSize;
        private int _facingDir = 1;
        private float _currentFacing = 1f;
        private float _resumeTimer;
        private bool _wasDragging;

        // 状态持久化
        private float _saveTimer;

        #endregion

        #region Unity 生命周期

        private void Awake()
        {
            _tw = GetComponent<TransparentWindow>();
            _padEngine = GetComponent<Animation.PADEmotionEngine>();
        }

        private bool _initialized;

        private void Start()
        {
            _windowSize = _tw.GetClientSize();

            if (_windowSize.x > 0 && _windowSize.y > 0)
            {
                InitMovement();
            }
            else
            {
                Debug.Log("[FoxSimpleMovement] 窗口未就绪，将在 Update 中重试初始化...");
            }
        }

        private void InitMovement()
        {
            if (_initialized) return;
            _initialized = true;

            // 恢复上次窗口位置和朝向
            var ws = Data.DataStore.Instance.GetWindowState();
            if (ws.posX != 0 || ws.posY != 0)
            {
                _tw.MoveWindow(ws.posX, ws.posY);
                if (ws.petFacingDir != 0)
                {
                    _facingDir = ws.petFacingDir;
                    _currentFacing = ws.petFacingDir;
                }
                Debug.Log($"[FoxSimpleMovement] 恢复窗口位置: ({ws.posX},{ws.posY}), 朝向: {_facingDir}");
            }

            Debug.Log($"[FoxSimpleMovement] 初始化完成。窗口: {_windowSize}");
        }

        private void Update()
        {
            // 延迟初始化：窗口就绪
            var currentSize = _tw.GetClientSize();
            if (!_initialized && currentSize.x > 0 && currentSize.y > 0)
            {
                _windowSize = currentSize;
                InitMovement();
            }

            // 定期保存窗口位置
            _saveTimer += Time.deltaTime;
            if (_saveTimer >= 10f)
            {
                _saveTimer = 0f;
                SaveState();
            }

            // 检查窗口大小变化
            if (currentSize != _windowSize && currentSize.x > 0)
            {
                _windowSize = currentSize;
            }

            // ── 动画状态同步：非 Idle 动画状态 → 暂停 ──
            var animator = Animation.PetAnimationManager.Instance?.CurrentAnimator;
            var animState = animator?.CurrentState ?? Animation.PetAnimationState.Idle;
            bool shouldPause = animState == Animation.PetAnimationState.Dragging
                            || animState == Animation.PetAnimationState.Listening
                            || animState == Animation.PetAnimationState.Speaking
                            || animState == Animation.PetAnimationState.Sleep
                            || animState == Animation.PetAnimationState.Greeting;

            if (shouldPause && !_wasDragging)
            {
                SetState(MoveState.Paused);
            }
            else if (!shouldPause && _wasDragging)
            {
                _resumeTimer = _dragRecoveryDelay;
            }

            _wasDragging = shouldPause;

            // 暂停恢复计时
            if (_state == MoveState.Paused && !shouldPause)
            {
                _resumeTimer -= Time.deltaTime;
                if (_resumeTimer <= 0f)
                {
                    SetState(MoveState.Idle);
                }
            }

            // ── 平滑转身 ──
            if (_flipModelOnTurn)
            {
                _currentFacing = Mathf.Lerp(_currentFacing, _facingDir, Time.deltaTime / _turnSpeed);
                Vector3 scale = transform.localScale;
                scale.x = _currentFacing;
                transform.localScale = scale;
            }
        }

        private void OnDestroy()
        {
            SaveState();
            Data.DataStore.Instance.Save();
            StopAllCoroutines();
        }

        #endregion

        #region 工具方法

        private void SetState(MoveState newState)
        {
            if (newState == _state) return;
            _state = newState;

            var animator = Animation.PetAnimationManager.Instance?.CurrentAnimator;
            switch (newState)
            {
                case MoveState.Idle:
                    animator?.SetState(Animation.PetAnimationState.Idle);
                    break;
                case MoveState.Paused:
                    // 不覆盖动画状态 —— 由外部模块管理
                    break;
            }
        }

        private void SaveState()
        {
            var pos = _tw.GetWindowScreenPosition();
            var size = _tw.GetClientSize();
            Data.DataStore.Instance.SaveWindowPosition(pos.x, pos.y, size.x, size.y);
            Data.DataStore.Instance.SavePetMovementState(_facingDir, 0, 0);
        }

        #endregion

        #region 公开属性

        public MoveState CurrentMoveState => _state;
        public int FacingDirection => _facingDir;

        #endregion
    }
}
