/*
 * Custom Midi Controller
 *
*/

import { setButtonLED, setLED, clearAllLEDs } from '/data/UserData/move-anything/shared/input_filter.mjs';
import { MoveBack, MoveMenu, MovePlay, MoveRec, MoveCapture, MoveRecord, MoveLoop, MoveMute, MoveDelete,
         MoveCopy, MoveUndo, MoveShift,MoveUp, MoveDown, MoveLeft, MoveRight, MoveMainKnob, MoveMainButton,
         MoveRow1, MoveRow2, MoveRow3, MoveRow4, MoveKnob1, MoveKnob2, MoveKnob3, MoveKnob4,
         MoveKnob5, MoveKnob6, MoveKnob7, MoveKnob8, MoveMaster, MoveCCButtons,
         White, Black, BrightRed, BrightGreen, OrangeRed, Cyan, DarkGrey, WhiteLedDim, WhiteLedBright,
         colourNames, MovePads, midiNotes} from '/data/UserData/move-anything/shared/constants.mjs';
import { drawMenuHeader, showOverlay, tickOverlay, drawOverlay,
         dismissOverlayOnInput } from '/data/UserData/move-anything/shared/menu_layout.mjs';
import { createTextScroller } from '/data/UserData/move-anything/shared/text_scroll.mjs';
import { createValue, createToggle } from '/data/UserData/move-anything/shared/menu_items.mjs';
import { createMenuState, handleMenuInput } from '/data/UserData/move-anything/shared/menu_nav.mjs';
import { createMenuStack } from '/data/UserData/move-anything/shared/menu_stack.mjs';
import { drawStackMenu } from '/data/UserData/move-anything/shared/menu_render.mjs';
import { openTextEntry, isTextEntryActive, handleTextEntryMidi, drawTextEntry,
         tickTextEntry } from '/data/UserData/move-anything/shared/text_entry.mjs';

/* ============================================================================
 * Constants
 * ============================================================================ */

const SCREEN_WIDTH = 128;
const SCREEN_HEIGHT = 64;

const NUM_PADS = 32;
const NUM_KNOBS = 9;
const NUM_BANKS = 16;

/* MIDI CCs */
const CC_JOG = MoveMainKnob;
const CC_JOG_CLICK = MoveMainButton;
const CC_BACK = MoveBack;
const CC_MENU = MoveMenu;
const CC_PLAY = MovePlay;
const CC_REC = MoveRec;
const CC_CAPTURE = MoveCapture;
const CC_RECORD = MoveRecord;
const CC_SHIFT = MoveShift;
const CC_UP = MoveUp;
const CC_DOWN = MoveDown;
const CC_LEFT = MoveLeft;
const CC_RIGHT = MoveRight;
const CC_MUTE = MoveMute;
const CC_COPY = MoveCopy;

const ALL_KNOBS = [MoveKnob1, MoveKnob2, MoveKnob3, MoveKnob4, MoveKnob5, MoveKnob6, MoveKnob7, MoveKnob8, MoveMaster];
const ALL_BUTTONS = [MovePlay, MoveRec, MoveCapture, MoveRecord, MoveLoop, MoveMute, MoveDelete, MoveCopy, MoveUndo, MoveUp, MoveLeft, MoveRight, MoveDown];
const WHITE_BUTTONS = [MoveCapture, MoveLoop, MoveMute, MoveDelete, MoveCopy, MoveUndo, MoveUp, MoveLeft, MoveRight, MoveDown];
const BUTTON_NAMES = ["Play", "Rec", "Capture", "Record", "Loop", "Mute", "Delete", "Copy", "Undo", "Up", "Left", "Right", "Down"];

/* Default values */
const DEFAULTS = {
    PAD: {
        NOTE_OFFSET: 36,
        LEVEL: 100,
        COLOUR: Black,
        CHOKEGRP: 0,
        NAME: "(empty)"
    },
    KNOB: {
        VALUE: 0,
        CC_OFFSET: 71,
        MIN: 0,
        MAX: 127,
        RELATIVE: 0,
        COLOUR: Black,
        NAME: "(empty)"
    },
    BUTTON: {
        COLOUR: Black
    },
    BANK: {
        CHANNEL: 1,
        LEVEL: 100,
        SHADOW: 1,
        NOTEOFFS: 1,
        OVERLAY: 1,
        NAME: "(empty)"
    }
};

/* ============================================================================
 * State
 * ============================================================================ */

/* View modes */
const VIEW_MAIN = "main";
const VIEW_SETTINGS = "settings";
let viewMode = VIEW_MAIN;

/* Settings menu state (using shared menu components) */
let settingsMenuState = null;
let settingsMenuStack = null;

/*    */
const CONFIG_LOCATION = "/data/UserData/move-anything/modules/other/control/config.json";
let config = {};
let banks = new Array(NUM_BANKS);
let selected = 3;  /* 0 = pad, 1 = knob, 2 = button, 3 = bank */
let selectedPad = -1;
let selectedKnob = -1;
let selectedButton = -1;
let selectedBank = 0;
let chokes = [];
let cable = 2;

