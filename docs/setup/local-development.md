# SHALX NETGUARD SOC — Local Development & Setup Guide

This guide walks through cloning, configuring, and executing SHALX NETGUARD in a zero-configuration local environment.

---

## 1. Prerequisites
- Python 3.10+
- Node.js 18+ and npm
- Git

---

## 2. Backend Setup

1. Open a terminal in the project root:
   ```bash
   pip install -r backend/requirements.txt
   ```

2. Copy the sample environment file:
   ```bash
   cp .env.example .env
   ```

3. Launch the FastAPI backend server:
   ```bash
   python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

4. The backend will automatically initialize the database schema and seed the default administrator account:
   - **Username**: `admin`
   - **Password**: `NetGuard@2026!`

---

## 3. Frontend Setup

1. Open a second terminal window in `frontend/`:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

2. Open your browser and navigate to `http://localhost:5173`.
3. Sign in using the credentials above.

---

## 4. Running Backend Tests

To execute the automated test suite with full verbose reporting:
```bash
python -m pytest backend/tests/ -v
```
