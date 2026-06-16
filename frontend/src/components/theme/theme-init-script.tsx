export function ThemeInitScript() {
  const code = `
    (() => {
      try {
        const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const theme = systemDark ? "dark" : "light";

        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;

        window.__setYTKBTheme = (nextTheme) => {
          const followsSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          const systemTheme = followsSystemDark ? "dark" : "light";
          document.documentElement.dataset.theme = systemTheme;
          document.documentElement.style.colorScheme = systemTheme;
        };
      } catch {
        document.documentElement.dataset.theme = "dark";
        document.documentElement.style.colorScheme = "dark";
      }
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
