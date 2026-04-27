// App-router loading state. Renders during route segment transitions
// before the destination page's data has loaded. We deliberately
// keep this minimal — the patient sees this often, so it should fade
// in calm and unobtrusive rather than draw attention. A centered
// "Anchor" wordmark with a slow pulse is enough.

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="serif animate-pulse text-2xl tracking-tight text-ink-300">
        Anchor
      </div>
    </div>
  );
}
