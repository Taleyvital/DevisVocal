"use client";

import { useEffect, useState } from "react";
import type { ArtisanProfile } from "@/lib/quote";

const STORAGE_KEY = "devisvocal.profile";

export const EMPTY_PROFILE: ArtisanProfile = {
  company_name: "",
  name: "",
  phone: "",
  email: "",
  address: "",
};

// The artisan profile lives on the device; it's sent with each quote.
export function useProfile() {
  const [profile, setProfile] = useState<ArtisanProfile>(EMPTY_PROFILE);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setProfile({ ...EMPTY_PROFILE, ...JSON.parse(saved) });
    } catch {
      // storage unavailable — keep the empty profile
    }
  }, []);

  const save = (next: ArtisanProfile) => {
    setProfile(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  return [profile, save] as const;
}

const FIELDS: {
  key: keyof ArtisanProfile;
  label: string;
  type?: string;
  autoComplete: string;
  placeholder?: string;
}[] = [
  { key: "company_name", label: "Nom de l'entreprise", autoComplete: "organization", placeholder: "Ex : Kouassi BTP" },
  { key: "name", label: "Votre nom", autoComplete: "name" },
  { key: "phone", label: "Téléphone", type: "tel", autoComplete: "tel", placeholder: "+225 07 00 00 00 00" },
  { key: "email", label: "Email", type: "email", autoComplete: "email" },
  { key: "address", label: "Adresse", autoComplete: "street-address" },
];

export function ProfileSheet({
  profile,
  onSave,
  onClose,
}: {
  profile: ArtisanProfile;
  onSave: (p: ArtisanProfile) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(profile);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft);
          onClose();
        }}
      >
        <h2 id="profile-title">Mon entreprise</h2>
        <p className="muted">Ces informations apparaissent en haut de vos devis.</p>
        {FIELDS.map((f) => (
          <label key={f.key} className="field">
            <span>{f.label}</span>
            <input
              type={f.type ?? "text"}
              autoComplete={f.autoComplete}
              placeholder={f.placeholder}
              value={draft[f.key]}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
            />
          </label>
        ))}
        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary">
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}
