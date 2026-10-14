import { Placeholder } from '@/components/Placeholder'
import { ScreenHeader } from '@/components/ScreenHeader'

export function ProgressScreen() {
  return (
    <>
      <ScreenHeader title="Progress" />
      <div className="space-y-3">
        <Placeholder phase={3}>Strength: estimated 1RM, PRs, weekly volume</Placeholder>
        <Placeholder phase={4}>Body: weight, body fat and muscle mass trends</Placeholder>
      </div>
    </>
  )
}
