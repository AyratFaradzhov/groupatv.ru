# Server deployment (ATV-GROUP555)

Notes for running the Express server in production. Behavior is unchanged for local dev.

## Required environment variables

Set these before starting the server (e.g. in `.env` or your host’s env config):

| Variable       | Description |
|----------------|-------------|
| `SMTP_HOST`    | SMTP server host (e.g. `smtp.example.com`) |
| `SMTP_PORT`    | SMTP port (default `587`) |
| `SMTP_SECURE`  | Set to `true` for TLS on connect (e.g. port 465) |
| `SMTP_USER`    | SMTP auth username |
| `SMTP_PASS`    | SMTP auth password |
| `SMTP_FROM`    | (Optional) From address; falls back to `SMTP_USER` |
| `EMAIL_TO`     | Recipient address for form submissions (partner, manufacturer, price-list) |

Optional:

| Variable        | Description |
|-----------------|-------------|
| `PORT`          | Server port (default `5500`) |
| `ALLOWED_ORIGIN`| If set, CORS allows only this origin (e.g. `https://yoursite.com`). Omit to reflect request origin. |

## Recommended production run

- **Direct:**  
  `node server.js`  
  (or `npm start` / `npm run server`)

- **With PM2 (process manager):**  
  `pm2 start server.js --name atv-group`  
  Then: `pm2 save` and `pm2 startup` if you use it for persistence.

## What the server does

- Serves static files from the project root (HTML, assets, images, data). Compression (gzip) and cache headers are applied.
- **Cache:** `/assets/*`, `/images/*`, `/data/*` → 7 days; HTML → `max-age=0, must-revalidate`.
- **Security:** Helmet (CSP disabled to avoid breaking inline scripts); rate limiting on form POSTs only.
- **Health:** `GET /health` returns `200` and `{ "ok": true }` for load balancers / monitoring.
- **Forms (unchanged):** `POST /partner`, `POST /manufacturer`, `POST /price-list` — same validation and nodemailer behavior; responses still `{ success: true }` on success.

## Checking after deploy

1. Pages load (same port as before).
2. Form POSTs return `{ success: true }` and email is sent when `EMAIL_TO` and SMTP are set.
3. Response headers: `Content-Encoding: gzip` for HTML/CSS/JS; `Cache-Control` on static assets; Helmet security headers present.
4. No new errors in server or browser console.
