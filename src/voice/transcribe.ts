import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { spawn } from "child_process";
import chalk from "chalk";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Two levels up from either src/voice/ (dev, via tsx) or dist/voice/ (prod) lands on the project root.
const PROJECT_ROOT = join(__dirname, "..", "..");
const CACHE_DIR = join(PROJECT_ROOT, ".voice-cache");
const MODEL_MARKER = join(CACHE_DIR, "Xenova", "whisper-base.en", "onnx", "decoder_model_merged_quantized.onnx");
// Plain JS, not compiled by tsc — always run straight from source regardless of dev/prod.
const WORKER_PATH = join(PROJECT_ROOT, "src", "voice", "transcribeWorker.mjs");

/* Transcription runs in a separate process so a native runtime hang can never freeze the app. */
const TIMEOUT_MS = 90_000;

export function isModelDownloaded(): boolean {
  return existsSync(MODEL_MARKER);
}

/* No-op kept for callers — the worker process loads the model on demand, nothing useful to warm up in-process. */
export function preloadTranscriber(): void {}

type WorkerMessage =
  | { type: "progress"; file: string; progress: number }
  | { type: "result"; text: string }
  | { type: "error"; message: string };

export async function transcribeWav(wavPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [WORKER_PATH, wavPath], { stdio: ["ignore", "pipe", "pipe"] });

    let resolved = false;
    let stdoutBuf = "";
    let stderrBuf = "";
    let lastProgressLine = "";

    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      child.kill();
      reject(new Error("Speech recognition timed out. This can happen occasionally on first run — try /voice again."));
    }, TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split("\n");
      stdoutBuf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let msg: WorkerMessage;
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        if (msg.type === "progress") {
          const text = `  Downloading speech model ${msg.file} — ${msg.progress}%`;
          if (text !== lastProgressLine) {
            lastProgressLine = text;
            process.stdout.write(`\r${chalk.dim(text.padEnd(70))}`);
            if (msg.progress >= 100) process.stdout.write("\n");
          }
        } else if (msg.type === "result") {
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);
          resolve(msg.text);
        } else if (msg.type === "error") {
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);
          reject(new Error(msg.message));
        }
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString();
    });

    child.on("error", (err) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      reject(new Error(`Speech recognition failed (exit ${code}). ${stderrBuf.trim().slice(-300)}`));
    });
  });
}
