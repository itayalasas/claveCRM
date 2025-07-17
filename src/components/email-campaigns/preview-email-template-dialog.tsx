
"use client";

import { useState, useEffect } from "react";
import type { EmailTemplate } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Smartphone, Monitor, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface PreviewEmailTemplateDialogProps {
  template: EmailTemplate | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PreviewEmailTemplateDialog({
  template,
  isOpen,
  onOpenChange,
}: PreviewEmailTemplateDialogProps) {
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [iframeSrcDoc, setIframeSrcDoc] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (template?.contentHtml) {
        // Basic sanitization placeholder - in a real app, use a robust library like DOMPurify
        const sanitizedHtml = template.contentHtml; // Replace with actual sanitization
        setIframeSrcDoc(sanitizedHtml);
    } else {
        setIframeSrcDoc(undefined);
    }
  }, [template]);

  if (!template) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Previsualización de Plantilla: {template.name}
          </DialogTitle>
          <DialogDescription>
            Asunto: {template.subject}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center my-2">
          <Tabs value={previewMode} onValueChange={(value) => setPreviewMode(value as "desktop" | "mobile")}>
            <TabsList>
              <TabsTrigger value="desktop"><Monitor className="mr-2 h-4 w-4" />Escritorio</TabsTrigger>
              <TabsTrigger value="mobile"><Smartphone className="mr-2 h-4 w-4" />Móvil</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-grow overflow-hidden border rounded-md bg-muted flex items-center justify-center p-2">
          {iframeSrcDoc ? (
             <iframe
                srcDoc={iframeSrcDoc}
                title={`Previsualización de ${template.name}`}
                className={cn(
                  "border-0 bg-white shadow-md transition-all duration-300 ease-in-out",
                  previewMode === "desktop" ? "w-full h-full max-w-[800px]" : "w-[375px] h-[667px] max-w-full max-h-full"
                )}
                sandbox="allow-scripts" // Be cautious with allow-scripts if HTML is from untrusted source. Consider "allow-same-origin" if needed.
            />
          ) : (
            <p className="text-muted-foreground">Contenido no disponible para previsualizar.</p>
          )}
        </div>
        
        <DialogFooter className="mt-auto pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
