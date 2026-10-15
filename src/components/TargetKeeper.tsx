import { useEffect } from 'react'
import { useData } from '@/data/DataProvider'
import { setTarget } from '@/data/food'
import { useNutritionPlan } from '@/data/profile'
import { localDateKey } from '@/lib/body'
import { targetOn } from '@/lib/nutrition'

/**
 * Keeps today's stored target equal to the calculated plan (profile + goal + weight trend + your nudges).
 * Past days keep the target they had, so history stays honest. Renders nothing.
 */
export function TargetKeeper() {
  const { db, store } = useData()
  const state = useNutritionPlan()
  const plan = state?.plan
  const goalId = state?.goal?.id ?? null

  useEffect(() => {
    if (!plan) return
    const today = localDateKey(new Date())
    void (async () => {
      const current = targetOn(await db.nutrition_targets.toArray(), today)
      const same = current && current.kcal === plan.kcal && current.protein_g === plan.protein_g && current.fat_g === plan.fat_g && current.carbs_g === plan.carbs_g
      if (!same) await setTarget(store, today, plan, current ? 'manual' : 'initial', goalId)
    })()
  }, [db, store, plan, goalId])

  return null
}
