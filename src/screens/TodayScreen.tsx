import { useState } from 'react'
import { CardioCard } from '@/components/CardioCard'
import { ScreenHeader } from '@/components/ScreenHeader'
import { SleepCard } from '@/components/SleepCard'
import { TodayWorkoutCard } from '@/components/TodayWorkoutCard'
import { TodayFoodCard } from '@/components/TodayFoodCard'
import { WaterCard } from '@/components/WaterCard'
import { WeighInCard } from '@/components/WeighInCard'
import { useFeatures } from '@/data/profile'

export function TodayScreen() {
  const [date] = useState(() =>
    new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
  )
  const f = useFeatures()
  return (
    <>
      <ScreenHeader title="Today" subtitle={date} />
      <div className="space-y-3">
        <TodayWorkoutCard />
        {f?.body && <WeighInCard />}
        {f?.sleep && <SleepCard />}
        {f?.water && <WaterCard />}
        {f?.cardio && <CardioCard />}
        {f?.food && <TodayFoodCard />}
      </div>
    </>
  )
}