/* UI state */
let shiftHeld = false;
let needsRedraw = true;
let tickCount = 0;
let maxChars = 10;
const REDRAW_INTERVAL = 6;

/* Text scroller for selected track's patch name */
const nameScroller = createTextScroller();

/* Colour sweeps */
const cachedKnobColour = {};
const neutralColourSweep = [0, 124, 123, 120];
const rainbowColourSweep = [33, 16, 15, 14, 11, 8, 3, 2];
const synthwaveColourSweep = [104, 105, 20, 21, 23, 26, 25];
const roseColourSweep = [124, 35, 23, 26, 25];
const colourSweeps = [neutralColourSweep, rainbowColourSweep, synthwaveColourSweep, roseColourSweep];

/* ============================================================================
 * Helpers
 * ============================================================================ */

/* Create on-demand bank with defaults */
function getBank(index) {
    if (!config[index]) config[index] = {};

    const bank = {
        get channel() { return config[index].channel ?? DEFAULTS.BANK.CHANNEL; },
        set channel(v) { config[index].channel = v; },
        get name() { return config[index].name ?? DEFAULTS.BANK.NAME; },
        set name(v) { config[index].name = v; },
        get level() { return config[index].level ?? DEFAULTS.BANK.LEVEL; },
        set level(v) { config[index].level = v; },
        get shadow() { return config[index].shadow ?? DEFAULTS.BANK.SHADOW; },
        set shadow(v) { config[index].shadow = v; },
        get noteoffs() { return config[index].noteoffs ?? DEFAULTS.BANK.NOTEOFFS; },
        set noteoffs(v) { config[index].noteoffs = v; },
        get overlay() { return config[index].overlay ?? DEFAULTS.BANK.OVERLAY; },
        set overlay(v) { config[index].overlay = v; },
        pads: getPads(index),
        knobs: getKnobs(index),
        buttons: getButtons(index)
    };

    return bank;
}

function getPads(bankIndex) {
    if (!config[bankIndex].pads) config[bankIndex].pads = {};

    /* Helper to ensure pad exists */
    const ensurePad = (i) => {
        if (!config[bankIndex].pads[i]) config[bankIndex].pads[i] = {};
        return config[bankIndex].pads[i];
    };

    return new Array(NUM_PADS).fill(0).map((_, i) => ({
        get note() { return config[bankIndex].pads[i]?.note ?? (i + DEFAULTS.PAD.NOTE_OFFSET); },
        set note(v) { ensurePad(i).note = v; },
        get name() { return config[bankIndex].pads[i]?.name ?? DEFAULTS.PAD.NAME; },
        set name(v) { ensurePad(i).name = v; },
        get colour() { return config[bankIndex].pads[i]?.colour ?? DEFAULTS.PAD.COLOUR; },
        set colour(v) { ensurePad(i).colour = v; },
        get level() { return config[bankIndex].pads[i]?.level ?? DEFAULTS.PAD.LEVEL; },
        set level(v) { ensurePad(i).level = v; },
        get chokegrp() { return config[bankIndex].pads[i]?.chokegrp ?? DEFAULTS.PAD.CHOKEGRP; },
        set chokegrp(v) { ensurePad(i).chokegrp = v; }
    }));
}

function getKnobs(bankIndex) {
    if (!config[bankIndex].knobs) config[bankIndex].knobs = {};

    /* Helper to ensure knob exists */
    const ensureKnob = (i) => {
        if (!config[bankIndex].knobs[i]) config[bankIndex].knobs[i] = {};
        return config[bankIndex].knobs[i];
    };

    return new Array(NUM_KNOBS).fill(0).map((_, i) => ({
        get value() { return config[bankIndex].knobs[i]?.value ?? DEFAULTS.KNOB.VALUE; },
        set value(v) { ensureKnob(i).value = v; },
        get cc() { return config[bankIndex].knobs[i]?.cc ?? (i + DEFAULTS.KNOB.CC_OFFSET); },
        set cc(v) { ensureKnob(i).cc = v; },
        get name() { return config[bankIndex].knobs[i]?.name ?? DEFAULTS.KNOB.NAME; },
        set name(v) { ensureKnob(i).name = v; },
        get colour() { return config[bankIndex].knobs[i]?.colour ?? DEFAULTS.KNOB.COLOUR; },
        set colour(v) { ensureKnob(i).colour = v; },
        get min() { return config[bankIndex].knobs[i]?.min ?? DEFAULTS.KNOB.MIN; },
        set min(v) { ensureKnob(i).min = v; },
        get max() { return config[bankIndex].knobs[i]?.max ?? DEFAULTS.KNOB.MAX; },
        set max(v) { ensureKnob(i).max = v; },
        get relative() { return config[bankIndex].knobs[i]?.relative ?? DEFAULTS.KNOB.RELATIVE; },
        set relative(v) { ensureKnob(i).relative = v; }
    }));
}

