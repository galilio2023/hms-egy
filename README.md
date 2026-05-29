# 🏥 HMS Egypt (Hospital Management System)

A comprehensive, mission-critical Hospital Management System (HMS) tailored specifically for the Egyptian healthcare market. Built with Next.js, featuring offline-first capabilities, E-invoicing integration, and AI-powered clinical intelligence.

## 🚀 Key Features

### 🩺 Medical Core
- **Patient Management**: Robust Egyptian National ID validation and parsing, demographic tracking, and medical record history.
- **Clinical & Nursing**: SOAP notes, vitals flowsheet, nursing assessment forms, and ward management.
- **Laboratory & Radiology**: Result management with Arabic/Persian numeral handling, automatic criticality detection, and physician alerts.
- **Surgical & Anesthesia**: Operating theatre scheduling and anesthesia documentation.

### 💰 Operations & Financials
- **ETA E-invoicing**: Full integration with the Egyptian Tax Authority (ETA) for B2B invoices and B2C receipts.
- **Pharmacy & Inventory**: Medication dispensing with real-time Drug-Drug Interaction (DDI) checks using GIN Trigram indexes.
- **Billing**: Integrated insurance provider management (HIO, UHIS, AXA, etc.) and automated billing workflows.

### ⚡ Infrastructure & AI
- **Local Survivable Node (LSN)**: High-performance offline shell with IndexedDB persistent storage and AES-GCM encryption (Law No. 151 of 2020 compliance).
- **Bidirectional Sync**: Ordered transaction log streaming with Last-Write-Wins (LWW) conflict resolution.
- **AI Clinical Intelligence**: Ambient Scribe and DDI analysis integrated with Claude for clinical reasoning.
- **Egyptian Localization**: Native Cairo Timezone handling, RTL UI mirroring, and Arabic text normalization.

## 🛠️ Tech Stack

- **Framework**: Next.js 15+ (App Router)
- **Styling**: Tailwind CSS v4 + shadcn/ui + Magic UI
- **Database**: PostgreSQL (via Neon) + Drizzle ORM
- **Security**: AES-GCM (LSN Encryption), PII Anonymization pipeline
- **AI**: Claude 3.5 Sonnet / Haiku
- **Testing**: Vitest (Unit) + Playwright (E2E)
- **Validation**: Zod (with localized numeral normalization)

## 📁 Project Structure

```text
├── db/                   # Drizzle schema, migrations, and seeds
├── public/               # Static assets and PWA manifest
├── src/
│   ├── app/              # Next.js App Router (Pages & APIs)
│   ├── components/       # UI Component library (shadcn/ui)
│   ├── context/          # React Context providers (Auth, LSN, etc.)
│   ├── hooks/            # Custom React hooks
│   ├── i18n/             # Localization configuration
│   ├── lib/              # Core business logic
│   │   ├── actions/      # Server Actions
│   │   ├── ai/           # AI integration logic
│   │   ├── eta/          # Egyptian Tax Authority client
│   │   ├── offline/      # LSN & Sync engine
│   │   ├── utils/        # Egypt-specific utils (NID, Date, Arabic)
│   │   └── validations/  # Zod schemas
│   └── types/            # TypeScript definitions
├── docs/                 # Detailed technical documentation
└── vitest.config.ts      # Test configuration
```

## 🚥 Getting Started

### Prerequisites
- Node.js 18+
- pnpm / npm / yarn
- PostgreSQL (Neon recommended)

### Installation
```bash
npm install
```

### Environment Setup
Create a `.env.local` file with the following:
```env
DATABASE_URL=
ETA_CLIENT_ID=
ETA_CLIENT_SECRET=
ETA_ENVIRONMENT=sandbox
ANTHROPIC_API_KEY=
```

### Running the App
```bash
npm run dev
```

## 📖 Documentation

For deeper dives into specific modules, refer to the `docs/` directory:
- [Architecture](./docs/ARCHITECTURE.md): LSN, Sync engine, and Security.
- [Localization](./docs/LOCALIZATION.md): Egyptian-specific logic and RTL.
- [Modules](./docs/MODULES.md): Clinical, Pharmacy, and Billing details.
- [Development](./docs/DEVELOPMENT.md): Guidelines and build constraints.

## ⚖️ License
Proprietary and Confidential.
