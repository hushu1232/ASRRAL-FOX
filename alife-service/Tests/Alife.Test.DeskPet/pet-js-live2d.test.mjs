import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const petScriptPath = path.resolve(
    "sources",
    "Alife.DeskPet",
    "Alife.DeskPet.Client",
    "wwwroot",
    "pet.js");

function createElement(tagName = "DIV") {
    return {
        tagName,
        innerText: "",
        textContent: "",
        offsetWidth: 0,
        offsetHeight: 0,
        dataset: {},
        type: "",
        min: "",
        max: "",
        step: "",
        value: "",
        oninput: null,
        onclick: null,
        onkeydown: null,
        children: [],
        append(...children) {
            this.children.push(...children);
        },
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        replaceChildren(...children) {
            this.children = children;
        },
        classList: {
            values: new Set(),
            add(value) {
                this.values.add(value);
            },
            remove(value) {
                this.values.delete(value);
            },
            contains(value) {
                return this.values.has(value);
            },
            toggle(value, force) {
                const enabled = force ?? !this.values.has(value);
                if (enabled) {
                    this.values.add(value);
                } else {
                    this.values.delete(value);
                }
                return enabled;
            }
        },
        addEventListener() {
        },
        setPointerCapture() {
        },
        hasPointerCapture() {
            return false;
        },
        releasePointerCapture() {
        }
    };
}

function createPetHarness() {
    const messages = [];
    const animationFrames = [];
    const parameterValues = new Map([
        ["ParamAngleX", 0],
        ["ParamAngleY", 0],
        ["ParamAngleZ", 0],
        ["ParamBodyAngleX", 0],
        ["ParamEyeLOpen", 1],
        ["ParamEyeROpen", 1],
        ["ParamMouthOpenY", 0],
        ["ParamBreath", 0]
    ]);
    const parameterRanges = new Map([
        ["ParamAngleX", [-30, 30]],
        ["ParamAngleY", [-30, 30]],
        ["ParamAngleZ", [-30, 30]],
        ["ParamBodyAngleX", [-10, 10]],
        ["ParamEyeLOpen", [0, 1]]
    ]);
    const parameterWrites = [];
    const expressionCalls = [];
    const motionCalls = [];
    let messageHandler = null;
    let frameId = 0;

    const coreModel = {
        setParameterValueById(id, value) {
            parameterValues.set(id, value);
            parameterWrites.push([id, value]);
        },
        getParameterIds() {
            return Array.from(parameterValues.keys());
        },
        getParameterValueById(id) {
            return parameterValues.get(id) ?? 0;
        },
        getParameterMinimumValueById(id) {
            return parameterRanges.get(id)?.[0] ?? -1;
        },
        getParameterMaximumValueById(id) {
            return parameterRanges.get(id)?.[1] ?? 1;
        },
        getDrawableIds() {
            return [];
        }
    };

    const live2dModel = {
        internalModel: {
            coreModel,
            originalHeight: 1000,
            originalWidth: 1400,
            focusController: {},
            getHitAreaDefs() {
                return [];
            }
        },
        height: 1000,
        scale: {
            y: 1,
            set(value) {
                this.y = value;
            }
        },
        position: {
            set(x, y) {
                this.x = x;
                this.y = y;
            }
        },
        anchor: {
            set(x, y) {
                this.x = x;
                this.y = y;
            }
        },
        interactive: false,
        expression(id) {
            expressionCalls.push(id);
        },
        motion(group, index, priority) {
            motionCalls.push({ group, index, priority });
        },
        focus() {
        },
        hitTest() {
            return [];
        }
    };

    const elements = new Map();
    const documentBody = createElement("BODY");
    const context = {
        console: {
            log() {
            },
            error() {
            }
        },
        document: {
            body: documentBody,
            documentElement: {
                style: {
                    setProperty() {
                    }
                }
            },
            getElementById(id) {
                if (!elements.has(id)) {
                    elements.set(id, createElement(id === "canvas" ? "CANVAS" : "DIV"));
                }
                return elements.get(id);
            },
            createElement(tagName) {
                return createElement(tagName.toUpperCase());
            }
        },
        window: {
            innerHeight: 540,
            innerWidth: 960,
            addEventListener() {
            },
            chrome: {
                webview: {
                    addEventListener(type, handler) {
                        if (type === "message") {
                            messageHandler = handler;
                        }
                    },
                    postMessage(data) {
                        messages.push(data);
                    }
                }
            }
        },
        PIXI: {
            Application: class {
                constructor() {
                    this.stage = {
                        addChild() {
                        },
                        removeChild() {
                        }
                    };
                }
            },
            live2d: {
                MotionPriority: {
                    FORCE: 3
                },
                Live2DModel: {
                    async from() {
                        return live2dModel;
                    }
                }
            }
        },
        Date,
        Math,
        Set,
        Map,
        Object,
        JSON,
        requestAnimationFrame(callback) {
            frameId += 1;
            animationFrames.push({ id: frameId, callback });
            return frameId;
        },
        cancelAnimationFrame(id) {
            const index = animationFrames.findIndex(frame => frame.id === id);
            if (index >= 0) {
                animationFrames.splice(index, 1);
            }
        }
    };

    context.window.requestAnimationFrame = context.requestAnimationFrame;
    context.window.cancelAnimationFrame = context.cancelAnimationFrame;

    vm.runInNewContext(fs.readFileSync(petScriptPath, "utf8"), context, {
        filename: petScriptPath
    });

    async function send(data) {
        assert.equal(typeof messageHandler, "function");
        messageHandler({ data });
        await new Promise(resolve => setImmediate(resolve));
    }

    function runNextAnimationFrame() {
        const frame = animationFrames.shift();
        assert.ok(frame, "expected an animation frame to be scheduled");
        frame.callback(Date.now());
    }

    return {
        messages,
        elements,
        documentBody,
        live2dModel,
        expressionCalls,
        motionCalls,
        parameterValues,
        parameterWrites,
        animationFrames,
        send,
        runNextAnimationFrame
    };
}

