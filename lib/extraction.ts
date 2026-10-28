import type { QuoteItem } from "./quote";

export interface ExtractedQuote {
  client: string;
  items: QuoteItem[];
  total_ht: number;
  tva: number;
  total_ttc: number;
}

export interface MissingInfo {
  missing: true;
  questions: string[];
}

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

export async function extractQuoteData(
  transcription: string
): Promise<ExtractedQuote | MissingInfo> {
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

  if (parsed.missing_questions?.length > 0) {
    return { missing: true, questions: parsed.missing_questions as string[] };
  }

  // Compute totals
  const items: QuoteItem[] = parsed.items.map(
    (item: {
      designation: string;
      quantity: number;
      unit: string;
      unit_price_fcfa: number;
    }) => ({
      designation: item.designation,
      quantity: item.quantity,
      unit: item.unit,
      unit_price_fcfa: item.unit_price_fcfa,
      total_fcfa: Math.round(item.quantity * item.unit_price_fcfa),
    })
  );

  const total_ht = items.reduce((sum, i) => sum + i.total_fcfa, 0);
  const tva = Math.round(total_ht * 0.18);
  const total_ttc = total_ht + tva;

  return {
    client: parsed.client as string,
    items,
    total_ht,
    tva,
    total_ttc,
  };
}
