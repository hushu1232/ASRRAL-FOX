using Live2D.Cubism.Framework.Expression;
using Live2D.Cubism.Framework;
using Live2D.Cubism.Core;
using UnityEngine;

namespace AstralFox
{
    [RequireComponent(typeof(CubismExpressionController))]
    public sealed class ExpressionHotkeys : MonoBehaviour
    {
        private CubismExpressionController _expCtrl;
        private CubismUpdateController _updateController;
        private bool _warnedMissingExpressions;

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
            _updateController = GetComponent<CubismUpdateController>();
            EnsureAttachedToCubismModel();
        }

        private void Start()
        {
            RefreshUpdateController();
            var count = _expCtrl?.ExpressionsList?.CubismExpressionObjects?.Length ?? 0;
            Debug.Log($"[ExpressionHotkeys] {count} expressions ready. 0-9/F1-F8 to play, ESC to clear.");
        }

        private void Update()
        {
            if (_expCtrl?.ExpressionsList?.CubismExpressionObjects == null)
            {
                if (!_warnedMissingExpressions)
                {
                    _warnedMissingExpressions = true;
                    Debug.LogWarning("[ExpressionHotkeys] No CubismExpressionList assigned. Run AstralFox > Setup Desktop Pet Scene or assign YouXiaoMiao.expressionList.asset.");
                }
                return;
            }

            var expressions = _expCtrl.ExpressionsList.CubismExpressionObjects;

            for (int i = 0; i < Hotkeys.Length; i++)
            {
                if (Input.GetKeyDown(Hotkeys[i]) && i < expressions.Length)
                {
                    _expCtrl.CurrentExpressionIndex = i;
                    ApplyExpressionImmediately();
                    Debug.Log($"[Expression] [{Hotkeys[i]}] {expressions[i].name}");
                }
            }

            if (Input.GetKeyDown(KeyCode.Escape))
            {
                _expCtrl.CurrentExpressionIndex = -1;
                ApplyExpressionImmediately();
                Debug.Log("[Expression] Cleared");
            }
        }

        private void RefreshUpdateController()
        {
            if (_updateController == null)
                _updateController = GetComponent<CubismUpdateController>();

            _updateController?.Refresh();
        }

        private void ApplyExpressionImmediately()
        {
            RefreshUpdateController();
            // If the update controller was not present or did not pick this component up yet,
            // advance the expression once so hotkey tests give immediate visible feedback.
            _expCtrl?.OnLateUpdate();
        }

        private void EnsureAttachedToCubismModel()
        {
            if (GetComponent<CubismModel>() != null)
                return;

            var model = GetComponentInChildren<CubismModel>();
            if (model == null)
            {
                Debug.LogWarning("[ExpressionHotkeys] No CubismModel found on this object or children. Native expressions cannot play.");
                return;
            }

            if (model.GetComponent<CubismUpdateController>() == null)
                model.gameObject.AddComponent<CubismUpdateController>();

            var childController = model.GetComponent<CubismExpressionController>();
            if (childController == null)
                childController = model.gameObject.AddComponent<CubismExpressionController>();

            childController.HasUpdateController = model.GetComponent<CubismUpdateController>() != null;
            if (childController.ExpressionsList == null && _expCtrl != null)
                childController.ExpressionsList = _expCtrl.ExpressionsList;

            if (model.GetComponent<ExpressionHotkeys>() == null)
                model.gameObject.AddComponent<ExpressionHotkeys>();

            Debug.LogWarning("[ExpressionHotkeys] Moved expression hotkeys to the CubismModel object so CubismExpressionController can bind the model.");
            enabled = false;
        }
    }
}
