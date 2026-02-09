# Деплой ассетов на сервер (без 404)

Чтобы картинки и CSS грузились на **groupatv.ru** так же, как локально, проверьте следующее.

## 1. Регистр имён файлов (Linux)

Сервер под Linux различает регистр. Все имена — **только в нижнем регистре**.

### Иконка Яндекса

- В коде везде: `/images/icons/yandex-icon.webp`.
- На диске файл **обязательно** должен называться `yandex-icon.webp` (с маленькой **y**).
- Если у вас до сих пор `Yandex-icon.webp`, переименуйте локально и закоммитьте, либо на сервере:
  ```bash
  cd /path/to/site/images/icons
  mv Yandex-icon.webp yandex-icon.webp   # если файл с большой Y
  ```

## 2. Hero-картинки на product.html

Страница запрашивает файлы из каталога **`/assets/images/products/`**:

- `product_cover_one.webp`
- `product_cover_two.webp`
- `product_cover_three.webp`
- `product_cover_four.webp`
- `brand_cover_one.webp`
- `brand_cover_two.webp`

Имена — строго в **нижнем регистре**. Положите эти 6 файлов в каталог `assets/images/products/` в репозитории и задеплойте папку вместе с сайтом.

## 3. error.css

В `main.css` импорт заменён на абсолютный URL:

```css
@import url("/assets/css/error.css");
```

Браузер всегда запрашивает `https://groupatv.ru/assets/css/error.css`. Убедитесь, что файл `assets/css/error.css` попадает на сервер в этот путь.

## 4. Nginx

- Для `location /assets/` и `location /images/` не должно быть fallback на `index.html` (иначе 404 отдаётся как HTML и будет MIME error для CSS).
- Статику отдавайте через `try_files $uri =404;` по нужным location.

## 5. Чек перед деплоем

- [ ] В репозитории есть `assets/images/products/` и в нём 6 webp-файлов (имена в нижнем регистре).
- [ ] В репозитории есть `images/icons/yandex-icon.webp` (с маленькой y).
- [ ] На сервере после деплоя: `assets/css/error.css`, `assets/images/products/*.webp`, `images/icons/yandex-icon.webp` отдаются с кодом 200.

После этого 404 по этим ресурсам и ошибки MIME/Console (form.js, search-autocomplete.js) должны пропасть.
