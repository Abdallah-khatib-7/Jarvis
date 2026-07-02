import { spawn } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { mkdirSync, rmSync } from "fs";
import ffmpegPath from "ffmpeg-static";

const VOICE_TMP_DIR = join(tmpdir(), "jarvis-voice");
mkdirSync(VOICE_TMP_DIR, { recursive: true });

const VOICE_NAME = "en-GB-RyanNeural";

/* Strips markdown, ANSI codes, and HTML so TTS doesn't read out symbols. */
function cleanForSpeech(text: string): string {
  return text
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/```[\s\S]*?```/g, " (code block) ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/https?:\/\/\S+/g, "a link")
    .replace(/[│╭╮╰╯─┃]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath as string, ["-hide_banner", "-loglevel", "error", ...args]);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(stderr.trim()))));
  });
}

function playWav(wavPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = `(New-Object Media.SoundPlayer '${wavPath.replace(/'/g, "''")}').PlaySync()`;
    const ps = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { stdio: "ignore" });
    ps.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`playback exited with code ${code}`))));
    ps.on("error", reject);
  });
}

export async function speak(text: string): Promise<void> {
  const clean = cleanForSpeech(text);
  if (!clean) return;

  const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
  const dir = join(VOICE_TMP_DIR, `say_${Date.now()}`);
  mkdirSync(dir, { recursive: true });

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(VOICE_NAME, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioFilePath } = await tts.toFile(dir, clean);

    const wavPath = audioFilePath.replace(/\.mp3$/, ".wav");
    await runFfmpeg(["-y", "-i", audioFilePath, wavPath]);
    await playWav(wavPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
