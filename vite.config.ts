import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const supabaseUrl =
    env.VITE_SUPABASE_URL?.replace(/\/$/, '') ||
    'https://bdrwkugogscemoakvsat.supabase.co'

  const supabaseProxy = {
    '/sb': {
      target: supabaseUrl,
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/sb/, ''),
      secure: true,
    },
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: { proxy: supabaseProxy },
    preview: { proxy: supabaseProxy },
  }
})
