import fs from 'node:fs/promises';
import path from 'node:path';
import { EDITOR_ROOT } from '../config.js';

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

const THEMES_FILE = path.join(EDITOR_ROOT, 'config', 'themes.json');

export async function readThemes(): Promise<ThemeConfig> {
  const raw = await fs.readFile(THEMES_FILE, 'utf-8');
  return JSON.parse(raw) as ThemeConfig;
}

export async function getThemeById(id: string): Promise<ThemePreset | undefined> {
  const config = await readThemes();
  return config.presets.find((t) => t.id === id);
}

export async function getDefaultTheme(): Promise<ThemePreset> {
  const config = await readThemes();
  return config.presets.find((t) => t.id === config.default) ?? config.presets[0];
}
