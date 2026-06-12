const ui = {
    bubble: document.getElementById("bubble"),
    bubbleContainer: document.getElementById("bubble-container"),
    thinkingIndicator: document.getElementById("thinking-indicator"),
    chatInput: document.getElementById("chat-input"),
    sendBtn: document.getElementById("send-btn"),
    previewPanel: document.getElementById("preview-panel"),
    previewResetView: document.getElementById("preview-reset-view"),
    previewBgToggle: document.getElementById("preview-bg-toggle"),
    previewScale: document.getElementById("preview-scale"),
    previewExpressions: document.getElementById("preview-expressions"),
    previewMotions: document.getElementById("preview-motions"),
    previewParams: document.getElementById("preview-params"),
    previewDiagnostics: document.getElementById("preview-diagnostics"),
    previewEvents: document.getElementById("preview-events")
};

const app = new PIXI.Application({
    view: document.getElementById("canvas"),
    autoStart: true,
    resizeTo: window,
    transparent: true,
    backgroundAlpha: 0,
});

let model = null;
let isDragging = false;
let idleCycleFrame = null;
let idleFrame = 0;
let lastBlinkTime = 0;
let isBlinking = false;
let updateModelLayout = () => {};
let activeExpression = null;
let activeMotion = null;
let viewScaleMultiplier = 1;
const idleDefaults = {
    breatheSpeed: 0.04,
    breatheAmplitude: 0.35,
    blinkInterval: 4000,
    blinkDuration: 160,
    headSwaySpeed: 0.012,
    headSwayAmplitude: 2.0
};
let idleParams = {...idleDefaults};

function postMessage(data) {
    window.chrome.webview.postMessage(data);
}

function showPreviewPanel() {
    ui.previewPanel?.classList.add("show");
    updateModelLayout();
}

function logPreviewEvent(text) {
    if (!ui.previewEvents) return;
    ui.previewEvents.innerText = text;
}

function addDiagnostic(level, message) {
    if (!ui.previewDiagnostics) return;
    const row = document.createElement("div");
    row.classList.add("diagnostic-row", level);
    row.innerText = `${level}: ${message}`;
    ui.previewDiagnostics.appendChild(row);
}

function postRendererError(operation, error) {
    const message = error?.message ?? String(error);
    logPreviewEvent(`${operation}: ${message}`);
    addDiagnostic("error", `${operation}: ${message}`);
    postMessage({type: "renderer-error", operation, message});
}

function getCoreModel() {
    return model?.internalModel?.coreModel ?? null;
}

function clampParameterValue(id, value) {
    const coreModel = getCoreModel();
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return null;
    const min = coreModel?.getParameterMinimumValueById?.(id);
    const max = coreModel?.getParameterMaximumValueById?.(id);
    if (Number.isFinite(min) && Number.isFinite(max)) {
        return Math.min(Math.max(numericValue, min), max);
    }
    return numericValue;
}

function setParameterValue(id, value) {
    const coreModel = getCoreModel();
    if (!coreModel || !id) return;
    const clampedValue = clampParameterValue(id, value);
    if (clampedValue === null) return;
    coreModel.setParameterValueById(id, clampedValue);
}

function setParameterValues(parameters) {
    if (!parameters) return;
    for (const [id, value] of Object.entries(parameters)) {
        setParameterValue(id, value);
    }
}

function setLipSync(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return;
    setParameterValue("ParamMouthOpenY", Math.min(Math.max(numericValue, 0), 1));
}

function getParameterMetadata() {
    const coreModel = getCoreModel();
    const parameters = {};
    if (!coreModel?.getParameterIds) return parameters;
    for (const id of coreModel.getParameterIds()) {
        parameters[id] = {
            value: coreModel.getParameterValueById?.(id) ?? 0,
            min: coreModel.getParameterMinimumValueById?.(id) ?? -1,
            max: coreModel.getParameterMaximumValueById?.(id) ?? 1
        };
    }
    return parameters;
}

