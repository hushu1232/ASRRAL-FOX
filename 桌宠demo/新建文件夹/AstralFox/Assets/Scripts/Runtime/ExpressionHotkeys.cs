using Live2D.Cubism.Framework.Expression;
using UnityEngine;

namespace AstralFox
{
    [RequireComponent(typeof(CubismExpressionController))]
    public sealed class ExpressionHotkeys : MonoBehaviour
    {
        private CubismExpressionController _expCtrl;

        private static readonly KeyCode[] Hotkeys =
        {
            KeyCode.Alpha0, KeyCode.Alpha1, KeyCode.Alpha2, KeyCode.Alpha3,
            KeyCode.Alpha4, KeyCode.Alpha5, KeyCode.Alpha6, KeyCode.Alpha7,
            KeyCode.Alpha8, KeyCode.Alpha9,
            KeyCode.F1, KeyCode.F2, KeyCode.F3, KeyCode.F4,
            KeyCode.F5, KeyCode.F6, KeyCode.F7, KeyCode.F8,
        };

        private void Awake()
        {
            _expCtrl = GetComponent<CubismExpressionController>();
        }

        private void Start()
        {
            var count = _expCtrl?.ExpressionsList?.CubismExpressionObjects?.Length ?? 0;
            Debug.Log($"[ExpressionHotkeys] {count} expressions ready. 0-9/F1-F8 to play, ESC to clear.");
        }

        private void Update()
        {
            if (_expCtrl?.ExpressionsList?.CubismExpressionObjects == null) return;
            var expressions = _expCtrl.ExpressionsList.CubismExpressionObjects;

            for (int i = 0; i < Hotkeys.Length; i++)
            {
                if (Input.GetKeyDown(Hotkeys[i]) && i < expressions.Length)
                {
                    _expCtrl.CurrentExpressionIndex = i;
                    Debug.Log($"[Expression] [{Hotkeys[i]}] {expressions[i].name}");
                }
            }

            if (Input.GetKeyDown(KeyCode.Escape))
            {
                _expCtrl.CurrentExpressionIndex = -1;
                Debug.Log("[Expression] Cleared");
            }
        }
    }
}
