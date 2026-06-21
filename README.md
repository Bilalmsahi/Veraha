<div align="center">

<img src="logo-brand.png" alt="Veraha" width="280"/>

### Compliance automation, built for teams that take security seriously.

**SOC 2 · ISO 27001 · HIPAA · GDPR — one platform, continuously audit-ready.**

[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![AWS S3](https://img.shields.io/badge/AWS-S3-FF9900?logo=amazonaws&logoColor=white)](https://aws.amazon.com/s3/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com)

</div>

---

## What is Veraha?

**Veraha** is a multi-tenant **compliance automation platform** that helps companies get and stay audit-ready for the frameworks that matter most: **SOC 2 Type II, ISO 27001:2022, HIPAA, and GDPR**.

Instead of compliance living in spreadsheets, shared drives, and someone's memory, Veraha gives every organization a single source of truth: live readiness scores, controls mapped to evidence, policies with real version history, risk registers that actually connect to mitigations, and an audit workflow that auditors can use directly — without ever pinging an engineer for a screenshot.

It's built as three coordinated applications sharing one backend:

| App | Who it's for | What it does |
|---|---|---|
| 🧭 **Client** | Compliance teams, employees, auditors | The day-to-day platform — frameworks, controls, evidence, policies, risk, vendors, audits |
| 🛡️ **Admin Client** | Platform operators (you) | Super-admin console for provisioning and managing tenant organizations |
| ⚙️ **Server** | — | A single Express/MongoDB API powering both front-ends, with S3-backed file storage and scheduled compliance jobs |

---

## ✨ Feature Highlights

### 📊 Live Compliance Dashboards
Real-time readiness scores per framework, control-status breakdowns, and "needs attention" rollups across policies, evidence, tests, and vendors — so nothing slips through during a quiet quarter.

### 🗂️ Controls & Multi-Framework Mapping
A single control can satisfy SOC 2, ISO 27001, HIPAA, and GDPR simultaneously. Controls carry **dual status tracking** — manual review status *and* automated test status — with full assignment, ownership, and history.

### 📁 Evidence Management
S3-backed uploads with **presigned, expiring URLs**, full versioning, and a real approval lifecycle (`Pending → Reviewed → Approved/Rejected`), plus `validFrom`/`validUntil` tracking so stale evidence gets flagged automatically, not discovered during an audit.

### 📜 Policy Lifecycle, Done Properly
A self-hosted rich-text editor (TinyMCE — no third-party API keys or limits), full version history with changelogs, a template library, and built-in **employee attestation** so you can prove, not just claim, that staff read and accepted every policy.

### ⚠️ Risk Register That Connects to Reality
Qualitative risk scoring (Likelihood × Impact), a reusable risk library, and risk-to-control mitigation linking — so every identified risk has a traceable, auditable response.

### 🤝 Vendor Risk Management
A full vendor inventory with risk tiering (High/Medium/Low), certification tracking (SOC 2, ISO, etc.) with file evidence, vendor assessment questionnaires, and vendor-to-control linkage for third-party risk visibility.

### 🔍 Built-In Audit Workflow
Dedicated audit periods, auditor assignment, scoped evidence requests, findings tracking, and a **read-only Auditor Portal** — external auditors get exactly the access they need, nothing more.

### 🎓 Personnel & Training
Employee directories with HR system sync, mandatory training modules with quizzes, completion tracking, and structured onboarding/offboarding task workflows.

### 🔌 Native Integrations
AWS account integration for automated technical findings, HR system sync for personnel data, and a Notion-powered seed pipeline for compliance control template libraries.

### 🔐 Role-Based Access & Multi-Tenancy
Strict tenant isolation with `ADMIN / MANAGER / EMPLOYEE / AUDITOR` roles, access review campaigns, and an org-wide activity log for full traceability.

### 🏢 Platform Administration
A dedicated admin console for provisioning organizations, assigning frameworks, managing users at scale, and overseeing the health of every tenant on the platform.

---

## 🏗️ Architecture

```
Veraha/
├── client/          React 19 + TypeScript SPA — the core compliance platform
├── admin-client/    React 19 + TypeScript SPA — internal super-admin console
└── server/          Express 5 + MongoDB API — shared backend for both apps
```

```
                       ┌─────────────────┐
                       │   AWS S3         │  Evidence, policies,
                       │   (file storage) │  vendor certifications
                       └────────▲────────┘
                                │ presigned URLs
        ┌───────────┐    ┌─────┴──────┐    ┌──────────────┐
        │  Client    │───▶│  Express    │◀───│  Admin Client │
        │  (React)   │◀───│  REST API   │───▶│   (React)     │
        └───────────┘    └─────┬──────┘    └──────────────┘
                                │
                       ┌────────▼────────┐
                       │    MongoDB       │
                       │   (Mongoose)     │
                       └─────────────────┘
                                │
                       ┌────────▼────────┐
                       │  node-cron jobs  │  Evidence reminders,
                       │                  │  policy/test unsnooze,
                       └─────────────────┘  invitation expiry
```

---

## 🧰 Tech Stack

<table>
<tr><td valign="top">

**Client**
- React 19 + TypeScript + Vite
- Tailwind CSS 4 + shadcn/ui + Radix UI
- Zustand (state) + TanStack Query (data)
- React Hook Form + Zod validation
- TinyMCE (self-hosted rich text)
- Recharts, React Router 7, DOMPurify
- Vitest

</td><td valign="top">

**Admin Client**
- React 19 + TypeScript + Vite
- Tailwind CSS 4 + shadcn/ui
- Lightweight, dependency-minimal SPA
- Radix UI primitives, Lucide icons

</td><td valign="top">

**Server**
- Node.js 20 + Express 5
- MongoDB + Mongoose
- JWT auth + bcrypt hashing
- AWS S3 (uploads + presigned URLs)
- Zod validation, sanitize-html
- node-cron scheduled jobs
- Mammoth (DOCX) / xlsx parsing
- Notion API (template seeding)
- Jest + Supertest + mongodb-memory-server
- Docker + docker-compose

</td></tr>
</table>

---

## 📦 What's Under the Hood

The backend alone ships **20+ API domains** — auth, organizations, frameworks, controls, evidence, policies, risk, vendors, tests, audits, access reviews, devices, personnel & training, integrations (AWS/HR), activity logging, comments, and reporting — backed by **40+ data models** and a full automated test suite (Jest + Supertest + in-memory MongoDB).

The client ships **19+ feature areas** spanning the full compliance lifecycle, from the first framework activation to a completed audit, including a dedicated read-only portal for external auditors.

This isn't a prototype — it's a production-shaped, multi-tenant SaaS platform with real authentication, real file lifecycle management, real audit trails, and real automation running on schedule.

---

## 🚀 Getting Started

> Each app is independently runnable. You'll need Node.js 20+, a MongoDB instance, and AWS S3 credentials (or local fallback storage) for the server.

### Server

```bash
cd server
npm install
cp .env.example .env   # configure MongoDB URI, JWT secret, AWS credentials
npm run dev
```

Or via Docker:

```bash
cd server
docker-compose up --build
```

### Client (compliance platform)

```bash
cd client
npm install
npm run dev
```

### Admin Client (platform console)

```bash
cd admin-client
npm install
npm run dev
```

---

## 🔒 Security Practices

- JWT-based authentication with bcrypt password hashing
- Role-based authorization (`ADMIN`, `MANAGER`, `EMPLOYEE`, `AUDITOR`)
- Input sanitization against NoSQL injection and unsafe HTML (`sanitize-html`, custom Mongo sanitization middleware)
- Shared Zod validation schemas between client and server, so the same rules are enforced on both ends
- Time-limited, presigned S3 URLs — files are never publicly exposed
- Strict multi-tenant data isolation at the query layer

---

## 📄 License

This project is proprietary. All rights reserved.

---

<div align="center">

**Veraha** — compliance, without the chaos.

</div>
