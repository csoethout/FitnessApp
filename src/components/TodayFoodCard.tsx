import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useDayLog, useTargetOn } from '@/data/foodHooks'
import { localDateKey } from '@/lib/body'
import { entryMacros, sumMacros } from '@/lib/nutrition'

/** Today: calories and protein left, links to the Food tab. */
export function TodayFoodCard() {
  const [today] = useState(() => localDateKey(new Date()))
  const entries = useDayLog(today)
  const target = useTargetOn(today)
  const eaten = useMemo(() => sumMacros((entries ?? []).map(entryMacros)), [entries])
  if (entries === undefined || target === undefined) return null
  return (
    <Link to="/food" data-tour="today-food" className="block rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm text-muted">Food</p>
      {target ? (
        <div className="mt-1 grid grid-cols-2 gap-2">
          <Left label="Calories left" value={target.kcal - eaten.kcal} unit="kcal" />
          <Left label="Protein left" value={target.protein_g - eaten.protein_g} unit="g" />
        </div>
      ) : (
        <p className="mt-1">Set up your nutrition plan on the Food tab.</p>
      )}
    </Link>
  )
}

function Left({ label, value, unit }: { label: string; value: number; unit: string }) {
  const over = value < 0
  return (
    <div>
      <p className="text-xs text-muted">{over ? label.replace('left', 'over') : label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${over ? 'text-amber-400' : ''}`}>
        {Math.abs(Math.round(value)).toLocaleString()} <span className="text-sm font-normal text-muted">{unit}</span>
      </p>
    </div>
  )
}
