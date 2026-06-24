import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { i18nReady } from './i18n/i18n'
import './index.css'
import App from './App.tsx'

i18nReady.then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
