export type SectionId =
  | 'home'
  | 'calendar'
  | 'salary'
  | 'cash'
  | 'employees'
  | 'reports'
  | 'notifications'
  | 'support'
  | 'settings'

export interface NavItem {
  id: SectionId
  label: string
  icon: string
  adminOnly?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Обзор', icon: '▦' },
  { id: 'calendar', label: 'Календарь', icon: '▣' },
  { id: 'salary', label: 'Зарплата', icon: '₽' },
  { id: 'cash', label: 'Касса и план', icon: '◷' },
  { id: 'employees', label: 'Сотрудники', icon: '☺', adminOnly: true },
  { id: 'reports', label: 'Отчёты', icon: '▤' },
  { id: 'notifications', label: 'Уведомления', icon: '◉' },
  { id: 'support', label: 'Поддержка', icon: '☏' },
  { id: 'settings', label: 'Настройки', icon: '⚙' },
]
