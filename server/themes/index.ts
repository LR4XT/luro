import fs from 'node:fs/promises';
import path from 'node:path';
import { EDITOR_ROOT } from '../config.js';

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
}

const THEMES_FILE = path.join(EDITOR_ROOT, 'config', 'themes.json');

export async function readThemes(): Promise<ThemeConfig> {
  const raw = await fs.readFile(THEMES_FILE, 'utf-8');
  return JSON.parse(raw) as ThemeConfig;
}

export async function getSiteThemeById(id: string): Promise<SiteThemePreset | undefined> {
  const config = await readThemes();
  return config.site.presets.find((theme) => theme.id === id);
}

export async function getDefaultSiteTheme(): Promise<SiteThemePreset> {
  const config = await readThemes();
  return (
    config.site.presets.find((theme) => theme.id === config.site.default) ??
    config.site.presets[0]
  );
}

/** @deprecated use getSiteThemeById */
export async function getThemeById(id: string): Promise<SiteThemePreset | undefined> {
  return getSiteThemeById(id);
}

/** @deprecated use getDefaultSiteTheme */
export async function getDefaultTheme(): Promise<SiteThemePreset> {
  return getDefaultSiteTheme();
}

export async function getEditorThemeById(id: string): Promise<EditorThemePreset | undefined> {
  const config = await readThemes();
  return config.editor.presets.find((theme) => theme.id === id);
}

export async function getDefaultEditorTheme(): Promise<EditorThemePreset> {
  const config = await readThemes();
  return (
    config.editor.presets.find((theme) => theme.id === config.editor.default) ??
    config.editor.presets[0]
  );
}
