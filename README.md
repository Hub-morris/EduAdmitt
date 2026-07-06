# EduAdmit — Online University Admission System

A full-stack university admission platform built with **React**, **Node.js**, and **PostgreSQL**, matching the EduAdmit UI/UX design system.

## Features

### Student Module
- Register & login
- Search programmes (filter by faculty, department, cost, type, degree)
- View programme details & school information
- Select programme & submit multi-step application
- Track application status (timeline view)
- View, download & print admission offer letter

### Admin Module
- Dashboard with stats & application chart
- Verify applications & uploaded documents
- AI-powered qualification check with explanatory reasoning (OpenAI optional, rule-based fallback)
- Approve admission & generate offer letters
- Manage programmes

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, React Router, Framer Motion, Recharts |
| Backend | Node.js, Express, JWT, Multer, PDFKit |
| Database | PostgreSQL |

## Quick Start

### 1. Start PostgreSQL

```bash
docker compose up -d
```

### 2. Backend

```bash
cd backend
npm install
npm run seed    # Initialize DB & seed sample data
npm run dev     # Starts on http://localhost:5000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev     # Starts on http://localhost:3000
```

## Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@eduadmit.ac.ke | admin123 |
| Student | Register at /register | — |

## Application Workflow

1. **Information Search** — Browse & filter programmes
2. **Programme Selection** — Select preferred programme
3. **Application** — Submit personal, contact, academic info & documents
4. **Verification** — Admin verifies documents
5. **Qualification Check** — System compares KCSE grade vs requirements + AI explanation
6. **Admission Offer** — Admin approves & assigns admission number
7. **Offer Letter** — Student downloads/prints official letter

## Project Structure

```
EduAdmit/
├── backend/          # Express API
├── frontend/         # React SPA (lazy-loaded routes)
├── docker-compose.yml
└── README.md
```

## Environment Variables

Copy `backend/.env.example` to `backend/.env`:

```
PORT=5000
DATABASE_URL=postgresql://eduadmit:eduadmit123@localhost:5432/eduadmit
JWT_SECRET=your_secret_key
UPLOAD_DIR=uploads
OPENAI_API_KEY=          # Optional — enables GPT-powered qualification reasoning
OPENAI_MODEL=gpt-4o-mini
```

## E2E Test

With PostgreSQL and the backend running:

```bash
cd backend
npm run test:e2e
```

Or run the full self-contained test (downloads embedded PostgreSQL, no Docker needed):

```bash
cd backend
npm run test:e2e:full
```

This walks through registration → programme search/filter → selection → application (with county & emergency contact) → admin verify → AI qualification → admission → offer letter.
