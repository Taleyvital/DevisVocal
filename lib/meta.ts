// Muse Spark (Meta Model API) chat completion returning structured JSON.

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: "developer" | "user" | "assistant";
  content: string | ContentPart[];
}

export async function chatJSON<T>(
  messages: ChatMessage[],
  schemaName: string,
  schema: object
): Promise<T> {
  const base = process.env.META_API_URL || "https://api.meta.ai/v1";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.META_API_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "muse-spark-1.3",
      messages,
      response_format: {
        type: "json_schema",
        json_schema: { name: schemaName, schema },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content as string;
  return JSON.parse(content) as T;
}
