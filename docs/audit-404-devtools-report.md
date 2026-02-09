# Отчёт аудита: 404, MIME, Console (product.html)

**Дата:** 2026-02-09  
**Страница:** https://groupatv.ru/product.html  
**Инструменты:** MCP Chrome DevTools, grep, фактические пути в репозитории.

---

## 1. Сводка 404 из Network (DevTools)

| # | Request URL | HTTP Status | Content-Type (response) | Initiator |
|---|-------------|-------------|-------------------------|-----------|
| 7 | https://groupatv.ru/assets/images/products/icons/catalogy-icon.svg | 404 | text/html; charset=utf-8 | product.html (img src) |
| 8 | https://groupatv.ru/assets/images/products/product_cover_one.webp | 404 | text/html; charset=utf-8 | product.html |
| 9 | https://groupatv.ru/assets/images/products/product_cover_two.webp | 404 | text/html; charset=utf-8 | product.html |
| 10 | https://groupatv.ru/assets/images/products/product_cover_three.webp | 404 | text/html; charset=utf-8 | product.html |
| 11 | https://groupatv.ru/assets/images/products/product_cover_four.webp | 404 | text/html; charset=utf-8 | product.html |
| 12 | https://groupatv.ru/assets/images/products/brand_cover_one.webp | 404 | text/html; charset=utf-8 | product.html |
| 13 | https://groupatv.ru/assets/images/products/brand_cover_two.webp | 404 | text/html; charset=utf-8 | product.html |
| 45 | https://groupatv.ru/assets/error.css | (ERR_ABORTED) | text/html (MIME) | main.css → @import "./error.css" (разрешён как assets/error.css при некорректном base) |
| 55,75 | https://groupatv.ru/assets/images/products/brand_cover_one.webp | 404 | text/html | product.html |
| 56,76 | https://groupatv.ru/assets/images/products/brand_cover_two.webp | 404 | text/html | product.html |
| 78 | https://groupatv.ru/favicon.ico | 404 | — | браузер по умолчанию |

**Вывод:** Сервер отдаёт HTML (страница ошибки) вместо статики — файлов в каталоге `assets/images/products/` нет; при запросе к несуществующему пути nginx (или fallback) возвращает HTML.

---

## 2. Серверная проверка (curl -I)

Выполнить на сервере или с рабочей станции:

```bash
# 404 — должны исчезнуть после патча (новые пути к существующим файлам)
curl -sI https://groupatv.ru/assets/images/products/icons/catalogy-icon.svg
curl -sI https://groupatv.ru/assets/images/products/product_cover_one.webp
curl -sI https://groupatv.ru/assets/images/products/brand_cover_one.webp

# После патча — должны быть 200 и корректный Content-Type
curl -sI https://groupatv.ru/assets/images/icons/catalogy-icon.svg
curl -sI https://groupatv.ru/assets/images/hero_categories/categories-img.webp
curl -sI https://groupatv.ru/assets/images/partner/ozon.webp

# CSS: должен быть 200 и text/css
curl -sI https://groupatv.ru/assets/css/error.css
curl -sI https://groupatv.ru/assets/css/main.css
```

Ожидание после патча и корректного деплоя:
- `assets/images/icons/catalogy-icon.svg` → 200, `Content-Type: image/svg+xml`
- `assets/images/hero_categories/categories-img.webp` → 200, `Content-Type: image/webp`
- `assets/css/error.css` → 200, `Content-Type: text/css`

---

## 3. Упоминания product_cover_two.webp и brand_cover_one.webp (grep)

| Файл | Строка | Путь | Замечание |
|------|--------|------|-----------|
| product.html | 384, 419, 434 (и др.) | assets/images/products/product_cover_two.webp, brand_cover_one.webp | Относительный путь, каталог products/ отсутствует на диске |
| docs/unused-assets-report.md | 174, 198 | assets/images/products/... | Документация (не исправлялась) |

**Регистр:** в коде использовались `product_cover_two.webp`, `brand_cover_one.webp` — в репозитории каталога `assets/images/products/` нет, файлов с такими именами нет.

---

## 4. Linux case-sensitivity и фактические файлы

В репозитории:
- **Нет каталога** `assets/images/products/` — все пути `assets/images/products/*` ведут в несуществующую папку.
- **Есть:** `assets/images/icons/catalogy-icon.svg`, `assets/images/categories/1/catalogy-icon.svg` (в коде использовался `products/icons/`).
- **Есть:** `assets/images/hero_categories/categories-img.webp`, `assets/images/partner/ozon.webp`, `wb.webp` — использованы для замены product_cover_* и brand_cover_*.

Команды для проверки на сервере (Linux):

```bash
ls -la /path/to/site/assets/images/
ls -la /path/to/site/assets/images/products/ 2>/dev/null || echo "No products dir"
ls -la /path/to/site/assets/images/icons/
ls -la /path/to/site/assets/css/error.css
```

После деплоя убедиться: каталога `products/` под `assets/images/` нет; файлы лежат в `icons/`, `hero_categories/`, `partner/`.

---

## 5. A) Таблица: Проблема → Причина → Файл:строка → Исправление

