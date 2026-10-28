"use client";

import { useEffect, useRef, useState } from "react";
import { computeTotals, formatFCFA, type QuoteDraft } from "@/lib/quote";
import { BuildingIcon, MicIcon, ShareIcon, StopIcon } from "./components/icons";
import { ProfileSheet, useProfile } from "./components/ProfileSheet";
import {
  completeItems,
  QuoteEditor,
  toEditLine,
  type EditLine,
} from "./components/QuoteEditor";
import { extensionFor, useRecorder } from "./components/useRecorder";

type Phase = "idle" | "analyzing" | "editing" | "generating" | "ready";

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

  const [transcription, setTranscription] = useState("");
  const [client, setClient] = useState("");
  const [lines, setLines] = useState<EditLine[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [generated, setGenerated] = useState<GeneratedQuote | null>(null);

  const [profile, setProfile] = useProfile();
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

  async function analyze(input: { audio?: Blob; text?: string }) {
    setError(null);
    setPhase("analyzing");
    const form = new FormData();
    if (input.audio) {
      form.append("audio", input.audio, `note.${extensionFor(input.audio.type)}`);
    } else {
      form.append("text", input.text ?? "");
    }

    try {
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = (await res.json()) as {
        error?: string;
        transcription?: string;
        draft?: QuoteDraft;
      };
      if (!res.ok || !data.draft) {
        setError(data.error ?? "Une erreur est survenue. Réessayez.");
        setPhase("idle");
        return;
      }
      setTranscription(data.transcription ?? "");
      setClient(data.draft.client === "À définir" ? "" : data.draft.client);
      setLines(
        data.draft.items.length ? data.draft.items.map(toEditLine) : [toEditLine()]
      );
      setQuestions(data.draft.questions);
      setPhase("editing");
    } catch {
      setError("Pas de connexion. Vérifiez votre réseau et réessayez.");
      setPhase("idle");
    }
  }

  const items = completeItems(lines);

  async function generate() {
    if (!items) return;
    setError(null);
    setPhase("generating");
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, client, items, transcription }),
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
        totalTtc: computeTotals(items).total_ttc,
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
    const text = `Devis ${number}${client ? ` – ${client}` : ""} : ${formatFCFA(totalTtc)} TTC`;

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `Devis ${number}`, text });
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
    setClient("");
    setLines([]);
    setQuestions([]);
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

        {(phase === "editing" || phase === "generating") && (
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
              client={client}
              onClientChange={setClient}
              lines={lines}
              onLinesChange={setLines}
              questions={questions}
              disabled={phase === "generating"}
            />

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
                disabled={!items || phase === "generating"}
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
              {client && <p>{client}</p>}
              <p className="ready-total">{formatFCFA(generated.totalTtc)} TTC</p>
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
          onClose={() => setProfileOpen(false)}
        />
      )}
    </div>
  );
}