function getButtons(bankIndex) {
    if (!config[bankIndex].buttons) config[bankIndex].buttons = {};

    /* Helper to ensure button exists */
    const ensureButton = (i) => {
        if (!config[bankIndex].buttons[i]) config[bankIndex].buttons[i] = {};
        return config[bankIndex].buttons[i];
    };

    return new Array(ALL_BUTTONS.length).fill(0).map((_, i) => ({
        get orig_cc() { return config[bankIndex].buttons[i]?.orig_cc ?? ALL_BUTTONS[i]; },
        set orig_cc(v) { ensureButton(i).orig_cc = v; },
        get cc() { return config[bankIndex].buttons[i]?.cc ?? ALL_BUTTONS[i]; },
        set cc(v) { ensureButton(i).cc = v; },
        get name() { return config[bankIndex].buttons[i]?.name ?? BUTTON_NAMES[i]; },
        set name(v) { ensureButton(i).name = v; },
        get colour() { return config[bankIndex].buttons[i]?.colour ?? DEFAULTS.BUTTON.COLOUR; },
        set colour(v) { ensureButton(i).colour = v; }
    }));
}

function defaultConfig() {
    /* No longer creates full config - just ensures banks array is populated with getters */
    for (let i = 0; i < NUM_BANKS; i++) {
        banks[i] = getBank(i);
    }
}

function loadConfig() {
    if (host_file_exists(CONFIG_LOCATION)) {
        config = JSON.parse(host_read_file(CONFIG_LOCATION));
        console.log("Loaded config");
    } else {
        config = {};
        console.log("Starting with empty config");
    }
    defaultConfig();
    return banks;
}

function saveConfig() {
    console.log("Save Config File");
    host_write_file(CONFIG_LOCATION, JSON.stringify(config));
}

/* Query knob mapping info and show overlay */
function showKnobOverlay(knobNum, val = "") {
    const name = banks[selectedBank].knobs[knobNum].name;
    const cc = banks[selectedBank].knobs[knobNum].cc;

    let value = val;
    if (banks[selectedBank].knobs[knobNum].relative) {
        if (val === 127) value = "---";
        if (val === 1) value = "+++";
    } else {
        value = banks[selectedBank].knobs[knobNum].value;
    }

    const displayName = (name !== DEFAULTS.KNOB.NAME) ? name : `Knob ${knobNum + 1}`;
    showOverlay(displayName, `${value} CC: ${cc} `);
    return true;
}

/* Query button mapping info and show overlay */
function showButtonOverlay(buttonNum, val = "") {
    const name = banks[selectedBank].buttons[buttonNum].name;
    const cc = banks[selectedBank].buttons[buttonNum].cc;
    let value = val;
    if (val === 127) value = "On";
    if (val === 0) value = "Off";
    const displayName = (name !== BUTTON_NAMES[buttonNum]) ? name : BUTTON_NAMES[buttonNum];
    showOverlay(displayName, `${value} CC: ${cc}`);
    return true;
}

/* Query pad mapping info and show overlay */
function showPadOverlay(padNum, vel) {
    let name = banks[selectedBank].pads[padNum].name;
    const note = banks[selectedBank].pads[padNum].note;
    const noteInfo = `Note: ${midiNotes[note]} (${note})`;
    const displayName = (name !== DEFAULTS.PAD.NAME) ? name : noteInfo;
    showOverlay(displayName, `${vel} Pad: ${padNum + 1}`);
    return true;
}

/* Query step mapping info and show overlay */
function showStepOverlay(stepNum) {
    let name = banks[stepNum].name;
    const displayName = (name !== DEFAULTS.BANK.NAME) ? name : `Bank ${stepNum + 1}`;
    showOverlay("Bank changed", displayName);
    return true;
}

export function clamp(value, min, max) {
    if (value > max) return max;
    if (value < min) return min;
    return value;
}

function getColourForKnobValue(colour = 0, value = 0) {
    let colourSweep = colourSweeps[colour];
    const level = clamp(value, 0, 127) / 127;
    const index = Math.round(level * (colourSweep.length - 1));
    return colourSweep[index];
}

/* ============================================================================
 * LED Control
 * ============================================================================ */

/* Stop the pulsing LED on the current selection */
function stopPulse() {
    if (selected === 0 && selectedPad >= 0) {
        move_midi_internal_send([0 << 4 | ((0x90) / 16), (0x90), selectedPad+68, banks[selectedBank].pads[selectedPad].colour]);
    } else if (selected === 1 && selectedKnob >= 0) {
        move_midi_internal_send([0 << 4 | ((0xB0) / 16), (0xB0), selectedKnob+71, getColourForKnobValue(banks[selectedBank].knobs[selectedKnob].colour, banks[selectedBank].knobs[selectedKnob].value)]);
    } else if (selected === 2 && selectedButton >= 0) {
        move_midi_internal_send([0 << 4 | ((0xB0) / 16), (0xB0), ALL_BUTTONS[selectedButton], banks[selectedBank].buttons[selectedButton].colour]);
    } else if (selected === 3) {
        move_midi_internal_send([0 << 4 | ((0x90) / 16), (0x90), selectedBank+16, White]);
    }
}

