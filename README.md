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

## Building

```bash
./scripts/build.sh
```

## Installation

```bash
./scripts/install.sh
```

## Usage

1. Connect MIDI device to Move via USB-A or USB-C port
2. Open Move Everything in standalone mode and open Other -> Custom MIDI Controller
3. Configure Custom MIDI Control (press Menu key) and select a bank, pad, knob or button (it will flash to indicate it is selected)
