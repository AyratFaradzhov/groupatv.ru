document.addEventListener("DOMContentLoaded", () => {
  // Работаем ТОЛЬКО на мобилке
  if (window.innerWidth > 767) return;

  const hero = document.querySelector(".about-atv__hero");
  if (!hero) return;

  const heroCard = hero.querySelector(".about-atv__hero-card");
  if (!heroCard) return;

  const button = hero.querySelector(".about-atv__hero-button");
  if (!button) return;

  // Проверяем: кнопка должна быть СРАЗУ ПОСЛЕ карточки
  const nextAfterCard = heroCard.nextElementSibling;

  // Если уже правильно — ничего не делаем
  if (nextAfterCard === button) return;

  // Иначе — переставляем кнопку
  heroCard.insertAdjacentElement("afterend", button);
});

(function () {
  var MOBILE_MAX = 767;

  function reorderFactorySection() {
    if (window.innerWidth > MOBILE_MAX) return;

    var section = document.querySelector(".about-atv--factory");
    if (!section) return;

    var content = section.querySelector(".about-atv__content");
    var info = section.querySelector(".about-atv__info");
    if (!content || !info) return;

    var title = info.querySelector("h2.about-atv__title");
    var description = info.querySelector("p.about-atv__description");
    var features = info.querySelector("ul.about-atv__features");
    var media = section.querySelector(".about-atv__media");
    if (!title || !description || !features || !media) return;

    while (content.firstChild) content.removeChild(content.firstChild);

    content.appendChild(title);
    content.appendChild(media);
    content.appendChild(description);
    content.appendChild(features);
  }

  function moveHeroButton() {
    var hero = document.querySelector(".about-atv__hero");
    if (!hero) return;

    var card = hero.querySelector(".about-atv__hero-card");
    var button = hero.querySelector(".about-atv__hero-button");
    if (!card || !button) return;

    if (window.innerWidth <= MOBILE_MAX) {
      if (card.contains(button)) {
        hero.insertBefore(button, card.nextSibling);
      }
    } else {
      if (!card.contains(button)) {
        card.appendChild(button);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      reorderFactorySection();
      moveHeroButton();
    });
  } else {
    reorderFactorySection();
    moveHeroButton();
  }

  window.addEventListener("resize", moveHeroButton);
})();

(function () {
  var MOBILE_MAX = 767;
  var SCRIPT_SRC = "assets/js/presence-marquee-mobile.js";

  function loadPresenceMarquee() {
    if (window.innerWidth > MOBILE_MAX) return;
    if (document.querySelector("script[data-presence-marquee]")) return;

    var script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.defer = true;
    script.setAttribute("data-presence-marquee", "true");
    document.body.appendChild(script);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadPresenceMarquee);
  } else {
    loadPresenceMarquee();
  }
})();
