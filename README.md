# Custom MIDI controller for Move Everything

Customisable MIDI controller for use on Ableton Move with Move Everything installed.

## Prerequisites

- [Move Everything](https://github.com/charlesvestal/move-anything) installed on your Ableton Move

## Features

- 16 Banks of custom pads/knobs/buttons
- Configurable MIDI channel per bank
- Adjust Pad (level) velocity for bank and individual pads
- Change MIDI note/cc for pads or knobs/buttons
- Change colour of pads, knobs and buttons
- Change knobs between relative or absolute values
- Assign a name to banks, pads, knobs and buttons
- Adjust bank to not send MIDI note offs for pads (for drums)
- Open in Standalone (Shift + MastVol + Vol8) or Overtake Mode (Shift + MastVol + JogWheelClick)
- Play Shadow Synths while in Overtake Mode on MIDI channel they are set to

## Building

```bash
./scripts/build.sh
```

## Installation

Through the Move Everything store. Or manually:

```bash
./scripts/install.sh
```


## Quick Start Guide

### 1. Launch the Controller in Standalone Mode
- Open **Move Everything** Standalone Mode (Shift + MastVol + Vol8)
- Navigate to **Other → Custom MIDI Control**

### Or 1. Launch the Controller in Overtake Mode
- Open **Move Everything** Overtake Mode (Shift + MastVol + JogWheelClick)
- Navigate to **Custom MIDI Control**

### 2. First Test
- Press **Bank 1** (step button 1)
- Hit any **pad** - you should hear a note
- Turn any **knob** - you should see the overlay

### 3. Your First Customization
- Press **Menu** button
- Press a **pad** to select it
- Use **jog wheel** to scroll to "Note"
- **Click jog** to edit
- **Turn jog** to change the note
- **Click jog** again to save
- Press **Back** to exit settings
- Test your pad!

## Settings Menu

### Entering Settings

**Press the Menu button** to enter settings mode.

### Navigation
- **Menu** = Enter settings
- **Back** = Exit settings
- **Jog wheel** = Scroll
- **Click jog** = Edit/Save
- **Step 1-16** = Change banks

### Pad Settings

Select a pad (press it):

| Setting | Range | Description |
|---------|-------|-------------|
| **Note** | 0-127 | MIDI note number to send |
| **Name** | Text | Custom name for the pad |
| **Colour** | 0-127 | LED color (see color chart) |
| **Pad Level** | 0-200% | Velocity multiplier |
| **Choke Grp** | 0-8 | Choke group (0 = none) |

**Editing Name:**
1. Select "Name"
2. Click jog wheel
3. Use the on-screen keyboard to type
4. Click jog wheel when done

### Knob Settings

Touch a knob:

| Setting | Range | Description |
|---------|-------|-------------|
| **CC** | 0-127 | MIDI CC number to send |
| **Name** | Text | Custom name for the knob |
| **Colour** | 0-3 | LED color scheme |
| **Min Value** | 0-127 | Minimum output value |
| **Max Value** | 0-127 | Maximum output value |
| **CC Relative** | On/Off | Relative mode (for endless encoders) |

### Button Settings

Press a button:

| Setting | Range | Description |
|---------|-------|-------------|
| **CC** | 0-127 | MIDI CC number to send |
| **Name** | Text | Custom name for the button |
| **Colour** | 0-127 | LED color |

### Bank Settings

Press a step button:

| Setting | Range | Description |
|---------|-------|-------------|
| **MIDI Chan** | 1-16 | MIDI channel for this bank |
| **Name** | Text | Custom name for the bank |
| **Mast Pad Level** | 0-200% | Velocity multiplier for all pads |
| **Min Pad Level** | 0-127 | Velocity minimum for all pads |
| **Use Shadow Synths** | On/Off | Route to Move's internal synths |
| **Note Offs** | On/Off | Send note-off messages |
| **Show Overlay** | On/Off | Display info when pressing pads/knobs |

### Visual Feedback
- **White pulse** = Item is selected (in settings)
- **White flash** = Pad is pressed
- **Knob LEDs** = Show current value
- **Step LEDs** = Show active bank (white) vs inactive (gray)

## Advanced Features

### Choke Groups

Choke groups allow pads to **cut each other off** when triggered - perfect for hi-hats!

**How it works:**
1. Set multiple pads to the same choke group (1-8)
2. When you press pad A (choke group 1)
3. Any other pad in choke group 1 that's playing will be stopped
4. This creates realistic hi-hat open/close behavior

**Example Setup:**
```
Pad 1: Hi-Hat Closed  - Choke Group 1
Pad 2: Hi-Hat Open    - Choke Group 1
Pad 3: Hi-Hat Pedal   - Choke Group 1
```

Now playing "closed" automatically stops "open" and vice versa!

**Tip:** Use choke group 0 (default setting) to disable choking for a pad.

### Velocity Scaling

Control how sensitive pads are to your playing dynamics:

**Pad Level (per pad):**
- 0% = Silent (no matter how hard you hit)
- 50% = Half velocity
- 100% = Normal (default)
- 200% = Double velocity

**Mast Pad Level (per bank):**
- Multiplies ALL pad velocities in the bank

**Min Pad Level (per bank):**
- Minimum velocity of ALL pads in the bank

**Formula:**
```
Output Velocity = Input × (Pad Level / 100) × (Master Level / 100) > Minimum Pad Level || Minimum Pad Level
```

**Example:**
```
Input: 100
Pad Level: 90%
Master Level: 150%
Output: 100 × 0.9 × 1.5 = 135 (capped at 127)
```

### Shadow Mode

**Shadow Mode (On):** MIDI goes to Move Everything's sound generators
- Use when you want to play Move Everything's built-in sounds
- No external MIDI device needed

**Shadow Mode (Off):** MIDI goes to external devices via USB
- Use with external synths, DAWs, or hardware
- Requires MIDI device connected

**Tip:** You can have different banks in different modes - Bank 1 for Move Everything's synths, Bank 2 for external gear!

### Note-Offs

**Note-Offs (On):** Send note-off when pad is released
- Default behavior
- Use for melodic instruments
- Allows notes to sustain until you release

**Note-Offs (Off):** Don't send note-off messages
- Use for drum machines
- Each hit is independent

### Relative Knob Mode

**Absolute Mode (default):**
- Knob position = MIDI value
- Jumping when you touch a knob is normal
- Good for parameters with clear ranges

**Relative Mode:**
- Knob sends +/- changes
- No jumping
- Perfect for controlling plugins with existing values
- Good for volume/filter controls

### Color Schemes

**Pads & Buttons:** 0-127 individual colors

**Knobs:** 4 color schemes (0-3)
- **Scheme 0:** Neutral grays
- **Scheme 1:** Rainbow
- **Scheme 2:** Synthwave (purple/pink/blue)
- **Scheme 3:** Rose (pink gradient)

Knob LEDs change brightness based on value!

---

### Performance Mode

**Hide overlays for distraction-free playing:**
1. Go to Bank Settings
2. Set "Show Overlay" to Off
3. Now pads/knobs don't show info when pressed
4. Cleaner visual experience during performance

---

### Backup Your Config

Your configuration is stored in:
```
/data/UserData/move-anything/modules/other/control/config.json
```

**To backup:**
1. Connect Move to computer
2. Copy the config.json file
3. Store it safely

**To restore:**
1. Copy your backup back to the same location
2. Reload the module

---

### Default Settings

**New Pad Defaults:**
- Note: 36 + pad number (C1 to C3)
- Color: Black (0)
- Level: 100%
- Choke Group: 0 (disabled)

**New Knob Defaults:**
- CC: 71 + knob number (CC71-CC79)
- Range: 0-127
- Mode: Absolute
- Color: Neutral (0)

**New Button Defaults:**
- CC: Original Move function CC
- Color: Black (0)
- Name: Original Move function name

**New Bank Defaults:**
- MIDI Channel: 1
- Master Level: 100%
- Shadow Mode: Off
- Note-Offs: On
- Show Overlay: On