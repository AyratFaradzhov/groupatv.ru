(() => {
  const MOBILE_QUERY = "(max-width: 767px)";
  const speedPxPerSec = 55;

  let initialized = false;
  let running = false;
  let resetDistance = 0;
  let position = 0;
  let lastTime = null;
  let logged = false;
  let rafId = null;
  let warned = false;

  const logOnce = (data) => {
    if (logged) return;
    logged = true;
    console.log("[presence-marquee-mobile]", data);
  };

  const measure = (container, track) => {
    track.style.willChange = "transform";
    track.style.display = "inline-flex";
    track.style.flexWrap = "nowrap";
    track.style.animation = "none";

    const trackWidth = track.scrollWidth;
    const containerWidth = container.offsetWidth;
    resetDistance = Math.max(0, trackWidth / 2);

    logOnce({
      containerWidth,
      trackWidth,
      resetDistance,
      speed: speedPxPerSec,
    });

    if (resetDistance <= containerWidth) {
      if (!warned) {
        warned = true;
        console.warn("[presence-marquee-mobile] resetDistance too small, waiting");
      }
      return false;
    }

    return true;
  };

  const animate = (track) => (time) => {
    if (lastTime === null) lastTime = time;
    const delta = (time - lastTime) / 1000;
    lastTime = time;

    position += speedPxPerSec * delta;
    if (position >= resetDistance && resetDistance > 0) {
      position -= resetDistance;
    }

    track.style.transform = `translateX(${-position}px)`;
    rafId = requestAnimationFrame(animate(track));
  };

  const start = (track) => {
    if (running) return;
    running = true;
    rafId = requestAnimationFrame(animate(track));
  };

  const init = async () => {
    if (!window.matchMedia(MOBILE_QUERY).matches) return;
    if (initialized) return;

    const container = document.querySelector(".about-atv__presence");
    const track = document.querySelector(".about-atv__presence-track");
    if (!container || !track) return;

    initialized = true;

    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (_) {}
    }

    if (measure(container, track)) {
      start(track);
    }

    const resizeObserver = new ResizeObserver(() => {
      if (measure(container, track)) {
        position = 0;
        lastTime = null;
        start(track);
      }
    });
    resizeObserver.observe(container);

    const mutationObserver = new MutationObserver(() => {
      if (measure(container, track)) {
        position = 0;
        lastTime = null;
        start(track);
      }
    });
    mutationObserver.observe(track, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    const retryId = setInterval(() => {
      if (measure(container, track)) {
        position = 0;
        lastTime = null;
        start(track);
        clearInterval(retryId);
      }
    }, 500);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
