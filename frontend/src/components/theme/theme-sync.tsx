"use client";

import { useEffect } from "react";

export function ThemeSync() {
  useEffect(() => {
    const storageKey = "ytkb-theme";
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function applyTheme() {
      const stored = localStorage.getItem(storageKey);
      const theme =
        stored === "light" || stored === "dark"
          ? stored
          : media.matches
            ? "dark"
            : "light";

      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    }

    applyTheme();

    media.addEventListener("change", applyTheme);
    window.addEventListener("storage", applyTheme);

    return () => {
      media.removeEventListener("change", applyTheme);
      window.removeEventListener("storage", applyTheme);
    };
  }, []);

  return null;
}
