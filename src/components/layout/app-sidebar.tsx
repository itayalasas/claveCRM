// src/components/layout/app-sidebar.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarMenuBadge,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { NAV_ITEMS, type NavItem, APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Settings, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { getUserInitials } from "@/lib/utils";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { state: sidebarState } = useSidebar();
  const { currentUser, logout, unreadInboxCount, isLoadingUnreadCount, hasPermission } = useAuth();
  const { toast } = useToast();
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});

  const logoSrc = "/clave-crm-logo.png";

  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: "Sesión Cerrada", description: "Has cerrado sesión exitosamente." });
      router.push("/login");
    } catch (error) {

      toast({ title: "Error", description: "No se pudo cerrar la sesión.", variant: "destructive" });
    }
  };

  const toggleSubmenu = (label: string) =>
    setOpenSubmenus((prev) => ({ ...prev, [label]: !prev[label] }));

  const isParentActive = (item: NavItem) => {
    if (item.parentActiveIf) return item.parentActiveIf(pathname);
    return !!item.subItems?.some((sub) => sub.href && pathname.startsWith(sub.href));
  };

  useEffect(() => {
    const newOpen: Record<string, boolean> = {};
    NAV_ITEMS.forEach((item) => {
      if (item.subItems && isParentActive(item)) {
        newOpen[item.label] = true;
      }
    });
    setOpenSubmenus((prev) => ({ ...prev, ...newOpen }));
  }, [pathname]);

  return (
    <Sidebar
      variant="sidebar"
      collapsible={sidebarState === "collapsed" ? "icon" : "offcanvas"}
      className="border-r"
    >
      {/* HEADER */}
      <SidebarHeader className="p-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src={logoSrc}
            alt={`${APP_NAME} Logo`}
            width={32}
            height={32}
            className="h-8 w-8 flex-shrink-0"
          />
          {sidebarState === "expanded" && (
            <h1 className="text-xl font-semibold truncate" style={{ color: "hsl(var(--primary))" }}>
              {APP_NAME}
            </h1>
          )}
        </Link>
      </SidebarHeader>

      <Separator />

      {/* CONTENT */}
      <SidebarContent className="flex-grow p-2">
        <SidebarMenu>

          {NAV_ITEMS.filter((item) => {


          // If it has subItems, check if at least one of them is visible.
            if (item.subItems) {
              const hasVisibleSub = item.subItems.some((sub) =>
 (!sub.requiredPermission || hasPermission(sub.requiredPermission)) && !sub.disabled
              );

              return hasVisibleSub; // Show if any sub-item is visible
            }

            // If it has no subItems and no requiredPermission, or the user has the requiredPermission, show.
 return !item.requiredPermission || hasPermission(item.requiredPermission);
          }).map((item) => {
            const isEmailNavItem = item.href === "/email";
            const showUnread = isEmailNavItem && !isLoadingUnreadCount && unreadInboxCount > 0;

            return (
              <SidebarMenuItem key={item.label}>
                {item.subItems ? (
                  <>
                    <SidebarMenuButton
                      onClick={() => toggleSubmenu(item.label)}
                      isActive={isParentActive(item)}
                      className={cn(
                        "justify-between w-full",
                        sidebarState === "collapsed" && "justify-center"
                      )}
                      tooltip={item.label}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        {sidebarState === "expanded" && <span className="truncate">{item.label}</span>}
                      </div>
                      {sidebarState === "expanded" && (
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform flex-shrink-0",
                            openSubmenus[item.label] ? "rotate-180" : ""
                          )}
                        />
                      )}
                    </SidebarMenuButton>
                    {sidebarState === "expanded" && openSubmenus[item.label] && (
                      <SidebarMenuSub>
                        {item.subItems.map((sub) => (
                          <SidebarMenuSubItem key={sub.href}>
                            <Link href={sub.href || "#"} passHref legacyBehavior>
                              <SidebarMenuSubButton
                                asChild
                                isActive={pathname.startsWith(sub.href || "")}
                              >
                                <a className="flex items-center">
                                  <sub.icon className="h-4 w-4 mr-2 flex-shrink-0" />
                                  <span className="truncate">{sub.label}</span>
                                </a>
                              </SidebarMenuSubButton>
                            </Link>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                  </>
                ) : (
                  <Link href={item.href || "#"} passHref legacyBehavior>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith(item.href || "")}
                      className={cn(sidebarState === "collapsed" && "justify-center")}
                      tooltip={item.label}
                    >
                      <a className="flex items-center">
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        {sidebarState === "expanded" && <span className="truncate">{item.label}</span>}
                        {showUnread && sidebarState === "expanded" && (
                          <SidebarMenuBadge className="bg-red-500 text-white">
                            {unreadInboxCount}
                          </SidebarMenuBadge>
                        )}
                      </a>
                    </SidebarMenuButton>
                  </Link>
                )}
              </SidebarMenuItem>
            );
          })}

        </SidebarMenu>

      </SidebarContent>

      <Separator />

      {/* FOOTER */}
      <SidebarFooter className="p-4">
        {currentUser ? (
          sidebarState === "expanded" ? (
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 flex-shrink-0">
                <AvatarImage
                  src={currentUser.avatarUrl || `https://avatar.vercel.sh/${currentUser.email}.png`}
                  alt={currentUser.name || "Usuario"}
                />
                <AvatarFallback className="text-sm font-medium text-foreground">
                  {getUserInitials(currentUser.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{currentUser.name}</p>
                <p className="text-xs text-muted-foreground truncate">{currentUser.email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto flex-shrink-0"
                title="Cerrar Sesión"
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={currentUser.avatarUrl || `https://avatar.vercel.sh/${currentUser.email}.png`}
                  alt={currentUser.name || "Usuario"}
                />
                <AvatarFallback className="text-sm font-medium text-foreground">
                  {getUserInitials(currentUser.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Configuración"
                  onClick={() => router.push("/settings")}
                >
                  <Settings className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Cerrar Sesión"
                  onClick={handleLogout}
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )
        ) : (
          sidebarState === "expanded" && (
            <Button onClick={() => router.push("/login")} className="w-full">
              Iniciar Sesión
            </Button>
          )
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
