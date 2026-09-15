import { getPeerFeedback } from '@/lib/confirmations/getPeerFeedback'
import { PeerFeedbackForm } from './PeerFeedbackForm'

export default async function PeerFeedbackPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const peerFeedback = await getPeerFeedback(id)

  if (!peerFeedback) {
    return <div className="p-6">Feedback request not found.</div>
  }

  if (peerFeedback.response_status === 'submitted') {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-2">Already Submitted</h1>
        <p className="text-gray-600">Thank you, your feedback has already been recorded.</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-bold mb-2">Peer Feedback</h1>
      <p className="text-gray-600 mb-6">
        Please share your feedback for{' '}
        {peerFeedback.confirmations?.employees?.name || 'this employee'}.
      </p>
      <PeerFeedbackForm peerFeedbackId={id} />
    </div>
  )
}