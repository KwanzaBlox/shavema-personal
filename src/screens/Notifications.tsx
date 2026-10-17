import { useMemo } from 'react'
import { computeNotifications } from '../notifications'
import { useStore } from '../store'

function Notifications() {
  const { data } = useStore()
  const notifications = useMemo(() => computeNotifications(data), [data])

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">УВЕДОМЛЕНИЯ</p>
          <h1>Уведомления</h1>
          <p className="subtitle">События, сформированные по текущим данным.</p>
        </div>
      </header>

      <section className="panel">
        {notifications.length === 0 ? (
          <p className="empty-note">Сейчас уведомлений нет — всё в порядке.</p>
        ) : (
          <ul className="notification-list">
            {notifications.map((notification, index) => (
              <li key={index} className="notification-item">
                <span className="notification-type">{notification.type}</span>
                <p>{notification.message}</p>
              </li>
            ))}
          </ul>
        )}

        <p className="meta-note">
          Пока это уведомления внутри приложения. Браузерные и push-уведомления
          будут добавлены отдельно после подключения онлайн-базы.
        </p>
      </section>
    </>
  )
}

export default Notifications
