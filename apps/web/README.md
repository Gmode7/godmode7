# GM7 Frontend

Modern React dashboard for the GM7 AI Software Agency platform.

## Deployment to Vercel

### 1. Install Vercel CLI
```bash
npm i -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Deploy
```bash
cd apps/web
vercel
```

### Or use Vercel Dashboard:

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `apps/web`
   - **Build Command**: `pnpm build`
   - **Output Directory**: `dist`
4. Add Environment Variables:
   - `VITE_API_URL`: Your backend URL (e.g., `https://your-repl.replit.app`)
5. Deploy!

## Environment Variables

Create `.env.local` for local development:

```
VITE_API_URL=http://127.0.0.1:3000
```

## Features

- ✨ Beautiful dark-themed UI with glassmorphism effects
- 📊 Real-time dashboard with pipeline visualization
- 🔄 Auto-polling for job updates
- 💬 Chat interface with the Orchestrator
- 🤖 Agent management matrix
- 📝 Project and job management
- 📱 Responsive design

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- React Router
- Lucide Icons