function renderParameterInspector() {
    if (!ui.previewParams) return;

    const parameters = getParameterMetadata();
    ui.previewParams.replaceChildren();

    for (const [id, info] of Object.entries(parameters)) {
        const row = document.createElement("div");
        row.classList.add("param-row");
        row.dataset.paramId = id;

        const label = document.createElement("label");
        label.classList.add("param-name");
        label.textContent = id;

        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = String(info.min);
        slider.max = String(info.max);
        slider.step = "0.01";
        slider.value = String(info.value);

        const valueLabel = document.createElement("span");
        valueLabel.classList.add("param-value");
        valueLabel.textContent = Number(info.value).toFixed(2);

        slider.oninput = event => {
            const value = Number(event.target.value);
            setParameterValue(id, value);
            valueLabel.textContent = value.toFixed(2);
        };

        row.append(label, slider, valueLabel);
        ui.previewParams.appendChild(row);
    }
}

function safeExpression(id) {
    try {
        model?.expression(id);
        activeExpression = id;
        syncPreviewActionStates();
        logPreviewEvent(`expression: ${id ?? "(reset)"}`);
    } catch (err) {
        postRendererError("expression", err);
    }
}

function safeMotion(group, index) {
    try {
        model?.motion(group, index, PIXI.live2d.MotionPriority.FORCE);
        activeMotion = `${group}/${index}`;
        syncPreviewActionStates();
        logPreviewEvent(`motion: ${group}/${index}`);
    } catch (err) {
        postRendererError("motion", err);
    }
}

function syncPreviewActionStates() {
    for (const button of ui.previewExpressions?.children ?? []) {
        button.classList.toggle("active", button.dataset.expressionId === (activeExpression ?? ""));
    }

    for (const button of ui.previewMotions?.children ?? []) {
        button.classList.toggle("active", button.dataset.motionId === activeMotion);
    }
}

function renderCatalog(catalog) {
    showPreviewPanel();
    ui.previewExpressions?.replaceChildren();
    ui.previewMotions?.replaceChildren();

    const resetButton = document.createElement("button");
    resetButton.classList.add("preview-action", "secondary");
    resetButton.textContent = "Reset";
    resetButton.innerText = "Reset";
    resetButton.dataset.expressionId = "";
    resetButton.onclick = () => safeExpression(null);
    ui.previewExpressions?.appendChild(resetButton);

    for (const expression of catalog.expressions ?? []) {
        const button = document.createElement("button");
        button.classList.add("preview-action");
        button.textContent = expression.name;
        button.innerText = expression.name;
        button.dataset.expressionId = expression.name;
        button.onclick = () => safeExpression(expression.name);
        ui.previewExpressions?.appendChild(button);
    }

    for (const motion of catalog.motions ?? []) {
        const button = document.createElement("button");
        button.classList.add("preview-action");
        button.textContent = motion.name;
        button.innerText = motion.name;
        button.dataset.motionId = `${motion.group}/${motion.index}`;
        button.onclick = () => safeMotion(motion.group, motion.index);
        ui.previewMotions?.appendChild(button);
    }

    postMessage({type: "catalog", expressions: catalog.expressions ?? [], motions: catalog.motions ?? []});
    renderParameterInspector();
    syncPreviewActionStates();
}

