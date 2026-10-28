"use client";

import { useEffect, useRef } from "react";
import { SadArtisan } from "./Mascot";

// Error popup with the disappointed mini artisan.
export function ErrorDialog({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div
        className="popup"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="popup-title"
        aria-describedby="popup-message"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="popup-mascot">
          <SadArtisan size={150} />
        </div>
        <h2 id="popup-title" className="popup-title">
          Oups…
        </h2>
        <p id="popup-message" className="popup-message">
          {message}
        </p>
        <button ref={buttonRef} type="button" className="btn btn-ink btn-block" onClick={onClose}>
          OK, compris
        </button>
      </div>
    </div>
  );
}
