# ระบบประเมินผลการปฏิบัติงานพนักงานรายวัน
# Employee Daily Performance Evaluation System

ระบบประเมินผลการปฏิบัติงานพนักงานรายวัน สำหรับใช้งานภายในองค์กร

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: PostgreSQL (Neon recommended)
- **ORM**: Prisma
- **Authentication**: Auth.js v5 (Credentials — Username+Password only)
- **Password Hashing**: bcryptjs
- **Validation**: Zod
- **Testing**: Vitest

---

## 1. Installation

```bash
npm install
```

---

## 2. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
# PostgreSQL connection (Neon, Supabase, or any PostgreSQL)
DATABASE_URL="postgresql://username:password@host:5432/employee_evaluation?sslmode=require"

# For Neon (connection pooling) — optional
DATABASE_URL_UNPOOLED="postgresql://username:password@host:5432/employee_evaluation?sslmode=require"

# Auth.js secret (generate with: openssl rand -base64 32)
AUTH_SECRET="your-auth-secret-here"

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Generate AUTH_SECRET

```bash
openssl rand -base64 32
```

---

## 3. Database Setup (Neon)

1. Go to [neon.tech](https://neon.tech) and create a free account
2. Create a new project
3. Copy the connection string to `DATABASE_URL` in `.env`

---

## 4. Database Migration

```bash
npm run db:migrate
```

Or push schema directly (development):

```bash
npm run db:push
```

---

## 5. Seed Data

```bash
npm run db:seed
```

This creates:
- 1 Manager user (`manager` / `ChangeMe123!`)
- 4 Evaluator users (`super01`, `supportsupervising01`, `head01`, `supporthead01`)
- 4 Departments (Sales, Support, Operation, HR)
- 4 Teams (Team A, Team B, Team C, Sales Team 1)
- 12 Employees
- Default score scale (1-5)
- Grade configs (A, B, C, D, F)
- 4 Evaluation categories with 12 questions
- 1 Active evaluation period (สิงหาคม 2026)
- Evaluator assignments with weights

> ⚠️ **All users have `mustChangePassword=true` — they must change password on first login.**

---

## 6. Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 7. Testing

```bash
# Run all tests
npm run test:run

# Watch mode
npm test

# With coverage
npm run test:coverage
```

---

## 8. Production Build

```bash
npm run build
npm start
```

---

## 9. Vercel Deployment

### Prerequisites
- Vercel account
- Neon PostgreSQL database

### Steps

1. Push code to GitHub

2. Import project in Vercel

3. Set environment variables in Vercel Dashboard:
   - `DATABASE_URL`
   - `DATABASE_URL_UNPOOLED` (for Neon connection pooling)
   - `AUTH_SECRET`
   - `NEXT_PUBLIC_APP_URL` (your Vercel domain)

4. Add build command override (optional):
   ```
   npx prisma migrate deploy && next build
   ```

5. Deploy!

---

## 10. Default Login Credentials

After running seed:

| Username | Password | Role | Note |
|---|---|---|---|
| manager | ChangeMe123! | Manager | Must change password |
| super01 | ChangeMe123! | Evaluator | Must change password |
| supportsupervising01 | ChangeMe123! | Evaluator | Must change password |
| head01 | ChangeMe123! | Evaluator | Must change password |
| supporthead01 | ChangeMe123! | Evaluator | Must change password |

> ⚠️ **DO NOT use these passwords in production. Change them immediately!**

---

## 11. Project Structure

```
app/
├── (auth)/          # Login, change-password pages
├── (dashboard)/     # Protected dashboard pages
└── api/             # API Route Handlers

components/
├── layout/          # Sidebar, header
├── providers/       # Session provider
└── ui/              # Shared UI components

lib/
├── auth/            # Auth.js config, session utils
├── calculations/    # Business logic (score, working-days)
├── db/              # Prisma client
├── permissions/     # RBAC engine
├── services/        # Audit service
└── validations/     # Zod schemas

prisma/
├── schema.prisma    # Database schema
└── seed.ts          # Seed data

__tests__/
└── calculations/    # Unit tests
```

---

## 12. Security Notes

- Passwords are hashed with **bcryptjs** (12 rounds)
- Sessions use **JWT** stored in HTTP-only cookies
- All API routes verify session + role server-side
- Evaluators cannot access Manager routes (enforced at middleware + API level)
- Audit logs record all mutations (immutable via UI)
- Manager Override requires explicit reason and is audit-logged
- Database transactions for critical operations
