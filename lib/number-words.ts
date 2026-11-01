// French amount in words for "Arrêté le présent devis à la somme de …".
// Taken from the devis-maker project (src/lib/numberToWords.ts).

const UNITES = [
  "", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
];

function dixaines(n: number): string {
  if (n < 20) return UNITES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  // 70-79 : soixante + 10..19 (avec "et" pour 71)
  if (d === 7) return u === 1 ? "soixante-et-onze" : "soixante-" + UNITES[10 + u];
  // 80-89 : quatre-vingts / quatre-vingt-X
  if (d === 8) return u === 0 ? "quatre-vingts" : "quatre-vingt-" + UNITES[u];
  // 90-99 : quatre-vingt-dix + ...
  if (d === 9) return "quatre-vingt-" + UNITES[10 + u];
  const tens = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante"][d];
  const liaison = u === 1 ? "-et-" : u > 0 ? "-" : "";
  return tens + liaison + (u > 0 ? UNITES[u] : "");
}

/**
 * suppressFinalS : true quand "cent" est suivi d'un multiplicateur (mille, million)
 * → "deux cent mille" et non "deux cents mille"
 */
function centaines(n: number, suppressFinalS = false): string {
  if (n < 100) return dixaines(n);
  const c = Math.floor(n / 100);
  const r = n % 100;
  if (c === 1) return "cent" + (r > 0 ? " " + dixaines(r) : "");
  const centWord = UNITES[c] + " cent" + (r === 0 && !suppressFinalS ? "s" : "");
  return centWord + (r > 0 ? " " + dixaines(r) : "");
}

export function numberToWords(n: number): string {
  if (!n || n <= 0) return "";
  n = Math.round(n);
  let result = "";

  if (n >= 1000000) {
    const m = Math.floor(n / 1000000);
    // "cent" avant "millions" : pas de s (ex: deux cent millions)
    result += m === 1 ? "un million" : centaines(m, true) + " millions";
    n %= 1000000;
    if (n > 0) result += " ";
  }

  if (n >= 1000) {
    const k = Math.floor(n / 1000);
    // "cent" avant "mille" : pas de s (ex: deux cent mille)
    result += k === 1 ? "mille" : centaines(k, true) + " mille";
    n %= 1000;
    if (n > 0) result += " ";
  }

  if (n > 0) result += centaines(n); // ici "cents" possible si multiple de 100

  return result.charAt(0).toUpperCase() + result.slice(1);
}

export function totalEnLettres(total: number): string {
  const mots = numberToWords(total);
  return mots ? mots + " Francs CFA" : "";
}
