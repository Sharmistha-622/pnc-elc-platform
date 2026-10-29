"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileUp, Download, CheckCircle2, AlertCircle, AlertTriangle, Loader2, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageBanner } from "@/components/shared/page-banner";
import { IMPORT_COLUMNS, IMPORT_TEMPLATE_CSV, type ImportPlan, type RowPlan } from "@/lib/employees/import";
import { previewEmployeeImport, runEmployeeImport } from "@/lib/employees/importActions";

const ACTION_LABEL: Record<RowPlan["action"], string> = {
  create: "New",
  update: "Update",
  unchanged: "No change",
  error: "Error",
};

const ACTION_CLASS: Record<RowPlan["action"], string> = {
  create: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  update: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  unchanged: "bg-muted text-muted-foreground",
  error: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

type Filter = "all" | RowPlan["action"] | "warnings";

export function ImportEmployees({ mayImport }: { mayImport: boolean }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string>("");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [busy, setBusy] = useState<"checking" | "importing" | null>(null);
  const [result, setResult] = useState<{ created: number; updated: number; unchanged: number } | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const downloadTemplate = () => {
    const blob = new Blob([IMPORT_TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "employee_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const check = async (text: string) => {
    setBusy("checking");
    try {
      const res = await previewEmployeeImport(text);
      if (!res.ok) {
        setPlan(null);
        toast.error(res.error);
        return;
      }
      setPlan(res.plan);
      setFilter(res.plan.counts.error ? "error" : "all");
    } catch {
      toast.error("Could not check the file.");
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = "";
    if (!selected) return;
    if (!/\.csv$/i.test(selected.name)) {
      toast.error("Upload a .csv file. In Excel or Google Sheets: File → Download / Save as → CSV.");
      return;
    }
    const text = await selected.text();
    setResult(null);
    setFileName(selected.name);
    setCsvText(text);
    await check(text);
  };

  const runImport = async () => {
    if (!plan?.canImport) return;
    setBusy("importing");
    try {
      const res = await runEmployeeImport(csvText);
      if (!res.ok) {
        if (res.plan) setPlan(res.plan);
        toast.error(res.error);
        return;
      }
      setResult(res);
      toast.success(`${res.created} added, ${res.updated} updated.`);
      // Show the directory as it now stands: every row should read "No change".
      await check(csvText);
    } catch {
      toast.error("The import did not finish. Upload the same file again to see what is in.");
    } finally {
      setBusy(null);
    }
  };

  const rows = (plan?.rows ?? []).filter((r) =>
    filter === "all" ? true : filter === "warnings" ? r.warnings.length > 0 : r.action === filter
  );
  const warningCount = plan?.rows.filter((r) => r.warnings.length > 0).length ?? 0;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-200">
      <PageBanner
        title="Import Employee Data"
        description="Add people to the directory, or update them, from a CSV. Everything is checked before anything is saved."
        icon={<FileUp className="h-8 w-8 text-teal-700 dark:text-teal-300" />}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/data-management"
              className="p-2 border border-border/80 rounded-lg hover:bg-muted transition-all text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1.5 bg-background"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Hub</span>
            </Link>
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="rounded-lg h-9 text-xs gap-1.5 font-semibold bg-background">
              <Download className="h-3.5 w-3.5 text-indigo-700 dark:text-indigo-300" />
              Template
            </Button>
          </div>
        }
      />

      {!mayImport ? (
        <Card className="rounded-lg border border-border p-5 flex items-start gap-3">
          <Lock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">Only PnC and Super Admin can import employees.</p>
            <p className="text-xs text-muted-foreground mt-1">Changing the employee directory is limited to them.</p>
          </div>
        </Card>
      ) : (
        <>
          <Card className="rounded-lg border border-border p-5 space-y-4">
            <div className="grid gap-2 md:grid-cols-2">
              {IMPORT_COLUMNS.map((c) => (
                <div key={c.key} className="text-xs flex gap-2">
                  <code className="font-mono font-semibold text-foreground shrink-0">{c.key}</code>
                  {c.required && (
                    <Badge variant="outline" className="h-4 px-1 text-[10px] rounded-md shrink-0">
                      {c.required === "always" ? "every row" : "new people"}
                    </Badge>
                  )}
                  <span className="text-muted-foreground">{c.help}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              People are matched by email. For someone already in the directory, only the cells you fill in are changed; an empty cell keeps what is there.
              Leave salary, bank and ID numbers out: they never go in this file.
            </p>

            <div className="border border-dashed rounded-lg p-6 text-center border-border hover:border-indigo-400 transition-colors">
              <input type="file" id="employee-file-input" accept=".csv,text/csv" onChange={onFile} disabled={busy !== null} className="hidden" />
              <label htmlFor="employee-file-input" className="cursor-pointer block">
                {busy === "checking" ? (
                  <Loader2 className="h-8 w-8 mx-auto text-indigo-700 dark:text-indigo-300 mb-2 animate-spin" />
                ) : (
                  <FileUp className="h-8 w-8 mx-auto text-indigo-700 dark:text-indigo-300 mb-2" />
                )}
                <span className="text-sm font-semibold text-foreground">{fileName ?? "Choose a CSV file"}</span>
                <p className="text-xs text-muted-foreground mt-1">From Excel or Google Sheets: File → Download / Save as → CSV.</p>
              </label>
            </div>
          </Card>

          {plan && (
            <div className="space-y-3">
              {plan.fileErrors.map((e) => (
                <div key={e} className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/5 text-xs text-rose-700 dark:text-rose-400 flex gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {e}
                </div>
              ))}
              {plan.fileWarnings.map((w) => (
                <div key={w} className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-xs text-amber-800 dark:text-amber-300 flex gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {w}
                </div>
              ))}

              {result && (
                <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-xs text-emerald-800 dark:text-emerald-300 flex gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Imported: {result.created} added, {result.updated} updated, {result.unchanged} already up to date. The table below is the file checked again against the directory.
                </div>
              )}

              {plan.rows.length > 0 && (
                <>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex gap-1.5 flex-wrap">
                      {(
                        [
                          ["all", `All ${plan.rows.length}`],
                          ["create", `New ${plan.counts.create}`],
                          ["update", `Update ${plan.counts.update}`],
                          ["unchanged", `No change ${plan.counts.unchanged}`],
                          ["error", `Errors ${plan.counts.error}`],
                          ["warnings", `Warnings ${warningCount}`],
                        ] as [Filter, string][]
                      ).map(([key, label]) => (
                        <Button
                          key={key}
                          type="button"
                          size="sm"
                          variant={filter === key ? "default" : "outline"}
                          onClick={() => setFilter(key)}
                          className="h-7 rounded-lg text-[11px]"
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                    <Button
                      type="button"
                      disabled={!plan.canImport || busy !== null}
                      onClick={runImport}
                      className="rounded-lg h-9 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-5 gap-1.5"
                    >
                      {busy === "importing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                      {plan.counts.error
                        ? `Fix ${plan.counts.error} row${plan.counts.error === 1 ? "" : "s"} to import`
                        : plan.canImport
                          ? `Import: add ${plan.counts.create}, update ${plan.counts.update}`
                          : "Nothing to import"}
                    </Button>
                  </div>

                  <div className="rounded-lg border border-border overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead className="text-xs w-14">Line</TableHead>
                          <TableHead className="text-xs">Person</TableHead>
                          <TableHead className="text-xs">Result</TableHead>
                          <TableHead className="text-xs">Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r) => (
                          <TableRow key={r.line} className="align-top">
                            <TableCell className="text-xs font-mono text-muted-foreground">{r.line}</TableCell>
                            <TableCell className="text-xs">
                              <div className="font-semibold text-foreground">{r.name || "—"}</div>
                              <div className="font-mono text-muted-foreground">{r.email || "—"}</div>
                              {r.write.employee_code && (
                                <div className="font-mono text-[11px] text-muted-foreground">{r.write.employee_code}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={`border-none text-[11px] rounded-lg ${ACTION_CLASS[r.action]}`}>{ACTION_LABEL[r.action]}</Badge>
                            </TableCell>
                            <TableCell className="text-xs space-y-1">
                              {r.errors.map((e) => (
                                <div key={e} className="text-rose-600 dark:text-rose-400">{e}</div>
                              ))}
                              {r.warnings.map((w) => (
                                <div key={w} className="text-amber-700 dark:text-amber-400">{w}</div>
                              ))}
                              {r.action === "create" && (
                                <div className="text-muted-foreground">
                                  {[r.write.employee_type, r.write.joining_date, r.write.team, r.managerEmail && `manager ${r.managerEmail}`]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </div>
                              )}
                              {r.changes.map((c) => (
                                <div key={c.field} className="text-muted-foreground">
                                  <span className="font-medium text-foreground">{c.field}</span>: {c.from ?? "—"} → {c.to ?? "—"}
                                </div>
                              ))}
                            </TableCell>
                          </TableRow>
                        ))}
                        {rows.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-xs text-center text-muted-foreground py-6">
                              No rows in this view.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
