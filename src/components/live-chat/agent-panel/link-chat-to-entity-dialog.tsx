"use client";

import { useState, useEffect } from "react";
import type { ChatSession, Lead, Contact } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, User, Users as UsersIcon, Briefcase, Link as LinkIconLucide, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LinkChatToEntityDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  session: ChatSession;
  leads: Lead[];
  contacts: Contact[];
  onLink: (sessionId: string, entityType: 'lead' | 'contact', entityId: string) => Promise<void>;
}

export function LinkChatToEntityDialog({
  isOpen,
  onOpenChange,
  session,
  leads,
  contacts,
  onLink,
}: LinkChatToEntityDialogProps) {
  const [activeTab, setActiveTab] = useState<"leads" | "contacts">("leads");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const { toast } = useToast();

  const filteredLeads = leads.filter(lead =>
    lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (lead.company && lead.company.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredContacts = contacts.filter(contact =>
    ((contact.firstName || "") + " " + (contact.lastName || "")).toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleLinkClick = async (entityType: 'lead' | 'contact', entityId: string) => {
    setIsLinking(true);
    try {
      await onLink(session.id, entityType, entityId);
      onOpenChange(false); // Close dialog on success
    } catch (error) {
      console.error("Error linking entity:", error);
      toast({ title: "Error al Vincular", description: "No se pudo vincular la entidad al chat.", variant: "destructive"});
    } finally {
      setIsLinking(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSearchTerm(""); // Reset search on open
      setActiveTab("leads"); // Default to leads tab
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIconLucide className="h-5 w-5 text-primary" />
            Vincular Chat a Entidad Existente
          </DialogTitle>
          <DialogDescription>
            Busca y selecciona un lead o contacto para vincular a esta sesión de chat con {session.visitorName || `Visitante ${session.visitorId.substring(0,6)}`}.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={`Buscar en ${activeTab === "leads" ? "Leads" : "Contactos"}...`}
              className="pl-8 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "leads" | "contacts")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="leads"><UsersIcon className="mr-2 h-4 w-4" />Leads ({filteredLeads.length})</TabsTrigger>
              <TabsTrigger value="contacts"><User className="mr-2 h-4 w-4" />Contactos ({filteredContacts.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="leads" className="mt-2">
              <ScrollArea className="h-64 border rounded-md">
                {filteredLeads.length > 0 ? (
                  filteredLeads.map(lead => (
                    <div key={lead.id} className="flex items-center justify-between p-2 hover:bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">{lead.email || lead.company || 'Sin detalles'}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleLinkClick('lead', lead.id)} disabled={isLinking || session.relatedLeadId === lead.id}>
                        {isLinking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {session.relatedLeadId === lead.id ? "Vinculado" : "Vincular"}
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="p-4 text-sm text-center text-muted-foreground">No se encontraron leads con ese criterio.</p>
                )}
              </ScrollArea>
            </TabsContent>
            <TabsContent value="contacts" className="mt-2">
              <ScrollArea className="h-64 border rounded-md">
                 {filteredContacts.length > 0 ? (
                  filteredContacts.map(contact => (
                    <div key={contact.id} className="flex items-center justify-between p-2 hover:bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">{contact.firstName || ""} {contact.lastName || ""}</p>
                        <p className="text-xs text-muted-foreground">{contact.email}</p>
                      </div>
                       <Button size="sm" variant="outline" onClick={() => handleLinkClick('contact', contact.id)} disabled={isLinking || session.relatedContactId === contact.id}>
                        {isLinking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {session.relatedContactId === contact.id ? "Vinculado" : "Vincular"}
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="p-4 text-sm text-center text-muted-foreground">No se encontraron contactos con ese criterio.</p>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLinking}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
