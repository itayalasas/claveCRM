
// src/components/layout/app-header.tsx
"use client";

import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Bell, Search, LogOut, Settings as SettingsIcon } from "lucide-react"; // Renamed Settings to SettingsIcon
import { Input } from "@/components/ui/input";
import { usePathname, useRouter } from "next/navigation";
import { NAV_ITEMS, APP_NAME, type NavItem } from "@/lib/constants";
import { useAuth } from "@/contexts/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { getUserInitials } from "@/lib/utils";


function findCurrentPage(items: NavItem[], pathname: string): NavItem | null {
  for (const item of items) {
    if (item.href && pathname.startsWith(item.href)) {
      return item;
    }
    if (item.subItems) {
      const foundInSub = findCurrentPage(item.subItems, pathname);
      if (foundInSub) return foundInSub;
    }
  }
  return null;
}

export function AppHeader() {
  const { isMobile } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, logout } = useAuth();
  const { toast } = useToast();
  
  const currentPage = findCurrentPage(NAV_ITEMS, pathname);
  const pageTitle = currentPage ? currentPage.label : APP_NAME;

  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: "Sesión Cerrada", description: "Has cerrado sesión exitosamente." });
      router.push('/login');
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      toast({ title: "Error", description: "No se pudo cerrar la sesión.", variant: "destructive" });
    }
  };
  

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
      {isMobile && <SidebarTrigger />}
      {!isMobile && <div className="w-8 h-8"></div>} {/* Placeholder to align title when desktop sidebar is collapsed */}
      
      <h1 className="text-xl font-semibold hidden md:block">{pageTitle}</h1>
      
      <div className="ml-auto flex items-center gap-2 md:gap-4">
        <div className="relative hidden sm:block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Buscar..." className="pl-8 sm:w-[200px] md:w-[200px] lg:w-[300px] rounded-full h-9" />
        </div>
        <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notificaciones</span>
        </Button>
        {currentUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={currentUser.avatarUrl || `https://avatar.vercel.sh/${currentUser.email}.png`} alt={currentUser.name || "Usuario"} data-ai-hint="user avatar" />
                  <AvatarFallback>{getUserInitials(currentUser.name)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{currentUser.name || "Usuario"}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {currentUser.email}
                  </p>
                   <p className="text-xs leading-none text-muted-foreground capitalize">
                    Rol: {currentUser.role || "usuario"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <SettingsIcon className="mr-2 h-4 w-4" />
                <span>Configuración</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar Sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
