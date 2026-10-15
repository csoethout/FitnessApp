import { useState } from 'react'
import { Placeholder } from '@/components/Placeholder'
import { ScreenHeader } from '@/components/ScreenHeader'
import { TodayWorkoutCard } from '@/components/TodayWorkoutCard'
import { WeighInCard } from '@/components/WeighInCard'

export function TodayScreen() {
  const [date] = useState(() =>
    new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
  )
  return (
    <>
      <ScreenHeader title="Today" subtitle={date} />
      <div className="space-y-3">
        <TodayWorkoutCard />
        <WeighInCard />
        <Placeholder phase={4}>Calories and protein left today</Placeholder>
      </div>
    </>
  )
}
