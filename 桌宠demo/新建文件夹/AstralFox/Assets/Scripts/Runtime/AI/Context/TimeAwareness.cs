// TimeAwareness.cs — 时间感知与日常陪伴（桌面端 Unity 实现）
// 挂载到 FoxCore GameObject，依赖 FoxAnimationController / FoxSimpleMovement / 情感引擎
//
// 核心逻辑与 Web 端 src/lib/behavior/time-awareness.ts 算法一致

using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using UnityEngine;
using AstralFox.Animation;
using Random = UnityEngine.Random;

namespace AstralFox.AI.Context
{
    /// <summary>
    /// 时间感知引擎 — 早晚安问候、整点互动、深夜关怀。
    /// 平台无关核心算法与 Web 端 time-awareness.ts 保持一致。
    /// </summary>
    public class TimeAwareness : MonoBehaviour
    {
        [Header("Configuration")]
        [SerializeField] private bool _enabled = true;
        [SerializeField] private bool _morningGreetingEnabled = true;
        [SerializeField] private int _morningStartHour = 6;
        [SerializeField] private int _morningEndHour = 12;
        [SerializeField] private bool _eveningGreetingEnabled = true;
        [SerializeField] private int _eveningStartHour = 18;
        [SerializeField] private int _eveningEndHour = 23;
        [SerializeField] private bool _hourlyInteractionEnabled = true;
        [SerializeField] private bool _nightCareEnabled = true;
        [SerializeField] private int _nightCareStartHour = 23;
        [SerializeField] private int _nightCareEndHour = 6;
        [SerializeField] private int _nightCareIntervalMinutes = 45;
        [SerializeField] private int _idleThresholdMinutes = 30;
        [SerializeField] private float _tickIntervalSeconds = 30f;

        [Header("Dependencies")]
        [SerializeField] private FoxAnimationController _animController;
        [SerializeField] private FoxSimpleMovement _movement;

        // ─── State ─────────────────────────────────────────

        private DateTime _lastGreetingTime = DateTime.MinValue;
        private DateTime _lastHourlyTime = DateTime.MinValue;
        private DateTime _lastNightCareTime = DateTime.MinValue;
        private DateTime _lastActivityTime;
        private DateTime _idleStartTime = DateTime.MinValue;
        private bool _isUserActive;
        private float _tickTimer;
        private int _lastCheckedHour = -1;

        // ─── Events (subscribe external systems) ──────────

        public delegate void GreetingHandler(string message, string emotion, string animation);
        public event GreetingHandler OnGreeting;

        public delegate void HourlyHandler(int hour, string message);
        public event HourlyHandler OnHourlyInteraction;

        public delegate void NightCareHandler(string message);
        public event NightCareHandler OnNightCare;

        public delegate void BubbleHandler(string message, float durationSeconds);
        public event BubbleHandler OnShowBubble;

        // ─── Greeting Pools (mirrors Web greeting pools) ──

        private static readonly Dictionary<string, string[]> GreetingPools = new()
        {
            ["morning"] = new[] {
                "早上好～新的一天开始啦！今天也要元气满满哦～",
                "早安！睡得好舒服呀，主人昨晚休息得好吗？",
                "啊～（伸懒腰）早上了呢，月亮下班我上班～",
                "早上好呀！今天天气看起来不错呢～一起加油吧！",
                "早安早安！我已经充满电了，随时待命！",
            },
            ["afternoon"] = new[] {
                "下午好～吃过午饭了吗？记得按时吃饭哦～",
                "午后的阳光真舒服，晒得我都想打盹了...zzz",
                "主人下午好！我在窗边晒太阳呢～",
                "下午了呢，来杯茶休息一下吧？",
                "下午好呀～工作了这么久，起来活动活动吧！",
            },
            ["evening"] = new[] {
                "晚上好～今天辛苦啦！记得好好吃晚饭哦～",
                "天黑了，星星都出来了呢～主人该休息一下啦",
                "晚上好呀，一天的努力都值得！",
                "晚上了呢～来听首歌放松一下吧？",
                "晚上好！今天有什么有趣的事想跟我分享吗？",
            },
            ["night"] = new[] {
                "都这么晚了，主人还不睡吗？熬夜对身体不好哦～",
                "（打哈欠）我好困了...主人也早点休息吧～",
                "夜深了，明天的你会感谢今晚早睡的自己！",
                "还不睡呀？那我来陪你一会儿吧～但要答应我别太晚哦",
                "已经是深夜了呢...有什么烦恼让你睡不着吗？",
            },
        };