/* Transfer pulse from current selection to new one (2 MIDI messages vs 70+) */
function transferPulse(newType, newIndex) {
    stopPulse();

    /* Start new pulse */
    if (newType === 0 && newIndex >= 0) {
        move_midi_internal_send([0 << 4 | ((0x90+0x09) / 16), (0x90+0x09), newIndex+68, White]);
    } else if (newType === 1 && newIndex >= 0) {
        move_midi_internal_send([0 << 4 | ((0xB0+0x09) / 16), (0xB0+0x09), newIndex+71, White]);
    } else if (newType === 2 && newIndex >= 0) {
        move_midi_internal_send([0 << 4 | ((0xB0+0x09) / 16), (0xB0+0x09), ALL_BUTTONS[newIndex], White]);
    } else if (newType === 3 && newIndex >= 0) {
        move_midi_internal_send([0 << 4 | ((0x90+0x09) / 16), (0x90+0x09), newIndex+16, Black]);
    }
}

function updateLEDs() {
    /* Pad LEDs  */
    let pads = banks[selectedBank].pads;
    for (let i = 0; i < NUM_PADS; i++) {
        let colour = Black;
        if (pads[i].colour) colour = pads[i].colour;
        setLED(i + 68, colour);
    }

    /* Knob LEDs  */
    let knobs = banks[selectedBank].knobs;
    for (let i = 0; i < NUM_KNOBS; i++) {
        let colour = Black;
        if (knobs[i].value) colour = getColourForKnobValue(knobs[i].colour, knobs[i].value);
        setButtonLED(i + 71, colour);
    }

    /* Button LEDs  */
    let buttons = banks[selectedBank].buttons;
    for (let i = 0; i < ALL_BUTTONS.length; i++) {
        let buttonCC = ALL_BUTTONS[i];
        let colour = Black;
        if (buttons[i].colour) colour = buttons[i].colour;
        setButtonLED(buttonCC, colour);
    }

    /* Bank LEDs  */
    for (let i = 0; i < NUM_BANKS; i++) {
        let colour = DarkGrey;
        if (i === selectedBank) colour = White;
        setLED(i + 16, colour);
    }

    /* Navigation buttons */
    setButtonLED(CC_MENU, WhiteLedBright);
    setButtonLED(CC_BACK, WhiteLedBright);
}

/* ============================================================================
 * Drawing
 * ============================================================================ */

function drawMainView() {
    clear_screen();

    /* Header */
    drawMenuHeader("Custom MIDI Control");

    /* Draw overlay if active */
    drawOverlay();
}

