import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { PresenceProvider } from './context/PresenceContext'
import { applyMotion } from './lib/motion'
import './styles.css'

const saved = localStorage.getItem('tj-theme')
if (saved === 'light') document.documentElement.dataset.theme = 'light'
applyMotion()

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PresenceProvider>
          <App />
        </PresenceProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
