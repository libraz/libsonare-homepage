import { type MaybeRefOrGetter, onMounted, onUnmounted, toValue } from 'vue';

/** A shortcut with options; a bare function is shorthand for `{ handler }`. */
export interface ShortcutBinding {
  handler: (event: KeyboardEvent) => void;
  /** Reactive gate; a disabled binding neither runs nor swallows the key. Default: enabled. */
  enabled?: MaybeRefOrGetter<boolean>;
  /** Also fire on auto-repeat keydowns. Default: false. */
  repeat?: boolean;
}

export type ShortcutMap = Record<string, ShortcutBinding | ShortcutBinding['handler']>;

export interface UseShortcutsOptions {
  /** Force the platform for `Mod`; defaults to {@link isMacPlatform}. */
  mac?: boolean;
}

interface ParsedCombo {
  code: string;
  mod: boolean;
  shift: boolean;
  alt: boolean;
  binding: ShortcutBinding;
}

/** True on macOS/iOS, where `Mod` means Meta instead of Ctrl. */
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return /mac|iphone|ipad|ipod/i.test(nav.userAgentData?.platform || nav.platform || '');
}

function parseCombo(combo: string, binding: ShortcutBinding): ParsedCombo {
  const parts = combo.split('+');
  const code = parts.pop() as string;
  return {
    code,
    mod: parts.includes('Mod'),
    shift: parts.includes('Shift'),
    alt: parts.includes('Alt'),
    binding,
  };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    target.closest('[contenteditable]:not([contenteditable="false"])') !== null
  );
}

/**
 * Register window-level keyboard shortcuts while the calling component is mounted.
 *
 * Combos are `[Mod+][Shift+][Alt+]<KeyboardEvent.code>`, e.g. `Space`, `KeyL`,
 * `Mod+KeyZ`, `Mod+Shift+KeyZ`. `Mod` is Meta on macOS and Ctrl elsewhere.
 * Modifiers must match exactly. Keys are ignored while an input, textarea,
 * select or contenteditable has focus, and during IME composition. Only handled
 * events are `preventDefault`ed.
 *
 * @param bindings Combo to handler (or {@link ShortcutBinding}).
 * @param options Platform override.
 */
export function useShortcuts(bindings: ShortcutMap, options: UseShortcutsOptions = {}): void {
  const combos = Object.entries(bindings).map(([combo, b]) =>
    parseCombo(combo, typeof b === 'function' ? { handler: b } : b),
  );
  const mac = options.mac ?? isMacPlatform();

  function onKeydown(event: KeyboardEvent) {
    if (event.isComposing || isTypingTarget(event.target)) return;
    const modDown = mac ? event.metaKey : event.ctrlKey;
    const strayMod = mac ? event.ctrlKey : event.metaKey;
    if (strayMod) return;

    for (const c of combos) {
      if (c.code !== event.code) continue;
      if (c.mod !== modDown || c.shift !== event.shiftKey || c.alt !== event.altKey) continue;
      if (event.repeat && !c.binding.repeat) continue;
      if (c.binding.enabled !== undefined && !toValue(c.binding.enabled)) continue;
      event.preventDefault();
      c.binding.handler(event);
      return;
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown));
  onUnmounted(() => window.removeEventListener('keydown', onKeydown));
}