/* Build settings menu items using shared menu item creators */
function getSettingsItems() {
    if (selected === 0) {  // pad config
        return [
            createValue('Note', {
                get: () => banks[selectedBank].pads[selectedPad].note || 0,
                set: (v) => { banks[selectedBank].pads[selectedPad].note = v; },
                min: 0,
                max: 127,
                step: 1,
                format: (v) => `${midiNotes[v]} (${v})`
            }),
            createValue('Name', {
                get: () => banks[selectedBank].pads[selectedPad].name || "(empty)",
                set: (v) => { needsRedraw = true; }
            }),
            createValue('Colour', {
                get: () => banks[selectedBank].pads[selectedPad].colour || 0,
                set: (v) => { banks[selectedBank].pads[selectedPad].colour = v; },
                min: 0,
                max: 127,
                step: 1,
                format: (v) => `${nameScroller.getScrolledText(colourNames[v], maxChars)}`
            }),
            createValue('Pad Level', {
                get: () => banks[selectedBank].pads[selectedPad].level || 100,
                set: (v) => { banks[selectedBank].pads[selectedPad].level = v; },
                min: 0,
                max: 200,
                step: 1,
                format: (v) => `${v}%`
            }),
            createValue('Choke Grp', {
                get: () => banks[selectedBank].pads[selectedPad].chokegrp || 0,
                set: (v) => { banks[selectedBank].pads[selectedPad].chokegrp = v; },
                min: 0,
                max: 8,
                step: 1,
                format: (v) => `${v}`
            }),
        ];
    } else if (selected === 1) {  // knob config
        return [
            createValue('CC', {
                get: () => banks[selectedBank].knobs[selectedKnob].cc || 0,
                set: (v) => { banks[selectedBank].knobs[selectedKnob].cc = v; } ,
                min: 0,
                max: 127,
                step: 1
            }),
            createValue('Name', {
                get: () => banks[selectedBank].knobs[selectedKnob].name || "(empty)",
                set: (v) => { needsRedraw = true; }
            }),
            createValue('Colour', {
                get: () => banks[selectedBank].knobs[selectedKnob].colour || 0,
                set: (v) => { banks[selectedBank].knobs[selectedKnob].colour = v; },
                min: 0,
                max: colourSweeps.length - 1,
                step: 1,
                format: (v) => `Col${v}`
            }),
            createValue('Min Value', {
                get: () => banks[selectedBank].knobs[selectedKnob].min || 0,
                set: (v) => { banks[selectedBank].knobs[selectedKnob].min = v; },
                min: 0,
                max: 127,
                step: 1
            }),
            createValue('Max Value', {
                get: () => banks[selectedBank].knobs[selectedKnob].max || 127,
                set: (v) => { banks[selectedBank].knobs[selectedKnob].max = v; },
                min: 0,
                max: 127,
                step: 1
            }),
            createToggle('CC Relative', {
                get: () => banks[selectedBank].knobs[selectedKnob].relative ?? 0,
                set: (v) => {
                    banks[selectedBank].knobs[selectedKnob].relative = v ? 1 : 0;
                    banks[selectedBank].knobs[selectedKnob].value = v ? -1 : 0;
                }
            })
        ];
    } else if (selected === 2) {  // button config
        return [
            createValue('CC', {
                get: () => banks[selectedBank].buttons[selectedButton].cc || 0,
                set: (v) => { banks[selectedBank].buttons[selectedButton].cc = v; } ,
                min: 0,
                max: 127,
                step: 1
            }),
            createValue('Name', {
                get: () => banks[selectedBank].buttons[selectedButton].name || "(empty)",
                set: (v) => { needsRedraw = true; }
            }),
            createValue('Colour', {
                get: () => banks[selectedBank].buttons[selectedButton].colour || 0,
                set: (v) => { banks[selectedBank].buttons[selectedButton].colour = v; },
                min: 0,
                max: 127,
                step: 10,
                // format: (v) => `${nameScroller.getScrolledText(colourNames[v], maxChars)}`
            })
        ];
    } else {  // bank config
        return [
            createValue('MIDI Chan', {
                get: () => banks[selectedBank].channel || 1,
                set: (v) => { banks[selectedBank].channel = v; },
                min: 1,
                max: 16,
                step: 1
            }),
            createValue('Name', {
                get: () => banks[selectedBank].name || "(empty)",
                set: (v) => { needsRedraw = true; }
            }),
            createValue('Master Pad Level', {
                get: () => banks[selectedBank].level || 100,
                set: (v) => { banks[selectedBank].level = v; },
                min: 0,
                max: 200,
                step: 1,
                format: (v) => `${v}%`
            }),
            createToggle('Use Shadow Synths', {
                get: () => banks[selectedBank].shadow ?? 0,
                set: (v) => { banks[selectedBank].shadow = v ? 1 : 0; }
            }),
            createToggle('Note Offs', {
                get: () => banks[selectedBank].noteoffs ?? 1,
                set: (v) => { banks[selectedBank].noteoffs = v ? 1 : 0; }
            }),
            createToggle('Show Overlay', {
                get: () => banks[selectedBank].overlay ?? 1,
                set: (v) => { banks[selectedBank].overlay = v ? 1 : 0; }
            })
        ];
    }
}

/* Initialize settings menu */
function initSettingsMenu() {
    settingsMenuState = createMenuState();
    settingsMenuStack = createMenuStack();
    settingsMenuStack.push({
        title: 'Settings',
        items: getSettingsItems(),
        selectedIndex: 0
    });
}

function getSelectedLabel() {
    if (selected === 0) return `Pad ${selectedPad + 1}`;
    if (selected === 1) return `Knob ${selectedKnob + 1}`;
    if (selected === 2) return `Button ${selectedButton + 1}`;
    return `Bank ${selectedBank + 1}`;
}

function drawSettingsView() {
    clear_screen();

    if (!settingsMenuStack || settingsMenuStack.depth() === 0) {
        initSettingsMenu();
    }

    /* Update current entry in place — never push during draw */
    const top = settingsMenuStack.current();
    if (top) {
        top.title = `Settings - ${getSelectedLabel()}`;
        top.items = getSettingsItems();
    }

    const footer = settingsMenuState.editing ? 'Jog:Change Clk:Save' : 'Jog:Scroll Clk:Edit';

    drawStackMenu({
        stack: settingsMenuStack,
        state: settingsMenuState,
        footer
    });
}

function draw() {
    switch (viewMode) {
        case VIEW_MAIN:
            drawMainView();
            break;
        case VIEW_SETTINGS:
            drawSettingsView();
            break;
    }
}

/* ============================================================================
 * MIDI Handling
 * ============================================================================ */

