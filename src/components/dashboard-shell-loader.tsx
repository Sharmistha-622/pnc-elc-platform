import React from "react";
import LoadingView from "./loading-view";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { UserProvider, type User } from "@/contexts/user-context";

export function DashboardShellLoader() {
  const fallbackUser: User = {
    id: "shell-loader",
    name: "Nitin Sudarshan",
    email: "nitin@navgurukul.org",
    avatar: "",
    role: "Super Admin",
    originalRole: "Super Admin",
  };

  return (
    <UserProvider user={fallbackUser}>
      <div className="[--header-height:calc(--spacing(14))] min-h-screen w-full">
        <SidebarProvider className="flex flex-col min-h-screen w-full">
          <SiteHeader isSuperAdmin={true} userRole="Super Admin" />
          <div className="flex flex-1 min-w-0 w-full min-h-[calc(100vh-var(--header-height,3.5rem)-1px)]">
            <AppSidebar userRole="Super Admin" />
            <SidebarInset className="min-w-0 flex flex-1 flex-col">
              <LoadingView fullScreen />
            </SidebarInset>
          </div>
        </SidebarProvider>
      </div>
    </UserProvider>
  );
}

export default DashboardShellLoader;
