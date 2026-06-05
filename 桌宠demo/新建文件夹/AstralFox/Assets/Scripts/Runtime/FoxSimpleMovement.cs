using System;
using System.Collections;
using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using System.Threading;
using UnityEngine;

namespace AstralFox
{
    /// <summary>
    /// 桌面宠物漫游运动系统。
    ///
    /// 功能：
    /// - 随机漫游 (走路/小跑/待机)，速度与概率受 PAD 情绪影响
    /// - 屏幕底部重力偏好 (80% 时间在桌面"地面"活动)
    /// - 双击 → 点击目的地移动，带视觉反馈提示
    /// - 用户空闲检测：空闲过久主动靠近光标
    /// - 动画状态同步：Listening/Speaking/Sleep 时自动暂停移动
    /// - 窗口位置与状态持久化 (每 10 秒保存)
    /// Class name "FoxSimpleMovement" uses the project code name "AstralFox". Character is 星尘 (anime girl).
    /// </summary>
    [RequireComponent(typeof(TransparentWindow))]
    public sealed class FoxSimpleMovement : MonoBehaviour
    {
        #region Inspector

        [Header("移动速度 (屏幕像素/秒)")]
        [SerializeField, Range(20f, 300f)]
        private float _walkSpeed = 80f;

        [SerializeField, Range(50f, 600f)]
        private float _runSpeed = 200f;

        [Header("漫游行为")]
        [SerializeField, Range(0f, 1f)]
        private float _runChance = 0.25f;          // 随机选择小跑的概率

        [SerializeField, Range(0.5f, 10f)]
        private float _minIdleTime = 2f;           // 最短待机时间

        [SerializeField, Range(1f, 30f)]
        private float _maxIdleTime = 8f;           // 最长待机时间

        [SerializeField, Range(0.1f, 3f)]
        private float _targetReachedThreshold = 0.5f; // 到达判定：距离目标小于此值(像素)视为到达

        [Header("窗口边界")]
        [SerializeField, Range(0, 200)]
        private int _edgeMargin = 50;              // 距离屏幕边缘的安全边距(像素)

        [Header("点击移动")]
        [SerializeField]
        private bool _enableClickToMove = true;       // 开启点击移动（双击桌宠 → 点击桌面目的地）

        [SerializeField, Range(0.2f, 1f)]
        private float _doubleClickInterval = 0.4f;    // 双击判定间隔(秒)

        [SerializeField, Range(2f, 15f)]
        private float _destinationWaitTime = 5f;       // 双击后等待目的地点击的超时(秒)

        [Header("转身")]
        [SerializeField]
        private bool _flipModelOnTurn = true;      // 转身时翻转模型 X 轴

        [SerializeField, Range(0.05f, 0.5f)]
        private float _turnSpeed = 0.15f;          // 转身平滑时间

        [Header("走路动画")]
        [SerializeField, Range(0f, 10f)]
        private float _bodyBobAmp = 3f;            // 身体上下摆动幅度

        [SerializeField, Range(1f, 10f)]
        private float _bodyBobFreq = 5f;           // 身体摆动频率

        [SerializeField, Range(0f, 5f)]
        private float _tailWagRun = 0.8f;          // 小跑时头发/尾巴摆动强度

        [SerializeField, Range(0f, 5f)]
        private float _tailWagWalk = 0.3f;         // 走路时头发/尾巴摆动强度

        [Header("情绪驱动")]
        [SerializeField, Range(0f, 1f), Tooltip("情绪对移动速度的影响程度")]
        private float _emotionSpeedInfluence = 0.5f;

        [SerializeField, Range(0f, 1f), Tooltip("情绪对目标位置选择的影响程度")]
        private float _emotionPositionInfluence = 0.4f;

        [Header("重力与停靠")]
        [SerializeField, Range(0f, 1f), Tooltip("底部重力偏好 (0=均匀分布, 1=总是靠近屏幕底部)")]
        private float _bottomGravity = 0.75f;