function handleCC(cc, val) {
    let channel = banks[selectedBank].channel - 1;

    /* Shift state */
    if (cc === CC_SHIFT) {
        shiftHeld = val > 63;
        needsRedraw = true;
        return;
    }

    /* Navigation */
    if (cc === CC_BACK && val > 63) {
        if (viewMode === VIEW_SETTINGS) {
            /* Let shared menu handle back (cancel edit or exit) */
            if (settingsMenuState && settingsMenuState.editing) {
                /* Cancel edit mode */
                settingsMenuState.editing = false;
                settingsMenuState.editValue = null;
                needsRedraw = true;
                return;
            }
            /* Exit settings */
            if (selected === 3) {
                stopPulse();
                viewMode = VIEW_MAIN;
                saveConfig();
                settingsMenuStack = null;  /* Reset for next time */
            } else {
                stopPulse();
                selected = 3;
                selectedKnob = -1;
                selectedPad = -1;
                selectedButton = -1;
                settingsMenuStack.setSelectedIndex(0);
            }
        } else if (viewMode !== VIEW_MAIN) {
            stopPulse();
            viewMode = VIEW_MAIN;
            saveConfig();
            settingsMenuStack = null;  /* Reset for next time */
        } else {
            saveConfig();
            host_return_to_menu();
        }
        needsRedraw = true;
        return;
    }

    if (cc === CC_MENU && val > 63) {
        /* Toggle between main and settings */
        if (viewMode === VIEW_SETTINGS) {
            stopPulse();
            viewMode = VIEW_MAIN;
            saveConfig();
            settingsMenuStack = null;  /* Reset for next time */
        } else {
            viewMode = VIEW_SETTINGS;
            selected = 3;
            selectedButton = -1;
            selectedKnob = -1;
            selectedPad = -1;
            transferPulse(3, selectedBank);
        }
        needsRedraw = true;
        return;
    }

    /* Buttons send midi */
    for (let i = 0; i < ALL_BUTTONS.length; i++) {
        if (cc === ALL_BUTTONS[i]) {
            if (viewMode === VIEW_SETTINGS && selectedButton != i) {
                settingsMenuState.editing = false;
                transferPulse(2, i);
            }
            selected = 2;
            selectedButton = i;
            selectedKnob = -1;
            selectedPad = -1;

            let ccOut = banks[selectedBank].buttons[i].cc;
            if (banks[selectedBank].shadow) {
                try {
                    shadow_send_midi_to_dsp([0xB0 | channel, ccOut, val]);
                } catch {
                    console.log("Shadow mode MIDI playback not available.");
                }
            } else {
                move_midi_external_send([cable << 4 | (0xB0 / 16), 0xB0 | channel, ccOut, val]);
            }

            /* Query the button mapping info and show overlay */
            if (viewMode === VIEW_MAIN && banks[selectedBank].overlay) {
                if (showButtonOverlay(selectedButton, val)) needsRedraw = true;
            }
            return;
        }
    }

    /* Knobs send midi */
    for (let i = 0; i < ALL_KNOBS.length; i++) {
        if (shiftHeld) {
            return;
        }
        if (cc === ALL_KNOBS[i]) {
            if (viewMode === VIEW_SETTINGS && selectedKnob != i) {
                settingsMenuState.editing = false;
                transferPulse(1, i);
            }
            selected = 1;
            selectedKnob = i;
            selectedPad = -1;
            selectedButton = -1;

            let ccOut = banks[selectedBank].knobs[i].cc;
            let minOut = banks[selectedBank].knobs[i].min;
            let maxOut = banks[selectedBank].knobs[i].max;
            let valOut = val;
            if (!banks[selectedBank].knobs[selectedKnob].relative) {
                valOut = banks[selectedBank].knobs[i].value;
                if (val === 127) {
                    valOut -=1;
                } else if (val === 1) {
                    valOut +=1;
                }
                if (valOut < minOut) valOut = minOut;
                if (valOut > maxOut) valOut = maxOut;
                banks[selectedBank].knobs[i].value = valOut;
            }
            if (banks[selectedBank].shadow) {
                try {
                    shadow_send_midi_to_dsp([0xB0 | channel, ccOut, valOut]);
                } catch {
                    console.log("Shadow mode MIDI playback not available.");
                }
            } else {
                move_midi_external_send([cable << 4 | (0xB0 / 16), 0xB0 | channel, ccOut, valOut]);
            }

            if (viewMode === VIEW_MAIN) {
                let knobs = banks[selectedBank].knobs;
                let colour = getColourForKnobValue(knobs[i].colour, valOut);
                if (cachedKnobColour[selectedKnob] === colour) return;
                setButtonLED(i + 71, colour);
                cachedKnobColour[selectedButton] = colour;

                if (banks[selectedBank].overlay) {
                    if (showKnobOverlay(selectedKnob, valOut)) needsRedraw = true;
                }
            }
            return;
        }
    }

    /* Settings view - delegate to shared menu components */
    if (viewMode === VIEW_SETTINGS) {
        if (!settingsMenuStack || settingsMenuStack.depth() === 0) {
            initSettingsMenu();
        }
        const current = settingsMenuStack.current();
        const items = current ? current.items : getSettingsItems();

        const result = handleMenuInput({
            cc,
            value: val,
            items,
            state: settingsMenuState,
            stack: settingsMenuStack,
            shiftHeld
        });

        /* Check if user selected items */
        const item = items[settingsMenuState.selectedIndex];
        if (item && item.label === 'Colour' && settingsMenuState.editing) {
            if (selected === 0) setLED(MovePads[selectedPad], settingsMenuState.editValue);
            if (selected === 1) setButtonLED(ALL_KNOBS[selectedKnob], getColourForKnobValue(settingsMenuState.editValue, banks[selectedBank].knobs[selectedKnob].value));
            if (selected === 2) setButtonLED(ALL_BUTTONS[selectedButton], settingsMenuState.editValue);
            return;
        }
        if (item && item.label === 'Colour' && !settingsMenuState.editing) {
            if (selected === 0) setLED(MovePads[selectedPad], banks[selectedBank].pads[selectedPad].colour);
            if (selected === 1) setButtonLED(ALL_KNOBS[selectedKnob], getColourForKnobValue(banks[selectedBank].knobs[selectedKnob].colour, banks[selectedBank].knobs[selectedKnob].value));
            if (selected === 2) setButtonLED(ALL_BUTTONS[selectedButton], banks[selectedBank].buttons[selectedButton].colour);
            return;
        }
        if (item && item.label === 'Name' && cc === CC_JOG_CLICK && val > 63) {
            let lastEnteredText = "(empty)";
            if (selected === 0) lastEnteredText = banks[selectedBank].pads[selectedPad].name;
            if (selected === 1) lastEnteredText = banks[selectedBank].knobs[selectedKnob].name;
            if (selected === 2) lastEnteredText = banks[selectedBank].buttons[selectedButton].name;
            if (selected === 3) lastEnteredText = banks[selectedBank].name;
            lastEnteredText = lastEnteredText || "(empty)";
            openTextEntry({
                title: "Enter Name",
                initialText: lastEnteredText === "(none)" ? "" : lastEnteredText,
                onConfirm: (text) => {
                    lastEnteredText = text || "(empty)";
                    if (selected === 0) banks[selectedBank].pads[selectedPad].name = text;
                    if (selected === 1) banks[selectedBank].knobs[selectedKnob].name = text;
                    if (selected === 2) banks[selectedBank].buttons[selectedButton].name = text;
                    if (selected === 3) banks[selectedBank].name = text;
                }
            });
            settingsMenuState.editing = false;
            settingsMenuState.editValue = null;
            needsRedraw = true;
            return;
        }

        if (result.needsRedraw) {
            needsRedraw = true;
        }
        return;
    }
}

