import React, { useState } from 'react'
import LoginPage from './pages/LoginPage'
import MainLayout from './pages/MainLayout'

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false)

  return loggedIn
    ? <MainLayout onLogout={() => setLoggedIn(false)} />
    : <LoginPage onLogin={() => setLoggedIn(true)} />
}
