// inject.js – Manifest V3‑compatible content‑script
// --------------------------------------------------
// • Uses chrome.runtime.sendMessage (no extension.*)
// • Collects full page text, external <script src>, .env & .git/config probes
// • Normalises protocol‑relative URLs (//example.com/js)
// --------------------------------------------------

(() => {
  //--------------------------------------------------
  // 1. Send page body for scanning
  //--------------------------------------------------
  const pageText = document.documentElement.innerText;
  chrome.runtime.sendMessage({
    pageBody: pageText,
    origin: window.origin,
    parentUrl: window.location.href,
    parentOrigin: window.origin,
  });

  //--------------------------------------------------
  // 2. Send every external <script src="…"> after DOM settle
  //--------------------------------------------------
  setTimeout(() => {
    Array.from(document.scripts)
      .map((s) => s.src)
      .filter(Boolean)
      .forEach((src) => {
        // Resolve protocol‑relative URLs (//example.com/foo.js)
        const fullSrc = src.startsWith('//') ? `${location.protocol}${src}` : src;
        chrome.runtime.sendMessage({
          scriptUrl: fullSrc,
          parentUrl: window.location.href,
          parentOrigin: window.origin,
        });
      });
  }, 1000); // 1 s is plenty – adjust if needed

  //--------------------------------------------------
  // 3. Probe for .env and .git/config files in the same directory
  //--------------------------------------------------
  const { origin, pathname } = window.location;
  const basePath = pathname.substring(0, pathname.lastIndexOf('/'));
  const baseHref = `${origin}${basePath}`;

  chrome.runtime.sendMessage({
    envFile: `${baseHref}/.env`,
    parentUrl: window.location.href,
    parentOrigin: window.origin,
  });

  chrome.runtime.sendMessage({
    gitDir: `${baseHref}/.git/config`,
    parentUrl: window.location.href,
    parentOrigin: window.origin,
  });
})();
