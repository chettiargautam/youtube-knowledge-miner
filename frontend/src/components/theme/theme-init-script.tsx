export function ThemeInitScript() {
  const code = `
    (() => {
      try {
        const storageKey = "ytkb-theme";
        const stored = localStorage.getItem(storageKey);
        const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const theme = stored === "light" || stored === "dark"
          ? stored
          : systemDark
            ? "dark"
            : "light";

        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;

        window.__setYTKBTheme = (nextTheme) => {
          if (nextTheme === "system") {
            localStorage.removeItem(storageKey);
            const followsSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            const systemTheme = followsSystemDark ? "dark" : "light";
            document.documentElement.dataset.theme = systemTheme;
            document.documentElement.style.colorScheme = systemTheme;
            return;
          }

          if (nextTheme === "light" || nextTheme === "dark") {
            localStorage.setItem(storageKey, nextTheme);
            document.documentElement.dataset.theme = nextTheme;
            document.documentElement.style.colorScheme = nextTheme;
          }
        };
      } catch {
        document.documentElement.dataset.theme = "dark";
        document.documentElement.style.colorScheme = "dark";
      }
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
