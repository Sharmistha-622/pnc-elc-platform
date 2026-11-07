import { z } from 'zod'
import { REQUEST_TYPES } from './types'

/** A request about the person's own data: the same schema in the form and the server action. */
const details = z.string().trim().max(2000, 'At most 2,000 characters')
const otherTypes = REQUEST_TYPES.filter((t) => t !== 'nomination') as [Exclude<(typeof REQUEST_TYPES)[number], 'nomination'>, ...Exclude<(typeof REQUEST_TYPES)[number], 'nomination'>[]]

export const myRequestSchema = z.discriminatedUnion('request_type', [
  z.object({ request_type: z.enum(otherTypes, { error: 'Choose what you are asking for' }), details }),
  z.object({
    request_type: z.literal('nomination'),
    details,
    nominee_name: z.string().trim().min(2, 'Enter their name').max(150),
    nominee_relation: z.string().trim().max(80),
    nominee_contact: z.string().trim().min(5, 'How can they be reached?').max(200),
  }),
])
export type MyRequestInput = z.input<typeof myRequestSchema>
