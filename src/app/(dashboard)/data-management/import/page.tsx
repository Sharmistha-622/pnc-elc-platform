import { getCurrentUserRole } from "@/lib/rbac/getCurrentUserRole";
import { canWrite } from "@/lib/rbac/roles";
import { ImportEmployees } from "./import-employees";

// Data Management is open to the platform roles too, but adding people to the
// directory is `general: edit` — PnC and Super Admin. Everyone else sees why
// the upload is not offered; the server action refuses them regardless.
export default async function ImportEmployeeDataPage() {
  const { role, originalRole } = await getCurrentUserRole();
  const mayImport = Boolean(
    role && originalRole && canWrite(role, "general") && canWrite(originalRole, "general")
  );
  return <ImportEmployees mayImport={mayImport} />;
}
