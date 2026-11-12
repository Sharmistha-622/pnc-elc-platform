import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { initialsOf } from '@/lib/org/teamTree'
import { cn } from '@/lib/utils'

interface PersonAvatarProps {
  name: string
  avatarUrl: string | null
  /** Initials colours, e.g. the team's hue-100 / hue-800. */
  toneClassName: string
  className?: string
}

/** A person's photo, or their initials on the team's colour. */
export const PersonAvatar = ({ name, avatarUrl, toneClassName, className }: PersonAvatarProps) => (
  <Avatar className={cn('size-9', className)}>
    {avatarUrl ? <AvatarImage src={avatarUrl} alt="" className="object-cover" /> : null}
    <AvatarFallback className={cn('text-xs font-semibold', toneClassName)}>{initialsOf(name)}</AvatarFallback>
  </Avatar>
)
