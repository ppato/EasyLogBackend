# EasyLog Backend

Este es el backend de **EasyLogSaaS**, una plataforma de monitoreo de logs para microservicios con enfoque multiempresa.

## 🚀 Tecnologías utilizadas

- Node.js + Express
- MongoDB + Mongoose
- JWT para autenticación
- Arquitectura RESTful
- CORS y middlewares personalizados

---

## 🔐 Autenticación

- Registro de empresa y primer usuario: `POST /api/register-company`
- Login con token JWT: `POST /api/login`
- Middleware para proteger rutas: verifica token y carga `req.user`

---

## 🧾 Endpoints principales

### Logs
- `POST /api/logs` → Guarda logs enviados desde servicios externos
- `GET /api/logs` → Lista logs de la empresa autenticada
- `GET /api/logs/levels` → Retorna los niveles únicos (`info`, `warning`, `critical`)

### Usuarios
- `POST /api/register-company` → Registra empresa y primer usuario
- `POST /api/login` → Devuelve un token JWT si las credenciales son válidas

---

## 🛠️ Setup local

1. Clona el repositorio:

```bash
git clone https://github.com/ppato/easylog-backend.git
cd easylog-backend
