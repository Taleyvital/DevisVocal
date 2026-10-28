"use client";

import { useCallback, useEffect, useState } from "react";

// State persisted on the device (localStorage), validated on load.
export function useStored<T>(key: string, initial: T, sanitize: (raw: unknown) => T) {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) setValue(sanitize(JSON.parse(saved)));
    } catch {
      // storage unavailable or corrupt — keep the initial value
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const save = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // ignore (private mode, quota)
      }
    },
    [key]
  );

  return [value, save] as const;
}
