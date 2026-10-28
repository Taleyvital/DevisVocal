"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "./Logo";

const SEEN_KEY = "devisvocal.splash";

// Launch screen: logo on the brand's dark background, once per session.
// Rendered on the server so it covers the app from the very first paint.
export function Splash() {
  const [state, setState] = useState<"shown" | "leaving" | "gone">("shown");

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // storage unavailable — show it
    }
    if (seen) {
      setState("gone");
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hold = reduce ? 700 : 1700;
    const leave = window.setTimeout(() => setState("leaving"), hold);
    const gone = window.setTimeout(() => setState("gone"), hold + 450);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(gone);
    };
  }, []);

  if (state === "gone") return null;

  return (
    <div
      className={`splash ${state === "leaving" ? "is-leaving" : ""}`}
      aria-hidden
      onClick={() => setState("leaving")}
      onTransitionEnd={() => state === "leaving" && setState("gone")}
    >
      <span className="splash-ring splash-ring-1" />
      <span className="splash-ring splash-ring-2" />
      <span className="splash-ring splash-ring-3" />
      <div className="splash-content">
        <LogoMark height={88} tape />
        <p className="splash-wordmark">
          DEVIS<span>VOCAL</span>
        </p>
        <span className="splash-ruler" />
      </div>
    </div>
  );
}
