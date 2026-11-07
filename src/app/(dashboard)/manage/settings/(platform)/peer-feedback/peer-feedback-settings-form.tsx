'use client'

import { useState, useTransition } from 'react'
import {
  updatePeerFeedbackSettings,
  addRedFlagKeyword,
  toggleRedFlagKeyword,
  deleteRedFlagKeyword,
} from '@/lib/settings/service'
import type {
  PeerFeedbackSettings,
  RedFlagKeyword,
} from '@/lib/settings/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Save,
  Loader2,
  CheckCircle2,
  Users,
  AlertTriangle,
  Plus,
  Trash2,
  AlertCircle,
  Tag,
  X,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination } from '@/components/shared/data-table-pagination'

export function PeerFeedbackSettingsForm({
  initialSettings,
  initialKeywords,
}: {
  initialSettings: PeerFeedbackSettings | null
  initialKeywords: RedFlagKeyword[]
}) {
  const [settings, setSettings] = useState(
    initialSettings || {
      id: '',
      minimum_peers: 4,
      maximum_peers: 5,
      default_peers: 5,
      red_flag_response_threshold: 0.5,
      updated_at: '',
    }
  )
  const [keywords, setKeywords] = useState<RedFlagKeyword[]>(initialKeywords)
  const [newKeyword, setNewKeyword] = useState('')
  const [isPending, startTransition] = useTransition()
  const [isKeywordPending, setIsKeywordPending] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [keywordError, setKeywordError] = useState<string | null>(null)
  const [keywordViewMode, setKeywordViewMode] = useState<'chips' | 'table'>('chips')
  const [keywordPageIndex, setKeywordPageIndex] = useState(1)
  const [keywordPageSize, setKeywordPageSize] = useState(10)

  function handleSaveSettings() {
    setError(null)
    setSaved(false)

    if (settings.minimum_peers > settings.maximum_peers) {
      setError('Minimum peers cannot exceed maximum peers.')
      return
    }
    if (
      settings.default_peers < settings.minimum_peers ||
      settings.default_peers > settings.maximum_peers
    ) {
      setError('Default peers must be between minimum and maximum peers.')
      return
    }
    if (
      settings.red_flag_response_threshold < 0 ||
      settings.red_flag_response_threshold > 1
    ) {
      setError('Response threshold must be between 0% and 100%.')
      return
    }

    startTransition(async () => {
      const result = await updatePeerFeedbackSettings({
        minimum_peers: settings.minimum_peers,
        maximum_peers: settings.maximum_peers,
        default_peers: settings.default_peers,
        red_flag_response_threshold: settings.red_flag_response_threshold,
      })

      if (!result.success) {
        setError(result.error || 'Failed to update settings')
        return
      }

      setSaved(true)
    })
  }

  async function handleAddKeyword() {
    const trimmed = newKeyword.trim().toLowerCase()
    if (!trimmed) return
    setKeywordError(null)

    if (keywords.some((k) => k.keyword.toLowerCase() === trimmed)) {
      setKeywordError('Keyword already exists in the list.')
      return
    }

    setIsKeywordPending(true)
    const result = await addRedFlagKeyword(trimmed)
    setIsKeywordPending(false)

    if (result.success && result.data) {
      setKeywords((prev) => [...prev, result.data as RedFlagKeyword])
      setNewKeyword('')
    } else {
      setKeywordError(result.error || 'Failed to add keyword')
    }
  }

  async function handleToggleKeyword(id: string, currentState: boolean) {
    const nextState = !currentState
    setKeywords((prev) =>
      prev.map((k) => (k.id === id ? { ...k, is_active: nextState } : k))
    )

    const result = await toggleRedFlagKeyword(id, nextState)
    if (!result.success) {
      setKeywords((prev) =>
        prev.map((k) => (k.id === id ? { ...k, is_active: currentState } : k))
      )
    }
  }

  async function handleDeleteKeyword(id: string) {
    const existing = keywords.find((k) => k.id === id)
    if (!existing) return

    setKeywords((prev) => prev.filter((k) => k.id !== id))
    const result = await deleteRedFlagKeyword(id)
    if (!result.success) {
      setKeywords((prev) => [...prev, existing])
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Reviewer Limits */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Nomination Boundaries</CardTitle>
              <CardDescription className="text-xs">
                Enforce the bounds on peer reviewers nominated for an employee confirmation evaluation.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="p-4 rounded-xl border border-border/80 bg-background/60 space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Minimum Reviewers
              </Label>
              <Input
                type="number"
                min={1}
                max={15}
                value={settings.minimum_peers}
                onChange={(e) => {
                  setSettings({ ...settings, minimum_peers: parseInt(e.target.value) || 1 })
                  setSaved(false)
                }}
                className="w-20 text-center text-sm font-semibold h-9 shadow-2xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Confirmations cannot be submitted with fewer than this number of peers.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border/80 bg-background/60 space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Maximum Reviewers
              </Label>
              <Input
                type="number"
                min={1}
                max={15}
                value={settings.maximum_peers}
                onChange={(e) => {
                  setSettings({ ...settings, maximum_peers: parseInt(e.target.value) || 1 })
                  setSaved(false)
                }}
                className="w-20 text-center text-sm font-semibold h-9 shadow-2xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Upper limit on peer invitations to avoid review fatigue and delays.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border/80 bg-background/60 space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Default Slots
              </Label>
              <Input
                type="number"
                min={1}
                max={15}
                value={settings.default_peers}
                onChange={(e) => {
                  setSettings({ ...settings, default_peers: parseInt(e.target.value) || 1 })
                  setSaved(false)
                }}
                className="w-20 text-center text-sm font-semibold h-9 shadow-2xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Initial number of peer reviewer slots rendered in nomination forms.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Red-Flag Criteria & Keywords */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Red Flag Detection Criteria</CardTitle>
              <CardDescription className="text-xs">
                Automated red flags alert People & Culture leads when peer feedback indicates potential performance issues or poor survey engagement.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-0 space-y-6">
          {/* Response Rate Threshold */}
          <div className="p-4 rounded-xl border border-border/80 bg-background/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Response Rate Red Flag Threshold
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                If the percentage of submitted peer reviews falls below this threshold, a participation red flag is raised.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Input
                type="number"
                min={0}
                max={100}
                step={5}
                value={Math.round(settings.red_flag_response_threshold * 100)}
                onChange={(e) => {
                  const pct = parseInt(e.target.value) || 0
                  setSettings({ ...settings, red_flag_response_threshold: pct / 100 })
                  setSaved(false)
                }}
                className="w-20 text-center text-sm font-semibold h-9 shadow-2xs"
              />
              <span className="text-sm font-bold text-muted-foreground">%</span>
            </div>
          </div>

          {/* Keywords Manager */}
          <div className="space-y-4 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <Label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  Red Flag Terminology & Keywords
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Any submitted review containing these keywords triggers a content flag for HR inspection.
                </p>
              </div>

              {/* View toggle and active count */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-[11px] font-semibold text-muted-foreground px-2 py-0.5 rounded-md bg-muted/60">
                  {keywords.filter((k) => k.is_active).length} of {keywords.length} active
                </span>
                <div className="flex items-center rounded-lg border border-border/80 p-0.5 bg-muted/40">
                  <button
                    type="button"
                    onClick={() => setKeywordViewMode('chips')}
                    className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${
                      keywordViewMode === 'chips'
                        ? 'bg-background text-foreground shadow-2xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Tags
                  </button>
                  <button
                    type="button"
                    onClick={() => setKeywordViewMode('table')}
                    className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${
                      keywordViewMode === 'table'
                        ? 'bg-background text-foreground shadow-2xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Table
                  </button>
                </div>
              </div>
            </div>

            {/* Add new keyword */}
            <div className="flex gap-2 max-w-md">
              <Input
                placeholder="Enter keyword (e.g. attendance, delay, misconduct)"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddKeyword()
                  }
                }}
                className="text-xs h-9 bg-background shadow-2xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddKeyword}
                disabled={isKeywordPending || !newKeyword.trim()}
                className="gap-1 text-xs font-semibold h-9 px-3 shrink-0"
              >
                {isKeywordPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                Add Term
              </Button>
            </div>
            {keywordError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {keywordError}
              </p>
            )}

            {/* View Mode: Tags */}
            {keywordViewMode === 'chips' ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {keywords.map((kw) => (
                  <div
                    key={kw.id}
                    className={`group inline-flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      kw.is_active
                        ? 'bg-rose-500/10 text-rose-800 dark:text-rose-200 border-rose-500/25 shadow-2xs hover:border-rose-500/40'
                        : 'bg-muted/40 text-muted-foreground border-dashed border-border/80 opacity-60 hover:opacity-90'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleKeyword(kw.id, kw.is_active)}
                      className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                      title={kw.is_active ? 'Active — click to pause' : 'Paused — click to activate'}
                    >
                      <span
                        className={`size-2 rounded-full shrink-0 ${
                          kw.is_active ? 'bg-rose-500' : 'bg-muted-foreground/40'
                        }`}
                      />
                      <span className="font-mono text-xs font-semibold tracking-tight">{kw.keyword}</span>
                      {!kw.is_active && (
                        <span className="text-[10px] text-muted-foreground font-normal">(paused)</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteKeyword(kw.id)}
                      className="size-5 rounded-full flex items-center justify-center text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors ml-0.5"
                      title={`Remove "${kw.keyword}"`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              /* View Mode: Table */
              <div className="rounded-xl border border-border/80 overflow-hidden bg-background shadow-2xs">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <TableHead className="w-[45%]">Monitored Term</TableHead>
                      <TableHead>Detection Scope</TableHead>
                      <TableHead className="w-[120px] text-center">Active Status</TableHead>
                      <TableHead className="w-[80px] text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keywords
                      .slice((keywordPageIndex - 1) * keywordPageSize, keywordPageIndex * keywordPageSize)
                      .map((kw) => (
                        <TableRow key={kw.id} className="hover:bg-muted/20">
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`size-2 rounded-full shrink-0 ${
                                  kw.is_active ? 'bg-rose-500' : 'bg-muted-foreground/40'
                                }`}
                              />
                              <span className="font-mono text-xs font-semibold text-foreground">
                                {kw.keyword}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              Comments & narrative answers
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center">
                              <Switch
                                size="sm"
                                checked={kw.is_active}
                                onCheckedChange={() => handleToggleKeyword(kw.id, kw.is_active)}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteKeyword(kw.id)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              title={`Delete ${kw.keyword}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                <DataTablePagination
                  pageIndex={keywordPageIndex}
                  pageSize={keywordPageSize}
                  totalItems={keywords.length}
                  pageSizeOptions={[10, 25, 50]}
                  onPageChange={setKeywordPageIndex}
                  onPageSizeChange={(newSize) => {
                    setKeywordPageSize(newSize)
                    setKeywordPageIndex(1)
                  }}
                  itemLabel="keywords"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save Action Bar matching application aesthetic */}
      <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border/80 shadow-xs">
        <div className="flex items-center gap-2">
          {saved && (
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Peer feedback settings saved successfully</span>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-1.5 text-destructive text-xs font-semibold">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
          {!saved && !error && (
            <span className="text-xs text-muted-foreground">
              Keywords update immediately; save to apply reviewer limits and threshold.
            </span>
          )}
        </div>
        <Button
          onClick={handleSaveSettings}
          disabled={isPending}
          className="gap-2 px-5 h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
        >
          {isPending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
