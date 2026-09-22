import { getPeerFeedback } from '@/lib/confirmations/getPeerFeedback'
import { PeerFeedbackForm } from './PeerFeedbackForm'
import { PageBanner } from '@/components/shared/page-banner'
import { MessageSquareQuote, CheckCircle2, MessageSquare } from 'lucide-react'

export default async function PeerFeedbackPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const peerFeedback = await getPeerFeedback(id)

  if (!peerFeedback) {
    return (
      <div className="space-y-6">
        <PageBanner
          badge="Error"
          title="Feedback Request Not Found"
          description="The requested peer review questionnaire could not be found or has expired."
          icon={MessageSquareQuote}
        />
      </div>
    )
  }

  if (peerFeedback.response_status === 'submitted') {
    return (
      <div className="space-y-6">
        <PageBanner
          badge="Completed"
          title="Feedback Recorded"
          description="Thank you, your peer review response has already been submitted and compiled."
          icon={CheckCircle2}
        />
        <div className="p-8 bg-card border border-border rounded-lg text-center max-w-xl mx-auto space-y-3">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 rounded-lg flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Response Already Submitted</h2>
          <p className="text-sm text-muted-foreground">
            Your anonymous peer feedback for {peerFeedback.confirmations?.employees?.name || 'this employee'} has been safely saved.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageBanner
        badge="Peer Review"
        title={`Peer Feedback for ${peerFeedback.confirmations?.employees?.name || 'Colleague'}`}
        description="Share constructive feedback to assist with probation evaluation and career progression."
        icon={MessageSquareQuote}
      />

      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <PeerFeedbackForm peerFeedbackId={id} />
      </div>
    </div>
  )
}