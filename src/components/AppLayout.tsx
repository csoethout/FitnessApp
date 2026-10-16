import { ChartLine, Dumbbell, Ellipsis, House, Utensils, type LucideIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { useFeatures } from '@/data/profile'
import { TargetKeeper } from './TargetKeeper'
import { UpdatePrompt } from './UpdatePrompt'

const tabs: { to: string; label: string; icon: LucideIcon; feature?: 'food' }[] = [
  { to: '/', label: 'Today', icon: House },
  { to: '/train', label: 'Train', icon: Dumbbell },
  { to: '/food', label: 'Food', icon: Utensils, feature: 'food' },
  { to: '/progress', label: 'Progress', icon: ChartLine },
  { to: '/more', label: 'More', icon: Ellipsis },
]

/**
 * App shell: scrollable content with a fixed bottom tab bar.
 * Tabs live at the bottom because that is where the thumb rests when holding a phone one-handed.
 */
export function AppLayout() {
  const features = useFeatures()
  return (
    <div className="flex h-full flex-col">
      {features?.food !== false && <TargetKeeper />}
      <main className="flex-1 overflow-y-auto px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
        <UpdatePrompt />
        <Outlet />
      </main>
      <nav className="border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto flex max-w-lg">
          {tabs.filter((t) => !t.feature || features?.[t.feature] !== false).map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${
                    isActive ? 'text-accent' : 'text-muted'
                  }`
                }
              >
                <Icon size={24} aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
