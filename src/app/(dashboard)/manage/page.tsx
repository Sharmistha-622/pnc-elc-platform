import { redirect } from 'next/navigation';
import { requireFeature } from '@/lib/rbac/requireFeature';

// `/manage` on its own maps to `manageUsers` in the route table, so it lands
// on the screen that feature is for. It used to send everyone to the letter
// templates — which most of the roles allowed here cannot open.
export default async function ManagePageRedirect() {
  await requireFeature('manageUsers');
  redirect('/manage/users');
}
