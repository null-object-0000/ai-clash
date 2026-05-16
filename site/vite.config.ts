import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

const base = process.env.BASE_URL || process.env.VITE_BASE_URL || '/'

export default defineConfig({
  base,
  plugins: [react()],
})
