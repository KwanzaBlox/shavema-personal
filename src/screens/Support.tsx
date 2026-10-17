import { useState } from 'react'
import { makeId, useStore } from '../store'

function Support() {
  const { data, addSupportMessage } = useStore()
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed) return
    addSupportMessage({
      id: makeId(),
      text: trimmed,
      author: 'Дмитрий',
      createdAt: new Date().toISOString(),
    })
    setText('')
    setSent(true)
    window.setTimeout(() => setSent(false), 2000)
  }

  const messages = [...data.supportMessages].reverse()

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">ПОДДЕРЖКА</p>
          <h1>Поддержка</h1>
          <p className="subtitle">Сообщения администратору и команде.</p>
        </div>
      </header>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Новое сообщение</h2>
            <p>Опиши вопрос или проблему</p>
          </div>
        </div>

        <textarea
          className="support-textarea"
          rows={4}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Например: не могу внести кассу за вчера"
        />

        <div className="support-actions">
          <button className="primary-btn" onClick={handleSend}>
            Отправить
          </button>
        </div>

        {sent && <p className="success-note">Сообщение отправлено ✓</p>}

        <p className="meta-note">
          Сообщения пока сохраняются на этом устройстве. Отправка на сервер и
          прикрепление скриншотов появятся после подключения онлайн-базы.
        </p>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Мои сообщения</h2>
            <p>{messages.length === 0 ? 'Пока пусто' : `Всего: ${messages.length}`}</p>
          </div>
        </div>

        {messages.length === 0 ? (
          <p className="empty-note">Сообщений пока нет.</p>
        ) : (
          <ul className="message-list">
            {messages.map((message) => (
              <li key={message.id} className="message-item">
                <div className="message-head">
                  <strong>{message.author}</strong>
                  <span>{new Date(message.createdAt).toLocaleString('ru-RU')}</span>
                </div>
                <p>{message.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

export default Support
