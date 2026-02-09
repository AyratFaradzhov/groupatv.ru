# Отчёт аудита проекта (Frontend + DevOps)

**Дата:** 2025  
**Задачи:** пути к файлам, 404, регистр (Linux), CSS/JS, загрузка, MIME.

---

## 1. Пути к файлам и регистр (lowercase / kebab-case)

### Исправлено

| Что | Было | Стало |
|-----|------|--------|
| **error.css** | В `main.css`: `@import "../error.css"` (указывал на `assets/error.css` — файла нет) | `@import "./error.css"` (файл в `assets/css/error.css`) |
| **CollaborationMobile.css** | Имя с CamelCase, чувствительно к регистру на Linux | Файл переименован в **collaboration-mobile.css**, ссылка в `collaboration.html` обновлена. Старый `CollaborationMobile.css` удалён. |
| **Yandex-icon.webp** | Во всех HTML: `images/icons/Yandex-icon.webp` (заглавная Y) | Во всех HTML: **images/icons/yandex-icon.webp** (lowercase). |

### Переименование иконки Яндекса (lowercase)

- Во всех HTML и в футере пути уже ведут на **images/icons/yandex-icon.webp**.
- Чтобы переименовать файл на диске (с `Yandex-icon.webp` на `yandex-icon.webp`), выполните один раз в корне проекта:
  ```bash
  npm run rename-yandex-icon
  ```
  (скрипт: `scripts/rename-yandex-icon.js`)

---

## 2. Ресурсы 404

- **error.css** — исправлен путь в `main.css` (см. выше), 404 устранён.
- **CollaborationMobile.css** — заменён на `collaboration-mobile.css`, 404 устранён.
- Остальные проверенные пути к изображениям в `assets/images/`, `images/icons/` и в CSS соответствуют существующим файлам. Изображения из `data/products.json` (например, `foods_normalized_v2/...`) зависят от наличия этой папки на сервере.

---

## 3. Подключённые CSS

- **error.css** — файл есть в `assets/css/error.css`. В `main.css` исправлен импорт с `../error.css` на `./error.css`.
- **CollaborationMobile.css** — заменён на **collaboration-mobile.css**, старый файл удалён, дублирования нет.

---

## 4. JavaScript

- **product-loader.js**
  - В начале `init()` добавлена проверка: скрипт не выполняется на страницах без контейнера продукта (нет `.product-page` и `#productsGrid`), чтобы не было ошибок в Console на главной, контактах и т.д.
- Остальные скрипты подключаются только на тех страницах, где есть нужные блоки (product-loader только в `product.html` и т.д.). Критичных синтаксических ошибок (Unexpected token) не найдено.
- Рекомендация: в остальных скриптах при использовании `querySelector` / `getElementById` по возможности оборачивать вызовы в проверки `if (el) { ... }` — в ключевом product-loader проверка контекста страницы уже добавлена.

---

## 5. Загрузка (defer, preload)

- **defer:** для всех локальных и внешних скриптов в HTML добавлен атрибут **defer** в файлах:
  - `index.html`, `product.html`, `about.html`, `collaboration.html`, `contacts.html`, `request-price.html`, `error.html`, `terms.html`, `privacy.html`, `consent.html`
- Порядок выполнения скриптов сохраняется (defer выполняет скрипты по порядку после разбора DOM).
- **Preload:** в `index.html` оставлен один критичный preload: `images/Subtract.png` для LCP. Дублирующих preload не добавлено.

---

## 6. MIME-типы

- Раздача статики через **Express** (`server.js`) с `express.static()` отдаёт корректные MIME по расширению (в т.ч. `text/css`, `application/javascript`, `image/webp` и др.).
- Для кастомного сервера (nginx/apache) убедитесь, что:
  - `.css` → `text/css`
  - `.js` → `application/javascript`
  - `.webp` → `image/webp`, `.png` → `image/png`, `.svg` → `image/svg+xml`

---

## 7. Изменённые файлы (список)

| Файл | Изменения |
|------|-----------|
| `assets/css/main.css` | Импорт `../error.css` → `./error.css` |
| `assets/css/collaboration-mobile.css` | **Создан** (копия содержимого с kebab-case именем) |
| `assets/css/CollaborationMobile.css` | **Удалён** (заменён на collaboration-mobile.css) |
| `collaboration.html` | Ссылка на `collaboration-mobile.css`, все `Yandex-icon.webp` → `yandex-icon.webp`, скриптам добавлен `defer` |
| `product.html` | `Yandex-icon.webp` → `yandex-icon.webp`, скриптам добавлен `defer` |
| `index.html` | `Yandex-icon.webp` → `yandex-icon.webp`, скриптам добавлен `defer` |
| `about.html` | `Yandex-icon.webp` → `yandex-icon.webp`, скриптам добавлен `defer` |
| `request-price.html` | `Yandex-icon.webp` → `yandex-icon.webp`, скриптам добавлен `defer` |
| `contacts.html` | `Yandex-icon.webp` → `yandex-icon.webp`, скриптам добавлен `defer` |
| `error.html` | `Yandex-icon.webp` → `yandex-icon.webp`, скриптам добавлен `defer` |
| `terms.html` | Скриптам добавлен `defer` |
| `privacy.html` | Скриптам добавлен `defer` |
| `consent.html` | Скриптам добавлен `defer` |
| `blocks/footer/footer.html` | `Yandex-icon.webp` → `yandex-icon.webp` |
| `about_comapy.html` | `Yandex-icon.webp` → `yandex-icon.webp` |
| `assets/js/product-loader.js` | В начале `init()` добавлена проверка наличия `.product-page` / `#productsGrid`, при отсутствии — выход без выполнения |

---

## Проверка DevTools

- **Console:** на страницах без продукта (index, contacts, about и т.д.) product-loader не инициализируется — лишних ошибок из-за отсутствующих элементов не должно быть.
- **Network:** после переименования иконки в **yandex-icon.webp** на сервере (Linux) и исправления путей к error.css и collaboration-mobile.css запросы к этим ресурсам должны возвращать 200, не 404.

---

## Рекомендации на будущее

1. **Имена файлов:** использовать только **lowercase** и **kebab-case** (например, `yandex-icon.webp`, `collaboration-mobile.css`) для совместимости с Linux.
2. **Иконка yandex:** выполнить `npm run rename-yandex-icon`, если файл ещё называется `Yandex-icon.webp`.
3. **Скрипты:** при добавлении нового JS на страницу по возможности оборачивать доступ к DOM в проверки `if (element) { ... }`.
