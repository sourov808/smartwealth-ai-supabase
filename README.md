# SmartWealth - AI-Powered Personal Finance Dashboard

SmartWealth is a modern, high-performance web application designed for personal wealth management. It features a React 19 Next.js 16 frontend, a FastAPI AI agent backend driven by Groq, and a real-time database powered by Supabase.

* **Frontend Live URL:** [https://practice-supa-five.vercel.app/](https://practice-supa-five.vercel.app/)
* **Architecture:** Monorepo (Next.js frontend in the root, Python FastAPI service in `/agents`)

---

## UI Preview

### Session Verification / Loading Screen
![Welcome to your records - Verifying session](./public/loading_screenshot.png)

---

## Key Features

1. **Next.js 16 Partial Prerendering (PPR):** Page layout shells (Sidebar, navigation, loading skeletons) are statically pre-rendered and served instantly, while dynamic database content is streamed asynchronously using React Server Components wrapped in `<Suspense>` boundaries.
2. **AI Chat Assistant:** A floating chat companion that communicates directly with the FastAPI backend via Server-Sent Events (SSE). It performs transactions, analyzes monthly budgets, and presents interactive tool approvals (like transaction deletion cards) directly in the chat panel.
3. **Database Realtime Synchronization:** Fully reactive UI components. If any change is made to the database (whether by the user in another tab, the AI assistant, or directly in the database), the frontend automatically updates all graphs, ledgers, and statistics in real-time.
4. **Supabase Authentication:** Secure session management supporting credential sign-in/sign-up as well as GitHub and Google OAuth providers.
5. **Modern Visualization:** Beautiful charts powered by Recharts (Area, Bar, and Pie visualizations) representing financial analytics, category budgets, and income vs. expenses.

---

## Tech Stack

* **Frontend:** Next.js 16 (App Router, Turbopack, Tailwind CSS, Motion, Lucide)
* **Backend:** FastAPI (Python 3.13+, Uvicorn, OpenAI Agents SDK, Groq)
* **Database & Auth:** Supabase (PostgreSQL, Realtime WebSockets, GoTrue Auth)

---

## Local Development

### 1. Prerequisites
Ensure you have `pnpm` installed for Node dependencies and `uv` installed for Python package management.

### 2. Frontend Configuration & Start
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
AGENT_BACKEND_URL=http://127.0.0.1:8000
```
Install dependencies and run the development server:
```bash
pnpm install
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) to view the frontend.

### 3. Backend Configuration & Start
Navigate to the `agents/` directory and create a `.env` file:
```env
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=llama-3.3-70b-versatile
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
```
Run the FastAPI server:
```bash
cd agents
uv run uvicorn agent_service.main:app --reload
```
The backend API will run on [http://127.0.0.1:8000](http://127.0.0.1:8000).

### 4. Git Tracking (Excluding memory and progress files)
If `memory.md` or `progress.md` files were previously tracked on GitHub before adding them to `.gitignore`, run the following commands to untrack them (keeping them locally on your machine):
```bash
git rm --cached memory.md progress.md agents/memory.md agents/progress.md
git commit -m "Stop tracking memory and progress files"
git push origin main
```

---

## Database Configuration (Supabase Realtime)

For the frontend's real-time sync system to work, you must enable Realtime replication on your Supabase tables.

1. Open the **SQL Editor** in your Supabase Dashboard.
2. Run the following SQL query:
```sql
-- Enable Realtime replication for tables
alter publication supabase_realtime add table transactions, budgets, profiles;
```

---

## Deployment

### Deploying the Backend on Render
1. Create a new **Web Service** on Render and connect your repository.
2. Set the following configurations:
   * **Root Directory:** `agents`
   * **Build Command:** `pip install -r requirements.txt`
   * **Start Command:** `uvicorn --app-dir src agent_service.main:app --host 0.0.0.0 --port $PORT`
3. Add your environment variables (`GROQ_API_KEY`, `GROQ_MODEL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`).

### Deploying the Frontend on Vercel
1. Create a new **Project** on Vercel and import your repository.
2. Set the **Root Directory** as `.` (default).
3. Add your environment variables:
   * `NEXT_PUBLIC_SUPABASE_URL`
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   * `AGENT_BACKEND_URL` (set to your deployed Render URL, e.g., `https://your-backend.onrender.com`)
4. Click **Deploy**.