function startIdleCycle(parameters = {}) {
    idleParams = {...idleDefaults, ...parameters};
    idleFrame = 0;
    lastBlinkTime = Date.now();
    isBlinking = false;
    stopIdleCycle();

    const tick = () => {
        const coreModel = getCoreModel();
        if (!coreModel) {
            idleCycleFrame = null;
            return;
        }

        idleFrame += 1;
        const now = Date.now();
        const breath = (Math.sin(idleFrame * idleParams.breatheSpeed) + 1) * 0.5 * idleParams.breatheAmplitude;
        const headSway = Math.sin(idleFrame * idleParams.headSwaySpeed) * idleParams.headSwayAmplitude;
        setParameterValue("ParamBreath", breath);
        setParameterValue("ParamAngleZ", headSway);

        if (!isBlinking && now - lastBlinkTime >= idleParams.blinkInterval) {
            isBlinking = true;
            lastBlinkTime = now;
        }
        if (isBlinking) {
            const elapsed = now - lastBlinkTime;
            if (elapsed < idleParams.blinkDuration / 2) {
                const closeRatio = elapsed / (idleParams.blinkDuration / 2);
                setParameterValue("ParamEyeLOpen", 1 - closeRatio);
                setParameterValue("ParamEyeROpen", 1 - closeRatio);
            } else if (elapsed < idleParams.blinkDuration) {
                const openRatio = (elapsed - idleParams.blinkDuration / 2) / (idleParams.blinkDuration / 2);
                setParameterValue("ParamEyeLOpen", openRatio);
                setParameterValue("ParamEyeROpen", openRatio);
            } else {
                isBlinking = false;
                setParameterValue("ParamEyeLOpen", 1);
                setParameterValue("ParamEyeROpen", 1);
            }
        }

        idleCycleFrame = requestAnimationFrame(tick);
    };

    idleCycleFrame = requestAnimationFrame(tick);
}

function stopIdleCycle() {
    if (idleCycleFrame !== null) {
        cancelAnimationFrame(idleCycleFrame);
        idleCycleFrame = null;
    }
}

//输入功能
window.chrome.webview.addEventListener("message", (e) => {
    const msg = e.data;
    switch (msg.type) {
        //加载live2d功能
        case "load":
            loadModel(msg.url);
            break;
        //修改表情
        case "expression":
            safeExpression(msg.id);
            break;
        //修改动作
        case "motion":
            safeMotion(msg.group, msg.index);
            break;
        case "catalog":
            renderCatalog(msg);
            break;
        case "preview":
            showPreviewPanel();
            break;
        //修改气泡文字
        case "diagnostic":
            addDiagnostic(msg.level ?? "info", msg.message ?? "");
            break;
        case "bubble":
            ui.bubble.innerText = msg.text;
            ui.bubbleContainer.classList.add("show");
            break;
        case "hide-bubble":
            ui.bubbleContainer.classList.remove("show");
            break;
        //修改注视目标
        case "look":
            model.focus(msg.x, msg.y, msg.instant);
            break;
        //修改状态反馈
        case "status":
            if (msg.working) {
                ui.thinkingIndicator.classList.add("show");
            } else {
                ui.thinkingIndicator.classList.remove("show");
            }
            break;
        //修改单个Live2D参数
        case "param":
            setParameterValue(msg.id, msg.value);
            break;
        //批量修改Live2D参数
        case "params":
            setParameterValues(msg.params);
            break;
        //口型同步
        case "lip-sync":
            setLipSync(msg.value);
            break;
        //空闲动画循环
        case "idle-cycle":
            if (msg.enabled) {
                startIdleCycle(msg.params);
            } else {
                stopIdleCycle();
            }
            break;
        //获取当前模型参数列表
        case "get-params":
            postMessage({type: "params-list", params: getParameterMetadata()});
            break;
    }
});

