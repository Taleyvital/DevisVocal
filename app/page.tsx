"use client";

import { useEffect, useRef, useState } from "react";
import { computeTotals, formatFCFA, formatNumber, type QuoteDraft } from "@/lib/quote";
import {
  CheckIcon,
  CloseIcon,
  DocIcon,
  EditIcon,
  KeyboardIcon,
  MicIcon,
  PlusIcon,
  ShareIcon,
  StopIcon,
  UserIcon,
} from "./components/icons";
import { VoiceOrb } from "./components/VoiceOrb";
import { ErrorDialog } from "./components/ErrorDialog";
import { Tape } from "./components/Tape";
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
  const initials =
    (profile.company_name || profile.name)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("");

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
    const text = `${label} ${number}${client ? ` – ${client}` : ""} : ${formatFCFA(totalTtc, template.currency)}${effectiveTva ? " TTC" : ""}`;

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
  const isEditing = quote !== null && (phase === "editing" || phase === "amending" || phase === "generating");
  const currency = template.currency;
  const title = isCapture ? "Dicter" : phase === "ready" ? "Prêt" : "Devis";

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="screen-title">{title}</h1>
        <button
          type="button"
          className="avatar"
          onClick={() => setProfileOpen(true)}
          aria-label="Mon entreprise et modèle de devis"
        >
          {initials || <UserIcon />}
          {!hasProfile && <span className="dot" aria-hidden />}
        </button>
      </header>

      <main className="content">

        {isCapture && (
          <section className="capture">
            <div className="orb-stage">
              <VoiceOrb
                mode={phase === "analyzing" ? "busy" : recorder.recording ? "recording" : "idle"}
                analyserRef={recorder.analyserRef}
              />
            </div>

            <p className="status" aria-live="polite">
              {phase === "analyzing"
                ? "Je prépare votre devis…"
                : recorder.recording
                  ? "Je vous écoute. Touchez le bouton rouge pour terminer."
                  : "Touchez le bouton jaune et dictez votre devis."}
            </p>

            <div className="timer-card">
              <div className="timer-head">
                <span className="timer-label">Durée</span>
                <span className="timer-value">
                  {formatDuration(recorder.seconds)}
                  <small> / {formatDuration(MAX_SECONDS)}</small>
                </span>
              </div>
              <Tape seconds={recorder.recording ? recorder.seconds : 0} max={MAX_SECONDS} />
            </div>

            {typing && phase === "idle" && !recorder.recording ? (
              <form
                className="card type-card"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (typedText.trim()) analyze({ text: typedText });
                }}
              >
                <label className="field">
                  <span>Décrivez le devis</span>
                  <textarea
                    rows={4}
                    autoFocus
                    value={typedText}
                    onChange={(e) => setTypedText(e.target.value)}
                    placeholder="Client, prestations, quantités, prix…"
                  />
                </label>
                <button
                  type="submit"
                  className="btn btn-ink btn-block"
                  disabled={!typedText.trim()}
                >
                  Analyser
                </button>
              </form>
            ) : (
              <div className="tiles">
                <button type="button" className="tile tile-steel" onClick={() => setProfileOpen(true)}>
                  <span className="tile-kicker">Entreprise</span>
                  <span className="tile-main">
                    {profile.company_name || profile.name || "À compléter"}
                  </span>
                  <span className="tile-ticks" aria-hidden />
                </button>
                <button type="button" className="tile tile-tape" onClick={() => setProfileOpen(true)}>
                  <span className="tile-kicker">Modèle</span>
                  <span className="tile-main">{template.source ? template.title : "Standard"}</span>
                  <span className="tile-sub">
                    {template.catalogue.length
                      ? `${template.catalogue.length} prix connus`
                      : "Importer un devis"}
                  </span>
                </button>
              </div>
            )}
          </section>
        )}

        {isEditing && quote && (
          <section className="editing">
            {!hasProfile && (
              <button type="button" className="nudge" onClick={() => setProfileOpen(true)}>
                <span className="nudge-icon">
                  <UserIcon size={20} />
                </span>
                <span className="nudge-text">
                  Ajoutez votre entreprise
                  <small>Elle apparaîtra en haut du devis</small>
                </span>
                <span className="nudge-chevron" aria-hidden />
              </button>
            )}

            <QuoteEditor
              quote={quote}
              onChange={setQuote}
              tvaRate={tvaRate}
              currency={currency}
              disabled={phase !== "editing"}
            />

            <form
              className="card amend"
              onSubmit={(e) => {
                e.preventDefault();
                if (correction.trim()) analyze({ text: correction });
              }}
            >
              <h2 className="card-title">Corriger</h2>
              <p className="muted amend-hint">
                Touchez le bouton jaune et dites par ex.&nbsp;: «&nbsp;ajoute 10 sacs de ciment
                à 5&nbsp;500&nbsp;», «&nbsp;enlève la peinture&nbsp;». Ou écrivez-le&nbsp;:
              </p>
              <div className="amend-form">
                <input
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  placeholder={
                    recorder.recording
                      ? `Enregistrement ${formatDuration(recorder.seconds)}…`
                      : phase === "amending"
                        ? "Correction en cours…"
                        : "Votre correction"
                  }
                  disabled={phase !== "editing" || recorder.recording}
                  aria-label="Correction écrite"
                />
                <button
                  type="submit"
                  className="btn btn-ink"
                  disabled={!correction.trim() || phase !== "editing"}
                >
                  OK
                </button>
              </div>
            </form>

            {transcription && (
              <details className="transcript">
                <summary>Ce que j&apos;ai entendu</summary>
                <p>{transcription}</p>
              </details>
            )}

            {!items && phase === "editing" && (
              <p className="pending-hint">Complétez les champs en rouge pour générer le PDF.</p>
            )}
          </section>
        )}

        {phase === "ready" && generated && (
          <section className="ready">
            <div className="ready-card">
              <span className="tape-edge" aria-hidden />
              <p className="ready-kicker">
                {template.title} · {generated.number}
              </p>
              {quote?.client && <p className="ready-client">{quote.client}</p>}
              <p className="ready-total">
                {formatNumber(generated.totalTtc)}
                <small>
                  {" "}
                  {currency}
                  {effectiveTva ? " TTC" : ""}
                </small>
              </p>
              <a className="ready-link" href={generated.url} target="_blank" rel="noopener">
                Voir le PDF
              </a>
            </div>
            <p className="muted ready-hint">
              Touchez « Partager » puis choisissez WhatsApp et votre client.
            </p>
          </section>
        )}
      </main>

      <nav className="dock" aria-label="Actions">
        {isCapture && (
          <>
            <DockButton
              label="Écrire"
              onClick={() => setTyping((t) => !t)}
              disabled={phase !== "idle" || recorder.recording}
              pressed={typing}
            >
              <KeyboardIcon />
            </DockButton>
            <MicPill
              recording={recorder.recording}
              busy={phase === "analyzing"}
              onClick={recorder.recording ? recorder.stop : recorder.start}
              label={recorder.recording ? "Terminer" : "Dicter"}
            />
            <DockButton label="Modèle" onClick={() => setProfileOpen(true)} disabled={recorder.recording}>
              <DocIcon />
            </DockButton>
          </>
        )}

        {isEditing && (
          <>
            <DockButton label="Annuler" onClick={reset} disabled={recorder.recording}>
              <CloseIcon />
            </DockButton>
            <MicPill
              recording={recorder.recording}
              busy={phase === "amending"}
              disabled={phase !== "editing"}
              onClick={recorder.recording ? recorder.stop : recorder.start}
              label={recorder.recording ? "Terminer" : "Corriger"}
            />
            <DockButton
              label={phase === "generating" ? "…" : "PDF"}
              onClick={generate}
              disabled={!items || phase !== "editing" || recorder.recording}
              variant="ink"
            >
              {phase === "generating" ? <span className="spinner spinner-sm" aria-hidden /> : <CheckIcon />}
            </DockButton>
          </>
        )}

        {phase === "ready" && (
          <>
            <DockButton label="Modifier" onClick={() => setPhase("editing")}>
              <EditIcon />
            </DockButton>
            <button type="button" className="pill pill-share" onClick={share}>
              <ShareIcon size={26} />
              <span className="pill-label">Partager</span>
            </button>
            <DockButton label="Nouveau" onClick={reset}>
              <PlusIcon size={22} />
            </DockButton>
          </>
        )}
      </nav>

      {error && <ErrorDialog message={error} onClose={() => setError(null)} />}

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

function DockButton({
  label,
  onClick,
  disabled,
  pressed,
  variant,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  variant?: "ink";
  children: React.ReactNode;
}) {
  return (
    <div className="dock-item">
      <button
        type="button"
        className={`dock-btn ${variant === "ink" ? "dock-btn-ink" : ""}`}
        onClick={onClick}
        disabled={disabled}
        aria-pressed={pressed}
        aria-label={label}
      >
        {children}
      </button>
      <span className="dock-label" aria-hidden>
        {label}
      </span>
    </div>
  );
}

function MicPill({
  recording,
  busy,
  disabled,
  onClick,
  label,
}: {
  recording: boolean;
  busy: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`pill ${recording ? "is-recording" : ""}`}
      onClick={onClick}
      disabled={(disabled || busy) && !recording}
      aria-label={recording ? "Terminer l'enregistrement" : label}
    >
      {busy ? (
        <span className="spinner spinner-sm spinner-dark" aria-hidden />
      ) : recording ? (
        <StopIcon size={24} />
      ) : (
        <MicIcon size={26} />
      )}
      <span className="pill-label">{busy ? "Analyse…" : label}</span>
    </button>
  );
}
