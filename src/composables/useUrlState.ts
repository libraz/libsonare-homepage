/**
 * Two-way binding between reactive demo state and the page's query string.
 *
 * A demo declares which refs are shareable by URL; each declaration names the
 * query parameter, the value the URL is silent about, and how a raw string is
 * parsed. Writes go through the History API so the VitePress router and the
 * page hash are left untouched, and Back/Forward re-applies the state read
 * from the URL. Nothing touches `window` until `enable()` runs on the client.
 */
import { nextTick, type Ref, watch } from 'vue';

/** `state` alone fixes `T`; the other members are checked against it. */
export interface UrlParamSpec<T> {
  /** Query parameter name. */
  key: string;
  /** The reactive state this parameter mirrors. */
  state: Ref<T>;
  /** Value the URL omits: written as no parameter, restored on a bare URL. */
  defaultValue: NoInfer<T>;
  /** Parse a raw query value; return null to reject it and keep the state as is. */
  parse(raw: string): NoInfer<T> | null;
  /** Serialize a value for the query string. Defaults to `String(value)`. */
  serialize?(value: NoInfer<T>): string;
}

/** Per-element inference so one call can bind refs of different types. */
type UrlParamSpecs<T extends unknown[]> = { [K in keyof T]: UrlParamSpec<T[K]> };

export function useUrlState<T extends unknown[]>(params: [...UrlParamSpecs<T>]) {
  const specs: UrlParamSpec<unknown>[] = params;
  let ready = false;
  let applyingFromHistory = false;

  watch(
    specs.map((spec) => spec.state),
    () => {
      if (!ready || applyingFromHistory || typeof window === 'undefined') return;
      writeToUrl('push');
    },
  );

  function serialize(spec: UrlParamSpec<unknown>, value: unknown): string {
    return spec.serialize ? spec.serialize(value) : String(value);
  }

  /** Parsed URL value for one parameter, or null when absent or rejected. */
  function readFromUrl(spec: UrlParamSpec<unknown>): unknown {
    const raw = new URLSearchParams(window.location.search).get(spec.key);
    return raw === null ? null : spec.parse(raw);
  }

  /** Apply every parameter the URL carries; parameters it lacks are left as is. */
  function applyFromUrl() {
    if (typeof window === 'undefined') return;
    const next = specs.map((spec) => readFromUrl(spec));
    if (next.every((value) => value === null)) return;
    setFromUrl((spec, index) => (next[index] === null ? spec.state.value : next[index]));
  }

  /** Rewrite the current entry so the URL reflects the state without a history push. */
  function replaceInUrl() {
    if (typeof window === 'undefined') return;
    writeToUrl('replace');
  }

  /** Start pushing state changes to the URL and following Back/Forward. */
  function enable() {
    if (typeof window === 'undefined') return;
    ready = true;
    window.addEventListener('popstate', handlePopState);
  }

  function disable() {
    ready = false;
    if (typeof window !== 'undefined') {
      window.removeEventListener('popstate', handlePopState);
    }
  }

  function writeToUrl(method: 'push' | 'replace') {
    const url = new URL(window.location.href);
    const state = { ...(window.history.state || {}) };
    for (const spec of specs) {
      const value = spec.state.value;
      const serialized = serialize(spec, value);
      if (serialized === serialize(spec, spec.defaultValue)) {
        url.searchParams.delete(spec.key);
      } else {
        url.searchParams.set(spec.key, serialized);
      }
      state[spec.key] = serialized;
    }
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl === currentUrl) return;
    if (method === 'push') {
      window.history.pushState(state, '', nextUrl);
    } else {
      window.history.replaceState(state, '', nextUrl);
    }
  }

  /** History navigation: a parameter missing from the URL means its default. */
  function handlePopState() {
    setFromUrl((spec) => readFromUrl(spec) ?? spec.defaultValue);
  }

  function setFromUrl(pick: (spec: UrlParamSpec<unknown>, index: number) => unknown) {
    applyingFromHistory = true;
    specs.forEach((spec, index) => {
      spec.state.value = pick(spec, index);
    });
    void nextTick(() => {
      applyingFromHistory = false;
    });
  }

  return {
    applyFromUrl,
    replaceInUrl,
    enable,
    disable,
  };
}
