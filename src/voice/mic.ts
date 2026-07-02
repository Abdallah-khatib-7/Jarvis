import { spawn } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { mkdirSync } from "fs";
import ffmpegPath from "ffmpeg-static";

const VOICE_TMP_DIR = join(tmpdir(), "jarvis-voice");
mkdirSync(VOICE_TMP_DIR, { recursive: true });

export interface MicDevice {
  name: string;
  altName: string;
}

/* Parses `ffmpeg -list_devices true -f dshow -i dummy` stderr output for audio-only devices. */
export async function listMicDevices(): Promise<MicDevice[]> {
  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath as string, ["-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"]);
    let out = "";
    proc.stderr.on("data", (d) => (out += d.toString()));
    proc.on("close", () => {
      const lines = out.split("\n");
      const devices: MicDevice[] = [];
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/"(.+)"\s*\(audio\)/);
        if (!m) continue;
        const next = lines[i + 1] || "";
        const alt = next.match(/"(.+)"/);
        if (alt) devices.push({ name: m[1], altName: alt[1] });
      }
      resolve(devices);
    });
    proc.on("error", () => resolve([]));
  });
}

export interface Recording {
  /* stop recording and resolve with the wav file path */
  stop: () => Promise<string>;
}

/* Starts recording 16kHz mono PCM WAV from the given device (ffmpeg dshow alt name). */
export function startRecording(deviceAltName: string): Recording {
  const wavPath = join(VOICE_TMP_DIR, `rec_${Date.now()}.wav`);
  const proc = spawn(
    ffmpegPath as string,
    ["-hide_banner", "-loglevel", "error", "-y", "-f", "dshow", "-i", `audio=${deviceAltName}`, "-ac", "1", "-ar", "16000", wavPath],
    { stdio: ["pipe", "ignore", "pipe"] }
  );

  let stderr = "";
  proc.stderr?.on("data", (d) => (stderr += d.toString()));

  const closed = new Promise<number | null>((resolve) => {
    proc.on("close", (code) => resolve(code));
  });

  return {
    stop: async () => {
      proc.stdin?.write("q");
      const code = await closed;
      if (code !== 0) throw new Error(`Recording failed: ${stderr.trim() || `ffmpeg exited with code ${code}`}`);
      return wavPath;
    },
  };
}
