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
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
        <PageBanner
          title="Feedback Request Not Found"
          description="The requested peer review questionnaire could not be found or has expired."
          icon={<MessageSquareQuote className="h-5 w-5 text-destructive" />}
        />
      </div>
    )
  }

  if (peerFeedback.response_status === 'submitted') {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
        <PageBanner
          title="Feedback Recorded"
          description="Thank you, your peer review response has already been submitted and compiled."
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
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
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      <PageBanner
        title={`Peer Feedback for ${peerFeedback.confirmations?.employees?.name || 'Colleague'}`}
        description="Share constructive feedback to assist with probation evaluation and career progression."
        icon={<MessageSquareQuote className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
      />

      <div className="bg-card border border-border rounded-lg p-6 shadow-xs max-w-2xl">
        <PeerFeedbackForm peerFeedbackId={id} />
      </div>
    </div>
  )
}