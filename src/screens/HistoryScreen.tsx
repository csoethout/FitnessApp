import { ChevronLeft } from 'lucide-react'
import { Link } from 'react-router'
import { HistoryList } from '@/components/HistoryList'

export function HistoryScreen() {
  return (
    <>
      <Link to="/train" className="-ml-2 mb-2 inline-flex min-h-12 items-center text-muted">
        <ChevronLeft size={20} /> Train
      </Link>
      <h1 className="mb-4 text-2xl font-semibold">History</h1>
      <HistoryList />
    </>
  )
}