        [SerializeField, Range(0.1f, 0.5f), Tooltip("屏幕底部目标区域的占比")]
        private float _bottomZoneRatio = 0.35f;

        [Header("主动互动")]
        [SerializeField, Range(10f, 300f), Tooltip("用户无操作多久后角色主动靠近光标 (秒)")]
        private float _idleApproachTime = 60f;

        [SerializeField, Range(0f, 1f), Tooltip("高好感度时主动靠近的概率加成")]
        private float _affectionApproachBonus = 0.3f;

        #endregion

        #region Win32 — 屏幕工作区域和鼠标状态 (via NativeWindowInterop)

        // Mouse hook thread — uses NativeWindowInterop for all Win32 calls

        #endregion

        #region 状态定义

        public enum MoveState
        {
            Idle,       // 原地待机
            Walking,    // 慢走
            Running,    // 小跑
            MovingToClick, // 走向点击位置（使用走路速度）
            Paused      // 暂停（拖拽中 / 拖拽后冷却）
        }

        #endregion

        #region 私有字段

        private TransparentWindow _tw;
        private FoxInteraction _interaction;
        private Animation.PADEmotionEngine _padEngine;

        private MoveState _state = MoveState.Idle;
        private Coroutine _roamRoutine;
        private RectInt _workArea;              // 屏幕工作区域(排除任务栏)
        private Vector2Int _windowSize;         // 当前窗口客户区大小
        private Vector2Int _targetPos;          // 当前目标位置(屏幕坐标)
        private int _facingDir = 1;             // 1=朝右, -1=朝左
        private float _currentFacing = 1f;      // 平滑过渡的朝向值
        private float _stateTimer;
        private float _resumeTimer;
        private bool _wasDragging;
        private float _walkPhase;               // 走路动画相位

        // 点击移动 — 独立线程鼠标钩子
        private ConcurrentQueue<Vector2Int> _clickQueue = new ConcurrentQueue<Vector2Int>();
        private Thread _hookThread;
        private IntPtr _hHook = IntPtr.Zero;
        private volatile bool _hookRunning;
        private NativeWindowInterop.LowLevelMouseProc _hookProc;

        // 双击桌宠 → 等待目的地点击 状态机
        private bool _waitingForDestination;
        private float _destinationWaitRemaining;
        private float _lastClickOnFoxTime = float.MinValue;

        // 状态持久化
        private float _saveTimer;

        #endregion

        #region Unity 生命周期

        private void Awake()
        {
            _tw = GetComponent<TransparentWindow>();
            _interaction = GetComponent<FoxInteraction>();
            _padEngine = GetComponent<Animation.PADEmotionEngine>();
        }

        private bool _initialized;

        private void Start()
        {
            _workArea = GetWorkArea();
            _currentFacing = _facingDir;
            _windowSize = _tw.GetClientSize();

            // 如果窗口尚未就绪（客户区为 0），延迟到 Update 初始化
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
                if (ws.petTargetX != 0 || ws.petTargetY != 0)
                {
                    _targetPos = new Vector2Int(ws.petTargetX, ws.petTargetY);
                    SetState(UnityEngine.Random.value < _runChance ? MoveState.Running : MoveState.Walking);
                }
                Debug.Log($"[FoxSimpleMovement] 恢复窗口位置: ({ws.posX},{ws.posY}), 朝向: {_facingDir}");
            }

            _roamRoutine = StartCoroutine(RoamLoop());
            StartHookThread();
            Debug.Log($"[FoxSimpleMovement] 初始化完成。工作区域: {_workArea}, 窗口: {_windowSize}");
        }

        private void Update()
        {
            // 延迟初始化：窗口就绪后首次获取有效尺寸
            var currentSize = _tw.GetClientSize();
            if (!_initialized && currentSize.x > 0 && currentSize.y > 0)
            {
                _windowSize = currentSize;
                InitMovement();
            }

            // 定期保存窗口位置和角色状态
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
                _workArea = GetWorkArea();
            }

