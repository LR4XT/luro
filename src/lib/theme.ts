export interface EditorThemePreset {
  id: string;
  name: string;
  variables: Record<string, string>;
}

export interface SiteThemePreset {
  id: string;
  name: string;
  description: string;
  siteStylesheet: string;
  themeOverlay?: string;
  preview: {
    sidebar: string;
    bg: string;
    accent: string;
  };
  imported?: boolean;
}

export interface ThemeConfig {
  editor: {
    default: string;
    presets: EditorThemePreset[];
  };
  site: {
    default: string;
    presets: SiteThemePreset[];
  };
  activeSiteThemeId: string;
}

const EDITOR_STORAGE_KEY = 'lr4xt-editor-appearance';

export function getStoredEditorThemeId(fallback: string): string {
  return localStorage.getItem(EDITOR_STORAGE_KEY) ?? fallback;
}

export function setStoredEditorThemeId(id: string): void {
  localStorage.setItem(EDITOR_STORAGE_KEY, id);
}

export function applyEditorTheme(preset: EditorThemePreset): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(preset.variables)) {
    root.style.setProperty(key, value);
  }
  root.dataset.editorTheme = preset.id;
}

export async function loadAndApplyEditorTheme(): Promise<ThemeConfig> {
  const res = await fetch('/api/themes');
  const config = (await res.json()) as ThemeConfig;
  const id = getStoredEditorThemeId(config.editor.default);
  const preset =
    config.editor.presets.find((theme) => theme.id === id) ?? config.editor.presets[0];
  applyEditorTheme(preset);
  return config;
}

export type { EditorThemePreset as ThemePreset };
