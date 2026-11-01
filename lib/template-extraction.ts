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

  const messages = (system: string): ChatMessage[] => [
    { role: "developer", content: system },
    { role: "user", content },
  ];

  // Style/catalogue and the faithful HTML layout are independent: run both,
  // the layout is optional (the standard PDF is used without it).
  const [parsed, layout] = await Promise.all([
    chatJSON<{ template?: unknown; business?: unknown }>(
      messages(SYSTEM_PROMPT),
      "modele_devis",
      TEMPLATE_SCHEMA
    ),
    chatJSON<unknown>(messages(LAYOUT_PROMPT), "gabarit_html", LAYOUT_SCHEMA).catch((err) => {
      console.error("[template] layout extraction failed (non-fatal):", err);
      return null;
    }),
  ]);

  return {
    template: sanitizeTemplate({ ...(parsed.template as object), source, layout }),
    business: sanitizeBusiness(parsed.business),
  };
}

const LAYOUT_SCHEMA = {
  type: "object",
  properties: {
    html: { type: "string", description: "Document HTML complet (avec <style>) au format A4, contenant {{{rows}}}" },
    item_row: { type: "string", description: "Une ligne <tr> d'article" },
    section_row: { type: "string", description: "Une ligne <tr> de titre de section, chaîne vide si le devis n'a pas de sections" },
    thousands: { type: "string", enum: [" ", "."], description: "Séparateur de milliers utilisé sur le devis" },
  },
  required: ["html", "item_row", "section_row", "thousands"],
};

const LAYOUT_PROMPT = `Tu reproduis en HTML/CSS la mise en page d'un ancien devis d'artisan (image fournie),
pour générer ses prochains devis avec EXACTEMENT la même présentation.

OBJECTIF : quelqu'un qui compare l'ancien devis et le nouveau doit reconnaître le même document :
mêmes blocs aux mêmes endroits, mêmes bordures, mêmes couleurs (hex estimés), mêmes tailles de texte
relatives, mêmes majuscules/italiques/soulignements, mêmes intitulés de colonnes, même ordre.

FORMAT
- Page A4 : 210mm de large. Mets les marges dans le CSS du body (padding en mm), @page { margin: 0 }.
- Polices : uniquement des familles génériques (Arial, Helvetica, sans-serif, serif). Pas de @font-face.
- Tout le CSS dans une seule balise <style>. Mise en page en flex/grid/table, pas de position absolue.
- INTERDIT : <script>, <img>, <svg>, liens, URL externes, formulaires. Le logo : remplace-le par
  {{company_name}} stylé comme sur l'original (ou un bloc de couleur s'il s'agit d'une forme).

CHAMPS À INSÉRER (remplace TOUTES les données variables de l'ancien devis par ces champs)
- Entreprise : {{company_name}} {{name}} {{phone}} {{email}} {{address}} {{legal}}
- Document : {{title}} (ex : DEVIS, FACTURE PRO-FORMA) {{number}} {{date}} (« 3 novembre 2026 ») {{date_short}} (« 03/11/2026 »)
- Client : {{client}} {{project}} (objet / chantier)
- Totaux : {{total_ht}} {{tva}} {{tva_rate}} {{total_ttc}} {{total}} {{currency}}
  Montant en lettres : {{total_words}} = le nombre en lettres SEUL, sans la monnaie
  (ex : « Arrêté le présent devis à la somme de : {{total_words}} francs CFA »)
- Conditions de paiement/validité : {{conditions}}
- Blocs conditionnels : {{#has_tva}}…{{/has_tva}} (lignes TVA/TTC), {{^has_tva}}…{{/has_tva}} (sans TVA),
  {{#project}}…{{/project}} si l'objet est facultatif.
- Lignes du tableau : à l'intérieur de <tbody>, écris {{{rows}}} (trois accolades) à la place des articles.
  Les lignes de totaux restent après {{{rows}}} dans le même tableau si c'est le cas sur l'original.

LIGNES
- "item_row" : UNE balise <tr> d'article, avec autant de cellules que l'en-tête, styles inline possibles.
  Champs : {{num}} {{designation}} {{quantity}} {{unit}} {{unit_price}} {{total}}.
  N'utilise {{unit}} que si l'original a une colonne ou une mention d'unité.
- "section_row" : UNE balise <tr> de titre de section (ex : « A1 | Fourniture et pose… »), champs {{code}} {{section}} {{subtotal}}.
  Chaîne vide si l'original n'a pas de sections.

TEXTES FIXES : recopie mot pour mot les textes propres à l'entreprise qui ne changent pas d'un devis
à l'autre (slogan, activité, « NB : … », « BON POUR ACCORD », intitulés), sauf les conditions → {{conditions}}.
N'écris AUCUNE donnée de l'ancien client ni aucun montant de l'ancien devis.
Les champs contiennent seulement la valeur : garde les intitulés (« CONDITIONS PARTICULIÈRES : »,
« Tél : »…) dans le gabarit, devant le champ, comme sur l'original.
Retourne UNIQUEMENT du JSON valide.`;
