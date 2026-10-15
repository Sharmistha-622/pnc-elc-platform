import React from "react";
import Link from "next/link";
import { getConfirmationsList } from "@/lib/confirmations/getConfirmationsList";
import { PageBanner } from "@/components/shared/page-banner";
import { ConfirmationsStatsCards } from "./confirmations-stats";
import { ConfirmationsTable } from "./confirmations-table";
import { ClipboardList, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function ConfirmationsPage() {
  const confirmations = await getConfirmationsList();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      {/* Banner matching manage/users */}
      <PageBanner
        title="Employee Confirmations"
        description="Monitor probation evaluation workflows, 360 peer feedback collection, and managerial decision sign-offs."
        icon={<ClipboardList className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
        actions={
          <Link href="/confirmations/new">
            <Button
              size="sm"
              className="h-8 rounded-lg text-xs gap-1.5 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              New Confirmation
            </Button>
          </Link>
        }
      />

      {/* 1. Stat Cards */}
      <ConfirmationsStatsCards confirmations={confirmations} />

      {/* 2. Table with Filter, Search, Sort & Pagination */}
      <ConfirmationsTable initialConfirmations={confirmations} />
    </div>
  );
}