| Проблема | Причина | Файл:строка | Исправление |
|----------|---------|-------------|-------------|
| 404 catalogy-icon.svg | Путь products/icons/ не существует; иконка есть в assets/images/icons/ | product.html:235 | src="/assets/images/icons/catalogy-icon.svg" |
| 404 product_cover_one..four.webp | Каталог products/ и файлы отсутствуют | product.html:377,384,391,398,406 | Заменены на /assets/images/hero_categories/categories-img.webp |
| 404 brand_cover_one/two.webp | Каталог products/ и файлы отсутствуют | product.html:419,426,434 | Заменены на /assets/images/partner/ozon.webp и wb.webp |
| error.css MIME text/html | Запрос к assets/error.css (404), сервер отдаёт HTML | main.css:18 (импорт разрешается относительно base) | Импорт в репо корректен (./error.css → assets/css/error.css). На сервере: раздавать main.css из assets/css/, убедиться что есть assets/css/error.css |
| SyntaxError Unexpected token ')' | Лишняя закрывающая скобка `});` в forEach | search-autocomplete.js:67–69 | Удалена лишняя `});` |
| TypeError: addEventListener of null | form.js выполняется до DOM; на product.html нет #cardSection | form.js:29–41, 74 | Код обёрнут в DOMContentLoaded; добавлена проверка section/track/items/prevBtn/nextBtn/counter, при отсутствии — ранний return |
| Относительные пути к ассетам | Риск 404 при разном base | product.html (hero, catalog icon) | Пути к указанным изображениям заменены на абсолютные /assets/... |

---

## 6. B) Patch (кратко, уже внесён в репозиторий)

- **product.html**
  - Иконка каталога: `assets/images/products/icons/catalogy-icon.svg` → `/assets/images/icons/catalogy-icon.svg`.
  - Hero product carousel: все `assets/images/products/product_cover_*.webp` → `/assets/images/hero_categories/categories-img.webp`.
  - Hero brands carousel: `assets/images/products/brand_cover_one.webp` → `/assets/images/partner/ozon.webp`, `brand_cover_two.webp` → `/assets/images/partner/wb.webp`.
- **assets/js/search-autocomplete.js**
  - Удалена лишняя `});` (строка 67), исправлен синтаксис блока forEach.
- **assets/js/form.js**
  - Весь код обёрнут в IIFE и инициализацию по DOMContentLoaded; перед использованием добавлены проверки на null для section, track, items, prevBtn, nextBtn, counter; при отсутствии элементов скрипт не вешает обработчики и не вызывает updateCarousel.

---

## 7. Nginx: root и location для /assets

Рекомендуемая конфигурация (статику отдавать напрямую, не через index.html):

```nginx
server {
  server_name groupatv.ru;
  root /path/to/site;   # или /var/www/groupatv;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /assets/ {
    try_files $uri =404;
    add_header Cache-Control "public, max-age=31536000";
    # Явно задаём MIME для CSS (если не подхватывается по расширению)
    location ~* \.css$ {
      add_header Content-Type "text/css; charset=utf-8";
    }
  }

  location ~* \.(css)$ {
    add_header Content-Type "text/css; charset=utf-8";
  }
}
```

Проверки:
- Статика под `/assets/` отдаётся напрямую (try_files $uri =404), без fallback на HTML.
- CSS отдаётся с `Content-Type: text/css`.
- Файл `assets/css/error.css` физически присутствует в деплое (скопирован из репозитория).

---

## 8. C) Команды для проверки на сервере

```bash
# 1. Наличие файлов (подставить свой DOCROOT)
DOCROOT=/var/www/groupatv
ls -la $DOCROOT/assets/images/icons/catalogy-icon.svg
ls -la $DOCROOT/assets/images/hero_categories/categories-img.webp
ls -la $DOCROOT/assets/images/partner/ozon.webp
ls -la $DOCROOT/assets/css/error.css
test -d $DOCROOT/assets/images/products && echo "WARN: products dir exists" || true

# 2. После деплоя — HTTP
curl -sI https://groupatv.ru/assets/images/icons/catalogy-icon.svg | head -5
curl -sI https://groupatv.ru/assets/css/main.css | grep -i content-type
curl -sI https://groupatv.ru/assets/css/error.css | grep -i content-type

# 3. Отсутствие 404 по старым путям (ожидается 404 до деплоя, после — не запрашиваются)
curl -so /dev/null -w "%{http_code}" https://groupatv.ru/assets/images/products/product_cover_one.webp
```

---

## 9. D) Финальный чек-лист для DevTools

После применения патча и деплоя:

1. **Network**
   - [ ] Нет запросов со статусом 404 к ресурсам сайта (допустим 404 только favicon.ico, если не добавлен).
   - [ ] Все запросы к `/assets/images/...` и `/assets/css/...` возвращают 200.
   - [ ] `assets/css/error.css` и `main.css` имеют Response Headers → Content-Type: `text/css` (или `text/css; charset=utf-8`).

2. **Console**
   - [ ] Нет ошибок "Failed to load resource: 404".
   - [ ] Нет "Refused to apply style ... MIME type ('text/html')".
   - [ ] Нет "Uncaught SyntaxError" (search-autocomplete.js).
   - [ ] Нет "Uncaught TypeError: Cannot read properties of null" (form.js).

3. **Визуально**
   - [ ] Иконка каталога на product.html отображается.
   - [ ] Hero-карусели (продукция и бренды) показывают изображения.
   - [ ] Стили применяются (в т.ч. от main.css и error.css).

Цель достигнута, когда: загрузка без 404 по ассетам, CSS с корректным MIME, изображения отображаются, Console без ошибок. Решение готово к push после выполнения `npm run build` (если есть) и деплоя с проверкой путей и nginx.
