import { useState } from 'react'
import { Placeholder } from '@/components/Placeholder'
import { ScreenHeader } from '@/components/ScreenHeader'
import { TodayWorkoutCard } from '@/components/TodayWorkoutCard'

export function TodayScreen() {
  const [date] = useState(() =>
    new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
  )
  return (
    <>
      <ScreenHeader title="Today" subtitle={date} />
      <div className="space-y-3">
        <TodayWorkoutCard />
        <Placeholder phase={4}>Calories and protein left, one-tap weigh-in</Placeholder>
      </div>
    </>
  )
}
