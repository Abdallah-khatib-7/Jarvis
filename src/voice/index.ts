import { rmSync } from "fs";
import inquirer from "inquirer";
import chalk from "chalk";
import { getFact, setFact } from "../database/memory.js";
import { listMicDevices, startRecording } from "./mic.js";
import { transcribeWav, isModelDownloaded } from "./transcribe.js";

export { speak } from "./speak.js";

const MIC_FACT_KEY = "voice_mic_device";

async function resolveMicDevice(userId: number): Promise<string | null> {
  const stored = getFact(userId, MIC_FACT_KEY);
  if (stored) return stored;

  const devices = await listMicDevices();
  if (devices.length === 0) return null;

  let chosen = devices[0];
  if (devices.length > 1) {
    const { pick } = await inquirer.prompt<{ pick: string }>([
      {
        type: "list",
        name: "pick",
        message: "Which microphone should JARVIS use?",
        choices: devices.map((d) => ({ name: d.name, value: d.altName })),
      },
    ]);
    chosen = devices.find((d) => d.altName === pick) ?? devices[0];
  }

  setFact(userId, MIC_FACT_KEY, chosen.altName);
  return chosen.altName;
}

export interface VoiceCaptureResult {
  ok: true;
  transcript: string;
}
export interface VoiceCaptureError {
  ok: false;
  error: string;
}

/* Push-to-talk: records until the user presses Enter, then transcribes locally. */
export async function captureVoiceInput(userId: number): Promise<VoiceCaptureResult | VoiceCaptureError> {
  const needsDownload = !isModelDownloaded();

  const device = await resolveMicDevice(userId);
  if (!device) {
    return { ok: false, error: "No microphone found on this system." };
  }

  if (needsDownload) {
    process.stdout.write(
      chalk.dim("\n  Note: this is your first time using /voice — the speech model needs to download\n") +
      chalk.dim("  (~150MB, one-time only). Go ahead and speak; transcribing will take a bit longer.\n")
    );
  }

  const rec = startRecording(device);

  process.stdout.write(chalk.red("\n  ● Listening…\n"));
  await inquirer.prompt<{ _: string }>([{ type: "input", name: "_", message: "  Press Enter when you're done speaking:" }]);

  let wavPath: string;
  try {
    wavPath = await rec.stop();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  process.stdout.write(chalk.dim("  Transcribing…\n"));
  try {
    const transcript = await transcribeWav(wavPath);
    if (!transcript) {
      return { ok: false, error: "Didn't catch anything — try again and speak clearly." };
    }
    return { ok: true, transcript };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    rmSync(wavPath, { force: true });
  }
}
