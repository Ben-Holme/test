import { useState } from 'react'

const STORAGE_KEY = 'vb_auth'
const PASSWORD = import.meta.env.VITE_APP_PASSWORD as string

function isUnlocked(): boolean {
  return localStorage.getItem(STORAGE_KEY) === PASSWORD
}

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(isUnlocked)
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  if (!PASSWORD || unlocked) return <>{children}</>

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (input === PASSWORD) {
      localStorage.setItem(STORAGE_KEY, PASSWORD)
      setUnlocked(true)
    } else {
      setError(true)
      setInput('')
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 w-80">
        <h1 className="text-lg font-bold text-neutral-100 mb-1">Vantör Bokföring</h1>
        <p className="text-xs text-neutral-500 mb-6">Ange lösenord för att fortsätta</p>
        <input
          type="password"
          autoFocus
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(false) }}
          placeholder="Lösenord"
          className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-sky-500 mb-3"
        />
        {error && <p className="text-xs text-red-400 mb-3">Fel lösenord</p>}
        <button
          type="submit"
          className="w-full bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
        >
          Logga in
        </button>
      </form>
    </div>
  )
}
