import { Placeholder } from '@/components/Placeholder'
import { ScreenHeader } from '@/components/ScreenHeader'

export function FoodScreen() {
  return (
    <>
      <ScreenHeader title="Food" />
      <Placeholder phase={4}>Daily food log, search, barcode scan, saved meals</Placeholder>
    </>
  )
}
