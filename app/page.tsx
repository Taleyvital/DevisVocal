"use client";

import { useEffect, useRef, useState } from "react";
import { computeTotals, formatFCFA, type QuoteDraft } from "@/lib/quote";
import { BuildingIcon, MicIcon, ShareIcon, StopIcon } from "./components/icons";
import { ProfileSheet, useProfile, useTemplate } from "./components/ProfileSheet";
import {
  completeItems,
  fromDraft,
  QuoteEditor,
  toDraft,
  type EditQuote,
} from "./components/QuoteEditor";
import { extensionFor, useRecorder } from "./components/useRecorder";

type Phase = "idle" | "analyzing" | "editing" | "amending" | "generating" | "ready";

const MAX_SECONDS = 180;

interface GeneratedQuote {
  number: string;
  file: File;
  url: string;
  totalTtc: number;
}

function formatDuration(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [correction, setCorrection] = useState("");

  const [transcription, setTranscription] = useState("");
  const [quote, setQuote] = useState<EditQuote | null>(null);
  const [generated, setGenerated] = useState<GeneratedQuote | null>(null);


  const [profile, setProfile] = useProfile();
  const [template, setTemplate] = useTemplate();
  const { catalogue, tva_rate: tvaRate } = template;
  const [profileOpen, setProfileOpen] = useState(false);
  const hasProfile = Boolean(profile.company_name || profile.name);

  const recorder = useRecorder({
    maxSeconds: MAX_SECONDS,
    onComplete: (blob) => analyze({ audio: blob }),
    onError: setError,
  });

  // Free the PDF object URL when replaced or on unmount
  const pdfUrlRef = useRef<string | null>(null);
  useEffect(() => {
    pdfUrlRef.current = generated?.url ?? null;
  }, [generated]);
  useEffect(() => () => {
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
  }, []);

  // From the editor, speech is a correction applied to the current quote
  async function analyze(input: { audio?: Blob; text?: string }) {
    const amending = phase === "editing" && quote !== null;
    const fallbackPhase: Phase = amending ? "editing" : "idle";
    setError(null);
    setPhase(amending ? "amending" : "analyzing");
    const form = new FormData();
    if (input.audio) {
      form.append("audio", input.audio, `note.${extensionFor(input.audio.type)}`);
    } else {
      form.append("text", input.text ?? "");
    }
    if (amending) form.append("current", JSON.stringify(toDraft(quote)));
    if (catalogue.length) form.append("catalogue", JSON.stringify(catalogue));

    try {
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = (await res.json()) as {
        error?: string;
        transcription?: string;
        draft?: QuoteDraft;
      };
      if (!res.ok || !data.draft) {
        setError(data.error ?? "Une erreur est survenue. Réessayez.");
        setPhase(fallbackPhase);
        return;
      }
      const said = data.transcription ?? "";
      setTranscription((prev) => (amending && prev ? `${prev}\n\nCorrection : ${said}` : said));
      setQuote(fromDraft(data.draft, amending ? quote.tva : template.apply_tva));
      setCorrection("");
      setPhase("editing");
    } catch {
      setError("Pas de connexion. Vérifiez votre réseau et réessayez.");
      setPhase(fallbackPhase);
    }
  }

  const items = quote ? completeItems(quote.lines) : null;
  const effectiveTva = quote?.tva ? tvaRate : 0;

  async function generate() {
    if (!items) return;
    setError(null);
    setPhase("generating");
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          client: quote?.client,
          project: quote?.project,
          items,
          tva_rate: effectiveTva,
          template: { ...template, catalogue: [] },
          transcription,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erreur lors de la génération du PDF.");
        setPhase("editing");
        return;
      }
      const blob = await res.blob();
      const number = res.headers.get("X-Quote-Number") ?? "devis";
      const file = new File([blob], `${number}.pdf`, { type: "application/pdf" });
      if (generated) URL.revokeObjectURL(generated.url);
      setGenerated({
        number,
        file,
        url: URL.createObjectURL(blob),
        totalTtc: computeTotals(items, effectiveTva).total_ttc,
      });
      setPhase("ready");
    } catch {
      setError("Pas de connexion. Vérifiez votre réseau et réessayez.");
      setPhase("editing");
    }
  }

  async function share() {
    if (!generated) return;
    const { file, number, totalTtc } = generated;
    const client = quote?.client;
    const label = template.title.charAt(0) + template.title.slice(1).toLowerCase();
    const text = `${label} ${number}${client ? ` – ${client}` : ""} : ${formatFCFA(totalTtc)}${effectiveTva ? " TTC" : ""}`;

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${label} ${number}`, text });
      } catch (err) {
        if ((err as DOMException)?.name !== "AbortError") {
          setError("Le partage a échoué. Téléchargez le PDF puis envoyez-le.");
        }
      }
      return;
    }

    // No file sharing (desktop browsers): download it instead
    const a = document.createElement("a");
    a.href = generated.url;
    a.download = file.name;
    a.click();
    setError(
      "Le partage direct n'est pas disponible sur ce navigateur : le PDF a été téléchargé, envoyez-le depuis WhatsApp."
    );
  }

  function reset() {
    if (generated) URL.revokeObjectURL(generated.url);
    setGenerated(null);
    setTranscription("");
    setQuote(null);
    setCorrection("");
    setTypedText("");
    setTyping(false);
    setError(null);
    setPhase("idle");
  }

  const isCapture = phase === "idle" || phase === "analyzing";

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">DevisVocal</span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setProfileOpen(true)}
        >
          <BuildingIcon />
          Mon entreprise
          {!hasProfile && <span className="dot" aria-label="à compléter" />}
        </button>
      </header>

      <main className="content">
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}

        {isCapture && (
          <section className="capture">
            <h1>Dictez votre devis</h1>
            <p className="muted hint">
              Ex&nbsp;: «&nbsp;Devis pour M.&nbsp;Kouassi, carrelage 20&nbsp;m² à
              8&nbsp;000&nbsp;F le m², plinthes 15&nbsp;mètres à 1&nbsp;500&nbsp;F.&nbsp;»
            </p>

            <button
              type="button"
              className={`mic ${recorder.recording ? "is-recording" : ""}`}
              onClick={recorder.recording ? recorder.stop : recorder.start}
              disabled={phase === "analyzing"}
              aria-label={
                recorder.recording ? "Arrêter l'enregistrement" : "Enregistrer une note vocale"
              }
            >
              {phase === "analyzing" ? (
                <span className="spinner" aria-hidden />
              ) : recorder.recording ? (
                <StopIcon size={56} />
              ) : (
                <MicIcon size={64} />
              )}
            </button>

            <p className="status" aria-live="polite">
              {phase === "analyzing"
                ? "Analyse en cours…"
                : recorder.recording
                  ? `Enregistrement ${formatDuration(recorder.seconds)} / ${formatDuration(MAX_SECONDS)} — touchez pour terminer`
                  : "Touchez le micro pour commencer"}
            </p>

            {!recorder.recording && phase === "idle" && (
              <div className="type-instead">
                {typing ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (typedText.trim()) analyze({ text: typedText });
                    }}
                  >
                    <label className="field">
                      <span>Décrivez le devis</span>
                      <textarea
                        rows={4}
                        value={typedText}
                        onChange={(e) => setTypedText(e.target.value)}
                        placeholder="Client, prestations, quantités, prix…"
                      />
                    </label>
                    <button
                      type="submit"
                      className="btn btn-primary btn-block"
                      disabled={!typedText.trim()}
                    >
                      Analyser
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => setTyping(true)}
                  >
                    Écrire plutôt
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {quote && (phase === "editing" || phase === "amending" || phase === "generating") && (
          <section>
            <div className="section-head">
              <h1>Votre devis</h1>
              <button type="button" className="link-btn" onClick={reset}>
                Recommencer
              </button>
            </div>

            {!hasProfile && (
              <button
                type="button"
                className="notice notice-action"
                onClick={() => setProfileOpen(true)}
              >
                Ajoutez le nom de votre entreprise pour qu&apos;il apparaisse
                sur le devis →
              </button>
            )}

            <QuoteEditor
              quote={quote}
              onChange={setQuote}
              tvaRate={tvaRate}
              disabled={phase !== "editing"}
            />

            <div className="amend">
              <h2 className="section-title">Corriger à la voix</h2>
              <p className="muted amend-hint">
                Ex&nbsp;: «&nbsp;ajoute 10 sacs de ciment à 5&nbsp;500&nbsp;», «&nbsp;enlève
                la peinture&nbsp;», «&nbsp;le client c&apos;est M.&nbsp;Konan&nbsp;»
              </p>
              <div className="amend-row">
                <button
                  type="button"
                  className={`mic-sm ${recorder.recording ? "is-recording" : ""}`}
                  onClick={recorder.recording ? recorder.stop : recorder.start}
                  disabled={phase !== "editing"}
                  aria-label={
                    recorder.recording ? "Terminer la correction" : "Dicter une correction"
                  }
                >
                  {phase === "amending" ? (
                    <span className="spinner spinner-sm" aria-hidden />
                  ) : recorder.recording ? (
                    <StopIcon size={26} />
                  ) : (
                    <MicIcon size={28} />
                  )}
                </button>
                <form
                  className="amend-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (correction.trim()) analyze({ text: correction });
                  }}
                >
                  <input
                    value={correction}
                    onChange={(e) => setCorrection(e.target.value)}
                    placeholder={
                      recorder.recording
                        ? `Enregistrement ${formatDuration(recorder.seconds)}…`
                        : phase === "amending"
                          ? "Correction en cours…"
                          : "Ou écrivez une correction"
                    }
                    disabled={phase !== "editing" || recorder.recording}
                    aria-label="Correction écrite"
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={!correction.trim() || phase !== "editing"}
                  >
                    OK
                  </button>
                </form>
              </div>
            </div>

            {transcription && (
              <details className="transcript">
                <summary>Ce que j&apos;ai entendu</summary>
                <p>{transcription}</p>
              </details>
            )}

            <div className="action-bar">
              <button
                type="button"
                className="btn btn-primary btn-block btn-lg"
                onClick={generate}
                disabled={!items || phase !== "editing" || recorder.recording}
              >
                {phase === "generating"
                  ? "Génération…"
                  : items
                    ? "Générer le PDF"
                    : "Complétez les champs en rouge"}
              </button>
            </div>
          </section>
        )}

        {phase === "ready" && generated && (
          <section className="ready">
            <div className="ready-card">
              <p className="muted">Devis prêt</p>
              <h1>{generated.number}</h1>
              {quote?.client && <p>{quote.client}</p>}
              <p className="ready-total">
                {formatFCFA(generated.totalTtc, template.currency)}
                {effectiveTva ? " TTC" : ""}
              </p>
            </div>

            <button
              type="button"
              className="btn btn-share btn-block btn-lg"
              onClick={share}
            >
              <ShareIcon /> Partager sur WhatsApp
            </button>
            <a
              className="btn btn-ghost btn-block"
              href={generated.url}
              target="_blank"
              rel="noopener"
            >
              Voir le PDF
            </a>
            <div className="ready-links">
              <button
                type="button"
                className="link-btn"
                onClick={() => setPhase("editing")}
              >
                Modifier
              </button>
              <button type="button" className="link-btn" onClick={reset}>
                Nouveau devis
              </button>
            </div>
          </section>
        )}
      </main>

      {profileOpen && (
        <ProfileSheet
          profile={profile}
          onSave={setProfile}
          template={template}
          onTemplateChange={setTemplate}
          onClose={() => setProfileOpen(false)}
        />
      )}
    </div>
  );
}
