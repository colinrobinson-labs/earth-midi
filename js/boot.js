/* Runs in the head, before the page paints: pick the Simple or embed layout up front so the full layout never flashes. */
try {
  if (location.hash === "#embed") document.documentElement.classList.add("simple", "embed");
  else if (location.hash === "#simple" || localStorage.getItem("em.simple") === "1")
    document.documentElement.classList.add("simple");
} catch (_) {}
