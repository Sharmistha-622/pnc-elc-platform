import { notFound } from 'next/navigation'
import { getCycleDetail } from '@/lib/reviews/queries'
import { CycleDetailView } from '@/components/reviews/cycle-detail'

export default async function ReviewCyclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await getCycleDetail(id)
  if (!detail) notFound()
  return <CycleDetailView detail={detail} backHref="/reviews" backLabel="Back to Reviews" />
}
