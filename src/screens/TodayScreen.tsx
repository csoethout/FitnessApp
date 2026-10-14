import { useState } from 'react'
import { Placeholder } from '@/components/Placeholder'
import { ScreenHeader } from '@/components/ScreenHeader'

export function TodayScreen() {
  const [date] = useState(() =>
    new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
  )
  return (
    <>
      <ScreenHeader title="Today" subtitle={date} />
      <div className="space-y-3">
        <Placeholder phase={2}>Today's workout and a Start button</Placeholder>
        <Placeholder phase={4}>Calories and protein left, one-tap weigh-in</Placeholder>
      </div>
    </>
  )
}
