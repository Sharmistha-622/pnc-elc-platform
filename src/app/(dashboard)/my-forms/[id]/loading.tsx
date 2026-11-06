// Shown instantly while a form opens, so the click on "View" or "Fill" gives
// immediate feedback instead of looking like nothing happened.
export default function LoadingForm() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300" aria-busy="true">
      <div className="flex items-center gap-2">
        <div className="h-8 w-32 rounded-lg bg-muted animate-pulse" />
      </div>
      <div className="h-28 w-full rounded-xl bg-muted/60 animate-pulse border border-border/60" />
      <div className="rounded-xl border bg-card p-6 space-y-5">
        <div className="h-5 w-1/4 rounded bg-muted animate-pulse" />
        <div className="h-10 w-full rounded-lg bg-muted/60 animate-pulse" />
        <div className="h-5 w-1/3 rounded bg-muted animate-pulse" />
        <div className="h-28 w-full rounded-lg bg-muted/60 animate-pulse" />
      </div>
    </div>
  )
}
