const path = require('path');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5500;

// --- Middleware order: compression → security → cors → body → static → routes ---

app.use(compression());

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

// CORS: default reflects request origin. Set ALLOWED_ORIGIN in production to restrict.
const corsOrigin = process.env.ALLOWED_ORIGIN;
app.use(cors(corsOrigin ? { origin: corsOrigin } : {}));

app.use(express.json());

// Static files with cache headers. Assets not fingerprinted → 7 days + ETag. HTML → revalidate.
const staticOpts = {
  setHeaders(res, filePath) {
    const normalized = path.normalize(filePath);
    const sep = path.sep;
    const inAssets =
      normalized.includes(sep + 'assets' + sep) ||
      normalized.includes(sep + 'images' + sep) ||
      normalized.includes(sep + 'data' + sep);
    if (inAssets) {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    } else if (path.extname(normalized) === '.html') {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    }
  },
};
app.use(express.static('.', staticOpts));

// --- Routes ---

// Health check for hosting/load balancers (unchanged behavior for local dev)
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function createPartnerEmailHTML(data) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .content { background: #fff; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; }
          .field { margin-bottom: 15px; }
          .label { font-weight: bold; color: #555; }
          .value { margin-top: 5px; padding: 8px; background: #f8f9fa; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Новая заявка: Стать партнёром</h2>
          </div>
          <div class="content">
            <div class="field">
              <div class="label">ФИО:</div>
              <div class="value">${data.partner_fullname || 'Не указано'}</div>
            </div>
            <div class="field">
              <div class="label">Телефон:</div>
              <div class="value">${data.partner_phone || 'Не указано'}</div>
            </div>
            <div class="field">
              <div class="label">Email:</div>
              <div class="value">${data.partner_email || 'Не указано'}</div>
            </div>
            <div class="field">
              <div class="label">Сообщение:</div>
              <div class="value">${data.partner_message || 'Не указано'}</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

function createManufacturerEmailHTML(data) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .content { background: #fff; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; }
          .field { margin-bottom: 15px; }
          .label { font-weight: bold; color: #555; }
          .value { margin-top: 5px; padding: 8px; background: #f8f9fa; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Новая заявка: Для производителя</h2>
          </div>
          <div class="content">
            <div class="field">
              <div class="label">Название компании:</div>
              <div class="value">${data.manufacturer_company || 'Не указано'}</div>
            </div>
            <div class="field">
              <div class="label">Контактное лицо:</div>
              <div class="value">${data.manufacturer_contact || 'Не указано'}</div>
            </div>
            <div class="field">
              <div class="label">Телефон:</div>
              <div class="value">${data.manufacturer_phone || 'Не указано'}</div>
            </div>
            <div class="field">
              <div class="label">Email:</div>
              <div class="value">${data.manufacturer_email || 'Не указано'}</div>
            </div>
            <div class="field">
              <div class="label">Описание предложения:</div>
              <div class="value">${data.manufacturer_message || 'Не указано'}</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

function createPriceListEmailHTML(data) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .content { background: #fff; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; }
          .field { margin-bottom: 15px; }
          .label { font-weight: bold; color: #555; }
          .value { margin-top: 5px; padding: 8px; background: #f8f9fa; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Новая заявка: Заявка на прайс-лист</h2>
          </div>
          <div class="content">
            <div class="field">
              <div class="label">Имя:</div>
              <div class="value">${data.name || 'Не указано'}</div>
            </div>
            <div class="field">
              <div class="label">Email:</div>
              <div class="value">${data.email || 'Не указано'}</div>
            </div>
            <div class="field">
              <div class="label">Телефон:</div>
              <div class="value">${data.phone || 'Не указано'}</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

// Rate limit for form POSTs only (reduce abuse; same behavior for normal use)
const formRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { success: false, error: 'Слишком много запросов. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/partner', formRateLimiter, async (req, res) => {
  try {
    const { partner_fullname, partner_phone, partner_email, partner_message, consent } = req.body;

    if (!partner_fullname || !partner_phone || !partner_email) {
      return res.status(400).json({
        success: false,
        error: 'Обязательные поля не заполнены',
      });
    }
    if (consent !== undefined && consent !== 'on' && consent !== true && String(consent).toLowerCase() !== 'true') {
      return res.status(400).json({
        success: false,
        error: 'Необходимо согласие на обработку персональных данных',
      });
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.EMAIL_TO,
      subject: 'Новая заявка: Стать партнёром',
      html: createPartnerEmailHTML(req.body),
      text: `
        Новая заявка: Стать партнёром
        ФИО: ${partner_fullname}
        Телефон: ${partner_phone}
        Email: ${partner_email}
        Сообщение: ${partner_message || 'Не указано'}
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка отправки письма:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка отправки заявки',
    });
  }
});

app.post('/manufacturer', formRateLimiter, async (req, res) => {
  try {
    const { manufacturer_company, manufacturer_contact, manufacturer_phone, manufacturer_email, manufacturer_message, consent } =
      req.body;

    if (!manufacturer_company || !manufacturer_contact || !manufacturer_phone || !manufacturer_email) {
      return res.status(400).json({
        success: false,
        error: 'Обязательные поля не заполнены',
      });
    }
    if (consent !== undefined && consent !== 'on' && consent !== true && String(consent).toLowerCase() !== 'true') {
      return res.status(400).json({
        success: false,
        error: 'Необходимо согласие на обработку персональных данных',
      });
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.EMAIL_TO,
      subject: 'Новая заявка: Для производителя',
      html: createManufacturerEmailHTML(req.body),
      text: `
        Новая заявка: Для производителя
        Название компании: ${manufacturer_company}
        Контактное лицо: ${manufacturer_contact}
        Телефон: ${manufacturer_phone}
        Email: ${manufacturer_email}
        Описание предложения: ${manufacturer_message || 'Не указано'}
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка отправки письма:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка отправки заявки',
    });
  }
});

app.post('/price-list', formRateLimiter, async (req, res) => {
  try {
    console.log('Получен запрос на /price-list:', req.body);

    const { name, email, phone } = req.body;

    if (!name || !email || !phone) {
      console.log('Ошибка валидации: не все поля заполнены');
      return res.status(400).json({
        success: false,
        error: 'Обязательные поля не заполнены',
      });
    }

    if (!process.env.EMAIL_TO) {
      console.log('Предупреждение: EMAIL_TO не установлен, но продолжаем обработку');
      return res.json({
        success: true,
        message: 'Заявка получена (email не настроен)',
      });
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.EMAIL_TO,
      subject: 'Новая заявка: Заявка на прайс-лист',
      html: createPriceListEmailHTML(req.body),
      text: `
        Новая заявка: Заявка на прайс-лист
        Имя: ${name}
        Email: ${email}
        Телефон: ${phone}
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('Email успешно отправлен');
    } catch (emailError) {
      console.error('Ошибка отправки email:', emailError);
      return res.json({
        success: true,
        message: 'Заявка получена, но email не отправлен',
        warning: emailError.message,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка обработки запроса:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка отправки заявки: ' + error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
