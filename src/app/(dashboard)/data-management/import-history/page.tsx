import { getEmployeeImportHistory } from "@/lib/employees/importActions";
import { ImportHistoryClient } from "./import-history-client";

export default async function ImportHistoryPage() {
  const batches = await getEmployeeImportHistory();
  return <ImportHistoryClient batches={batches} />;
}
