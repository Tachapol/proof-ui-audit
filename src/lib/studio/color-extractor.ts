import { calculateContrastRatioRaw, parseColor } from '@/lib/audit/color-math';
import { ROLE_NAMES, type AgendaItem, type ChatMessage, type StudioRole } from './types';
import type { UXIssue } from '@/lib/schema/ux-issue';

export interface ProposedColorOption {
  color: string; // 6-digit hex lowercase
  source: 'ai_discussion' | 'ai_note' | 'brand_token' | 'system_default';
  roleName?: string;
  sourceLabel: string;
  contrastRatio: number;
  passesThreshold: boolean;
}

export function toHex6(colorStr: string): string | null {
  const parsed = parseColor(colorStr);
  if (!parsed) return null;
  const toHex = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
  return `#${toHex(parsed.r)}${toHex(parsed.g)}${toHex(parsed.b)}`.toLowerCase();
}

/**
 * Extracts and filters verified candidate colors proposed in notes, discussion chat, or brand context.
 * Strict rules:
 * 1. Discards colors matching current failing baseline foreground (e.g. #aaaaaa).
 * 2. Discards colors matching background color (e.g. #ffffff).
 * 3. Discards colors that fail to meet the contrast threshold.
 */
export function extractProposedColors(params: {
  item: AgendaItem;
  messages?: ChatMessage[];
  themeColor?: string;
  representative: UXIssue;
}): ProposedColorOption[] {
  const { item, messages = [], themeColor, representative } = params;
  const background = String(representative.measured.backgroundColor || '#ffffff');
  const threshold = Number(representative.expected.minRatio || 4.5);

  const baselineFgHex = toHex6(String(representative.measured.color || ''));
  const baselineBgHex = toHex6(background);

  const results: ProposedColorOption[] = [];
  const seenHexes = new Set<string>();

  function tryAddColor(rawHex: string, source: ProposedColorOption['source'], roleName?: string, customLabel?: string) {
    const hex = toHex6(rawHex);
    if (!hex) return;
    if (seenHexes.has(hex)) return;

    // Reject baseline foreground color (e.g. #aaaaaa / #aaa)
    if (baselineFgHex && hex === baselineFgHex) return;

    // Reject background color (e.g. #ffffff)
    if (baselineBgHex && hex === baselineBgHex) return;

    const ratio = calculateContrastRatioRaw(hex, background);

    // Reject colors that fail threshold
    if (ratio < threshold) return;

    seenHexes.add(hex);
    results.push({
      color: hex,
      source,
      roleName,
      sourceLabel: customLabel || (roleName ? `${roleName} recommendation (${hex})` : `Option (${hex})`),
      contrastRatio: Math.round(ratio * 100) / 100,
      passesThreshold: true,
    });
  }

  // 1. Scan Discussion messages for this issue (prioritize recent discussion replies from roles)
  const relevantMessages = messages.filter(m => m.issueId === item.id && m.sender !== 'user');
  for (const msg of [...relevantMessages].reverse()) {
    const roleTitle = ROLE_NAMES[msg.sender as keyof typeof ROLE_NAMES] || msg.sender;
    const hexMatches = msg.text.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || [];
    for (const h of hexMatches) {
      tryAddColor(h, 'ai_discussion', roleTitle, `${roleTitle} (Chat: ${toHex6(h)})`);
    }
  }

  // 2. Scan Role Notes
  for (const note of item.notes) {
    const roleTitle = ROLE_NAMES[note.role] || note.role;
    const hexMatches = note.recommendation.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || [];
    for (const h of hexMatches) {
      tryAddColor(h, 'ai_note', roleTitle, `${roleTitle} recommendation (${toHex6(h)})`);
    }
  }

  // 3. Scan Brand Theme Token
  if (themeColor) {
    tryAddColor(themeColor, 'brand_token', undefined, `Brand theme token (${toHex6(themeColor)})`);
  }

  // 4. System High-Contrast Default
  tryAddColor('#111827', 'system_default', undefined, 'System slate (#111827)');

  return results;
}

/**
 * Resolves the accurate attribution label for any selected color.
 * If user customized the color, explicitly returns "Custom designer selection (#hex)".
 */
export function resolveColorAttribution(
  selectedColor: string,
  options: ProposedColorOption[]
): string {
  const hex = toHex6(selectedColor);
  if (!hex) return `Custom selection (${selectedColor})`;
  const matched = options.find(o => o.color === hex);
  if (matched) return matched.sourceLabel;
  return `Custom designer selection (${hex})`;
}
