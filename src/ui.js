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
const ALL_BUTTONS = [MovePlay, MoveRec, MoveCapture, MoveRecord, MoveLoop, MoveMute, MoveDelete, MoveCopy, MoveUndo, MoveShift, MoveUp, MoveLeft, MoveRight, MoveDown];
const WHITE_BUTTONS = [MoveCapture, MoveLoop, MoveMute, MoveDelete, MoveCopy, MoveUndo, MoveShift, MoveUp, MoveLeft, MoveRight, MoveDown];
const BUTTON_NAMES = ["Play", "Rec", "Capture", "Record", "Loop", "Mute", "Delete", "Copy", "Undo", "Shift", "Up", "Left", "Right", "Down"];

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
let banks = [];
let selected = 3;  /* 0 = pad, 1 = knob, 2 = button, 3 = bank */
let selectedPad = -1;
let selectedKnob = -1;
let selectedButton = -1;
let selectedBank = 0;
let highlightPad = false;
let disableLEDUpdate = false;

/* UI state */
let shiftHeld = false;
let needsRedraw = true;
let tickCount = 0;
let maxChars = 10;
let showOverlays = true;
const REDRAW_INTERVAL = 6;

/* Text scroller for selected track's patch name */
const nameScroller = createTextScroller();

/* Colour sweeps */
const neutralColorSweep = [0, 124, 123, 120];
const rainbowColorSweep = [33, 16, 15, 14, 11, 8, 3, 2];
const synthwaveColorSweep = [104, 105, 20, 21, 23, 26, 25];
const roseColorSweep = [124, 35, 23, 26, 25];
const colourSweeps = [neutralColorSweep, rainbowColorSweep, synthwaveColorSweep, roseColorSweep];

/* ============================================================================
 * Helpers
 * ============================================================================ */

function defaultConfig() {
    /* Pad, Knob and Bank state */
    let pads = [];
    for (let p = 0; p < NUM_PADS; p++) {
        pads.push({
            note: p + 36,
            level: 100,
            colour: Black,
            name: "(empty)"
        });
    }

    let knobs = [];
    for (let k = 0; k < NUM_KNOBS; k++) {
        knobs.push({
            value: 0,
            cc: k + 71,
            min: 0,
            max: 127,
            colour: Black,
            name: "(empty)"
        });
    }

    let buttons = [];
    for (let b = 0; b < ALL_BUTTONS.length; b++) {
        buttons.push({
            orig_cc: ALL_BUTTONS[b],
            cc: ALL_BUTTONS[b],
            colour: Black,
            name: BUTTON_NAMES[b]
        });
    }

    let banks = [];
    for (let s = 0; s < NUM_BANKS; s++) {
        banks.push({
            midi_ch: 1,
            name: "(empty)",
            noteoffs: 1,
            level: 100,
            pads: pads,
            knobs: knobs,
            buttons: buttons
        });
    }

    return banks;
}

function loadConfig() {
    if (host_file_exists(CONFIG_LOCATION)) {
        return JSON.parse(host_read_file(CONFIG_LOCATION));
    } else {
        console.log("Empty Config Loaded");
        return defaultConfig();
    }
}

function saveConfig() {
    console.log("Save Config File");
    host_write_file(CONFIG_LOCATION, JSON.stringify(banks));
}

/* Query knob mapping info and show overlay */
function showKnobOverlay(knobNum, val = "") {
    let name = banks[selectedBank].knobs[knobNum].name;
    if (name === "(empty)") name = "";

    let value = val;
    const cc = banks[selectedBank].knobs[knobNum].cc;
    if (banks[selectedBank].knobs[knobNum].relative) {
        if (val === 127) value = "---";
        if (val === 1) value = "+++";
    } else {
        value = banks[selectedBank].knobs[knobNum].value;
    }

    showOverlay(`CC: ${cc} ${name} `, value);
    return true;
}

/* Query button mapping info and show overlay */
function showButtonOverlay(buttonNum) {
    let name = banks[selectedBank].buttons[buttonNum].name;
    if (name === "(empty)") name = "";

    const cc = banks[selectedBank].buttons[buttonNum].cc;

    showOverlay(`CC: ${cc}`, name);
    return true;
}

/* Query pad mapping info and show overlay */
function showPadOverlay(padNum, vel) {
    let name = banks[selectedBank].pads[padNum].name;
    if (name === "(empty)") name = "";

    const note = banks[selectedBank].pads[padNum].note;

    showOverlay(`Note: ${midiNotes[note]} (${note})`, `${vel} ${name}`);
    return true;
}

