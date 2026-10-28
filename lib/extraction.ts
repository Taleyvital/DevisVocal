import type { DraftItem, QuoteDraft } from "./quote";

const QUOTE_SCHEMA = {
  type: "object",
  properties: {
    client: { type: "string", description: "Nom du client" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          designation: { type: "string" },
          quantity: { type: ["number", "null"] },
          unit: { type: "string", description: "Ex: m2, ml, u, m3, forfait" },
          unit_price_fcfa: { type: ["number", "null"] },
        },
        required: ["designation", "quantity", "unit", "unit_price_fcfa"],
      },
    },
    missing_questions: {
      type: "array",
      items: { type: "string" },
      description: "Questions à poser à l'artisan pour les infos manquantes",
    },
  },
  required: ["client", "items", "missing_questions"],
};

const SYSTEM_PROMPT = `Tu es un assistant pour artisans ivoiriens.
À partir d'une transcription vocale en français ivoirien ou en français standard,
tu extrais les informations d'un devis de chantier.

Règles :
- Interprète le vocabulaire de chantier ivoirien (béton, ferraillage, parpaing, dalle, etc.)
- Les prix sont en FCFA
- Si une quantité ou un prix unitaire est manquant pour un poste, ajoute une question claire dans "missing_questions"
- N'invente JAMAIS de prix ou de quantités — mets null et pose la question
- Pour le client : si non mentionné, mets "À définir"
- Les unités courantes : m2, m3, ml, u (unité), kg, forfait, sac, m
- Retourne UNIQUEMENT du JSON valide, sans texte autour`;

// Always returns the lines found, with null quantity/price where unknown,
// plus questions for the artisan — the UI lets them fill the gaps.
export async function extractQuoteData(
  transcription: string
): Promise<QuoteDraft> {
  const res = await fetch("https://api.meta.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.META_API_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "muse-spark-1.3",
      messages: [
        { role: "developer", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Transcription vocale :\n\n${transcription}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "devis_schema",
          schema: QUOTE_SCHEMA,
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Extraction API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content as string;
  const parsed = JSON.parse(content);

  const items: DraftItem[] = (parsed.items ?? []).map((item: DraftItem) => ({
    designation: String(item.designation ?? ""),
    quantity: typeof item.quantity === "number" ? item.quantity : null,
    unit: String(item.unit ?? "u"),
    unit_price_fcfa:
      typeof item.unit_price_fcfa === "number" ? item.unit_price_fcfa : null,
  }));

  return {
    client: String(parsed.client ?? "À définir"),
    items,
    questions: (parsed.missing_questions ?? []) as string[],
  };
}
