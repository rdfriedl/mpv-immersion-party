#!/usr/bin/env node
const Mpv = require("mpv");
const chalk = require("chalk");
const { askForFile, getOutputDevices, getVideoFileTracks, pickAudioTracks, pickOutputDevice } = require("./helpers.js");

async function main() {
  let movieFile = process.argv[2];
  if (!movieFile) {
    movieFile = await askForFile();
  }

  const tracks = await getVideoFileTracks(movieFile);
  const audioTracks = tracks.filter((track) => track.type === "audio");
  // const subTracks = tracks.filter((track) => track.type === "sub");

  const langs = await pickAudioTracks(audioTracks);
  const devices = await getOutputDevices();

  const langToDevice = {};
  for (const language of langs) {
    const outputDevice = await pickOutputDevice(devices, `Output device for ${chalk.green(language.title)}`);
    langToDevice[language.lang] = outputDevice.name;
  }

  const instances = Object.entries(langToDevice).map(([lang, device]) => {
    const mpv = new Mpv({
      args: [`--audio-device=${device}`, `--alang=${lang}`, `--vlang=${lang}`, `--slang=${lang}`, "--pause"],
    });
    return { mpv, lang };
  });

  let ignoreNextSeekEventQueue = [];
  for (const { mpv, lang } of instances) {
    await mpv.command("loadfile", movieFile);

    mpv.on("seek", async () => {
      if (ignoreNextSeekEventQueue.includes(mpv)) {
        ignoreNextSeekEventQueue = ignoreNextSeekEventQueue.filter((inst) => inst !== mpv);
        return;
      }

      const time = await mpv.get("playback-time");
      console.log(`${lang}: seek ${time}`);

      for (const { mpv: other } of instances) {
        if (other !== mpv) {
          ignoreNextSeekEventQueue.push(other);
          await other.set("playback-time", time);
        }
      }
    });

    async function setOtherPause() {
      const pause = await mpv.get("pause");
      console.log(`${lang}: pause ${pause}`);
      for (const { mpv: other } of instances) {
        if (other !== mpv) {
          await other.set("pause", pause);
        }
      }
    }
    mpv.on("pause", setOtherPause);
    mpv.on("unpause", setOtherPause);

    mpv.on("error", (err) => {
      if (err) {
        console.error(`${lang}: MPV Error`);
        console.log(err);
      } else {
        console.warn(`${lang}: MPV closed`);
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
