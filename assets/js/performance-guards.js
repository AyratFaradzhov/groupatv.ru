/**
 * Performance guards for dynamic image creation.
 * Use when creating <img> in JS: do NOT apply loading="lazy" inside sliders/transformed containers.
 */
(function () {
  "use strict";
  if (typeof window.applySafeImageAttributes !== "undefined") return;
  window.applySafeImageAttributes = function (img) {
    if (!img || img.tagName !== "IMG") return;
    img.decoding = "async";
    if (img.closest(".card, .slider, .card__viewport, .card__candy, [style*='transform']")) {
      return;
    }
    img.loading = "lazy";
  };
})();
