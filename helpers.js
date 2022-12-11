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
    message: "Pick the mkv file",
    choices: ["../", ...files.sort((a, b) => b.isDirectory() - a.isDirectory()).map((info) => info.name)],
    header: autoCompleteHelper,
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
  const picks = await new AutoComplete({
    message: "Available languages",
    choices: tracks.map((track) => track.title),
    multiple: true,
    header: autoCompleteHelper,
  }).run();

  return picks.map((title) => tracks.find((track) => track.title === title));
};
exports.pickOutputDevice = async function pickOutputDevice(devices, message) {
  const pick = await new AutoComplete({
    message: message ?? "Pick output device",
    choices: devices.map((track) => track.description),
    header: autoCompleteHelper,
  }).run();

  return devices.find((track) => track.description === pick);
};

exports.getOutputDevices = async function getOutputDevices() {
  const mpv = new Mpv();
  const devices = await mpv.get("audio-device-list");
  mpv.on("error", () => {});
  mpv.process.kill();
  return devices;
};

exports.getVideoFileTracks = async function getVideoFileTracks(filepath) {
  return new Promise(async (res) => {
    const mpv = new Mpv({ args: ["--pause", "--vo=null"] });
    await mpv.command("loadfile", filepath);
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
          lang: await getProp(`track-list/${i}/lang`),
          type: await getProp(`track-list/${i}/type`),
        });
      }

      mpv.on("error", () => {});
      mpv.process.kill();

      res(tracks);
    });
  });
};