test("pet.js applies single and batched Live2D parameters", async () => {
    const pet = createPetHarness();

    await pet.send({ type: "load", url: "model.model3.json" });
    await pet.send({ type: "param", id: "ParamAngleX", value: 15 });
    await pet.send({
        type: "params",
        params: {
            ParamAngleY: -8,
            ParamEyeLOpen: 0.5
        }
    });

    assert.equal(pet.parameterValues.get("ParamAngleX"), 15);
    assert.equal(pet.parameterValues.get("ParamAngleY"), -8);
    assert.equal(pet.parameterValues.get("ParamEyeLOpen"), 0.5);
});

test("pet.js clamps lip sync and reports parameter metadata", async () => {
    const pet = createPetHarness();

    await pet.send({ type: "load", url: "model.model3.json" });
    await pet.send({ type: "lip-sync", value: 2 });
    await pet.send({ type: "get-params" });

    assert.equal(pet.parameterValues.get("ParamMouthOpenY"), 1);
    assert.deepEqual(
        JSON.parse(JSON.stringify(pet.messages.find(message => message.type === "params-list")?.params.ParamAngleX)),
        { value: 0, min: -30, max: 30 });
});

test("pet.js starts and stops the idle animation loop", async () => {
    const pet = createPetHarness();

    await pet.send({ type: "load", url: "model.model3.json" });
    assert.ok(pet.animationFrames.length > 0);

    pet.runNextAnimationFrame();
    assert.ok(pet.parameterWrites.some(([id]) => id === "ParamBreath"));
    assert.ok(pet.parameterWrites.some(([id]) => id === "ParamAngleZ"));

    await pet.send({ type: "idle-cycle", enabled: false });
    assert.equal(pet.animationFrames.length, 0);
});

test("pet.js keeps the model clear of the preview panel when catalog is shown", async () => {
    const pet = createPetHarness();
    pet.elements.get("preview-panel").offsetWidth = 260;

    await pet.send({ type: "load", url: "model.model3.json" });
    assert.equal(pet.live2dModel.position.x, 480);

    await pet.send({
        type: "catalog",
        expressions: [
            { name: "cry", file: "exp/cry.exp3.json" }
        ],
        motions: []
    });

    assert.equal(pet.live2dModel.position.x, 624);
    assert.ok(pet.live2dModel.scale.y < 0.486);
});

