/**
 * Heading-to-anchor slug, shared by the VitePress build and the link checker.
 *
 * It lives in its own module so the two can never drift: the site renders ids
 * with this function and `check-doc-links.mjs` resolves `#fragment` links with
 * the same one.
 */

const RE_SPECIAL = /[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”<>,.?/]+/g;
const RE_COMBINING = /[̀-ͯ]/g;

export function slugifyHeading(value) {
  return (
    value
      .replace(/<[^>]*>/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .trim()
      .normalize('NFKD')
      .replace(RE_COMBINING, '')
      .replace(RE_SPECIAL, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/^(\d)/, '_$1')
      .toLowerCase()
      // Recompose. The NFKD pass strips only the Latin combining range, so
      // dakuten would stay split off its kana and no hand-written Japanese
      // anchor would ever match the rendered id.
      .normalize('NFC')
  );
}
