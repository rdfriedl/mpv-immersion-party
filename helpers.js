#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const Mpv = require("mpv");
const { AutoComplete, Confirm } = require("enquirer");

exports.confirm = async function confirm(question) {
  return new Confirm({
    message: question,
  }).run();
};

const autoCompleteHelper = "Use <up>, <down>, and <space> to select an option. <enter> to submit";
exports.askForFile = async function askForFile(cwd = process.cwd()) {
  const files = fs.readdirSync(cwd, { withFileTypes: true });

  const prompt = new AutoComplete({
    header: autoCompleteHelper,
    message: "Pick the mkv file",
    choices: ["../", ...files.sort((a, b) => b.isDirectory() - a.isDirectory()).map((info) => info.name)],
  });

  try {
    const filename = await prompt.run();
    const filepath = path.join(cwd, filename);
    const info = fs.statSync(filepath);

    if (info.isDirectory()) {
      return getFile(filepath);
    }
    return filepath;
  } catch (e) {
    console.error(e);
  }
};

exports.pickAudioTracks = async function pickAudioTracks(tracks) {
  return await new AutoComplete({
    header: autoCompleteHelper,
    message: "Select audio tracks",
    choices: tracks.map((track) => ({ name: track.id, message: `(${track.id}) ${track.title}`, value: track.id })),
    multiple: true,
    result(ids) {
      return ids.map((id) => tracks.find((track) => track.id === id));
    },
  }).run();
};
exports.pickOutputDevice = async function pickOutputDevice(devices, message) {
  return await new AutoComplete({
    header: autoCompleteHelper,
    message: message ?? "Pick output device",
    choices: devices.map((device) => ({ name: device.name, message: device.description, value: device.name })),
    result(name) {
      return devices.find((device) => device.name === name);
    },
  }).run();
};

exports.getOutputDevices = async function getOutputDevices() {
  const mpv = new Mpv();
  const devices = await mpv.get("audio-device-list");
  mpv.on("error", () => {});
  mpv.process.kill();
  return devices;
};

exports.getVideoFileTracks = async function getVideoFileTracks(filepath) {
  return new Promise(async (res, rej) => {
    const mpv = new Mpv({ args: ["--pause", "--vo=null"] });
    await mpv.command("loadfile", filepath);
    mpv.on("error", (err) => {
      if (err) rej(err);
    });

    mpv.on("file-loaded", async () => {
      const count = await mpv.get("track-list/count");

      const getProp = async (prop) => {
        try {
          return await mpv.get(prop);
        } catch (e) {
          return null;
        }
      };

      const tracks = [];
      for (let i = 0; i < count; i++) {
        tracks.push({
          title: await getProp(`track-list/${i}/title`),
          id: await getProp(`track-list/${i}/id`),
          lang: await getProp(`track-list/${i}/lang`),
          type: await getProp(`track-list/${i}/type`),
        });
      }

      mpv.process.kill();

      res(tracks);
    });
  });
};
