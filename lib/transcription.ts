import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import { Readable, PassThrough } from "stream";
import FormData from "form-data";

ffmpeg.setFfmpegPath(ffmpegPath.path);

// Convert any audio buffer to WAV mono 16kHz (required by Meta ASR API)
async function toWav(inputBuffer: Buffer, inputFormat: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const inputStream = Readable.from(inputBuffer);
    const outputStream = new PassThrough();
    const chunks: Buffer[] = [];

    outputStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    outputStream.on("end", () => resolve(Buffer.concat(chunks)));
    outputStream.on("error", reject);

    ffmpeg(inputStream)
      .inputFormat(inputFormat)
      .audioChannels(1)
      .audioFrequency(16000)
      .audioCodec("pcm_s16le")
      .format("wav")
      .on("error", reject)
      .pipe(outputStream, { end: true });
  });
}

function mimeToFfmpegFormat(mimeType: string): string {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "mp4";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("wav")) return "wav";
  return "ogg"; // WhatsApp default
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const format = mimeToFfmpegFormat(mimeType);
  const wavBuffer = await toWav(audioBuffer, format);

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