/* Query step mapping info and show overlay */
function showStepOverlay(stepNum) {
    let name = banks[selectedBank].name;
    if (name === "(empty)") name = "";
    showOverlay(`Bank changed ${name}`, stepNum);
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

function getSafe(prop, defaultVal) {
  return function(fn, defaultVal) {
    try {
      if (fn() === undefined) {
        return defaultVal;
      } else {
        return fn();
      }
    } catch (e) {
      return defaultVal;
    }
  }(function() {return prop;}, defaultVal);
}

/* ============================================================================
 * LED Control
 * ============================================================================ */

function updateLEDs() {
    /* Pad LEDs  */
    let pads = banks[selectedBank].pads;
    for (let i = 0; i < NUM_PADS; i++) {
        let colour = Black;
        if (pads[i].colour) {
            colour = pads[i].colour;
        }
        if (i === selectedPad && highlightPad === true) {
            colour = White;
        }
        setLED(i + 68, colour, true);
        if (i === selectedPad && viewMode === VIEW_SETTINGS) {
            move_midi_internal_send([0 << 4 | (0x90 / 16), 0x90, i+68, colour]);
            move_midi_internal_send([0 << 4 | ((0x90+0x09) / 16), (0x90+0x09), i+68, White]);
        }
    }

    /* Knob LEDs  */
    let knobs = banks[selectedBank].knobs;
    for (let i = 0; i < NUM_KNOBS; i++) {
        let colour = Black;
        if (knobs[i].colour) {
            colour = getColourForKnobValue(knobs[i].colour, knobs[i].value);
        }
        setButtonLED(i + 71, colour, true);
        if (i === selectedKnob && viewMode === VIEW_SETTINGS) {
            move_midi_internal_send([0 << 4 | (0xB0 / 16), 0xB0, i+71, colour]);
            move_midi_internal_send([0 << 4 | ((0xB0+0x09) / 16), (0xB0+0x09), i+71, White]);
        }
    }

    /* Button LEDs  */
    let buttons = banks[selectedBank].buttons;
    for (let i = 0; i < ALL_BUTTONS.length; i++) {
        let buttonCC = ALL_BUTTONS[i];
        let colour = getSafe(buttons[i].colour, Black);
        setButtonLED(buttonCC, colour, true);
        if (i === selectedButton && viewMode === VIEW_SETTINGS) {
            move_midi_internal_send([0 << 4 | (0xB0 / 16), 0xB0, buttonCC, Black]);
            move_midi_internal_send([0 << 4 | ((0xB0+0x09) / 16), (0xB0+0x09), buttonCC, White]);
        }
    }

    /* Bank LEDs  */
    for (let i = 0; i < NUM_BANKS; i++) {
        let colour = DarkGrey;
        if (i === selectedBank) {
            colour = White;
        }
        setLED(i + 16, colour, true);
        if (i === selectedBank && selected === 3 && viewMode === VIEW_SETTINGS) {
            move_midi_internal_send([0 << 4 | (0x90 / 16), 0x90, i+16, Black]);
            move_midi_internal_send([0 << 4 | ((0x90+0x09) / 16), (0x90+0x09), i+16, White]);
        }
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
    if (showOverlays) drawOverlay();
}

/* Build settings menu items using shared menu item creators */
function getSettingsItems() {
    if (selected === 0) {
        return [
            createValue('Note', {
                get: () => banks[selectedBank].pads[selectedPad].note || 0,
                set: (v) => { banks[selectedBank].pads[selectedPad].note = v; },
                min: 0,
                max: 127,
                step: 1,
                format: (v) => `${midiNotes[v]} (${v})`
            }),
            createValue('Pad Level', {
                get: () => banks[selectedBank].pads[selectedPad].level || 100,
                set: (v) => { banks[selectedBank].pads[selectedPad].level = v; },
                min: 0,
                max: 200,
                step: 1,
                format: (v) => `${v}%`
            }),
            createValue('Colour', {
                get: () => banks[selectedBank].pads[selectedPad].colour || 0,
                set: (v) => { banks[selectedBank].pads[selectedPad].colour = v; },
                min: 0,
                max: 127,
                step: 1,
                format: (v) => `${nameScroller.getScrolledText(colourNames[v], maxChars)}`
            }),
            createValue('Name', {
                get: () => banks[selectedBank].pads[selectedPad].name || "(empty)",
                set: (v) => { needsRedraw = true; }
            })
        ];
    } else if (selected === 1){
        return [
            createValue('CC', {
                get: () => banks[selectedBank].knobs[selectedKnob].cc || 0,
                set: (v) => { banks[selectedBank].knobs[selectedKnob].cc = v; } ,
                min: 0,
                max: 127,
                step: 1
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
            createValue('Colour', {
                get: () => banks[selectedBank].knobs[selectedKnob].colour || 0,
                set: (v) => { banks[selectedBank].knobs[selectedKnob].colour = v; },
                min: 0,
                max: colourSweeps.length - 1,
                step: 1,
                format: (v) => `Col${v}`
            }),
            createValue('Name', {
                get: () => banks[selectedBank].knobs[selectedKnob].name || "(empty)",
                set: (v) => { needsRedraw = true; }
            }),
            createToggle('CC Relative', {
                get: () => banks[selectedBank].knobs[selectedKnob].relative ?? 0,
                set: (v) => { banks[selectedBank].knobs[selectedKnob].relative = v ? 1 : 0; }
            })
        ];
    } else if (selected === 2){
        return [
            createValue('CC', {
                get: () => banks[selectedBank].buttons[selectedButton].cc || 0,
                set: (v) => { banks[selectedBank].buttons[selectedButton].cc = v; } ,
                min: 0,
                max: 127,
                step: 1
            }),
            createValue('Colour', {
                get: () => banks[selectedBank].buttons[selectedButton].colour || 0,
                set: (v) => { banks[selectedBank].buttons[selectedButton].colour = v; },
                min: 0,
                max: 127,
                step: 10,
                // format: (v) => `${nameScroller.getScrolledText(colourNames[v], maxChars)}`
            }),
            createValue('Name', {
                get: () => banks[selectedBank].buttons[selectedButton].name || "(empty)",
                set: (v) => { needsRedraw = true; }
            })
        ];
    } else {
        return [
            createValue('Name', {
                get: () => banks[selectedBank].name || "(empty)",
                set: (v) => { needsRedraw = true; }
            }),
            createValue('MIDI Chan', {
                get: () => banks[selectedBank].channel || 1,
                set: (v) => { banks[selectedBank].channel = v; },
                min: 1,
                max: 16,
                step: 1
            }),
            createValue('Master Pad Level', {
                get: () => banks[selectedBank].level || 100,
                set: (v) => { banks[selectedBank].level = v; },
                min: 0,
                max: 200,
                step: 1,
                format: (v) => `${v}%`
            }),
            createToggle('Note Offs', {
                get: () => banks[selectedBank].noteoffs ?? 1,
                set: (v) => { banks[selectedBank].noteoffs = v ? 1 : 0; }
            }),
            createToggle('Show Overlay', {
                get: () => banks[selectedBank].overlay ?? 1,
                set: (v) => { banks[selectedBank].overlay = v ? 1 : 0; showOverlays = v; }
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

function drawSettingsView() {
    clear_screen();

    if (!settingsMenuStack || settingsMenuStack.depth() === 0) {
        initSettingsMenu();
    }

    let current = "(none)";
    if (selected === 0) {
        current = `Pad ${selectedPad + 1}`;
    } else if (selected === 1) {
        current = `Knob ${selectedKnob + 1}`;
    } else if (selected === 2) {
        current = `Button ${selectedButton}`;
    } else {
        current = `Bank ${selectedBank + 1}`;
    }

    settingsMenuStack.push({
        title: `Settings - ${current}`,
        items: getSettingsItems(),
        selectedIndex: 0
    });

    const footer = settingsMenuState.editing ? 'Jog:Change Clk:Save' : 'Jog:Scroll Clk:Edit';

    drawStackMenu({
        stack: settingsMenuStack,
        state: settingsMenuState,
        footer
    });

    if (showOverlays) drawOverlay();
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
    let channel = banks[selectedBank].channel;

    // /* Shift state */
    // if (cc === CC_SHIFT) {
    //     shiftHeld = val > 63;
    //     needsRedraw = true;
    //     return;
    // }

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
                viewMode = VIEW_MAIN;
                saveConfig();
                settingsMenuStack = null;  /* Reset for next time */
            } else {
                selected = 3;
                selectedKnob = -1;
                selectedPad = -1;
                selectedButton = -1;
            }
        } else if (viewMode !== VIEW_MAIN) {
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
            viewMode = VIEW_MAIN;
            saveConfig();
            settingsMenuStack = null;  /* Reset for next time */
        } else {
            viewMode = VIEW_SETTINGS;
        }
        needsRedraw = true;
        return;
    }

    /* Other buttons send midi */
    for (let i = 0; i < ALL_BUTTONS.length; i++) {
        if (cc === ALL_BUTTONS[i]) {
            if (viewMode === VIEW_SETTINGS && selectedButton != i) {
                settingsMenuState.editing = false;
                disableLEDUpdate = false;
                settingsMenuStack.push({selectedIndex: 0});
            }
            selected = 2;
            selectedButton = i;
            selectedKnob = -1;
            selectedPad = -1;

            let ccOut = banks[selectedBank].buttons[i].cc;
            move_midi_external_send([2 << 4 | (0xB0 / 16), 0xB0 | channel, ccOut, val]);

            /* Query the button mapping info and show overlay */
            if (viewMode === VIEW_MAIN) {
                if (showButtonOverlay(selectedButton)) {
                    needsRedraw = true;
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
        disableLEDUpdate = false;
        if (item && item.label === 'Colour' && settingsMenuState.editing) {
            disableLEDUpdate = true;
            if (selected === 0) setLED(MovePads[selectedPad], settingsMenuState.editValue, true);
            if (selected === 1) setButtonLED(ALL_KNOBS[selectedKnob], settingsMenuState.editValue, true);
            if (selected === 2) setButtonLED(ALL_BUTTONS[selectedButton], settingsMenuState.editValue, true);
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

    /* Knob and button handling depends on view mode */
    if (viewMode === VIEW_MAIN) {
        /* In main view: knobs send midi */
        for (let i = 0; i < ALL_KNOBS.length; i++) {
            if (cc === ALL_KNOBS[i]) {
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
                move_midi_external_send([2 << 4 | (0xB0 / 16), 0xB0 | channel, ccOut, valOut]);

                /* Query the knob mapping info and show overlay */
                if (showKnobOverlay(selectedKnob, val)) {
                    needsRedraw = true;
                }
                return;
             }
        }
    }
}

function handleNote(note, vel) {
    let channel = banks[selectedBank].channel;

    /* Knob touch */
    if (note >= 0 && note <= 8 && vel > 0) {
        if (viewMode === VIEW_MAIN) showKnobOverlay(note);
        if (viewMode === VIEW_SETTINGS && selectedKnob != note) {
            settingsMenuState.editing = false;
            disableLEDUpdate = false;
            settingsMenuStack.push({selectedIndex: 0});
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
        if (viewMode === VIEW_SETTINGS  && selectedBank != bankIdx) {
            settingsMenuState.editing = false;
            disableLEDUpdate = false;
            settingsMenuStack.push({selectedIndex: 0});
        }
        selectedBank = bankIdx;
        selectedKnob = -1;
        selectedPad = -1;
        selectedButton = -1;
        selected = 3;
        needsRedraw = true;
        return;
    }
    /* Pads press */
    if (note >= 68 && note <= 99 && vel > 0) {
        const padIdx = note - 68;
        if (viewMode === VIEW_SETTINGS && selectedPad != padIdx) {
            settingsMenuState.editing = false;
            disableLEDUpdate = false;
            settingsMenuStack.push({selectedIndex: 0});
        }
        selectedKnob = -1;
        selectedButton = -1;
        selectedPad = padIdx;
        selected = 0;

        /* edit velocity */
        let padLevel = banks[selectedBank].pads[selectedPad].level || 100;
        let masterLevel = banks[selectedBank].level || 100;
        let velOut = Math.round(vel * (padLevel/100) * (masterLevel/100))
        if (velOut > 127) velOut = 127;

        if (viewMode === VIEW_MAIN) showPadOverlay(padIdx, velOut);
        highlightPad = true;
        needsRedraw = true;

        /* send midi */
        let noteOut = banks[selectedBank].pads[selectedPad].note;
        move_midi_external_send([2 << 4 | (0x90 / 16), 0x90 | channel, noteOut, velOut]);
        return;
    }
    /* Pads release */
    if (note >= 68 && note <= 99 && vel === 0) {
        highlightPad = false;
        needsRedraw = true;

        /* send midi */
        let noteOut = banks[selectedBank].pads[selectedPad].note;
        if (banks[selectedBank].noteoffs) {
            move_midi_external_send([2 << 4 | (0x80 / 16), 0x80 | channel, noteOut, vel]);
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
    }
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
        if (!disableLEDUpdate) updateLEDs();
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
globalThis.onMidiMessageExternal = onMidiMessage;
