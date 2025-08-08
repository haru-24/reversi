import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import P2PReversi from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <P2PReversi />
  </StrictMode>,
)
