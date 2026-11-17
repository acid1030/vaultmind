import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './control-console.css'
import './minimal-light.css'

document.documentElement.classList.toggle('light', localStorage.getItem('workspace-theme') !== 'dark')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
