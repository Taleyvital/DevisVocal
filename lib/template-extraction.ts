import { chatJSON, type ChatMessage } from "./meta";
import {
  sanitizeBusiness,
  sanitizeTemplate,
  type BusinessInfo,
  type QuoteTemplate,
} from "./template";

const nullable = (type: string) => ({ type: [type, "null"] });

const TEMPLATE_SCHEMA = {
  type: "object",
  properties: {
    template: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titre du document, ex : DEVIS, DEVIS ESTIMATIF, FACTURE PROFORMA" },
        primary_color: { type: "string", description: "Couleur principale (en-têtes, tableau) en hex #rrggbb" },
        accent_color: { type: "string", description: "Couleur claire des lignes alternées en hex #rrggbb, #f5f5f5 si aucune" },
        header_style: { type: "string", enum: ["band", "light"], description: "band = bandeau de couleur pleine en haut ; light = fond blanc" },
        font: { type: "string", enum: ["sans", "serif"] },
        currency: { type: "string", description: "Libellé de la monnaie tel qu'écrit, ex : FCFA, F CFA" },
        tva_rate: { ...nullable("number"), description: "Taux de TVA en décimal (0.18), null si absent" },
        apply_tva: { type: "boolean", description: "false si le devis n'a pas de TVA ou indique TVA non applicable" },
        conditions: { type: "string", description: "Texte des conditions recopié (validité, acompte, délais, paiement), chaîne vide si absent" },
        signature: { type: "string", description: "Libellé de la zone de signature (ex : Bon pour accord), chaîne vide si absente" },
        catalogue: {
          type: "array",
          description: "Chaque ligne du devis avec son prix unitaire",
          items: {
            type: "object",
            properties: {
              designation: { type: "string" },
              unit: { type: "string" },
              unit_price_fcfa: { type: "number" },
            },
            required: ["designation", "unit", "unit_price_fcfa"],
          },
        },
      },
      required: [
        "title", "primary_color", "accent_color", "header_style", "font", "currency",
        "tva_rate", "apply_tva", "conditions", "signature", "catalogue",
      ],
    },
    business: {
      type: "object",
      description: "Coordonnées de l'ENTREPRISE émettrice (pas du client)",
      properties: {
        company_name: { type: "string" },
        name: { type: "string", description: "Nom du gérant / artisan si indiqué" },
        phone: { type: "string" },
        email: { type: "string" },
        address: { type: "string" },
        legal: { type: "string", description: "RCCM, NCC/IDU, régime fiscal, coordonnées bancaires, une info par ligne" },
      },
      required: ["company_name", "name", "phone", "email", "address", "legal"],
    },
  },
  required: ["template", "business"],
};

const SYSTEM_PROMPT = `Tu analyses un ancien devis d'un artisan du BTP en Côte d'Ivoire
(photo ou PDF) pour que ses prochains devis reprennent le même modèle.

Relève :
- La mise en forme : titre du document, couleur principale et couleur claire (estime-les en hex
  à partir de l'image), bandeau coloré ou fond blanc, police avec ou sans empattement.
- Les textes à réutiliser mot pour mot : conditions (validité, acompte, délais, modalités de paiement),
  libellé de signature.
- La TVA : taux et si elle est appliquée.
- Le catalogue : chaque prestation/fourniture avec son unité et son prix unitaire en FCFA (nombre entier).
- Les coordonnées de l'entreprise ÉMETTRICE et ses mentions légales (RCCM, NCC, banque).
  Ne confonds jamais avec le client.

Si une information est illisible ou absente, laisse une chaîne vide (ou null pour la TVA).
N'invente rien. Les données du client et les montants totaux ne nous intéressent pas.
Retourne UNIQUEMENT du JSON valide.`;

export async function extractTemplate(
  pages: string[], // data: URLs (JPEG)
  pdfText: string,
  source: string
): Promise<{ template: QuoteTemplate; business: BusinessInfo }> {
  const content: Exclude<ChatMessage["content"], string> = [
    { type: "text", text: "Voici l'ancien devis." },
    ...pages.map((url) => ({ type: "image_url" as const, image_url: { url } })),
  ];
  if (pdfText) {
    content.push({
      type: "text",
      text: `Texte extrait du PDF (plus fiable que l'image pour les chiffres) :\n${pdfText.slice(0, 15000)}`,
    });
  }

  const parsed = await chatJSON<{ template?: unknown; business?: unknown }>(
    [
      { role: "developer", content: SYSTEM_PROMPT },
      { role: "user", content },
    ],
    "modele_devis",
    TEMPLATE_SCHEMA
  );

  return {
    template: sanitizeTemplate({ ...(parsed.template as object), source }),
    business: sanitizeBusiness(parsed.business),
  };
}
