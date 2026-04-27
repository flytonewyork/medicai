// Active-state matcher for the bottom nav + desktop sidebar +
// "more" menu. The bug this replaces: every nav surface used
// `pathname === item.href`, which only highlights the tab on the
// exact landing page. The moment the patient drilled into a sub-
// route (`/nutrition/log`, `/schedule/new`, `/treatment/cycle/3`)
// every nav icon went grey — leaving the user with no visual
// anchor for "where am I?". Persistent UX bug across iOS Safari,
// Android Chrome, desktop.
//
// The fix: exact-match for `/` (dashboard), prefix-match with a
// `/` boundary for everything else so sibling routes like
// `/nutritional` or `/care-team-roster` don't trip a false
// positive.

export function isNavItemActive(
  pathname: string | null | undefined,
  href: string,
): boolean {
  if (!pathname) return false;
  // Strip query / hash / trailing slash before matching so
  // `/nutrition/`, `/nutrition?foo`, `/nutrition#x` all behave the
  // same as `/nutrition`.
  const path = stripExtras(pathname);
  if (href === "/") return path === "/";
  if (path === href) return true;
  return path.startsWith(href + "/");
}

function stripExtras(pathname: string): string {
  let p = pathname;
  const q = p.indexOf("?");
  if (q !== -1) p = p.slice(0, q);
  const h = p.indexOf("#");
  if (h !== -1) p = p.slice(0, h);
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}
