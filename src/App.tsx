import { useState } from 'react'
import './App.css'
import { AuthProvider, useAuth } from './auth'
import { NAV_ITEMS, type SectionId } from './navigation'
import { StoreProvider } from './store'
import Calendar from './screens/Calendar'
import Cash from './screens/Cash'
import Home from './screens/Home'
import Login from './screens/Login'
import Notifications from './screens/Notifications'
import Reports from './screens/Reports'
import Salary from './screens/Salary'
import Settings from './screens/Settings'
import Support from './screens/Support'
import Employees from './screens/Employees'

const PRIMARY_COUNT = 4

function AppShell() {
  const { profile, signOut } = useAuth()
  const [section, setSection] = useState<SectionId>('home')
  const [menuOpen, setMenuOpen] = useState(false)

  const isAdmin = profile?.role === 'admin'
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)
  const primaryItems = visibleItems.slice(0, PRIMARY_COUNT)
  const moreItems = visibleItems.slice(PRIMARY_COUNT)

  function goTo(id: SectionId) {
    setSection(id)
    setMenuOpen(false)
  }

  function renderScreen() {
    switch (section) {
      case 'home':
        return <Home onNavigate={goTo} />
      case 'calendar':
        return <Calendar />
      case 'salary':
        return <Salary />
      case 'cash':
        return <Cash />
      case 'employees':
        return <Employees />
      case 'reports':
        return <Reports />
      case 'notifications':
        return <Notifications />
      case 'support':
        return <Support />
      case 'settings':
        return <Settings />
      default:
        return <Home onNavigate={goTo} />
    }
  }

  return (
    <main className="app">
      <header className="mobile-header">
        <div className="brand">
          <div className="brand-icon">Ш</div>
          <div>
            <h2>Шаверма</h2>
            <span>ПЕРСОНАЛ</span>
          </div>
        </div>
      </header>

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">Ш</div>
          <div>
            <h2>Шаверма</h2>
            <span>ПЕРСОНАЛ</span>
          </div>
        </div>

        <nav className="navigation">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${section === item.id ? 'active' : ''}`}
              onClick={() => goTo(item.id)}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>

        <div className="profile">
          <div className="avatar">{profile?.shortName || '?'}</div>
          <div>
            <strong>{profile?.fullName}</strong>
            <span>{isAdmin ? 'Администратор' : 'Сотрудник'}</span>
          </div>
        </div>

        <button className="ghost-btn signout-btn" onClick={signOut}>
          Выйти
        </button>
      </aside>

      <section className="content">{renderScreen()}</section>

      <nav className="bottom-nav">
        {primaryItems.map((item) => (
          <button
            key={item.id}
            className={`bottom-nav-item ${section === item.id ? 'active' : ''}`}
            onClick={() => goTo(item.id)}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </button>
        ))}

        {moreItems.length > 0 && (
          <button
            className={`bottom-nav-item ${
              moreItems.some((item) => item.id === section) ? 'active' : ''
            }`}
            onClick={() => setMenuOpen(true)}
          >
            <span className="bottom-nav-icon">☰</span>
            <span className="bottom-nav-label">Ещё</span>
          </button>
        )}
      </nav>

      {menuOpen && (
        <div className="sheet-backdrop" onClick={() => setMenuOpen(false)}>
          <div
            className="mobile-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-heading">РАЗДЕЛЫ</div>
            <div className="sheet-grid">
              {moreItems.map((item) => (
                <button
                  key={item.id}
                  className={`sheet-item ${section === item.id ? 'active' : ''}`}
                  onClick={() => goTo(item.id)}
                >
                  <span className="sheet-icon">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
            <button className="ghost-btn signout-btn" onClick={signOut}>
              Выйти
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

function AppGate() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return <div className="app-loading">Загрузка…</div>
  }
  if (!user) {
    return <Login />
  }
  if (!profile) {
    return (
      <div className="app-loading">
        Профиль не найден. Проверь, что выполнена SQL-схема из файла
        supabase/schema.sql, и перезагрузи страницу.
      </div>
    )
  }
  return <AppShell />
}

function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <AppGate />
      </StoreProvider>
    </AuthProvider>
  )
}

export default App
