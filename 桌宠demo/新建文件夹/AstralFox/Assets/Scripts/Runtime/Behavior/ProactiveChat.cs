using System;
using System.Collections.Generic;
using UnityEngine;

namespace AstralFox.Behavior
{
    /// <summary>
    /// Proactive conversation initiator — makes the pet speak FIRST based on
    /// context, needs, and emotional state, rather than only responding to user.
    /// This is what transforms AstralFox from "reactive" to "proactive companion."
    /// </summary>
    [RequireComponent(typeof(ContextAwareness))]
    [RequireComponent(typeof(PetNeeds))]
    public sealed class ProactiveChat : MonoBehaviour
    {
        [Header("Timing")]
        [SerializeField, Range(120f, 1800f)]
        private float _minInterval = 300f;     // Minimum seconds between proactive chats

        [SerializeField, Range(300f, 3600f)]
        private float _maxInterval = 1200f;    // Maximum seconds without proactive chat

        [Header("Need Triggers")]
        [SerializeField]
        private bool _triggerOnBored = true;    // Entertainment < 30%

        [SerializeField]
        private bool _triggerOnHungry = true;   // Hunger < 30%

        [SerializeField]
        private bool _triggerOnTired = true;    // Fatigue < 30%

        public event Action<string> OnProactiveMessage; // message text for TTS/bubble
        public event Action OnProactiveWakeWord;        // trigger voice pipeline

        private ContextAwareness _context;
        private PetNeeds _needs;
        private Animation.PADEmotionEngine _emotion;
        private float _lastChatTime;
        private float _checkTimer;

        // Context-specific chat pools
        private static readonly Dictionary<string, string[]> ContextMessages = new()
        {
            ["coding"] = new[] {
                "代码写得怎么样了呀~",
                "要不要我帮你Debug？虽然我只会卖萌...",
                "写代码的时候记得多喝水哦！",
                "累了就摸摸我的头放松一下吧~"
            },
            ["gaming"] = new[] {
                "看起来好好玩！带我一个嘛~",
                "打得不错！",
                "不要太沉迷游戏啦，记得休息眼睛哦"
            },
            ["browsing"] = new[] {
                "发现了什么好玩的东西吗？",
                "也给我看看嘛~"
            },
            ["music"] = new[] {
                "这首歌好好听！",
                "要不要我跟着哼两句？"
            },
            ["creative"] = new[] {
                "好厉害！在创作什么呢？",
                "艺术家大人！"
            },
            ["long_idle"] = new[] {
                "你还在吗？星尘好想你...",
                "好久没理我了，来聊聊天嘛~",
                "我快无聊死了！来摸摸我吧！"
            },
            ["hungry"] = new[] {
                "肚子好饿...有没有好吃的？",
                "饿得都没力气卖萌了..."
            },
            ["bored"] = new[] {
                "好无聊呀~来聊聊天吧！",
                "没人陪我玩..."
            },
            ["tired"] = new[] {
                "有点累了...让我休息一会儿~",
                "好困..."
            },
            ["return"] = new[] {
                "你回来啦！好想你！",
                "欢迎回来~刚才去哪了呀？"
            },
        };

        private void Awake()
        {
            _context = GetComponent<ContextAwareness>();
            _needs = GetComponent<PetNeeds>();
            _emotion = GetComponent<Animation.PADEmotionEngine>();
        }

        private void Start()
        {
            _context.OnContextTrigger += OnContextTrigger;
            _context.OnUserReturned += OnUserReturned;
        }

        private void Update()
        {
            _checkTimer += Time.unscaledDeltaTime;
            if (_checkTimer < 10f) return;
            _checkTimer = 0f;

            CheckNeedBasedTriggers();
            CheckTimeBasedTrigger();
        }

        private void OnContextTrigger(string reason)
        {
            string msg = null;
            switch (reason)
            {
                case "long_idle":
                    msg = PickRandom(ContextMessages["long_idle"]);
                    break;
                case "started_coding":
                    msg = PickRandom(ContextMessages["coding"]);
                    break;
                case "late_night_gaming":
                    msg = "这么晚了还在打游戏！该休息啦，明天再玩嘛~";
                    break;
            }
            if (msg != null) SendProactiveMessage(msg);
        }

        private void OnUserReturned(float awaySeconds)
        {
            if (awaySeconds > 300f) // 5+ min away
            {
                string msg = PickRandom(ContextMessages["return"]);
                SendProactiveMessage(msg);
            }
        }

        private void CheckNeedBasedTriggers()
        {
            if (_needs == null) return;

            string msg = null;
            if (_triggerOnBored && _needs.EntertainmentLevel <= Behavior.PetNeeds.NeedLevel.Low)
                msg = PickRandom(ContextMessages["bored"]);
            else if (_triggerOnHungry && _needs.HungerLevel <= Behavior.PetNeeds.NeedLevel.Low)
                msg = PickRandom(ContextMessages["hungry"]);
            else if (_triggerOnTired && _needs.FatigueLevel <= Behavior.PetNeeds.NeedLevel.Low)
                msg = PickRandom(ContextMessages["tired"]);

            if (msg != null) SendProactiveMessage(msg);
        }

        private void CheckTimeBasedTrigger()
        {
            float elapsed = Time.unscaledTime - _lastChatTime;
            if (elapsed < _minInterval) return;

            // Random chance proportional to how long since last chat
            float probability = Mathf.Clamp01((elapsed - _minInterval) / (_maxInterval - _minInterval));
            if (UnityEngine.Random.value < probability * 0.1f) // 10% max per check
            {
                string category = _context.CurrentCategory;
                if (ContextMessages.TryGetValue(category, out var pool))
                {
                    SendProactiveMessage(PickRandom(pool));
                }
            }
        }

        private void SendProactiveMessage(string msg)
        {
            if (Time.unscaledTime - _lastChatTime < 60f) return; // Debounce 1min
            _lastChatTime = Time.unscaledTime;

            OnProactiveMessage?.Invoke(msg);
            OnProactiveWakeWord?.Invoke();

            // Show bubble via TimeAwareness-style event
            Debug.Log($"[ProactiveChat] {msg}");
        }

        private static string PickRandom(string[] pool)
            => pool[UnityEngine.Random.Range(0, pool.Length)];

        private void OnDestroy()
        {
            if (_context != null)
            {
                _context.OnContextTrigger -= OnContextTrigger;
                _context.OnUserReturned -= OnUserReturned;
            }
        }
    }
}
