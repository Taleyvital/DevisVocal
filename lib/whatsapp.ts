import FormData from "form-data";

const BASE = "https://graph.facebook.com/v22.0";
const PHONE_ID = () => process.env.WHATSAPP_PHONE_NUMBER_ID!;
const TOKEN = () => process.env.WHATSAPP_TOKEN!;

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN()}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp API error ${res.status}: ${body}`);
  }
  return res;
}

export async function getMediaUrl(
  mediaId: string
): Promise<{ url: string; mimeType: string }> {
  const res = await apiFetch(`/${mediaId}`);
  const json = await res.json();
  return { url: json.url as string, mimeType: json.mime_type as string };
}

export async function downloadMedia(mediaId: string): Promise<Buffer> {
  const { url } = await getMediaUrl(mediaId);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN()}` },
  });
  if (!res.ok) throw new Error(`Media download failed: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function sendTextMessage(to: string, text: string): Promise<void> {
  await apiFetch(`/${PHONE_ID()}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
}

export async function uploadMedia(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", buffer, { filename, contentType: mimeType });

  const res = await fetch(`${BASE}/${PHONE_ID()}/media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN()}`,
      ...form.getHeaders(),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: form.getBuffer() as any,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Media upload failed ${res.status}: ${body}`);
  }
  const json = await res.json();
  return json.id as string;
}

export async function sendDocument(
  to: string,
  pdfBuffer: Buffer,
  filename: string,
  caption: string
): Promise<void> {
  const mediaId = await uploadMedia(pdfBuffer, filename, "application/pdf");
  await apiFetch(`/${PHONE_ID()}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "document",
      document: { id: mediaId, filename, caption },
    }),
  });
}