        private static readonly Dictionary<int, string[]> HourlyRemarks = new()
        {
            [0] = new[] { "午夜啦！新的一天开始了～", "零点咯，灰姑娘的魔法要消失了！" },
            [1] = new[] { "凌晨1点...主人真的是夜猫子呢", "1点了，还在忙吗？" },
            [6] = new[] { "6点了！太阳要出来了～", "清晨6点，早起的鸟儿有虫吃～" },
            [7] = new[] { "早上7点，该起床准备上班啦", "7点啦，新的一天开始了！" },
            [9] = new[] { "9点了，开始一天的工作吧！", "上午9点，效率最高的时候呢！" },
            [10] = new[] { "10点了，工作还顺利吗？", "上午10点，记得多喝水哦～" },
            [12] = new[] { "中午12点！该吃午饭啦～", "12点了，肚子饿了吗？" },
            [14] = new[] { "下午2点，有点犯困呢...", "2点了，来杯咖啡提提神？" },
            [15] = new[] { "下午3点啦，该起来动一动咯！", "3点，伸个懒腰吧～" },
            [18] = new[] { "下午6点，下班时间到！", "6点了，今天辛苦啦～" },
            [21] = new[] { "晚上9点，放松一下看看剧？", "9点了，洗个热水澡吧～" },
            [22] = new[] { "10点，准备睡觉了吗？", "晚上10点，该进入休息模式了～" },
            [23] = new[] { "11点了哦，早点休息吧～", "深夜11点，美容觉时间到！" },
        };

        private static readonly string[] NightCareMessages = {
            "已经很晚了，主人不困吗？早点休息对身体好哦～",
            "（揉眼睛）我都有点困了...主人要一起睡觉吗？",
            "熬夜会变熊猫眼的！快去睡觉～",
            "这么晚了还在忙吗？不要太勉强自己呀",
            "夜深了，放下手机，闭上眼睛，好好休息吧～",
            "主人，明天的事明天再做，现在该睡了～",
            "（打哈欠）唔...我好困，晚安啦主人...",
        };

        private static readonly string[] ReturnGreetings = {
            "主人回来啦！我刚才好无聊呢～",
            "欢迎回来！你不在的时候我都在乖乖等你哦～",
            "终于等到你！我刚才数了星星，数到第",
            "主人！你去哪里了？我好想你～",
            "回来啦回来啦！快快，有什么需要我帮忙的吗？",
        };

        private static readonly Dictionary<string, string> EmotionMap = new()
        {
            ["morning"] = "happy",
            ["afternoon"] = "neutral",
            ["evening"] = "happy",
            ["night"] = "sad",
        };

        private static readonly Dictionary<string, string> AnimMap = new()
        {
            ["morning"] = "stretch",
            ["afternoon"] = "idle_warm",
            ["evening"] = "wave",
            ["night"] = "yawn",
        };

        // ─── Unity Lifecycle ──────────────────────────────

        private void Start()
        {
            _lastActivityTime = DateTime.Now;
            _tickTimer = _tickIntervalSeconds; // Fire first tick soon
        }

        private void Update()
        {
            if (!_enabled) return;

            // Activity detection — check mouse/keyboard via Windows API
            DetectUserActivity();

            // Tick timer
            _tickTimer -= Time.deltaTime;
            if (_tickTimer <= 0f)
            {
                _tickTimer = _tickIntervalSeconds;
                RunTick();
            }
        }

        // ─── Windows API — Last Input Time ───────────────

        [DllImport("user32.dll")]
        private static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

        [StructLayout(LayoutKind.Sequential)]
        private struct LASTINPUTINFO
        {
            public uint cbSize;
            public uint dwTime;
        }

        private void DetectUserActivity()
        {
            // Use Windows GetLastInputInfo for system-wide idle detection
            var lii = new LASTINPUTINFO { cbSize = (uint)Marshal.SizeOf<LASTINPUTINFO>() };

            if (!GetLastInputInfo(ref lii)) return;

            // Use unsigned subtraction to correctly handle TickCount wrapping
            // (Environment.TickCount wraps every ~24.9 days on 32-bit; uint math wraps cleanly)
            uint tickNow = (uint)Environment.TickCount;
            uint lastInput = lii.dwTime;
            uint idleMs = tickNow - lastInput; // unsigned: wraps correctly on overflow
            var wasIdle = _idleStartTime != DateTime.MinValue;

            if (idleMs < 5000) // Active in last 5s
            {
                _lastActivityTime = DateTime.Now;
                _isUserActive = true;
                _idleStartTime = DateTime.MinValue;
            }
            else if (_isUserActive)
            {
                _isUserActive = false;
                _idleStartTime = DateTime.Now;
            }
        }

        // ─── Core Tick (matches Web time-awareness.ts) ───

        private void RunTick()
        {
            var now = DateTime.Now;
            var period = GetTimePeriod(now.Hour);

            // 1. Morning / Evening Greeting
            if (ShouldTriggerPeriodGreeting(now))
            {
                var greeting = SelectGreeting(period, isReturn: false);
                _lastGreetingTime = now;
                TriggerGreeting(greeting.message, greeting.emotion, greeting.animation, period);
            }

            // 2. Hourly Interaction
            if (ShouldTriggerHourly(now))
            {
                var interaction = SelectHourlyInteraction(now.Hour);
                _lastHourlyTime = now;
                _lastCheckedHour = now.Hour;
                OnHourlyInteraction?.Invoke(now.Hour, interaction);
                OnShowBubble?.Invoke(interaction, 8f);
            }

            // 3. Late Night Care
            if (ShouldTriggerNightCare(now))
            {
                var msg = PickRandom(NightCareMessages);
                _lastNightCareTime = now;
                OnNightCare?.Invoke(msg);
                OnShowBubble?.Invoke(msg, 10f);

                if (_animController != null)
                    _animController.SetEmotion("sad");
            }

            // 4. Return Greeting (after idle)
            if (ShouldTriggerReturnGreeting(now))
            {
                var greeting = SelectGreeting(period, isReturn: true);
                _lastGreetingTime = now;
                TriggerGreeting(greeting.message, greeting.emotion, greeting.animation, period);
            }
        }

