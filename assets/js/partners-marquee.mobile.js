(() => {
  const MOBILE_MAX_WIDTH = 767;
  const SPEED_PX_PER_SEC = 18;
  const RESUME_DELAY_MS = 700;
  const RESUME_EASE_MS = 700;

  if (window.innerWidth > MOBILE_MAX_WIDTH) return;

  const section = document.querySelector(".page-collaboration .partners");
  const list = section?.querySelector(".partners__list");
  if (!section || !list) return;
  if (list.dataset.marqueeInit === "1") return;
  list.dataset.marqueeInit = "1";

  let originalCount = Array.from(list.children).length;
  let items = [];
  let itemCenters = [];
  let originalWidth = 0;
  let lastTime = null;
  let currentSpeed = 0;
  let position = 0;
  let resumeTimeoutId = null;
  let autoScrolling = false;
  let tapIndex = null;
  let isPaused = false;
  let resumeStart = null;

  const cloneItems = () => {
    const originals = Array.from(list.children);
    originals.forEach((item) => {
      const clone = item.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      list.appendChild(clone);
    });
  };

  const measure = () => {
    items = Array.from(list.children);
    if (!items.length) return;

    const lastOriginal = items[originalCount - 1];
    originalWidth = lastOriginal.offsetLeft + lastOriginal.offsetWidth;
    itemCenters = items.map((item) => item.offsetLeft + item.offsetWidth / 2);
  };

  const pause = () => {
    isPaused = true;
    currentSpeed = 0;
    resumeStart = null;
    if (resumeTimeoutId) {
      clearTimeout(resumeTimeoutId);
      resumeTimeoutId = null;
    }
  };

  const scheduleResume = () => {
    if (resumeTimeoutId) clearTimeout(resumeTimeoutId);
    resumeTimeoutId = setTimeout(() => {
      isPaused = false;
      resumeStart = performance.now();
    }, RESUME_DELAY_MS);
  };

  const updateDepth = () => {
    const viewportCenter = list.scrollLeft + list.clientWidth / 2;
    const maxDistance = list.clientWidth / 2;

    items.forEach((item, index) => {
      const distance = Math.min(
        Math.abs(itemCenters[index] - viewportCenter),
        maxDistance
      );
      const t = distance / maxDistance;
      let scale = 1.05 - 0.1 * t;
      let opacity = 1 - 0.3 * t;

      if (tapIndex !== null) {
        const diff = Math.abs(index - tapIndex);
        if (diff === 0) {
          scale += 0.04;
          opacity = 1;
        } else if (diff === 1) {
          opacity *= 0.7;
        } else {
          opacity *= 0.85;
        }
      }

      item.style.transform = `scale(${scale.toFixed(3)})`;
      item.style.opacity = opacity.toFixed(2);
    });
  };

  const tick = (time) => {
    if (lastTime === null) lastTime = time;
    const delta = (time - lastTime) / 1000;
    lastTime = time;

    if (!originalWidth) {
      measure();
    }

    if (isPaused) {
      currentSpeed = 0;
    } else if (resumeStart !== null) {
      const t = Math.min(1, (time - resumeStart) / RESUME_EASE_MS);
      currentSpeed = SPEED_PX_PER_SEC * (1 - Math.pow(1 - t, 3));
      if (t >= 1) {
        resumeStart = null;
      }
    } else {
      currentSpeed = SPEED_PX_PER_SEC;
    }

    if (currentSpeed > 0 && originalWidth > 0) {
      autoScrolling = true;
      position += currentSpeed * delta;
      if (position >= originalWidth) {
        position -= originalWidth;
      }
      list.scrollLeft = position;
      autoScrolling = false;
    }

    updateDepth();
    requestAnimationFrame(tick);
  };

  const handlePointerDown = (event) => {
    const item = event.target.closest(".partners-item");
    if (item) {
      tapIndex = items.indexOf(item);
    }
    pause();
  };

  const clearTap = () => {
    tapIndex = null;
    scheduleResume();
  };

  const onScroll = () => {
    if (autoScrolling) return;
    position = list.scrollLeft;
    pause();
    scheduleResume();
  };

  const init = () => {
    cloneItems();
    measure();
    list.scrollLeft = 0;
    position = 0;

    list.addEventListener("pointerdown", handlePointerDown, { passive: true });
    list.addEventListener("pointerup", clearTap, { passive: true });
    list.addEventListener("pointercancel", clearTap, { passive: true });
    list.addEventListener("pointerleave", clearTap, { passive: true });
    list.addEventListener("touchstart", pause, { passive: true });
    list.addEventListener("touchend", scheduleResume, { passive: true });
    list.addEventListener("wheel", pause, { passive: true });
    list.addEventListener("scroll", onScroll, { passive: true });

    window.addEventListener("resize", () => {
      if (window.innerWidth > MOBILE_MAX_WIDTH) return;
      measure();
    });

    requestAnimationFrame(tick);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