test("pet.js renders preview catalog buttons and invokes expressions and motions", async () => {
    const pet = createPetHarness();

    await pet.send({ type: "load", url: "model.model3.json" });
    await pet.send({
        type: "catalog",
        expressions: [
            { name: "哭哭", file: "exp/哭哭.exp3.json" }
        ],
        motions: [
            { name: "常规", group: "exp", index: 0, file: "exp/常规.motion3.json", loop: true }
        ]
    });

    const expressionList = pet.elements.get("preview-expressions");
    const motionList = pet.elements.get("preview-motions");
    assert.equal(expressionList.children.length, 2);
    assert.equal(motionList.children.length, 1);

    expressionList.children.find(button => button.dataset?.expressionId === "哭哭").onclick();
    motionList.children.find(button => button.dataset?.motionId === "exp/0").onclick();

    assert.deepEqual(pet.expressionCalls, ["哭哭"]);
    assert.deepEqual(pet.motionCalls, [{ group: "exp", index: 0, priority: 3 }]);
});

test("pet.js renders parameter sliders and writes values to the core model", async () => {
    const pet = createPetHarness();

    await pet.send({ type: "load", url: "model.model3.json" });
    await pet.send({ type: "catalog", expressions: [], motions: [] });

    const paramsList = pet.elements.get("preview-params");
    assert.ok(paramsList.children.length >= 3);

    const angleRow = paramsList.children.find(row => row.dataset?.paramId === "ParamAngleX");
    assert.ok(angleRow, "ParamAngleX row should exist");

    const slider = angleRow.children.find(child => child.tagName === "INPUT");
    assert.ok(slider, "ParamAngleX slider should exist");

    slider.value = "12";
    slider.oninput({ target: slider });

    assert.equal(pet.parameterValues.get("ParamAngleX"), 12);
});

test("pet.js renders an expression reset button", async () => {
    const pet = createPetHarness();

    await pet.send({ type: "load", url: "model.model3.json" });
    await pet.send({
        type: "catalog",
        expressions: [{ name: "cry", file: "exp/cry.exp3.json" }],
        motions: []
    });

    const expressionList = pet.elements.get("preview-expressions");
    const resetButton = expressionList.children.find(button => button.dataset?.expressionId === "");
    assert.ok(resetButton, "reset expression button should exist");

    resetButton.onclick();

    assert.deepEqual(pet.expressionCalls, [null]);
});

test("pet.js supports preview view scale reset", async () => {
    const pet = createPetHarness();

    await pet.send({ type: "load", url: "model.model3.json" });
    await pet.send({ type: "catalog", expressions: [], motions: [] });

    const scaleInput = pet.elements.get("preview-scale");
    const resetButton = pet.elements.get("preview-reset-view");
    assert.ok(scaleInput, "scale input should exist");
    assert.ok(resetButton, "reset view button should exist");

    scaleInput.value = "0.5";
    scaleInput.oninput({ target: scaleInput });
    assert.ok(pet.live2dModel.scale.y < 0.3);

    resetButton.onclick();
    assert.ok(pet.live2dModel.scale.y > 0.3);
});

test("pet.js toggles checkerboard preview background", async () => {
    const pet = createPetHarness();

    await pet.send({ type: "load", url: "model.model3.json" });
    await pet.send({ type: "catalog", expressions: [], motions: [] });

    const backgroundToggle = pet.elements.get("preview-bg-toggle");
    assert.ok(backgroundToggle, "background toggle should exist");

    backgroundToggle.onclick();
    assert.equal(pet.documentBody.classList.contains("checkerboard"), true);

    backgroundToggle.onclick();
    assert.equal(pet.documentBody.classList.contains("checkerboard"), false);
});

test("pet.js displays renderer diagnostics", async () => {
    const pet = createPetHarness();

    await pet.send({ type: "load", url: "model.model3.json" });
    await pet.send({ type: "catalog", expressions: [], motions: [] });
    await pet.send({ type: "diagnostic", level: "warning", message: "Missing texture_99.png" });

    const diagnostics = pet.elements.get("preview-diagnostics");
    assert.equal(diagnostics.children.length, 1);
    assert.equal(diagnostics.children[0].innerText, "warning: Missing texture_99.png");
});
