import { Placeholder } from '@/components/Placeholder'
import { ScreenHeader } from '@/components/ScreenHeader'

export function TrainScreen() {
  return (
    <>
      <ScreenHeader title="Train" />
      <div className="space-y-3">
        <Placeholder phase={2}>Workout logger and history</Placeholder>
        <Placeholder phase={5}>Weekly plan and "Plan my week"</Placeholder>
      </div>
    </>
  )
}
