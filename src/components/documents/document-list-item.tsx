
"use client";

import type { DocumentFile, Lead, Contact, User } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Trash2, CalendarDays, UserCircle, Tags, LucideIcon, FileType, FileImage, FileAudio, FileVideo, FileArchive, FileQuestion, Link as LinkIconLucide, History, UploadCloud, Eye, Share2, Copy, EyeOff, Globe, Users, View, Users2 } from "lucide-react";
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import React, { useState } from "react";
import { DocumentSharingDialogContent } from "./document-sharing-dialog-content";


interface DocumentListItemProps {
  documentFile: DocumentFile;
  onDelete: (documentId: string, storagePath: string) => void;
  onUploadNewVersion: (document: DocumentFile) => void;
  onViewHistory: (document: DocumentFile) => void;
  onTogglePublic: (documentId: string, currentIsPublic: boolean) => Promise<void>;
  onUpdateSharingSettings: (documentId: string, newPermissions: DocumentFile['permissions']) => Promise<void>;
  onViewDocument: (document: DocumentFile) => void; 
  leads?: Lead[];
  contacts?: Contact[];
  allUsers: User[];
  currentUser: User;
}

function getFileIcon(fileType: string): LucideIcon {
  if (fileType.startsWith("image/")) return FileImage;
  if (fileType.startsWith("audio/")) return FileAudio;
  if (fileType.startsWith("video/")) return FileVideo;
  if (fileType.startsWith("application/pdf")) return FileType; // Specific for PDF
  if (fileType.includes("word")) return FileText; // DOCX
  if (fileType.includes("sheet") || fileType.includes("excel")) return FileText; // XLSX
  if (fileType.startsWith("application/zip") || fileType.startsWith("application/x-rar-compressed")) return FileArchive;
  if (fileType.startsWith("text/")) return FileText;
  return FileQuestion;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


export function DocumentListItem({
    documentFile,
    onDelete,
    onUploadNewVersion,
    onViewHistory,
    onTogglePublic,
    onUpdateSharingSettings,
    onViewDocument, 
    leads = [],
    contacts = [],
    allUsers,
    currentUser
}: DocumentListItemProps) {
  const { toast } = useToast();
  const FileIcon = getFileIcon(documentFile.fileType);
  const uploaderIdForCurrentVersion = documentFile.lastVersionUploadedByUserId || documentFile.uploadedByUserId;
  const storagePath = `documents/${uploaderIdForCurrentVersion}/${documentFile.fileNameInStorage}`;
  const [isSharingDialogOpen, setIsSharingDialogOpen] = useState(false);

  const relatedLead = documentFile.relatedLeadId ? leads.find(l => l.id === documentFile.relatedLeadId) : null;
  const relatedContact = documentFile.relatedContactId ? contacts.find(c => c.id === documentFile.relatedContactId) : null;

  const displayUploadedAt = documentFile.lastVersionUploadedAt || documentFile.uploadedAt;
  const displayUploadedBy = documentFile.lastVersionUploadedByUserName || documentFile.uploadedByUserName;

  const hasHistory = documentFile.versionHistory && documentFile.versionHistory.length > 0;

  const sharedUserCount = documentFile.permissions?.users?.length || 0;
  const sharedGroupCount = documentFile.permissions?.groups?.length || 0;

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <FileIcon className="h-8 w-8 text-primary flex-shrink-0" />
            <div className="flex-grow min-w-0">
              <CardTitle className="text-base truncate" title={documentFile.name}>
                {documentFile.name}
              </CardTitle>
              <CardDescription className="text-xs truncate flex items-center gap-1.5">
                <span>Tipo: {documentFile.fileType}</span>
                <span className="text-muted-foreground/50">|</span>
                <span>Tamaño: {formatFileSize(documentFile.fileSize)}</span>
                <span className="text-muted-foreground/50">|</span>
                <span>Ver: {documentFile.currentVersion}</span>
                {documentFile.isPublic && <Badge variant="outline" className="ml-1 border-green-500 text-green-600 text-[10px] px-1 py-0">Público</Badge>}
                {!documentFile.isPublic && sharedUserCount > 0 && (
                    <Badge variant="outline" className="ml-1 border-blue-500 text-blue-600 text-[10px] px-1 py-0 flex items-center gap-0.5">
                        <Users className="h-2.5 w-2.5"/> {sharedUserCount}
                    </Badge>
                )}
                {!documentFile.isPublic && sharedGroupCount > 0 && (
                    <Badge variant="outline" className="ml-1 border-purple-500 text-purple-600 text-[10px] px-1 py-0 flex items-center gap-0.5">
                        <Users2 className="h-2.5 w-2.5"/> {sharedGroupCount}
                    </Badge>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-1 items-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => onViewDocument(documentFile)} className="h-8 w-8">
                    <View className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Ver Documento</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <AlertDialog open={isSharingDialogOpen} onOpenChange={setIsSharingDialogOpen}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent><p>Compartir Documento</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <AlertDialogContent className="sm:max-w-md md:max-w-lg">
                <AlertDialogHeader>
                  <AlertDialogTitle>Compartir Documento: {documentFile.name}</AlertDialogTitle>
                  <AlertDialogDescription>
                    Gestiona quién puede acceder a este documento.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <DocumentSharingDialogContent
                    documentFile={documentFile}
                    allUsers={allUsers}
                    currentUser={currentUser}
                    onSaveSharing={async (docId, perms) => {
                        await onUpdateSharingSettings(docId, perms);
                    }}
                    onTogglePublic={onTogglePublic}
                    onClose={() => setIsSharingDialogOpen(false)}
                />
              </AlertDialogContent>
            </AlertDialog>

             <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                         <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                            <a href={documentFile.fileURL} target="_blank" rel="noopener noreferrer" download={documentFile.name}>
                                <Download className="h-4 w-4" />
                            </a>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Descargar v{documentFile.currentVersion}</p></TooltipContent>
                </Tooltip>
             </TooltipProvider>
             <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => onUploadNewVersion(documentFile)} className="h-8 w-8">
                            <UploadCloud className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Subir Nueva Versión</p></TooltipContent>
                </Tooltip>
             </TooltipProvider>
             <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => onViewHistory(documentFile)} className="h-8 w-8" disabled={!hasHistory && documentFile.currentVersion <= 1}>
                            <History className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Ver Historial de Versiones</p></TooltipContent>
                </Tooltip>
             </TooltipProvider>
            <TooltipProvider>
                 <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(documentFile.id, storagePath)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Eliminar Documento</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3 space-y-1 text-xs text-muted-foreground">
        {documentFile.description && <p className="line-clamp-2">Descripción: {documentFile.description}</p>}
        <div className="flex items-center gap-1">
          <UserCircle className="h-3 w-3" />
          Subido por: {displayUploadedBy || 'Desconocido'}
        </div>
        <div className="flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          Última Actualización: {isValid(parseISO(displayUploadedAt)) ? format(parseISO(displayUploadedAt), "PPp", { locale: es }) : 'Fecha inválida'}
        </div>
         {relatedLead && (
            <div className="flex items-center gap-1 text-primary" title={`Asociado al Lead: ${relatedLead.name}`}>
                <LinkIconLucide className="h-3 w-3"/>
                Lead: <span className="font-medium truncate">{relatedLead.name}</span>
            </div>
        )}
        {relatedContact && (
            <div className="flex items-center gap-1 text-primary" title={`Asociado al Contacto: ${relatedContact.firstName || ''} ${relatedContact.lastName || ''}`}>
                <LinkIconLucide className="h-3 w-3"/>
                Contacto: <span className="font-medium truncate">{`${relatedContact.firstName || ''} ${relatedContact.lastName || ''} (${relatedContact.email})`.trim()}</span>
            </div>
        )}
      </CardContent>
      {(documentFile.tags && documentFile.tags.length > 0) && (
        <CardFooter className="pt-2 pb-3 border-t flex flex-wrap gap-1">
            <Tags className="h-3 w-3 text-muted-foreground mr-1"/>
            {documentFile.tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
        </CardFooter>
      )}
    </Card>
  );
}
