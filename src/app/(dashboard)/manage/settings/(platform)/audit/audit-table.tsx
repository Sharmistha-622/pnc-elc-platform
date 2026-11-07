'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DataTablePagination } from '@/components/shared/data-table-pagination'
import { History, UserCheck, Globe, Calendar, Bell, FileText, ArrowRight } from 'lucide-react'

function formatTableBadge(table: string) {
  switch (table) {
    case 'general_settings':
      return { label: 'General', icon: Globe, color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30' }
    case 'confirmation_rules':
      return { label: 'Confirmation', icon: UserCheck, color: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30' }
    case 'appraisal_rules':
    case 'appraisal_cycles':
      return { label: 'Appraisal', icon: Calendar, color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' }
    case 'peer_feedback_settings':
    case 'red_flag_keywords':
      return { label: 'Peer Feedback', icon: UserCheck, color: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30' }
    case 'notification_settings':
      return { label: 'Notifications', icon: Bell, color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' }
    case 'document_types':
      return { label: 'Documents', icon: FileText, color: 'bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/30' }
    default:
      return { label: table, icon: History, color: 'bg-muted text-muted-foreground' }
  }
}

export function AuditTable({ initialLogs }: { initialLogs: any[] }) {
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const paginatedLogs = initialLogs.slice((pageIndex - 1) * pageSize, pageIndex * pageSize)

  return (
    <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl overflow-hidden">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <History className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">Settings Audit Trail</CardTitle>
            <CardDescription className="text-xs">
              Chronological audit record of configuration modifications across all lifecycle and operational settings.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {initialLogs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm border-t border-border/80">
            <History className="w-8 h-8 mx-auto mb-2 opacity-30 text-indigo-700 dark:text-indigo-300" />
            <p className="font-semibold text-foreground">No configuration changes logged yet</p>
            <p className="text-xs mt-1 max-w-sm mx-auto">
              Modifications saved across the settings tabs will be automatically recorded here with before and after diffs.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-y border-border text-xs text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="py-3 px-5 text-left">Timestamp</th>
                  <th className="py-3 px-4 text-left">Category</th>
                  <th className="py-3 px-4 text-left">Configuration Key</th>
                  <th className="py-3 px-4 text-left">Audit Value Transition</th>
                  <th className="py-3 px-4 text-left">Authorized User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {paginatedLogs.map((log: any) => {
                  const badge = formatTableBadge(log.table_name)
                  const Icon = badge.icon
                  return (
                    <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-5 whitespace-nowrap text-xs text-muted-foreground font-mono">
                        {new Date(log.changed_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <Badge variant="outline" className={`gap-1 text-xs font-normal ${badge.color}`}>
                          <Icon className="w-3 h-3" />
                          {badge.label}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-foreground">
                        {log.setting_key}
                      </td>
                      <td className="py-3 px-4 max-w-md truncate text-xs">
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="text-muted-foreground line-through truncate max-w-[120px]">
                            {log.old_value || '—'}
                          </span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="text-foreground font-semibold truncate max-w-[180px]">
                            {log.new_value}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-muted-foreground font-medium">
                        {log.changed_by || 'system'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <DataTablePagination
              pageIndex={pageIndex}
              pageSize={pageSize}
              totalItems={initialLogs.length}
              pageSizeOptions={[10, 25, 50]}
              onPageChange={setPageIndex}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize)
                setPageIndex(1)
              }}
              itemLabel="audit records"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