function handleNote(note, vel) {
    let channel = banks[selectedBank].channel -1;

    if (shiftHeld) {
        return;
    }

    /* Knob touch */
    if (note >= 0 && note <= 8 && vel > 0) {
        if (viewMode === VIEW_MAIN && banks[selectedBank].overlay) showKnobOverlay(note);
        if (viewMode === VIEW_SETTINGS && selectedKnob != note) {
            settingsMenuState.editing = false;
            transferPulse(1, note);
        }
        selectedKnob = note;
        selectedPad = -1;
        selectedButton = -1;
        selected = 1;
        needsRedraw = true;
        return;
    }
    /* Step buttons change bank */
    if (note >= 16 && note <= 31 && vel > 0) {
        const bankIdx = note - 16;
        if (viewMode === VIEW_MAIN) showStepOverlay(bankIdx);
        if (viewMode === VIEW_SETTINGS) {
            settingsMenuState.editing = false;
            transferPulse(3, bankIdx);
        }
        selectedBank = bankIdx;
        selectedKnob = -1;
        selectedPad = -1;
        selectedButton = -1;
        selected = 3;
        chokes = [];
        needsRedraw = true;
        updateLEDs();
        if (viewMode === VIEW_SETTINGS) transferPulse(3, bankIdx);
        return;
    }
    /* Pads press */
    if (note >= 68 && note <= 99 && vel > 0) {
        const padIdx = note - 68;
        if (viewMode === VIEW_SETTINGS && selectedPad != padIdx) {
            settingsMenuState.editing = false;
            transferPulse(0, padIdx);
        }
        selectedKnob = -1;
        selectedButton = -1;
        selectedPad = padIdx;
        selected = 0;
        let noteOut = banks[selectedBank].pads[selectedPad].note;

        /* edit velocity */
        let padLevel = banks[selectedBank].pads[selectedPad].level || 100;
        let masterLevel = banks[selectedBank].level || 100;
        let velOut = Math.round(vel * (padLevel/100) * (masterLevel/100));
        if (velOut > 127) velOut = 127;

        if (viewMode === VIEW_MAIN) setLED(note, White);
        if (viewMode === VIEW_MAIN && banks[selectedBank].overlay) showPadOverlay(padIdx, velOut);
        needsRedraw = true;

        /* choke group handling */
        let padChokeGrp = banks[selectedBank].pads[selectedPad].chokegrp;
        if (padChokeGrp) {
            if (typeof chokes[padChokeGrp] === 'undefined') chokes[padChokeGrp] = -1;
            if (chokes[padChokeGrp] === noteOut) chokes[padChokeGrp] = -1; //remove current pad if exists
        }
        /* send midi */
        if (banks[selectedBank].shadow) {
            try {
                shadow_send_midi_to_dsp([0x90 | channel, noteOut, velOut]);
                if (chokes[padChokeGrp]) {
                    shadow_send_midi_to_dsp([0x80 | channel, chokes[padChokeGrp], 0]);
                    chokes[padChokeGrp] = -1;
                }
            } catch {
                console.log("Shadow mode MIDI playback not available.");
            }
        } else {
            move_midi_external_send([cable << 4 | (0x90 / 16), 0x90 | channel, noteOut, velOut]);
            if (chokes[padChokeGrp]) {
                move_midi_external_send([cable << 4 | (0x80 / 16), 0x80 | channel, chokes[padChokeGrp], 0]);
                chokes[padChokeGrp] = -1;
            }
        }
        if (padChokeGrp) chokes[padChokeGrp] = noteOut;
        return;
    }
    /* Pads release */
    if (note >= 68 && note <= 99 && vel === 0) {
        const padIdx = note - 68;
        needsRedraw = true;
        if (viewMode === VIEW_MAIN) setLED(note, banks[selectedBank].pads[padIdx].colour);

        /* send midi */
        let noteOut = banks[selectedBank].pads[padIdx].note;
        if (banks[selectedBank].noteoffs) {
            if (banks[selectedBank].shadow) {
                try {
                    shadow_send_midi_to_dsp([0x80 | channel, noteOut, vel]);
                } catch {
                    console.log("Shadow mode MIDI playback not available.");
                }
            } else {
                move_midi_external_send([cable << 4 | (0x80 / 16), 0x80 | channel, noteOut, vel]);
            }
        }
        return;
    }
}

