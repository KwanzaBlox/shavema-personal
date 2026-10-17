import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth'

function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    const result = await signIn(email, password)
    if (result.error) setError(result.error)
    setBusy(false)
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="brand">
          <div className="brand-icon">Ш</div>
          <div>
            <h2>Шаверма</h2>
            <span>ПЕРСОНАЛ</span>
          </div>
        </div>
        <h1>Вход</h1>
        <p className="subtitle">Войди, чтобы продолжить.</p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <span className="field-label">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="field">
            <span className="field-label">Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••"
              required
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button
            className="primary-btn login-btn"
            type="submit"
            disabled={busy}
          >
            {busy ? 'Входим…' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
