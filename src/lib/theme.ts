export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  siteStylesheet: string;
  variables: Record<string, string>;
}

export interface ThemeConfig {
  default: string;
  presets: ThemePreset[];
}

const STORAGE_KEY = 'lr4xt-editor-theme';

export function getStoredThemeId(fallback: string): string {
  return localStorage.getItem(STORAGE_KEY) ?? fallback;
}

export function setStoredThemeId(id: string): void {
  localStorage.setItem(STORAGE_KEY, id);
}

export function applyTheme(preset: ThemePreset): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(preset.variables)) {
    root.style.setProperty(key, value);
  }
  root.dataset.theme = preset.id;
}

export async function loadAndApplyTheme(): Promise<ThemeConfig> {
  const res = await fetch('/api/themes');
  const config = (await res.json()) as ThemeConfig;
  const id = getStoredThemeId(config.default);
  const preset = config.presets.find((t) => t.id === id) ?? config.presets[0];
  applyTheme(preset);
  return config;
}
