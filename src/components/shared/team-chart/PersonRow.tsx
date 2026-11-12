'use client'

import Link from 'next/link'
import { Mail, UserRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { useHoverCardKeyboard } from '@/hooks/useHoverCardKeyboard'
import type { TeamHue } from '@/lib/org/teamPalette'
import type { TeamPerson } from '@/lib/org/teamTree'
import { cn } from '@/lib/utils'

import { PersonAvatar } from './PersonAvatar'
import { chartItemId, useTeamChart } from './TeamChartContext'

interface PersonRowProps {
  person: TeamPerson
  teamName: string
  hue: TeamHue
}

const ROW =
  'flex h-16 w-full min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-card px-3 text-left outline-none transition-shadow hover:ring-2 focus-visible:ring-2 data-[state=open]:ring-2 dark:border-slate-800'

/**
 * One person: photo or initials, full name, and designation. The whole row
 * opens their profile when the viewer may open profiles; otherwise it is a
 * button whose focus (a tap, on a phone) opens their card. Hover or focus
 * shows a card with Email and Profile; Slack is left out until Slack member
 * IDs are stored.
 */
export const PersonRow = ({ person, teamName, hue }: PersonRowProps) => {
  const { canOpenProfiles, matchedPeople, activeMatch } = useTeamChart()
  const itemId = chartItemId('person', person.id)
  const isMatch = matchedPeople.has(person.id)
  const isActive = activeMatch === itemId
  const profileHref = `/employees/${person.id}/profile`
  const card = useHoverCardKeyboard<HTMLAnchorElement & HTMLButtonElement>()

  const rowClassName = cn(
    ROW,
    hue.ring,
    isMatch && cn('ring-2', hue.match),
    isActive && 'ring-offset-2 ring-offset-background',
  )
  const body = (
    <>
      <PersonAvatar name={person.name} avatarUrl={person.avatarUrl} toneClassName={hue.avatar} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold text-foreground" title={person.name}>
          {person.name}
        </span>
        <span className="truncate text-sm text-slate-600 dark:text-slate-400" title={person.subtitle}>
          {person.subtitle}
        </span>
      </span>
    </>
  )

  return (
    <HoverCard open={card.open} onOpenChange={card.onOpenChange} openDelay={250} closeDelay={150}>
      <HoverCardTrigger asChild>
        {canOpenProfiles ? (
          <Link href={profileHref} className={rowClassName} data-team-chart-item={itemId} {...card.triggerProps}>
            {body}
          </Link>
        ) : (
          <button
            type="button"
            className={rowClassName}
            data-team-chart-item={itemId}
            aria-label={`${person.name}, ${person.subtitle}`}
            {...card.triggerProps}
          >
            {body}
          </button>
        )}
      </HoverCardTrigger>
      <HoverCardContent side="right" align="start" className="w-72 space-y-3" {...card.contentProps}>
        <div className="flex items-center gap-3">
          <PersonAvatar name={person.name} avatarUrl={person.avatarUrl} toneClassName={hue.avatar} className="size-10" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{person.name}</p>
            <p className="truncate text-sm text-slate-600 dark:text-slate-400">{person.subtitle}</p>
            <p className="truncate text-xs text-slate-600 dark:text-slate-400">{teamName}</p>
          </div>
        </div>
        {person.email ? <p className="truncate text-xs text-slate-600 dark:text-slate-400">{person.email}</p> : null}
        {person.email || canOpenProfiles ? (
          <div className="flex gap-2">
            {person.email ? (
              <Button asChild variant="outline" size="sm" className="flex-1">
                <a href={`mailto:${person.email}`}>
                  <Mail aria-hidden="true" />
                  Email
                </a>
              </Button>
            ) : null}
            {canOpenProfiles ? (
              <Button asChild variant="secondary" size="sm" className="flex-1">
                <Link href={profileHref}>
                  <UserRound aria-hidden="true" />
                  Profile
                </Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-slate-600 dark:text-slate-400">No contact details to show.</p>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}