        // ─── Trigger Logic ───────────────────────────────

        private bool ShouldTriggerPeriodGreeting(DateTime now)
        {
            var age = now - _lastGreetingTime;
            if (age.TotalHours < 4) return false;

            var activityAge = now - _lastActivityTime;
            if (activityAge.TotalSeconds > 60) return false;

            var hour = now.Hour;

            if (_morningGreetingEnabled && HourMatches(hour, _morningStartHour, _morningEndHour))
                return true;

            if (_eveningGreetingEnabled && HourMatches(hour, _eveningStartHour, _eveningEndHour))
                return true;

            return false;
        }

        private bool ShouldTriggerHourly(DateTime now)
        {
            if (!_hourlyInteractionEnabled) return false;
            if (now.Hour == _lastCheckedHour) return false;
            if (now.Hour >= 0 && now.Hour < 6 && !_isUserActive) return false;

            return true;
        }

        private bool ShouldTriggerNightCare(DateTime now)
        {
            if (!_nightCareEnabled) return false;
            if (!HourMatches(now.Hour, _nightCareStartHour, _nightCareEndHour)) return false;

            var interval = TimeSpan.FromMinutes(_nightCareIntervalMinutes);
            if (_lastNightCareTime > DateTime.MinValue && now - _lastNightCareTime < interval)
                return false;

            return _isUserActive;
        }

        private bool ShouldTriggerReturnGreeting(DateTime now)
        {
            if (_idleStartTime == DateTime.MinValue) return false;

            var idleDuration = now - _idleStartTime;
            if (idleDuration.TotalMinutes < _idleThresholdMinutes) return false;

            return _isUserActive;
        }

        // ─── Helpers ─────────────────────────────────────

        private static string GetTimePeriod(int hour)
        {
            if (hour >= 6 && hour < 12) return "morning";
            if (hour >= 12 && hour < 18) return "afternoon";
            if (hour >= 18 && hour < 23) return "evening";
            return "night";
        }

        private static bool HourMatches(int hour, int start, int end)
        {
            if (start <= end) return hour >= start && hour < end;
            return hour >= start || hour < end;
        }

        private static string PickRandom(string[] pool)
        {
            return pool[Random.Range(0, pool.Length)];
        }

        private (string message, string emotion, string animation) SelectGreeting(
            string period, bool isReturn)
        {
            var pool = isReturn
                ? ReturnGreetings
                : (GreetingPools.TryGetValue(period, out var p) ? p : GreetingPools["morning"]);

            var emotion = isReturn
                ? "surprised"
                : (EmotionMap.TryGetValue(period, out var e) ? e : "neutral");

            var animation = isReturn
                ? "jump"
                : (AnimMap.TryGetValue(period, out var a) ? a : "idle");

            return (PickRandom(pool), emotion, animation);
        }

        private static string SelectHourlyInteraction(int hour)
        {
            if (HourlyRemarks.TryGetValue(hour, out var remarks))
                return PickRandom(remarks);

            return $"{hour}点啦～时间过得好快呢";
        }

        private void TriggerGreeting(string message, string emotion, string animation, string period)
        {
            OnGreeting?.Invoke(message, emotion, animation);
            OnShowBubble?.Invoke(message, 10f);

            // Dispatch to animation controller
            if (_animController != null)
            {
                _animController.SetEmotion(emotion);
                _animController.PlayAnimation(animation);
            }

            Debug.Log($"[TimeAwareness] Greeting ({period}): {message}");
        }

        // ─── Public API ──────────────────────────────────

        public void SetConfig(bool enabled,
            bool morningEnabled, int morningStart, int morningEnd,
            bool eveningEnabled, int eveningStart, int eveningEnd,
            bool hourlyEnabled,
            bool nightCareEnabled, int nightStart, int nightEnd, int nightIntervalMin,
            int idleThresholdMin)
        {
            _enabled = enabled;
            _morningGreetingEnabled = morningEnabled;
            _morningStartHour = morningStart;
            _morningEndHour = morningEnd;
            _eveningGreetingEnabled = eveningEnabled;
            _eveningStartHour = eveningStart;
            _eveningEndHour = eveningEnd;
            _hourlyInteractionEnabled = hourlyEnabled;
            _nightCareEnabled = nightCareEnabled;
            _nightCareStartHour = nightStart;
            _nightCareEndHour = nightEnd;
            _nightCareIntervalMinutes = nightIntervalMin;
            _idleThresholdMinutes = idleThresholdMin;
        }

        public void MarkUserActivity()
        {
            _lastActivityTime = DateTime.Now;
            _isUserActive = true;
            _idleStartTime = DateTime.MinValue;
        }
    }
}
