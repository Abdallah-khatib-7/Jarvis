import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, "..", "..", ".voice-cache");

function readWavPCM16Mono16k(path) {
  const buf = readFileSync(path);
  let offset = 12;
  let dataOffset = -1;
  let dataLen = 0;
  while (offset < buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "data") {
      dataOffset = offset + 8;
      dataLen = size;
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (dataOffset === -1) throw new Error("Invalid WAV file: no data chunk found.");

  const samples = new Float32Array(dataLen / 2);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = buf.readInt16LE(dataOffset + i * 2) / 32768;
  }
  return samples;
}

function report(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

async function main() {
  const wavPath = process.argv[2];
  if (!wavPath) throw new Error("Usage: transcribeWorker.mjs <wavPath>");

  const samples = readWavPCM16Mono16k(wavPath);
  const durationSec = samples.length / 16000;
  if (durationSec < 0.3) {
    report({ type: "result", text: "" });
    return;
  }

  const { pipeline, env } = await import("@xenova/transformers");
  env.allowLocalModels = false;
  env.cacheDir = CACHE_DIR;

  const asr = await pipeline("automatic-speech-recognition", "Xenova/whisper-base.en", {
    progress_callback: (e) => {
      if (e.status === "progress" && typeof e.progress === "number" && e.file) {
        report({ type: "progress", file: e.file, progress: Math.round(e.progress) });
      }
    },
  });

  const result = await asr(samples);
  report({ type: "result", text: result.text.trim() });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    report({ type: "error", message: err instanceof Error ? err.message : String(err) });
    process.exit(1);
  });