            // ── 动画状态同步：非 Idle 动画状态 → 暂停漫游 ──
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
                _resumeTimer = animState == Animation.PetAnimationState.Idle ? 1.5f : 3f;
            }

            _wasDragging = shouldPause;

            // 暂停恢复计时
            if (_state == MoveState.Paused && !shouldPause)
            {
                _resumeTimer -= Time.deltaTime;
                if (_resumeTimer <= 0f)
                {
                    PickNewTarget();
                    float runChance = GetEmotionModulatedRunChance();
                    SetState(UnityEngine.Random.value < runChance ? MoveState.Running : MoveState.Walking);
                    if (_roamRoutine == null)
                        _roamRoutine = StartCoroutine(RoamLoop());
                }
            }

            // ── 用户空闲检测：空闲过久 → 角色主动靠近光标 ──
            UpdateIdleApproach();

            // 目的地等待超时
            if (_waitingForDestination)
            {
                _destinationWaitRemaining -= Time.deltaTime;
                if (_destinationWaitRemaining <= 0f)
                {
                    _waitingForDestination = false;
                    Debug.Log("[FoxSimpleMovement] 等待目的地超时，已取消。");
                }
            }

            // 点击移动：双击桌宠 → 点击桌面目的地
            if (_enableClickToMove && _state != MoveState.Paused)
            {
                while (_clickQueue.TryDequeue(out Vector2Int clickPt))
                {
                    var wr = _tw.GetWindowScreenRect();
                    bool onFox = clickPt.x >= wr.left && clickPt.x <= wr.right
                              && clickPt.y >= wr.top  && clickPt.y <= wr.bottom;

                    if (_waitingForDestination)
                    {
                        // 等待目的地阶段
                        if (onFox)
                        {
                            // 再次点击桌宠 → 取消
                            _waitingForDestination = false;
                            Debug.Log("[FoxSimpleMovement] 再次点击桌宠，已取消目的地选择。");
                        }
                        else if (IsInWorkArea(clickPt))
                        {
                            // 桌面空白处 → 走到目的地
                            _waitingForDestination = false;
                            OnDesktopClicked(clickPt);
                        }
                        // else: 点击在任务栏/屏幕外 → 忽略
                    }
                    else if (onFox)
                    {
                        // 非等待阶段，点击桌宠 → 检测双击
                        float now = Time.time;
                        if (now - _lastClickOnFoxTime <= _doubleClickInterval)
                        {
                            _waitingForDestination = true;
                            _destinationWaitRemaining = _destinationWaitTime;
                            ShowDestinationPrompt();
                            Debug.Log($"[FoxSimpleMovement] 双击桌宠！请在 {_destinationWaitTime}s 内点击目的地...");
                        }
                        _lastClickOnFoxTime = now;
                    }
                    // else: 非等待阶段点击桌面空白处 → 忽略（需先双击桌宠激活）
                }
            }

            // 更新移动
            UpdateMovement();

            // 更新走路动画参数
            UpdateWalkAnimation();
        }


        #endregion

        #region 漫游协程

        /// <summary>
        /// 漫游主循环：选择目标 → 走过去 → 待机 → 重复
        /// </summary>
        private IEnumerator RoamLoop()
        {
            while (true)
            {
                switch (_state)
                {
                    case MoveState.Idle:
                        float idleTime = GetEmotionModulatedIdleTime();
                        yield return new WaitForSeconds(idleTime);

                        PickNewTarget();
                        bool run = UnityEngine.Random.value < GetEmotionModulatedRunChance();
                        SetState(run ? MoveState.Running : MoveState.Walking);
                        break;

                    case MoveState.Walking:
                    case MoveState.Running:
                    case MoveState.MovingToClick:
                        // 等待到达目标
                        yield return null; // 在 Update 中处理移动
                        break;

                    case MoveState.Paused:
                        yield return null;
                        break;
                }
            }
        }

        #endregion

        #region 移动逻辑

        /// <summary>
        /// 每帧执行窗口移动，检测是否到达目标。
        /// </summary>
        private void UpdateMovement()
        {
            if (_state != MoveState.Walking && _state != MoveState.Running && _state != MoveState.MovingToClick)
                return;

            Vector2Int currentPos = _tw.GetWindowScreenPosition();
            Vector2 delta = new Vector2(
                _targetPos.x - currentPos.x,
                _targetPos.y - currentPos.y);

            float dist = delta.magnitude;

            // 到达目标？
            if (dist < _targetReachedThreshold)
            {
                bool wasClickMove = _state == MoveState.MovingToClick;
                SetState(MoveState.Idle);
                if (wasClickMove) ShowArrival();
                return;
            }

            // 计算本帧移动（情绪调制速度）
            float baseSpeed = _state == MoveState.Running ? _runSpeed : _walkSpeed;
            float speed = GetEmotionModulatedSpeed(baseSpeed);
            float step = speed * Time.deltaTime;
            if (step > dist) step = dist;

            Vector2 moveDir = delta.normalized;
            Vector2Int newPos = new Vector2Int(
                Mathf.RoundToInt(currentPos.x + moveDir.x * step),
                Mathf.RoundToInt(currentPos.y + moveDir.y * step));

            // 钳制到工作区域
            newPos = ClampToWorkArea(newPos);
            _tw.MoveWindow(newPos.x, newPos.y);

            // 更新朝向
            if (Mathf.Abs(delta.x) > 1f)
                _facingDir = delta.x > 0 ? 1 : -1;
        }

        /// <summary>
        /// 选取目标位置。受底部重力偏好和情绪状态影响：
        /// - 80%重力偏好使目标偏向屏幕底部
        /// - 高愉悦度倾向屏幕中央，低愉悦度倾向角落
        /// - 高支配度拥有更大移动范围
        /// </summary>
        private void PickNewTarget()
        {
            _workArea = GetWorkArea();

            int minX = _workArea.xMin + _edgeMargin;
            int maxX = _workArea.xMax - _windowSize.x - _edgeMargin;
            int minY = _workArea.yMin + _edgeMargin;
            int maxY = _workArea.yMax - _windowSize.y - _edgeMargin;

            if (maxX < minX) maxX = minX;
            if (maxY < minY) maxY = minY;

            // ── Y轴：底部重力偏好 ──
            int targetY;
            if (UnityEngine.Random.value < _bottomGravity)
            {
                // 偏重屏幕底部区域
                int bottomZoneTop = maxY - Mathf.RoundToInt((maxY - minY) * _bottomZoneRatio);
                if (bottomZoneTop < minY) bottomZoneTop = minY;
                targetY = UnityEngine.Random.Range(bottomZoneTop, maxY + 1);
            }
            else
            {
                targetY = UnityEngine.Random.Range(minY, maxY + 1);
            }

            // ── X轴 + 情绪位置偏移 ──
            int targetX = UnityEngine.Random.Range(minX, maxX + 1);

            // 情绪影响：高愉悦 → 偏向中央，低愉悦 → 偏向边缘
            if (_padEngine != null && _emotionPositionInfluence > 0f)
            {
                float pleasure = _padEngine.Pleasure; // -1 to 1
                float dominance = _padEngine.Dominance; // -1 to 1

                // 支配度调制范围大小：低支配 → 范围缩小（胆小，靠近当前位置）
                if (dominance < 0f)
                {
                    var currentPos = _tw.GetWindowScreenPosition();
                    float shrinkFactor = 1f + dominance * 0.6f; // 0.4 to 1.0
                    int rangeX = Mathf.RoundToInt((maxX - minX) * shrinkFactor);
                    int rangeY = Mathf.RoundToInt((maxY - minY) * shrinkFactor);
                    int centerX = currentPos.x;
                    int centerY = currentPos.y;
                    minX = Mathf.Max(minX, centerX - rangeX / 2);
                    maxX = Mathf.Min(maxX, centerX + rangeX / 2);
                    minY = Mathf.Max(minY, centerY - rangeY / 2);
                    maxY = Mathf.Min(maxY, centerY + rangeY / 2);
                    if (maxX < minX) maxX = minX;
                    if (maxY < minY) maxY = minY;
                    targetX = UnityEngine.Random.Range(minX, maxX + 1);
                    targetY = Mathf.Clamp(targetY, minY, maxY);
                }

                // 愉悦度偏向中央（仅当影响力 > 0 时混入）
                float centerBias = pleasure * _emotionPositionInfluence;
                if (Mathf.Abs(centerBias) > 0.05f)
                {
                    int screenCenterX = (_workArea.xMin + _workArea.xMax - _windowSize.x) / 2;
                    targetX = Mathf.RoundToInt(Mathf.Lerp(targetX, screenCenterX, Mathf.Abs(centerBias)));
                    targetX = Mathf.Clamp(targetX, minX, maxX);
                }
            }

            _targetPos = new Vector2Int(targetX, targetY);
        }

        /// <summary>
        /// 将窗口位置钳制到工作区域内。
        /// </summary>
        private Vector2Int ClampToWorkArea(Vector2Int pos)
        {
            int minX = _workArea.xMin + _edgeMargin;
            int maxX = _workArea.xMax - _windowSize.x - _edgeMargin;
            int minY = _workArea.yMin + _edgeMargin;
            int maxY = _workArea.yMax - _windowSize.y - _edgeMargin;

            if (maxX < minX) maxX = minX;
            if (maxY < minY) maxY = minY;

            return new Vector2Int(
                Mathf.Clamp(pos.x, minX, maxX),
                Mathf.Clamp(pos.y, minY, maxY));
        }

        #endregion

        #region 走路动画

        /// <summary>
        /// 驱动 Live2D 参数模拟走路效果：
        /// - 身体前后摇摆 (BodyAngleX)
        /// - 尾部摆动 (TailWag)
        /// - 耳朵轻微晃动 (EarL/EarR)
        /// </summary>
        private void UpdateWalkAnimation()
        {
            var animator = Animation.PetAnimationManager.Instance?.CurrentAnimator;
            if (animator == null || !animator.IsReady) return;

            bool isMoving = _state == MoveState.Walking ||
                            _state == MoveState.Running ||
                            _state == MoveState.MovingToClick;

            if (isMoving)
            {
                float baseSpeed = _state == MoveState.Running ? _runSpeed : _walkSpeed;
                float speed = GetEmotionModulatedSpeed(baseSpeed);
                _walkPhase += Time.deltaTime * _bodyBobFreq * (speed / _walkSpeed);

                // 身体前后摇摆
                float bob = Mathf.Sin(_walkPhase) * _bodyBobAmp *
                            (_state == MoveState.Running ? 1.4f : 1f);

                // 身体左右微晃（走路特征）
                float sway = Mathf.Cos(_walkPhase * 0.7f) * _bodyBobAmp * 0.5f;
                animator.SetBodyPose(bob, 0f, sway);

                // 头发/尾巴摆动
                float tailWag = _state == MoveState.Running ? _tailWagRun : _tailWagWalk;
                animator.SetTailWag(tailWag);
                animator.SetTailSwing(Mathf.Sin(_walkPhase * 1.3f) * tailWag);

                // 耳朵随步伐微动
                float earBob = Mathf.Abs(Mathf.Sin(_walkPhase)) * 0.15f;
                animator.SetEarPose(earBob, earBob);
            }
            else
            {
                // 待机：恢复默认
                _walkPhase = 0f;
                animator.SetBodyPose(0f, 0f, 0f);
                animator.SetTailWag(0f);
                animator.SetTailSwing(0f);
                animator.SetEarPose(0f, 0f);
            }

            // 平滑转身（翻转模型 X 轴）
            if (_flipModelOnTurn)
            {
                _currentFacing = Mathf.Lerp(_currentFacing, _facingDir, Time.deltaTime / _turnSpeed);
                Vector3 scale = transform.localScale;
                scale.x = _currentFacing;
                transform.localScale = scale;
            }
        }

        #endregion

        #region 点击移动

        /// <summary>
        /// 响应桌面空白处点击：让角色走向点击位置。
        /// 目标位置 = 点击位置 - 半个窗口尺寸（让角色居中于点击处）。
        /// </summary>
        /// <summary>
        /// 检查屏幕坐标是否在工作区域（排除任务栏）内。
        /// </summary>
        private bool IsInWorkArea(Vector2Int screenPt)
        {
            return screenPt.x >= _workArea.xMin && screenPt.x <= _workArea.xMax
                && screenPt.y >= _workArea.yMin && screenPt.y <= _workArea.yMax;
        }

        private void OnDesktopClicked(Vector2Int screenClickPos)
        {
            _targetPos = new Vector2Int(
                screenClickPos.x - _windowSize.x / 2,
                screenClickPos.y - _windowSize.y / 2);

            _targetPos = ClampToWorkArea(_targetPos);

            SetState(MoveState.MovingToClick);
            Debug.Log($"[FoxSimpleMovement] 点击移动 → ({_targetPos.x}, {_targetPos.y})");
        }

        /// <summary>双击激活目的地模式时，眼睛睁大 + 耳朵竖起作为"等待指令"的视觉提示。</summary>
        private void ShowDestinationPrompt()
        {
            StartCoroutine(DestinationPromptRoutine());
        }

        private System.Collections.IEnumerator DestinationPromptRoutine()
        {
            var animator = Animation.PetAnimationManager.Instance?.CurrentAnimator;
            if (animator == null) yield break;

            // 快速睁大眼睛
            animator.SetEyeOpen(1.2f);
            animator.SetEarPose(0.6f, 0.6f);
            yield return new WaitForSeconds(0.15f);

            // 恢复正常
            animator.SetEyeOpen(1f);
            animator.SetEarPose(0f, 0f);

            // 保持微弱的"警觉"状态（耳朵微竖）
            float t = 0f;
            while (_waitingForDestination && t < _destinationWaitTime)
            {
                float flicker = Mathf.Sin(Time.time * 4f) * 0.15f;
                animator.SetEarPose(0.2f + flicker, 0.2f + flicker);
                yield return null;
                t += Time.deltaTime;
            }
            animator.SetEarPose(0f, 0f);
        }

        /// <summary>到达点击目的地时做一个"到达"小动作。</summary>
        private void ShowArrival()
        {
            var animator = Animation.PetAnimationManager.Instance?.CurrentAnimator;
            if (animator == null) return;

            // 快速头发/尾巴摆动 + 微微点头
            StartCoroutine(ArrivalRoutine());
        }

        private System.Collections.IEnumerator ArrivalRoutine()
        {
            var animator = Animation.PetAnimationManager.Instance?.CurrentAnimator;
            if (animator == null) yield break;

            // 三连头发/尾巴摆动
            for (int i = 0; i < 3; i++)
            {
                animator.SetTailWag(0.7f);
                yield return new WaitForSeconds(0.12f);
                animator.SetTailWag(0f);
                yield return new WaitForSeconds(0.08f);
            }
        }

        /// <summary>
        /// 启动独立线程，安装 WH_MOUSE_LL 全局鼠标钩子。
        /// 钩子回调将鼠标点击位置推入无锁队列，主线程在 Update 中消费。
        /// </summary>
        private void StartHookThread()
        {
            _hookRunning = true;
            _hookThread = new Thread(() =>
            {
                _hHook = NativeWindowInterop.SetWindowsHookEx(NativeWindowInterop.WH_MOUSE_LL, HookCallback, IntPtr.Zero, 0);
                if (_hHook == IntPtr.Zero)
                {
                    Debug.LogError("[FoxSimpleMovement] 鼠标钩子安装失败！");
                    return;
                }

                // Windows 消息泵 —— 钩子依赖消息循环分发事件
                NativeWindowInterop.MSG msg;
                while (_hookRunning)
                {
                    int ret = NativeWindowInterop.GetMessage(out msg, IntPtr.Zero, 0, 0);
                    if (ret == 0 || ret == -1) break; // WM_QUIT 或错误
                }

                NativeWindowInterop.UnhookWindowsHookEx(_hHook);
                _hHook = IntPtr.Zero;
            })
            {
                IsBackground = true,
                Name = "FoxMouseHook"
            };
            _hookThread.Start();
        }

        private IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam) // matches NativeWindowInterop.LowLevelMouseProc
        {
            if (nCode >= 0 && wParam.ToInt32() == NativeWindowInterop.WM_LBUTTONDOWN)
            {
                var hs = Marshal.PtrToStructure<NativeWindowInterop.MSLLHOOKSTRUCT>(lParam);
                _clickQueue.Enqueue(new Vector2Int(hs.pt.X, hs.pt.Y));
            }
            return NativeWindowInterop.CallNextHookEx(_hHook, nCode, wParam, lParam);
        }

        private void StopHookThread()
        {
            _hookRunning = false;
            if (_hookThread != null && _hookThread.IsAlive)
            {
                NativeWindowInterop.PostThreadMessage((uint)_hookThread.ManagedThreadId, NativeWindowInterop.WM_QUIT, IntPtr.Zero, IntPtr.Zero);
                if (!_hookThread.Join(2000))
                {
                    Debug.LogWarning("[FoxSimpleMovement] 钩子线程未能在 2 秒内退出。");
                }
            }
            _hookThread = null;
        }

        private void SaveState()
        {
            var pos = _tw.GetWindowScreenPosition();
            var size = _tw.GetClientSize();
            Data.DataStore.Instance.SaveWindowPosition(pos.x, pos.y, size.x, size.y);
            Data.DataStore.Instance.SavePetMovementState(_facingDir, _targetPos.x, _targetPos.y);
        }

        private void OnDestroy()
        {
            SaveState();
            Data.DataStore.Instance.Save();
            StopHookThread();
        }

        #endregion

        #region 情绪调制

        /// <summary>根据 Arousal 调制移动速度。高唤醒 → 快，低唤醒 → 慢。</summary>
        private float GetEmotionModulatedSpeed(float baseSpeed)
        {
            if (_padEngine == null || _emotionSpeedInfluence <= 0f) return baseSpeed;
            float arousal = _padEngine.Arousal;
            float multiplier = 1f + arousal * _emotionSpeedInfluence; // 0.5x to 1.5x
            return baseSpeed * multiplier;
        }

        /// <summary>根据 Arousal 调制小跑概率。高唤醒 → 更爱跑。</summary>
        private float GetEmotionModulatedRunChance()
        {
            if (_padEngine == null) return _runChance;
            float arousal = _padEngine.Arousal;
            return Mathf.Clamp(_runChance + arousal * 0.2f, 0.05f, 0.7f);
        }

        /// <summary>根据 Arousal 调制待机时长。</summary>
        private float GetEmotionModulatedIdleTime()
        {
            if (_padEngine == null)
                return UnityEngine.Random.Range(_minIdleTime, _maxIdleTime);
            float arousal = _padEngine.Arousal;
            float factor = 1f - arousal * 0.5f; // 高唤醒→短待机，低唤醒→长待机
            return UnityEngine.Random.Range(_minIdleTime * factor, _maxIdleTime * factor);
        }

        #endregion

        #region 用户空闲检测

        /// <summary>
        /// 检测用户空闲时长。超过阈值后，角色有一定概率主动靠近光标。
        /// 好感度越高，主动靠近的概率越大。
        /// </summary>
        private void UpdateIdleApproach()
        {
            if (_state == MoveState.Paused || _state == MoveState.MovingToClick) return;
            if (_idleApproachTime <= 0f) return;

            float idleSec = GetUserIdleSeconds();
            if (idleSec < _idleApproachTime) return;

            // 用户空闲过久，角色主动靠近
            var affection = Data.DataStore.Instance.GetAffection();
            float approachChance = 0.15f + (affection.affectionLevel / 100f) * _affectionApproachBonus;
            // 每小时最多触发一次主动靠近
            float cooldown = 3600f;
            bool canApproach = Time.time - _lastApproachTime > cooldown;

            if (canApproach && UnityEngine.Random.value < approachChance * Time.deltaTime * 0.1f)
            {
                _lastApproachTime = Time.time;
                ApproachCursor();
            }
        }

        private float _lastApproachTime = float.MinValue;

        private void ApproachCursor()
        {
            NativeWindowInterop.POINT cursor;
            if (!NativeWindowInterop.GetCursorPos(out cursor))
            {
                // Fallback to GetMouseScreenPosition from TransparentWindow
                var mouseScreen = _tw.GetMouseScreenPosition();
                cursor = new NativeWindowInterop.POINT { X = mouseScreen.x, Y = mouseScreen.y };
            }

            // 目标位置 = 光标附近（做一个偏移，不直接压在光标上）
            int offsetX = UnityEngine.Random.Range(-60, 61);
            int offsetY = UnityEngine.Random.Range(-40, 20); // 偏向光标上方
            _targetPos = new Vector2Int(cursor.X + offsetX, cursor.Y + offsetY);
            _targetPos = ClampToWorkArea(_targetPos);

            SetState(UnityEngine.Random.value < 0.3f ? MoveState.Running : MoveState.Walking);
            Debug.Log($"[FoxSimpleMovement] 主动靠近光标 → ({_targetPos.x}, {_targetPos.y})");
        }

        private static float GetUserIdleSeconds()
        {
            var lii = new NativeWindowInterop.LASTINPUTINFO();
            lii.cbSize = (uint)System.Runtime.InteropServices.Marshal.SizeOf(lii);
            if (NativeWindowInterop.GetLastInputInfo(out lii))
            {
                uint tickCount = (uint)Environment.TickCount;
                return (tickCount - lii.dwTime) / 1000f;
            }
            return 0f;
        }

        #endregion

        #region 工具方法

        private void SetState(MoveState newState)
        {
            if (newState == _state) return;

            MoveState prev = _state;
            _state = newState;

            // 状态进入行为
            var animator = Animation.PetAnimationManager.Instance?.CurrentAnimator;
            switch (newState)
            {
                case MoveState.Idle:
                    animator?.SetState(Animation.PetAnimationState.Idle);
                    break;
                case MoveState.Walking:
                case MoveState.Running:
                case MoveState.MovingToClick:
                    // 保持 Idle 动画状态，仅通过参数驱动走路效果
                    animator?.SetState(Animation.PetAnimationState.Idle);
                    break;
                case MoveState.Paused:
                    // 不覆盖动画状态 —— 动画状态由外部模块管理
                    // (Dragging→OnDragEnd, Listening/Speaking/Sleep 由 VoiceManager/FoxAnimationController 控制)
                    break;
            }

            // 停止旧协程（状态由 UpdateMovement 中的到达检测切换回 Idle）
        }

        /// <summary>
        /// 获取显示器工作区域（排除任务栏）。
        /// </summary>
        private RectInt GetWorkArea()
        {
            NativeWindowInterop.RECT rect = new NativeWindowInterop.RECT();
            NativeWindowInterop.SystemParametersInfo(NativeWindowInterop.SPI_GETWORKAREA, 0, ref rect, 0);
            return new RectInt(rect.Left, rect.Top,
                rect.Right - rect.Left, rect.Bottom - rect.Top);
        }

        #endregion

        #region 公开属性（供外部查询）

        public MoveState CurrentMoveState => _state;
        public Vector2Int TargetPosition => _targetPos;
        public int FacingDirection => _facingDir;

        #endregion
    }
}
