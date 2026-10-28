import { chatJSON } from "./meta";
import type { CatalogueItem, DraftItem, QuoteDraft } from "./quote";

const nullable = (type: string) => ({ type: [type, "null"] });

const QUOTE_SCHEMA = {
  type: "object",
  properties: {
    client: { type: "string", description: "Nom du client, ou \"À définir\"" },
    project: {
      type: "string",
      description: "Objet et/ou lieu du chantier, chaîne vide si non mentionné",
    },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          section: {
            ...nullable("string"),
            description: "Lot ou partie du chantier (ex : Gros œuvre, Plomberie), null sinon",
          },
          designation: { type: "string" },
          quantity: nullable("number"),
          unit: { type: "string", description: "Ex: m2, ml, u, m3, forfait, sac, kg" },
          unit_price_fcfa: nullable("number"),
          hint: {
            ...nullable("string"),
            description:
              "Explication courte si une valeur a été calculée, déduite ou reprise du catalogue, sinon null",
          },
        },
        required: ["section", "designation", "quantity", "unit", "unit_price_fcfa", "hint"],
      },
    },
    tva: {
      ...nullable("boolean"),
      description: "false si l'artisan dit sans TVA / hors taxe, true s'il la demande, null sinon",
    },
    assumptions: {
      type: "array",
      items: { type: "string" },
      description: "Interprétations faites que l'artisan doit vérifier",
    },
    missing_questions: {
      type: "array",
      items: { type: "string" },
      description: "Questions à poser à l'artisan pour les infos manquantes",
    },
  },
  required: ["client", "project", "items", "tva", "assumptions", "missing_questions"],
};

const SYSTEM_PROMPT = `Tu es l'assistant d'un artisan du BTP en Côte d'Ivoire.
À partir de ce qu'il dicte (français ivoirien ou standard, transcription parfois imparfaite),
tu prépares les lignes d'un devis de chantier.

COMPRENDRE L'ORAL
- Nombres dits en lettres ou à moitié : « deux cent cinquante mille » = 250000, « 250 mille » = 250000,
  « un million deux » = 1200000, « 1 million 500 » = 1500000, « 3,5 millions » = 3500000.
- « F », « francs », « CFA », « balles » (au sens de francs) = FCFA.
- Argot monétaire ambigu (« bâton », « brique », « kolo »…) : ne devine pas la valeur, pose une question.
- L'artisan se corrige en parlant (« non, plutôt 25 », « euh attends, 30 ») : garde la dernière valeur.
- Ignore les hésitations, répétitions et bruits de transcription.

CALCULS QUE TU PEUX FAIRE (et expliquer dans "hint")
- Prix global pour une quantité : « 10 sacs pour 50 000 » → quantité 10, prix unitaire 5000,
  hint « 50 000 F ÷ 10 sacs ».
- Surfaces : « pièce de 4 sur 5 » → 20 m2 ; murs « 10 mètres sur 3 » → 30 m2.
- Volumes : « dalle 5 sur 4, 15 centimètres d'épaisseur » → 3 m3.
- Montant global sans quantité (« la main d'œuvre c'est 300 000 », « en tout ») → quantité 1, unité forfait.
- « Même prix que … » → reprends le prix de la ligne citée.
- Arrondis : jamais. Calcule exactement.

VOCABULAIRE DE CHANTIER IVOIRIEN
- « fer de 8/10/12 » = barres d'acier HA8/HA10/HA12 ; « agglos », « briques de 15/de 12 » = parpaings/agglos de 15/12 ;
  « crépissage » = enduit ; « staff » = faux plafond en staff ; « BA13 » = plaque de plâtre ;
  « tôle bac alu », « dallage », « chape », « fosse septique », « regard », « carreaux » = carrelage.
- Rédige des désignations propres et professionnelles (majuscule, sans fautes),
  sans ajouter ce qui n'a pas été dit (ne transforme pas « pose » en « fourniture et pose »).

REGROUPEMENT
- Si l'artisan parle par lots ou parties (« pour le gros œuvre… », « côté plomberie… »), remplis "section".
  Sinon mets null partout.

PRIX DU CATALOGUE
- Si un catalogue de l'artisan est fourni et qu'il ne donne pas de prix pour un article qui y figure
  (même article, même unité), reprends ce prix et mets hint « Prix de votre ancien devis ».
- Un prix dicté a toujours priorité sur le catalogue.

RÈGLES STRICTES
- N'invente JAMAIS une quantité ou un prix : mets null et pose une question claire et courte.
- Chaque interprétation non évidente (calcul, mot d'argot, unité supposée) va dans "assumptions".
- Client non mentionné → "À définir".
- Unités : m2, m3, ml, m, u, kg, sac, forfait, jour, h.
- Retourne UNIQUEMENT du JSON valide.`;

const AMEND_INSTRUCTIONS = `
MODIFICATION D'UN DEVIS EXISTANT
Le message contient le devis actuel (JSON) puis une consigne de l'artisan
(« ajoute 10 sacs de ciment à 5 500 », « enlève la peinture », « le client c'est M. Konan »,
« mets le carrelage à 9 000 »). Applique la consigne et renvoie le devis COMPLET mis à jour.
Ne modifie pas ce que la consigne ne concerne pas. Les "assumptions" et "missing_questions"
ne portent que sur ce qui reste à vérifier après la modification.`;

interface ExtractOptions {
  catalogue?: CatalogueItem[];
  current?: QuoteDraft; // when set, `speech` is a correction to apply to it
}

export async function extractQuoteData(
  speech: string,
  { catalogue = [], current }: ExtractOptions = {}
): Promise<QuoteDraft> {
  const parts: string[] = [];
  if (catalogue.length) {
    parts.push(`Catalogue de l'artisan (prix habituels) :\n${JSON.stringify(catalogue)}`);
  }
  if (current) {
    parts.push(`Devis actuel :\n${JSON.stringify(current)}`);
    parts.push(`Consigne de l'artisan :\n${speech}`);
  } else {
    parts.push(`Transcription vocale :\n${speech}`);
  }

  const parsed = await chatJSON<Record<string, unknown>>(
    [
      { role: "developer", content: SYSTEM_PROMPT + (current ? AMEND_INSTRUCTIONS : "") },
      { role: "user", content: parts.join("\n\n") },
    ],
    "devis_schema",
    QUOTE_SCHEMA
  );

  return normalizeDraft(parsed);
}

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
const strings = (v: unknown) =>
  Array.isArray(v) ? v.map(text).filter(Boolean) : [];

// Defensive: model output and client input go through the same shape check
export function normalizeDraft(raw: unknown): QuoteDraft {
  const r = (raw ?? {}) as Record<string, unknown>;
  const items: DraftItem[] = (Array.isArray(r.items) ? r.items : [])
    .slice(0, 100)
    .map((i: Record<string, unknown>) => ({
      section: text(i?.section) || null,
      designation: text(i?.designation),
      quantity: num(i?.quantity),
      unit: text(i?.unit) || "u",
      unit_price_fcfa: num(i?.unit_price_fcfa),
      hint: text(i?.hint) || null,
    }));

  return {
    client: text(r.client) || "À définir",
    project: text(r.project),
    items,
    tva: typeof r.tva === "boolean" ? r.tva : null,
    assumptions: strings(r.assumptions),
    questions: strings(r.missing_questions ?? r.questions),
  };
}
