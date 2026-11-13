(() => {
  const storageKey = 'bioatlas-theme';
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = null;
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === 'dark' || stored === 'light') preference = stored;
  } catch {
    // La selección sigue funcionando cuando el navegador bloquea el almacenamiento.
  }

  function applyTheme() {
    const theme = preference || (systemTheme.matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', String(theme === 'dark'));
    });
  }

  applyTheme();
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.addEventListener('click', () => {
        preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        try {
          localStorage.setItem(storageKey, preference);
        } catch {
          // Conserva la selección en esta página aunque no se pueda guardar.
        }
        applyTheme();
      });
    });
  });
  systemTheme.addEventListener('change', applyTheme);
  window.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) {
      preference = event.newValue === 'dark' || event.newValue === 'light' ? event.newValue : null;
      applyTheme();
    }
  });
})();
