"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileUp,
  Loader2,
  Download,
  CheckCircle2,
  Sheet,
} from "lucide-react";

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (users: any[]) => void;
}

export function BulkUploadDialog({ open, onOpenChange, onSuccess }: BulkUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);

  const resetState = () => {
    setFile(null);
    setPreviewRows([]);
    setIsParsing(false);
    setIsImporting(false);
    setImportResult(null);
  };

  const handleClose = (newOpen: boolean) => {
    if (!isImporting) {
      if (!newOpen) resetState();
      onOpenChange(newOpen);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent =
      "email,full_name,role,team\n" +
      "rahul.sharma@navgurukul.org,Rahul Sharma,Member,Engineering\n" +
      "priya.singh@navgurukul.org,Priya Singh,Operations,PnC\n" +
      "amit.kumar@navgurukul.org,Amit Kumar,Viewer,Operations\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "ng_elc_users_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Downloaded sample CSV template.");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsParsing(true);
    setImportResult(null);

    try {
      const text = await selectedFile.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        toast.error("CSV file must have a header row and at least one data row.");
        setIsParsing(false);
        return;
      }

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ""));
      const parsed: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = line.split(",").map((v) => v.trim().replace(/^["']|["']$/g, ""));
        const rowObj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowObj[h] = values[idx] || "";
        });

        const isValid = !!rowObj.email && rowObj.email.includes("@");
        parsed.push({
          email: rowObj.email,
          full_name: rowObj.full_name || rowObj.name || rowObj.email.split("@")[0],
          role: rowObj.role || "Member",
          team: rowObj.team || "None",
          _valid: isValid,
          _error: isValid ? undefined : "Invalid or missing email",
        });
      }

      setPreviewRows(parsed);
      toast.success(`Parsed ${parsed.length} user rows from CSV.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to parse CSV file.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    const validRows = previewRows.filter((r) => r._valid);
    if (validRows.length === 0) {
      toast.error("No valid rows to import.");
      return;
    }

    setIsImporting(true);
    try {
      const newUsers = validRows.map((r) => ({
        id: "user-" + Math.random().toString(36).substring(2, 9),
        email: r.email,
        user_metadata: {
          full_name: r.full_name,
          role: r.role,
          team: r.team,
          last_active_at: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      }));

      setImportResult({
        total: previewRows.length,
        imported: validRows.length,
        failed: previewRows.length - validRows.length,
      });

      toast.success(`Successfully imported ${validRows.length} users!`);
      if (onSuccess) onSuccess(newUsers);
    } catch (err: any) {
      toast.error(err.message || "Bulk import failed.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] rounded-lg border bg-card p-5 shadow-xl animate-in zoom-in-95 duration-200">
        <DialogHeader className="space-y-1 pb-1">
          <DialogTitle className="text-lg font-bold tracking-tight flex items-center gap-2 text-foreground">
            <div className="p-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <FileUp className="h-4 w-4" />
            </div>
            Bulk Upload Users
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Upload a CSV file containing user emails, names, roles, and teams.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Template Download Banner */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border">
            <div className="flex items-center gap-2">
              <Sheet className="h-3.5 w-3.5 text-indigo-500" />
              <div className="text-xs">
                <span className="font-semibold text-foreground">Need the format?</span>
                <p className="text-[11px] text-muted-foreground">Download sample CSV template</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="h-7 rounded-lg text-xs gap-1"
            >
              <Download className="h-3 w-3" />
              Template
            </Button>
          </div>

          {/* File Input Box */}
          <div className="border border-dashed rounded-lg p-4 text-center border-border hover:border-indigo-400 transition-colors">
            <input
              type="file"
              id="bulk-user-file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={isImporting || isParsing}
              className="hidden"
            />
            <label htmlFor="bulk-user-file" className="cursor-pointer block">
              <FileUp className="h-6 w-6 mx-auto text-indigo-500 mb-1.5" />
              <span className="text-xs font-semibold text-foreground">
                {file ? file.name : "Click to select or drop CSV file"}
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">Accepts CSV with headers: email, full_name, role, team</p>
            </label>
          </div>

          {/* Preview Statistics */}
          {previewRows.length > 0 && !importResult && (
            <div className="p-2.5 bg-muted/30 rounded-lg space-y-1.5 border border-border/60">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Total Rows: {previewRows.length}</span>
                <div className="flex gap-1.5">
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none text-[10px] rounded-lg">
                    Valid: {previewRows.filter((r) => r._valid).length}
                  </Badge>
                  {previewRows.some((r) => !r._valid) && (
                    <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-none text-[10px] rounded-lg">
                      Invalid: {previewRows.filter((r) => !r._valid).length}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Result Banner */}
          {importResult && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-emerald-700 dark:text-emerald-300">Import Complete</p>
                <p className="text-muted-foreground text-[11px]">
                  {importResult.imported} users created/updated successfully.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={isImporting}
            onClick={() => handleClose(false)}
            className="rounded-lg h-8 text-xs"
          >
            {importResult ? "Done" : "Cancel"}
          </Button>
          {!importResult && previewRows.length > 0 && (
            <Button
              type="button"
              disabled={isImporting || previewRows.filter((r) => r._valid).length === 0}
              onClick={handleImport}
              className="rounded-lg h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 flex items-center gap-1.5"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <FileUp className="h-3.5 w-3.5" />
                  Import {previewRows.filter((r) => r._valid).length} Users
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
