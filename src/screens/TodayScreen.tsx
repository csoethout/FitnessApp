import { useState } from 'react'
import { ScreenHeader } from '@/components/ScreenHeader'
import { TodayWorkoutCard } from '@/components/TodayWorkoutCard'
import { TodayFoodCard } from '@/components/TodayFoodCard'
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
        <TodayFoodCard />
      </div>
    </>
  )
}
