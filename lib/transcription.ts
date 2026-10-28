import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import FormData from "form-data";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

ffmpeg.setFfmpegPath(ffmpegPath.path);

// Convert any browser recording (webm/opus, mp4/aac, ogg…) to WAV mono 16kHz
// (required by Meta ASR API). Goes through temp files rather than pipes:
// Safari's mp4 recordings can't be decoded from a non-seekable stream.
async function toWav(inputBuffer: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "devisvocal-"));
  const inputPath = join(dir, "input");
  const outputPath = join(dir, "output.wav");
  try {
    await writeFile(inputPath, inputBuffer);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .audioChannels(1)
        .audioFrequency(16000)
        .audioCodec("pcm_s16le")
        .format("wav")
        .on("end", () => resolve())
        .on("error", reject)
        .save(outputPath);
    });
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const wavBuffer = await toWav(audioBuffer);

  const form = new FormData();
  form.append(
    "request",
    JSON.stringify({
      model: "muse-voice-transcribe-1.0",
      mode: "PUSH_TO_TALK",
      audioEncoding: "WAV",
      languageBias: ["fr"],
      // Vocabulaire chantier ivoirien
      keywords: [
        "béton", "ferraillage", "coffrages", "maçonnerie", "carrelage",
        "plomberie", "électricité", "peinture", "enduit", "chape",
        "FCFA", "mètre", "m2", "m3", "unité", "forfait", "devis",
        "tuyau", "câble", "dalle", "semelle", "parpaing", "ciment",
        "sable", "gravier", "fer", "tige", "étrier",
      ],
    }),
    { contentType: "application/json" }
  );
  form.append("audio", wavBuffer, {
    filename: "audio.wav",
    contentType: "audio/wav",
  });

  const res = await fetch("https://api.meta.ai/v1/asr/transcribe", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.META_API_KEY!}`,
      ...form.getHeaders(),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: form.getBuffer() as any,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Transcription API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return (data.transcript as string) ?? "";
}
