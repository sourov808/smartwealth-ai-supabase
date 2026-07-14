# Cost Management App - Memory Document

This file preserves key context, tech stack choices, architectural patterns, and user preferences across workspace interactions.

## Project Core Metadata
- **Name**: Personal Cost Management Application
- **Directory**: `/home/sourov/Desktop/practice_supa`
- **Tech Stack**:
  - Framework: Next.js (App Router, Tailwind CSS v4)
  - Database & Auth: Supabase (PostgreSQL, RLS, Auth API)
  - UI Library: Tailwind CSS v4, shadcn/ui components (Radix primitives)
  - Animation: motion.dev (Framer Motion)
  - Icons: Lucide React
  - Charting: Recharts

## Architecture & Conventions

### 1. Modular Coding Patterns (Anti-Monolith)
- Components must be strictly decoupled.
- Complex pages (like dashboard or analytics) should be composed of sub-components under `components/dashboard/` or `components/analytics/` instead of massive files.
- Forms and modal views must reside in separate files (e.g., `transaction-modal.tsx`).
- Data hooks and helpers are separated into `lib/` and custom react hooks.

### 2. State & Data Flow
- **Authentication**: Auth state managed via Supabase Client and protected via Edge request proxy (`proxy.ts`) redirect rules.
- **Transactions & Budgets**: Server actions and hooks for optimistic updates where useful. 
- **Time/Date handling**: Handled via standard JS Date API / `date-fns` for queries and timezone safety.
- **Unit Testing**: Automated testing environment integrated using Vitest (`vitest.config.ts`) with custom path alias resolution mapping `@/*` to the workspace root. Covers utility files (`tests/utils.test.ts`) and proxy matching expressions (`tests/proxy.test.ts`).

### 3. Styling & Aesthetics
- Sleek modern layout: Minimalist Notion-like aesthetic utilizing neutral stone backgrounds, clean thin borders, and flat overlay states. Adaptive Sage green for income (`--color-sage`), Rust/terracotta for expenses (`--color-rust`), and Gold/amber for warnings/limits (`--color-amber-brand`).
- Branding Splash Screen: Displays a polished "Welcome to your records" during auth status resolving states.
- Icons: Styled with Lucide `stroke-[1.5]` line weights.
- Animations: Subtle layout shifts, enter/exit animations on modals, hover micro-interactions on charts.

## Active Database Schema Notes
- **profiles**: links to auth users for preferences.
- **transactions**: stores daily/monthly expenses and incomes.
- **budgets**: records category budgets.


