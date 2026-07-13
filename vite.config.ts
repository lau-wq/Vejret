import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Appen serveres fra https://lau-wq.github.io/Vejret/
  base: '/Vejret/',
  plugins: [react()],
})
