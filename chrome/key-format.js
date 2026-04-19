(function (global) {
  'use strict';

  const BASE_LABELS = {
    ArrowDown: '↓',
    ArrowUp: '↑',
    ArrowLeft: '←',
    ArrowRight: '→',
    Enter: 'Enter',
    Escape: 'Esc',
    ' ': 'Space',
    Control: 'Ctrl',
    Alt: 'Alt'
  };

  const COMPACT_BASE_LABELS = {
    Enter: '↵',
    ' ': 'Spc'
  };

  function normalizeModifier(mod) {
    if (mod === 'Control') return 'Ctrl';
    if (mod === 'Option') return 'Alt';
    return mod;
  }

  function formatBaseKey(base, compact) {
    const normalized = normalizeModifier(base);
    const numpad = normalized.match(/^Numpad(.+)$/);
    if (numpad) return `テンキー${numpad[1]}`;
    if (compact && COMPACT_BASE_LABELS[normalized]) return COMPACT_BASE_LABELS[normalized];
    return BASE_LABELS[normalized] ?? normalized;
  }

  function formatKeyLabel(binding, { compact = false } = {}) {
    if (!binding) return '';
    const parts = String(binding).split('+').filter(Boolean);
    if (!parts.length) return '';

    const base = parts[parts.length - 1];
    const mods = parts.slice(0, -1).map(normalizeModifier);
    return [...mods, formatBaseKey(base, compact)].join('+');
  }

  global.formatKeyLabel = formatKeyLabel;
})(globalThis);
