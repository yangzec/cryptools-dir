// DataAny tracker as a native <script> in the SSR HTML (see plausible.tsx).
// The tracker reads its own data-website-id via document.currentScript and
// posts to /api/collect on the host that served it.
export function DataAny({
  websiteId,
  src,
}: {
  websiteId: string;
  src: string;
}) {
  // src is built on the server from DATAANY_URL by dataanyOrigin() (https,
  // or http://localhost in development); never from settings.
  if (!websiteId || !src) return null;
  return (
    <script id="dataany-tracker" data-website-id={websiteId} src={src} async />
  );
}
