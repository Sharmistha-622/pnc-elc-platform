// Shown instantly while a form opens, so the click on "View" or "Fill" gives
// immediate feedback instead of looking like nothing happened.
export default function LoadingForm() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 lg:p-8 max-w-3xl mx-auto w-full" aria-busy="true">
      <p className="text-sm text-muted-foreground">Opening the form…</p>
      <div className="h-8 w-2/3 rounded-md bg-muted animate-pulse" />
      <div className="h-4 w-1/2 rounded-md bg-muted animate-pulse" />
      <div className="rounded-lg border p-4 space-y-3">
        <div className="h-4 w-1/3 rounded bg-muted animate-pulse" />
        <div className="h-10 w-full rounded bg-muted animate-pulse" />
        <div className="h-4 w-1/4 rounded bg-muted animate-pulse" />
        <div className="h-24 w-full rounded bg-muted animate-pulse" />
      </div>
    </div>
  )
}
