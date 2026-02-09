# Инструкция по настройке отправки форм

## Установка зависимостей

```bash
npm install
```

## Настройка переменных окружения

Создайте файл `.env` в корне проекта со следующим содержимым:

```env
# SMTP настройки
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com

# Email получателя
EMAIL_TO=info@atv-group.ru

# Порт сервера
PORT=5500
```

### Настройка Gmail SMTP

1. Включите двухфакторную аутентификацию в вашем Google аккаунте
2. Создайте пароль приложения:
   - Перейдите в настройки аккаунта Google
   - Безопасность → Двухэтапная аутентификация → Пароли приложений
   - Создайте новый пароль приложения для "Почта"
   - Используйте этот пароль в `SMTP_PASS`

### Альтернативные SMTP провайдеры

**Yandex:**
```env
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_SECURE=true
```

**Mail.ru:**
```env
SMTP_HOST=smtp.mail.ru
SMTP_PORT=465
SMTP_SECURE=true
```

## Запуск сервера

```bash
npm run server
# или
npm start
```

Сервер будет доступен по адресу: `http://localhost:5500`

## Использование

1. Запустите сервер: `npm run server`
2. Откройте страницу `collaboration.html` в браузере
3. Заполните и отправьте форму (партнёр или производитель)
4. После успешной отправки появится модальное окно

## API Endpoints

### POST /partner
Отправка формы "Стать партнёром"   -  

**Тело запроса:**
```json
{
  "partner_fullname": "Иванов Иван Иванович",
  "partner_phone": "+79991234567",
  "partner_email": "example@mail.ru",
  "partner_message": "Текст сообщения (необязательно)"
}
```

### POST /manufacturer
Отправка формы "Для производителя"

**Тело запроса:**
```json
{
  "manufacturer_company": "ООО Компания",
  "manufacturer_contact": "Петров Петр",
  "manufacturer_phone": "+79991234567",
  "manufacturer_email": "example@mail.ru",
  "manufacturer_message": "Описание предложения"
}
```

## Структура файлов

- `server.js` - Express сервер с обработкой форм
- `assets/js/forms-handler.js` - Frontend обработка отправки форм
- `assets/css/success-modal.css` - Стили модального окна
- `collaboration.html` - HTML страница с формами и модальным окном

## Особенности

- Валидация обязательных полей на сервере
- Красивые HTML-письма с форматированием
- Модальное окно с плавной анимацией
- Закрытие модального окна по клику на overlay, ESC или кнопку
- Блокировка прокрутки страницы при открытом модальном окне
- Обработка ошибок с понятными сообщениями



