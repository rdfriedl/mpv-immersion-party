# mpv-immersion-party

This is a nodejs cli tool that manages multiple instances of mpv and uses the `--audio-device` option to output each instances audio to a different device.

## Setup

1. Install NodeJS from [nodejs.org](https://nodejs.org/en/download/)
2. Install MPV from [mpv.io](https://mpv.io/installation/)

## Video file requirements

This tool has only been tested on `mkv` files. however it might work with other formats.

The `--alang` ([docs](https://mpv.io/manual/stable/#options-alang)), `--vlang` ([docs](https://mpv.io/manual/stable/#options-vlang)), and `--slang` ([docs](https://mpv.io/manual/stable/#options-slang)) options are used to make mpv select the correct audio, video, and subtitle tracks for the selected language.

The `--audio-device` ([docs](https://mpv.io/manual/stable/#options-audio-device)) option is used to make mpv output the audio to a specific device.

## Example

_npx is a command that comes with NodeJS to download and run packages ([docs](https://docs.npmjs.com/cli/v7/commands/npx))_

```bash
npx mpv-immersion-party VideoFile.mkv
```