function onMidiMessage(msg, source) {
    if (!msg || msg.length < 3) return;

    const status = msg[0] & 0xF0;
    const data1 = msg[1];
    const data2 = msg[2];

    /* Text entry handles its own MIDI when active */
    if (isTextEntryActive()) {
        handleTextEntryMidi(msg);
        return;
    }

    /* Dismiss overlay on user interaction, but NOT for knob turns (they update the overlay)
     * Don't return early - let the input be processed (it may show a new overlay) */
    const isKnobCC = (status === 0xB0 && data1 >= 71 && data1 <= 79);
    if (!isKnobCC) {
        dismissOverlayOnInput(msg);
    }

    if (status === 0xB0) {
        handleCC(data1, data2);
    } else if (status === 0x90 || status === 0x80) {
        const vel = status === 0x80 ? 0 : data2;
        handleNote(data1, vel);
    } else if (status === 0xA0) {
        if (data2 > 18) {  /* ignore light aftertouch */
            let channel = banks[selectedBank].channel;
            if (banks[selectedBank].shadow) {
                try {
                    shadow_send_midi_to_dsp([status | channel, data1, data2]);
                } catch {
                    console.log("Shadow mode MIDI playback not available.");
                }
            } else {
                move_midi_external_send([cable << 4 | (status / 16), status | channel, data1, data2]);
            }
        }
    }
}

function midiIgnore(msg, source) {
    /* ignore external MIDI messages */
    return;
}

    /* ============================================================================
 * Lifecycle
 * ============================================================================ */

function init() {
    /* Clear LEDs first */
    clearAllLEDs();

    /* Initial sync */
    banks = loadConfig();

    /* Initial LED state */
    updateLEDs();

    /* Initial draw */
    draw();
}

function tick() {
    tickCount++;

    /* Handle overlay timeout */
    if (tickOverlay()) {
        needsRedraw = true;
    }

    /* Text entry takes over when active */
    if (isTextEntryActive()) {
        tickTextEntry();
        drawTextEntry();
        return;
    }

    /* Tick the name scroller */
    if (nameScroller.tick()) {
        needsRedraw = true;
    }

    /* Periodic state sync and redraw */
    if (tickCount % REDRAW_INTERVAL === 0) {
        needsRedraw = true;
    }

    if (needsRedraw) {
        draw();
        needsRedraw = false;
    }
}

/* Export module interface */
globalThis.init = init;
globalThis.tick = tick;
globalThis.onMidiMessageInternal = onMidiMessage;
globalThis.onMidiMessageExternal = midiIgnore;
