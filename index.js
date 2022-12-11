#!/usr/bin/env node
const Mpv = require("mpv");
const chalk = require("chalk");
const { askForFile, getOutputDevices, getVideoFileTracks, pickAudioTracks, pickOutputDevice } = require("./helpers.js");

const debug = (...args) => {
  if (process.env.DEBUG) {
    console.log(...args);
  }
};

async function main() {
  let movieFile = process.argv[2];
  if (!movieFile) {
    movieFile = await askForFile();
  }

  const tracks = await getVideoFileTracks(movieFile);
  debug("Found tracks", tracks);

  const audioTracks = tracks
    .filter((track) => track.type === "audio")
    .map((track) => ({ ...track, title: track.title ?? track.lang }))
    .filter((track) => track.title && track.lang);
  debug("Found audio tracks", audioTracks);

  const subTracks = tracks
    .filter((track) => track.type === "sub")
    .map((track) => ({ ...track, title: track.title ?? track.lang }))
    .filter((track) => track.title && track.lang);
  debug("Found sub tracks", subTracks);

  const selectedAudioTracks = await pickAudioTracks(audioTracks);
  const devices = await getOutputDevices();

  const audioToDevice = new Map();
  for (const track of selectedAudioTracks) {
    const outputDevice = await pickOutputDevice(devices, `Output device for ${chalk.green(track.title)}`);
    audioToDevice.set(track, outputDevice);
  }

  const instances = Array.from(audioToDevice.entries()).map(([track, device]) => {
    const args = [
      `--audio-device=${device.name}`,
      `--aid=${track.id}`,
      `--alang=${track.lang}`,
      `--vlang=${track.lang}`,
      `--slang=${track.lang}`,
      "--pause",
    ];
    debug("starting MPV with", args);
    const mpv = new Mpv({
      args,
    });
    return { mpv, audio: track };
  });

  let ignoreNextSeekEventQueue = [];
  let ignoreNextPauseEventQueue = [];
  for (const { mpv, audio } of instances) {
    await mpv.command("loadfile", movieFile);
    await mpv.command("observe_property", 1, "pause");

    mpv.on("seek", async () => {
      if (ignoreNextSeekEventQueue.includes(mpv)) {
        ignoreNextSeekEventQueue = ignoreNextSeekEventQueue.filter((inst) => inst !== mpv);
        return;
      }

      const time = await mpv.get("playback-time");
      console.log(`${audio.title}: seek ${time}`);

      for (const { mpv: other } of instances) {
        if (other !== mpv) {
          ignoreNextSeekEventQueue.push(other);
          await other.set("playback-time", time);
        }
      }
    });

    mpv.on("property-change", (event) => {
      if (event.name === "pause") {
        if (ignoreNextPauseEventQueue.includes(mpv)) {
          ignoreNextPauseEventQueue = ignoreNextPauseEventQueue.filter((inst) => inst !== mpv);
          return;
        }
        const pause = event.data;
        console.log(`${audio.title}: pause ${pause}`);
        for (const { mpv: other } of instances) {
          if (other !== mpv) {
            ignoreNextPauseEventQueue.push(other);
            other.set("pause", pause);
          }
        }
      }
    });

    mpv.on("error", (err) => {
      if (err) {
        console.error(`${audio.title}: MPV Error`);
        console.log(err);
      } else {
        console.warn(`${audio.title}: MPV closed`);
      }
    });
  }

  function exit() {
    console.log("closing MPV instances");
    for (const { mpv } of instances) {
      try {
        mpv.process.kill();
      } catch (e) {
        console.log(e);
      }
    }
    process.exit(0);
  }
  process.on("SIGINT", exit);
  process.on("SIGTERM", exit);
}

main();