async function loadModel(url) {
    console.log("[Pet] Loading model:", url);
    stopIdleCycle();
    if (model) app.stage.removeChild(model);
    try {
        model = await PIXI.live2d.Live2DModel.from(url, {autoInteract: false});
        console.log("[Pet] Model loaded successfully");
    } catch (err) {
        console.error("[Pet] Live2D model load failed:", err);
        postMessage({type: "loaded"});
        return;
    }
    app.stage.addChild(model);

    // 诊断：打印 hitArea 信息
    const hitAreaDefs = model.internalModel?.getHitAreaDefs?.();
    console.log("[Pet] HitArea definitions:", JSON.stringify(hitAreaDefs));
    const drawableIds = model.internalModel?.coreModel?.getDrawableIds?.();
    console.log("[Pet] Drawable IDs:", JSON.stringify(drawableIds));

    // 设置动画曲线
    const ctrl = model.internalModel.focusController;
    if (ctrl) {
        ctrl.acceleration = 0.04;
        ctrl.deceleration = 0.08;
    }

    // 保存原始无缩放的高度，避免因为循环自乘导致闪烁变大
    const baseHeight = model.internalModel.originalHeight || (model.height / model.scale.y);
    const baseWidth = model.internalModel.originalWidth || model.width || baseHeight;

    updateModelLayout = () => {
        const uiScale = window.innerHeight / 540;
        document.documentElement.style.setProperty('--ui-scale', uiScale);
        const previewReservedWidth = ui.previewPanel?.classList.contains("show")
            ? (ui.previewPanel.offsetWidth || 260) + 28
            : 0;
        const availableWidth = Math.max(window.innerWidth - previewReservedWidth, window.innerWidth * 0.35);
        const scale = Math.min((window.innerHeight * 0.9) / baseHeight, (availableWidth * 0.9) / baseWidth);
        model.scale.set(scale * viewScaleMultiplier);
        model.position.set(previewReservedWidth + availableWidth / 2, window.innerHeight / 2);
    };

    model.anchor.set(0.5, 0.5);
    updateModelLayout();
    model.interactive = true;

    window.addEventListener("resize", () => {
        if (model) {
            updateModelLayout();
        }
    });

    startIdleCycle();
    renderParameterInspector();
    postMessage({type: "loaded"});
}


//输出功能
{
    // 缩放按钮拖动逻辑
    const resizeBtn = document.getElementById("resize-btn");
    let startX, startY;
    resizeBtn.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        resizeBtn.setPointerCapture(e.pointerId);
        startX = e.screenX;
        startY = e.screenY;
    });
    resizeBtn.addEventListener("pointermove", (e) => {
        if (resizeBtn.hasPointerCapture(e.pointerId)) {
            const dx = e.screenX - startX;
            const dy = e.screenY - startY;
            if (dx !== 0 || dy !== 0) {
                postMessage({type: "resize_delta", dx: dx, dy: dy});
                startX = e.screenX;
                startY = e.screenY;
            }
        }
    });
    resizeBtn.addEventListener("pointerup", (e) => {
        resizeBtn.releasePointerCapture(e.pointerId);
    });

    //双击触摸反馈
    window.addEventListener("dblclick", async (e) => {
        if (e.target.tagName !== "CANVAS") return;
        const hitAreas = await model.hitTest(e.clientX, e.clientY);
        console.log("[Pet] hitTest result:", JSON.stringify(hitAreas), "clientX/Y:", e.clientX, e.clientY);
        if (hitAreas.length > 0) postMessage({type: "poke", areas: hitAreas});
    });

    //单击拖动反馈
    window.addEventListener("mousedown", async (e) => {
        if (e.button !== 0 || e.target.tagName !== "CANVAS") return;
        const hitAreas = await model.hitTest(e.clientX, e.clientY);
        if (!hitAreas || hitAreas.length === 0) {
            isDragging = true;
            postMessage({type: "drag_start"});
        }
    });
    window.addEventListener("mouseup", async (e) => {
        if (isDragging === true) {
            isDragging = false;
            postMessage({type: "drag_end"});
        }
    })

    //文本输入反馈
    const onSend = () => {
        const text = ui.chatInput.value.trim();
        if (text) {
            postMessage({type: "input", text});
            ui.chatInput.value = "";
        }
    };
    ui.sendBtn.onclick = onSend;
    ui.chatInput.onkeydown = (e) => {
        if (e.key === "Enter") onSend();
    };

    ui.previewScale.oninput = event => {
        viewScaleMultiplier = Number(event.target.value);
        if (!Number.isFinite(viewScaleMultiplier)) viewScaleMultiplier = 1;
        updateModelLayout();
    };

    ui.previewResetView.onclick = () => {
        viewScaleMultiplier = 1;
        ui.previewScale.value = "1";
        updateModelLayout();
        logPreviewEvent("view: fit");
    };

    ui.previewBgToggle.onclick = () => {
        document.body.classList.toggle("checkerboard");
        logPreviewEvent(`background: ${document.body.classList.contains("checkerboard") ? "grid" : "transparent"}`);
    };

}

postMessage({type: "ready"});
