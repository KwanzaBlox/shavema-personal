import { useState } from 'react'
import { DEFAULT_SETTINGS } from '../data'
import { useStore } from '../store'
import { useAuth } from '../auth'
import type { PremiumTier, Settings as AppSettings } from '../types'

interface TierForm {
  from: string
  premium: string
}

function Settings() {
  const { data, updateSettings } = useStore()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [baseRate, setBaseRate] = useState(String(data.settings.baseRate))
  const [soloMultiplier, setSoloMultiplier] = useState(
    String(data.settings.soloMultiplier),
  )
  const [longShiftThreshold, setLongShiftThreshold] = useState(
    String(data.settings.longShiftThreshold),
  )
  const [tiers, setTiers] = useState<TierForm[]>(
    data.settings.premiumTiers.map((tier) => ({
      from: String(tier.from),
      premium: String(tier.premium),
    })),
  )
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function updateTier(index: number, field: 'from' | 'premium', value: string) {
    setTiers((prev) =>
      prev.map((tier, i) =>
        i === index ? { ...tier, [field]: value } : tier,
      ),
    )
  }

  function addTier() {
    setTiers((prev) => [...prev, { from: '', premium: '' }])
  }

  function removeTier(index: number) {
    setTiers((prev) => prev.filter((_, i) => i !== index))
  }

  function handleReset() {
    setBaseRate(String(DEFAULT_SETTINGS.baseRate))
    setSoloMultiplier(String(DEFAULT_SETTINGS.soloMultiplier))
    setLongShiftThreshold(String(DEFAULT_SETTINGS.longShiftThreshold))
    setTiers(
      DEFAULT_SETTINGS.premiumTiers.map((tier) => ({
        from: String(tier.from),
        premium: String(tier.premium),
      })),
    )
    setError(null)
  }

  function handleSave() {
    const base = Number(baseRate.replace(',', '.'))
    const mult = Number(soloMultiplier.replace(',', '.'))
    const threshold = Number(longShiftThreshold.replace(',', '.'))

    if (!Number.isFinite(base) || base <= 0) {
      setError('Базовая ставка должна быть больше нуля.')
      return
    }
    if (!Number.isFinite(mult) || mult < 1) {
      setError('Множитель одиночной смены должен быть не меньше 1.')
      return
    }
    if (!Number.isFinite(threshold) || threshold <= 0) {
      setError('Порог длительной смены должен быть больше нуля.')
      return
    }

    const parsedTiers: PremiumTier[] = []
    for (const tier of tiers) {
      const from = Number(tier.from.replace(',', '.'))
      const premium = Number(tier.premium.replace(',', '.'))
      if (!Number.isFinite(from) || from < 0) {
        setError('Порог кассы в таблице премий должен быть не меньше нуля.')
        return
      }
      if (!Number.isFinite(premium) || premium < 0) {
        setError('Премия в таблице должна быть не меньше нуля.')
        return
      }
      parsedTiers.push({ from, premium })
    }
    parsedTiers.sort((a, b) => a.from - b.from)

    const settings: AppSettings = {
      baseRate: base,
      soloMultiplier: mult,
      longShiftThreshold: threshold,
      premiumTiers: parsedTiers,
    }
    updateSettings(settings)
    setError(null)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  if (!isAdmin) {
    return (
      <>
        <header className="topbar">
          <div>
            <p className="eyebrow">НАСТРОЙКИ</p>
            <h1>Настройки</h1>
            <p className="subtitle">Профиль и параметры расчёта.</p>
          </div>
        </header>
        <section className="panel">
          <div className="profile-card">
            <div className="avatar">{profile?.shortName || '?'}</div>
            <div>
              <strong>{profile?.fullName}</strong>
              <span>{isAdmin ? 'Администратор' : 'Сотрудник'}</span>
            </div>
          </div>
        </section>
        <p className="empty-note">
          Изменять ставки, пороги и таблицу премий может только администратор.
        </p>
      </>
    )
  }

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">НАСТРОЙКИ</p>
          <h1>Настройки</h1>
          <p className="subtitle">Ставки, пороги премий и параметры расчёта.</p>
        </div>
      </header>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Профиль</h2>
            <p>Текущий пользователь</p>
          </div>
        </div>
        <div className="profile-card">
          <div className="avatar">Д</div>
          <div>
            <strong>Дмитрий</strong>
            <span>Администратор</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Ставки и пороги</h2>
            <p>Параметры расчёта зарплаты</p>
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <span className="field-label">Базовая ставка, ₽/час</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={baseRate}
              onChange={(event) => setBaseRate(event.target.value)}
            />
          </div>
          <div className="field">
            <span className="field-label">Множитель одиночной смены</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="1"
              value={soloMultiplier}
              onChange={(event) => setSoloMultiplier(event.target.value)}
            />
          </div>
          <div className="field">
            <span className="field-label">Порог длительной смены, ч</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              value={longShiftThreshold}
              onChange={(event) => setLongShiftThreshold(event.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Таблица премий</h2>
            <p>Премия за дневную кассу: берётся наибольший достигнутый порог</p>
          </div>
          <button className="ghost-btn" onClick={addTier}>
            ＋ Добавить порог
          </button>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Касса от, ₽</th>
                <th>Премия, ₽</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier, index) => (
                <tr key={index}>
                  <td>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={tier.from}
                      onChange={(event) =>
                        updateTier(index, 'from', event.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={tier.premium}
                      onChange={(event) =>
                        updateTier(index, 'premium', event.target.value)
                      }
                    />
                  </td>
                  <td>
                    <button
                      className="ghost-btn danger"
                      onClick={() => removeTier(index)}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
              {tiers.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty-note">
                    Таблица премий пуста — премия всегда будет 0.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {error && <p className="form-error">{error}</p>}
      {saved && <p className="success-note">Настройки сохранены ✓</p>}

      <div className="settings-actions">
        <button className="ghost-btn" onClick={handleReset}>
          Сбросить по умолчанию
        </button>
        <button className="primary-btn" onClick={handleSave}>
          Сохранить настройки
        </button>
      </div>
    </>
  )
}

export default Settings
