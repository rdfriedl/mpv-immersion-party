import Mpv from "mpv";
import os from "os";
import shell from "shelljs";
import inquirer from "inquirer";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
const argv = yargs(hideBin(process.argv)).argv;
const win32 = os.platform() === "win32";
const mpvCommand = win32 ? "mpv.exe" : "mpv";

const LANGUAGE_CODES = {
  eng: "English",
  ger: "German",
  jpn: "Japanese",
};

async function getAudioDevices() {
  const output = shell.exec(`${mpvCommand} --audio-device=help`, {
    silent: true,
  });
  const devices = output.matchAll(/^\s*'(.+)'\s\((.+)\)$/gm);

  if (devices) {
    return Array.from(devices).map(([_, id, name]) => {
      return { id, name };
    });
  }
  return [];
}

const videoArg = argv._[0];
if (!videoArg) {
  console.log("Missing movie file.");
  process.exit(1);
}

const devices = await getAudioDevices();

const { languages } = await inquirer.prompt([
  {
    name: "languages",
    message: "Output languages",
    type: "checkbox",
    choices: Object.entries(LANGUAGE_CODES).map(([code, name]) => ({
      value: code,
      name,
    })),
    validate: (input) => {
      return input.length > 0 ? true : "Select at least one language";
    },
  },
]);

const languageOutputDevices = await inquirer.prompt(
  languages.map((code) => ({
    name: code,
    message: `Output device for ${LANGUAGE_CODES[code]}`,
    type: "list",
    choices: devices.map(({ id, name }) => ({ value: id, name })),
    loop: false,
  }))
);

const instances = Object.entries(languageOutputDevices).map(
  ([code, device]) => {
    const mpv = new Mpv({
      args: [
        `--audio-device=${device}`,
        `--alang=${code}`,
        `--vlang=${code}`,
        `--slang=${code}`,
        "--pause",
      ],
    });
    return { mpv, code };
  }
);

let ignoreNextSeekEventQueue = [];
for (const { mpv, code } of instances) {
  await mpv.command("loadfile", videoArg);

  mpv.on("seek", async () => {
    if (ignoreNextSeekEventQueue.includes(mpv)) {
      ignoreNextSeekEventQueue = ignoreNextSeekEventQueue.filter(
        (inst) => inst !== mpv
      );
      return;
    }

    const time = await mpv.get("playback-time");
    console.log(`seek event on ${LANGUAGE_CODES[code]}`, time);

    for (const { mpv: other } of instances) {
      if (other !== mpv) {
        ignoreNextSeekEventQueue.push(other);
        await other.set("playback-time", time);
      }
    }
  });

  async function setOtherPause() {
    const pause = await mpv.get("pause");
    for (const { mpv: other } of instances) {
      if (other !== mpv) {
        await other.set("pause", pause);
      }
    }
  }
  mpv.on("pause", setOtherPause);
  mpv.on("unpause", setOtherPause);
}

function closeInstances() {
  for (const { mpv } of instances) {
    try {
      mpv.process.kill();
    } catch (e) {}
  }
  process.exit();
}
process.on("SIGINT", closeInstances);
process.on("SIGTERM", closeInstances);
