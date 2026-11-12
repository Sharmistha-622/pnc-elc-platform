import { AlertCircle } from 'lucide-react'

/** Shown in place of the chart when it could not be loaded. */
export const TeamChartError = ({ message }: { message: string }) => (
  <div
    role="alert"
    className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground"
  >
    <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
    <p>{message}</p>
  </div>
)
