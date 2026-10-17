import { useEffect, useState } from 'react'
import { useAuth } from '../auth'
import { supabase } from '../lib/supabase'
import type { Role } from '../types'

interface EmployeeRow {
  id: string
  fullName: string
  shortName: string
  slug: string | null
  role: Role
}

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Администратор',
  employee: 'Сотрудник',
}

function Employees() {
  const { profile } = useAuth()
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      setError('Supabase не настроен.')
      return
    }
    supabase
      .from('profiles')
      .select('id, full_name, short_name, slug, role')
      .order('full_name')
      .then(({ data, error: fetchError }) => {
        setLoading(false)
        if (fetchError) {
          setError(fetchError.message)
          return
        }
        setEmployees(
          (data ?? []).map((row) => ({
            id: row.id,
            fullName: row.full_name,
            shortName: row.short_name,
            slug: row.slug,
            role: row.role,
          })),
        )
      })
  }, [])

  async function changeRole(row: EmployeeRow, role: Role) {
    if (!supabase) return
    setError(null)
    setNotice(null)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', row.id)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setEmployees((prev) =>
      prev.map((item) => (item.id === row.id ? { ...item, role } : item)),
    )
    setNotice(`Роль «${row.fullName}» изменена.`)
  }

  function isSelf(row: EmployeeRow) {
    return row.id === profile?.id
  }

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">СОТРУДНИКИ</p>
          <h1>Сотрудники</h1>
          <p className="subtitle">Управление пользователями и ролями.</p>
        </div>
      </header>

      <section className="panel">
        {loading ? (
          <p className="empty-note">Загрузка…</p>
        ) : error ? (
          <p className="form-error">{error}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Роль</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((row) => (
                  <tr key={row.id}>
                    <td>{row.fullName}</td>
                    <td>{ROLE_LABEL[row.role]}</td>
                    <td>
                      {isSelf(row) ? (
                        <span className="meta-note">Это вы</span>
                      ) : row.role === 'admin' ? (
                        <button
                          className="ghost-btn"
                          onClick={() => changeRole(row, 'employee')}
                        >
                          Сделать сотрудником
                        </button>
                      ) : (
                        <button
                          className="ghost-btn"
                          onClick={() => changeRole(row, 'admin')}
                        >
                          Сделать администратором
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {notice && <p className="success-note">{notice}</p>}
      </section>
    </>
  )
}

export default Employees
