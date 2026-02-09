const section = document.getElementById("cardSection");
const track = document.querySelector(".card__candy");
const items = document.querySelectorAll(".card__candy-item");

const prevBtn = document.querySelector(".pagination__arrow:first-child");
const nextBtn = document.querySelector(".pagination__arrow:last-child");
const counter = document.querySelector(".pagination__counter");

let currentIndex = 0;
const total = items.length;

function updateCounter() {
  counter.textContent = `${String(currentIndex + 1).padStart(
    2,
    "0"
  )} / ${String(total).padStart(2, "0")}`;
}

function updateBackground() {
  section.className = "card";
  section.classList.add(items[currentIndex].dataset.bg);
}

function updateCarousel() {
  track.style.transform = `translateX(-${currentIndex * 100}%)`;
  updateCounter();
  updateBackground();
}

nextBtn.addEventListener("click", () => {
  if (currentIndex < total - 1) {
    currentIndex++;
    updateCarousel();
  }
});

prevBtn.addEventListener("click", () => {
  if (currentIndex > 0) {
    currentIndex--;
    updateCarousel();
  }
});

/* Свайп: один слайд за жест */
let touchStartX = 0;
let touchEndX = 0;
const SWIPE_THRESHOLD = 50;

if (track && section) {
  section.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.changedTouches ? e.changedTouches[0].screenX : e.screenX;
    },
    { passive: true }
  );
  section.addEventListener(
    "touchend",
    (e) => {
      touchEndX = e.changedTouches ? e.changedTouches[0].screenX : e.screenX;
      const delta = touchStartX - touchEndX;
      if (Math.abs(delta) < SWIPE_THRESHOLD) return;
      if (delta > 0 && currentIndex < total - 1) {
        currentIndex++;
        updateCarousel();
      } else if (delta < 0 && currentIndex > 0) {
        currentIndex--;
        updateCarousel();
      }
    },
    { passive: true }
  );
}

updateCarousel();
