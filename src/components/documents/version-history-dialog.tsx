"use client";

import type { DocumentFile, DocumentVersion } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, UserCircle, CalendarDays, MessageSquareText, FileText, RotateCcw } from "lucide-react";
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface VersionHistoryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  documentFile: DocumentFile;
  onRestoreVersion: (documentId: string, versionToRestore: DocumentVersion) => Promise<void>;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function VersionHistoryDialog({
  isOpen,
  onOpenChange,
  documentFile,
  onRestoreVersion,
}: VersionHistoryDialogProps) {

  const allVersions: (DocumentVersion & { isCurrent?: boolean })[] = [
    {
      version: documentFile.currentVersion,
      fileURL: documentFile.fileURL,
      fileNameInStorage: documentFile.fileNameInStorage,
      uploadedAt: documentFile.lastVersionUploadedAt || documentFile.uploadedAt,
      uploadedByUserId: documentFile.lastVersionUploadedByUserId || documentFile.uploadedByUserId,
      uploadedByUserName: documentFile.lastVersionUploadedByUserName || documentFile.uploadedByUserName,
      notes: documentFile.description || `Versión actual.`, 
      fileSize: documentFile.fileSize,
      fileType: documentFile.fileType,
      isCurrent: true,
    },
    ...(documentFile.versionHistory || []).map(v => ({...v, notes: v.versionNotes || v.notes})), // Ensure notes field is consistent
  ].sort((a, b) => b.version - a.version);

  const handleRestoreClick = async (version: DocumentVersion) => {
    if (window.confirm(`¿Estás seguro de que quieres restaurar la versión ${version.version} de este documento? La versión actual se guardará en el historial.`)) {
      await onRestoreVersion(documentFile.id, version);
      onOpenChange(false); // Close dialog after restore attempt
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Historial de Versiones: {documentFile.name}
          </DialogTitle>
          <DialogDescription>
            Visualiza todas las versiones de este documento. La versión más reciente es la actual.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Versión</TableHead>
                <TableHead>Subido Por</TableHead>
                <TableHead>Fecha de Subida</TableHead>
                <TableHead>Tamaño</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allVersions.length > 0 ? allVersions.map((version) => (
                <TableRow key={version.version} className={version.isCurrent ? "bg-primary/5" : ""}>
                  <TableCell>
                    <Badge variant={version.isCurrent ? "default" : "secondary"}>
                      v{version.version} {version.isCurrent && "(Actual)"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-xs">
                      <UserCircle className="h-4 w-4 text-muted-foreground" />
                      {version.uploadedByUserName || "Desconocido"}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3 text-muted-foreground" />
                        {isValid(parseISO(version.uploadedAt)) ? format(parseISO(version.uploadedAt), "PPp", { locale: es }) : 'Fecha inválida'}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{formatFileSize(version.fileSize)}</TableCell>
                  <TableCell className="text-xs max-w-xs truncate" title={version.notes}>
                    {version.notes || "Sin notas"}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                           <Button variant="outline" size="sm" asChild>
                            <a href={version.fileURL} target="_blank" rel="noopener noreferrer" download={`${documentFile.name} (v${version.version})`}>
                                <Download className="h-3 w-3" />
                                <span className="sr-only sm:not-sr-only sm:ml-1">Descargar</span>
                            </a>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Descargar v{version.version}</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {!version.isCurrent && (
                      <TooltipProvider>
                        <Tooltip>
                           <TooltipTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => handleRestoreClick(version)}>
                                <RotateCcw className="h-3 w-3" />
                                <span className="sr-only sm:not-sr-only sm:ml-1">Restaurar</span>
                            </Button>
                            </TooltipTrigger>
                           <TooltipContent><p>Restaurar a v{version.version}</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No hay historial de versiones disponible además de la actual.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
        <DialogFooter className="pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}