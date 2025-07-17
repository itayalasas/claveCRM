
"use client";

import { useState, useEffect, useCallback } from "react";
import type { DocumentFile, Lead, Contact, LucideIcon as LucideIconType, DocumentVersion, DocumentTemplate, User, DocumentUserPermission, DocumentGroupPermission } from "@/lib/types";
import { NAV_ITEMS, DOCUMENT_TEMPLATE_CATEGORIES } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolderKanban, PlusCircle, Search, Filter, Settings2, Share2 as ShareIconLucide, GitBranch, Info, History, FileSignature, Link as LinkIconLucideReal, RotateCcw, Library, Play, Users, Eye, Bell, Users2, View } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, query, orderBy, Timestamp, where, updateDoc, arrayUnion, getDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { DocumentListItem } from "@/components/documents/document-list-item";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { UploadNewVersionDialog } from "@/components/documents/upload-new-version-dialog";
import { VersionHistoryDialog } from "@/components/documents/version-history-dialog";
import { AddEditDocumentTemplateDialog } from "@/components/documents/add-edit-document-template-dialog";
import { DocumentTemplateListItem } from "@/components/documents/document-template-list-item";
import { GenerateDocumentFromTemplateDialog } from "@/components/documents/generate-document-from-template-dialog";
import { DocumentViewerDialog } from "@/components/documents/document-viewer-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { isValid, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { logSystemEvent } from "@/lib/auditLogger"; 
import { getAllUsers } from "@/lib/userUtils"; // <-- AÑADIDO: Importar la nueva función


export default function DocumentsPage() {
  const navItem = NAV_ITEMS.flatMap(item => item.subItems || item).find(item => item.href === '/documents');
  const PageIcon = navItem?.icon || FolderKanban;

  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [documentTemplates, setDocumentTemplates] = useState<DocumentTemplate[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]); // Renombrado de users a allUsers para evitar conflicto con la prop allUsers en DocumentListItem


  const [isLoading, setIsLoading] = useState(true); 
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true); 
  const [isLoadingSupportData, setIsLoadingSupportData] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [templateSearchTerm, setTemplateSearchTerm] = useState("");

  const [isUploadFormVisible, setIsUploadFormVisible] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{id: string, storagePath: string, name: string} | null>(null);

  const [isUploadNewVersionDialogOpen, setIsUploadNewVersionDialogOpen] = useState(false);
  const [documentForNewVersion, setDocumentForNewVersion] = useState<DocumentFile | null>(null);
  const [isVersionHistoryDialogOpen, setIsVersionHistoryDialogOpen] = useState(false);
  const [documentForVersionHistory, setDocumentForVersionHistory] = useState<DocumentFile | null>(null);

  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<DocumentTemplate | null>(null);

  const [isGenerateDocumentDialogOpen, setIsGenerateDocumentDialogOpen] = useState(false);
  const [templateForGeneration, setTemplateForGeneration] = useState<DocumentTemplate | null>(null);

  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [documentToView, setDocumentToView] = useState<DocumentFile | null>(null);

  // CAMBIO: getAllUsers eliminado de useAuth()
  const { currentUser, loading: authLoading, hasPermission } = useAuth();
  const { toast } = useToast();

  const fetchDocuments = useCallback(async () => {
    if (!currentUser) {
      setIsLoading(false);
      setDocuments([]);
      return;
    }
    setIsLoading(true);
    try {
      const q = query(collection(db, "documents"), orderBy("uploadedAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedDocs = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name as string,
          fileNameInStorage: data.fileNameInStorage as string,
          fileURL: data.fileURL as string,
          fileType: data.fileType as string,
          fileSize: data.fileSize as number,
          description: data.description as (string | undefined),
          tags: data.tags as (string[] | undefined),
          uploadedAt: (data.uploadedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          uploadedByUserId: data.uploadedByUserId as string,
          uploadedByUserName: data.uploadedByUserName as string,
          lastVersionUploadedAt: (data.lastVersionUploadedAt as Timestamp)?.toDate().toISOString() || undefined,
          lastVersionUploadedByUserId: data.lastVersionUploadedByUserId as (string | undefined),
          lastVersionUploadedByUserName: data.lastVersionUploadedByUserName as (string | undefined),
          relatedLeadId: data.relatedLeadId as (string | undefined),
          relatedContactId: data.relatedContactId as (string | undefined),
          relatedOpportunityId: data.relatedOpportunityId as (string | undefined),
          relatedOrderId: data.relatedOrderId as (string | undefined),
          relatedQuoteId: data.relatedQuoteId as (string | undefined),
          relatedTicketId: data.relatedTicketId as (string | undefined),
          relatedProjectId: data.relatedProjectId as (string | undefined),
          currentVersion: data.currentVersion as number,
          versionHistory: (data.versionHistory || []).map((v: any): DocumentVersion => ({
            version: v.version as number,
            fileURL: v.fileURL as string,
            fileNameInStorage: v.fileNameInStorage as string,
             uploadedAt: (typeof v.uploadedAt === 'string' && isValid(parseISO(v.uploadedAt)))
              ? v.uploadedAt
              : (v.uploadedAt instanceof Timestamp ? v.uploadedAt.toDate().toISOString() : new Date().toISOString()),
            uploadedByUserId: v.uploadedByUserId as string,
            uploadedByUserName: v.uploadedByUserName as string,
            fileSize: v.fileSize as number,
            fileType: v.fileType as string,
            notes: v.notes as (string | undefined),
            versionNotes: v.versionNotes as (string | undefined),
          })),
          isPublic: data.isPublic as (boolean | undefined),
          permissions: {
            users: (data.permissions?.users || []).map((p:any): DocumentUserPermission => ({
                userId: p.userId,
                userName: p.userName,
                email: p.email,
                avatarUrl: p.avatarUrl,
                level: p.level,
            })),
            groups: (data.permissions?.groups || []).map((p:any): DocumentGroupPermission => ({
                groupId: p.groupId,
                groupName: p.groupName,
                level: p.level,
            })),
          },
          accessKey: data.accessKey as (string | undefined),
          basedOnTemplateId: data.basedOnTemplateId as (string | undefined),
          templateVariablesFilled: data.templateVariablesFilled as (Record<string, string> | undefined),
        } as DocumentFile;
      });

      const userVisibleDocuments = fetchedDocs.filter(docFile =>
        docFile.uploadedByUserId === currentUser.id || 
        docFile.permissions?.users?.some(p => p.userId === currentUser.id) || 
        (docFile.permissions?.groups?.some(pg => currentUser.role === 'admin' || (currentUser.groups?.includes(pg.groupId)))) || // TODO: Reemplazar 'admin' con un permiso real
        docFile.isPublic 
      );

      setDocuments(userVisibleDocuments);
    } catch (error) {
      console.error("Error al obtener documentos:", error);
      toast({ title: "Error al Cargar Documentos", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, toast]);

  const fetchDocumentTemplates = useCallback(async () => {
    if (!currentUser) {
      setIsLoadingTemplates(false);
      return;
    }
    setIsLoadingTemplates(true);
    try {
      const q = query(collection(db, "documentTemplates"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedTemplates = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || undefined,
        } as DocumentTemplate;
      });
      setDocumentTemplates(fetchedTemplates);
    } catch (error) {
      console.error("Error al obtener plantillas de documentos:", error);
      toast({ title: "Error al Cargar Plantillas", variant: "destructive" });
    } finally {
      setIsLoadingTemplates(false);
    }
  }, [currentUser, toast]);


  const fetchSupportData = useCallback(async () => {
    setIsLoadingSupportData(true);
    try {
      // CAMBIO: Llamar a getAllUsers importada
      const [leadsSnapshot, contactsSnapshot, usersDataFromUtil] = await Promise.all([
        getDocs(collection(db, "leads")),
        getDocs(collection(db, "contacts")),
        getAllUsers(),
      ]);

      setLeads(leadsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Lead)));
      setContacts(contactsSnapshot.docs.map(docSnap => ({id: docSnap.id, ...docSnap.data()} as Contact)));
      setAllUsers(usersDataFromUtil); // CAMBIO: Usar el resultado de getAllUsers()

    } catch (error) {
      console.error("Error al obtener datos de soporte (leads, contactos, usuarios):", error);
      toast({ title: "Error al Cargar Datos de Soporte", variant: "destructive"});
    } finally {
      setIsLoadingSupportData(false);
    }
  // CAMBIO: getAllUsers eliminado de dependencias
  }, [toast]);


  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !hasPermission('ver-documentos')) {
         // Usar redirect de next/navigation para SSR/App Router
         // No se puede usar router.push() directamente aquí como en pages router
         // Esta página se renderizará y luego se comprobará. Considerar un componente HOC o middleware para rutas.
         console.warn("Acceso denegado a Documentos, debería redirigir el layout o un HOC.");
         // redirect('/access-denied'); // Esto causaría un error si se llama incondicionalmente durante el renderizado.
      } else {
        fetchDocuments();
        fetchDocumentTemplates();
        fetchSupportData();
      }
    } else {
        setDocuments([]);
        setDocumentTemplates([]);
        setLeads([]);
        setContacts([]);
        setAllUsers([]);
        setIsLoading(true);
        setIsLoadingTemplates(true);
        setIsLoadingSupportData(true);
    }
  // CAMBIO: fetchSupportData ya no cambia su referencia innecesariamente
  }, [authLoading, currentUser, hasPermission, fetchDocuments, fetchDocumentTemplates, fetchSupportData]);

  // ... (resto del componente, funciones handleSave, handleDelete, etc. sin cambios directos a getAllUsers)
  // Asegurarse que si alguna de esas funciones NECESITA la lista de usuarios, la tome de `allUsers` (el estado local)

  if (authLoading || (!currentUser && !hasPermission('ver-documentos'))) {
      return (
        <div className="flex flex-col gap-6 w-full p-6 items-center justify-center h-screen">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
      );
  }
  // Si después de cargar auth, no hay currentUser pero sí permiso (caso improbable), o no tiene permiso.
  // El layout superior ya debería manejar la redirección para !currentUser en rutas protegidas.
  // Esta es una doble verificación o para casos donde el layout no redirige.
  if (!currentUser || !hasPermission('ver-documentos')) {
      // Idealmente, el AppLayout ya redirigió o mostró un bloqueo.
      // Si llegamos aquí, es posible que el usuario haya perdido la sesión o los permisos cambiaron.
      // Mostrar un loader o un mensaje simple mientras se espera la redirección del layout o un re-render.
      return <div className="flex justify-center items-center h-screen w-full"><p>Verificando permisos y sesión...</p></div>;
  }

  const filteredDocuments = documents.filter(docFile =>
    docFile.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (docFile.description && docFile.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (docFile.tags && docFile.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  const filteredDocumentTemplates = documentTemplates.filter(template =>
    template.name.toLowerCase().includes(templateSearchTerm.toLowerCase()) ||
    (template.description && template.description.toLowerCase().includes(templateSearchTerm.toLowerCase())) ||
    (template.category && template.category.toLowerCase().includes(templateSearchTerm.toLowerCase()))
  );

  const renderFutureFeatureCard = (title: string, Icon: LucideIconType, description: string, features: string[], implemented: boolean = false, partiallyImplemented: boolean = false, inProgress: boolean = false) => (
    <Card className={`${implemented ? "bg-green-50 border-green-200" : (partiallyImplemented || inProgress ? "bg-yellow-50 border-yellow-200" : "bg-muted/30")} w-full`}>
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 text-lg ${implemented ? 'text-green-700' : (partiallyImplemented || inProgress ? 'text-yellow-700' : 'text-amber-500')}`}>
          <Icon className="h-5 w-5" />
          {title}
          {implemented && <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white text-xs">Implementado</Badge>}
          {partiallyImplemented && <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600 text-black text-xs">Parcial</Badge>}
          {inProgress && !implemented && !partiallyImplemented && <Badge variant="outline" className="border-blue-500 text-blue-600 text-xs">En Progreso</Badge>}
          {!implemented && !partiallyImplemented && !inProgress && <Badge variant="outline" className="text-xs">Planeado</Badge>}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          {features.map(f => <li key={f}>{f}</li>)}
        </ul>
      </CardContent>
    </Card>
  );

  return (
    // CAMBIO: Añadido w-full
    <div className="flex flex-col gap-6 w-full">
      <Card className="shadow-lg w-full">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
                <CardTitle className="flex items-center gap-2 text-2xl">
                <PageIcon className="h-6 w-6 text-primary" />
                {navItem?.label || "Gestión de Documentos"}
                </CardTitle>
                <CardDescription>
                Organiza, versiona, comparte y visualiza documentos y plantillas.
                </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="documents" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="documents"><FolderKanban className="mr-2 h-4 w-4" />Documentos</TabsTrigger>
          <TabsTrigger value="templates"><Library className="mr-2 h-4 w-4" />Plantillas</TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
            <Card className="mt-4 w-full">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <CardTitle>Documentos Almacenados</CardTitle>
                        {/* Botón deshabilitado si no tiene permiso de crear */} 
                        <Button onClick={() => setIsUploadFormVisible(prev => !prev)} disabled={!currentUser || isLoadingSupportData || !hasPermission('subir-documento')}>
                            <PlusCircle className="mr-2 h-4 w-4" /> {isUploadFormVisible ? "Cancelar Subida" : "Subir Documento"}
                        </Button>
                    </div>
                    {isUploadFormVisible && (
                        <CardContent className="p-0 pt-4">
                            {isLoadingSupportData ? (
                                <Skeleton className="h-60 w-full max-w-lg" />
                            ) : (
                                <DocumentUploadForm
                                    currentUser={currentUser}
                                    onUploadSuccess={handleUploadSuccess}
                                    leads={leads}
                                    contacts={contacts}
                                />
                            )}
                        </CardContent>
                    )}
                    <div className="flex gap-2 mt-4">
                        <div className="relative flex-grow">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Buscar por nombre, descripción o etiqueta..."
                                className="pl-8 w-full"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {/* <Button variant="outline" disabled>
                            <Filter className="mr-2 h-4 w-4" /> Filtrar
                        </Button> */}
                    </div>
                </CardHeader>
                <CardContent>
                {(isLoading || isLoadingSupportData) && documents.length === 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
                    </div>
                ) : filteredDocuments.length > 0 && currentUser ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDocuments.map(docFile => (
                        <DocumentListItem
                        key={docFile.id}
                        documentFile={docFile}
                        onDelete={(docId, storagePath) => confirmDeleteDocument(docId, storagePath, docFile.name)}
                        onUploadNewVersion={openUploadNewVersionDialog}
                        onViewHistory={openVersionHistoryDialog}
                        onTogglePublic={(docId, isPub) => handleTogglePublic(docId, isPub, docFile.name)}
                        onUpdateSharingSettings={(docId, perms) => handleUpdateSharingSettings(docId, perms, docFile.name)}
                        onViewDocument={handleViewDocument}
                        leads={leads}
                        contacts={contacts}
                        allUsers={allUsers} // Pasa la lista de todos los usuarios aquí
                        currentUser={currentUser}
                        // Asumiendo permisos para DocumentListItem
                        canEdit={hasPermission('editar-documento')}
                        canDelete={hasPermission('eliminar-documento')}
                        canShare={hasPermission('compartir-documento')}
                        />
                    ))}
                    </div>
                ) : (
                    <div className="text-center py-10 text-muted-foreground">
                    <FolderKanban className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-lg">No hay documentos.</p>
                    {searchTerm ? <p>Intenta con otro término de búsqueda.</p> : <p>Empieza subiendo tu primer documento.</p>}
                    </div>
                )}
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="templates">
           <Card className="mt-4 w-full">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <CardTitle>Plantillas de Documentos</CardTitle>
                        {/* Botón deshabilitado si no tiene permiso de crear */} 
                        <Button onClick={openNewTemplateDialog} disabled={!currentUser || !hasPermission('crear-plantilla-documento')}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Nueva Plantilla
                        </Button>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <div className="relative flex-grow">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Buscar por nombre, descripción o categoría..."
                                className="pl-8 w-full"
                                value={templateSearchTerm}
                                onChange={(e) => setTemplateSearchTerm(e.target.value)}
                            />
                        </div>
                         {/* <Button variant="outline" disabled>
                            <Filter className="mr-2 h-4 w-4" /> Filtrar
                        </Button> */}
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoadingTemplates && documentTemplates.length === 0 ? (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
                        </div>
                    ) : filteredDocumentTemplates.length > 0 ? (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredDocumentTemplates.map(template => (
                                <DocumentTemplateListItem
                                    key={template.id}
                                    template={template}
                                    onEdit={openEditTemplateDialog}
                                    onDelete={confirmDeleteTemplate}
                                    onGenerate={openGenerateDocumentDialog}
                                    // Asumiendo permisos para DocumentTemplateListItem
                                    canEdit={hasPermission('editar-plantilla-documento')}
                                    canDelete={hasPermission('eliminar-plantilla-documento')}
                                    canGenerate={hasPermission('crear-documento')} // O un permiso como 'generar-documento-plantilla'
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 text-muted-foreground">
                            <Library className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                            <p className="text-lg">No hay plantillas de documentos.</p>
                            {templateSearchTerm ? <p>Intenta con otro término de búsqueda.</p> : <p>Crea tu primera plantilla.</p>}
                        </div>
                    )}
                </CardContent>
           </Card>
        </TabsContent>
      </Tabs>

      {/* Sección de "Futuras Funcionalidades" omitida por brevedad, se asume que no usa getAllUsers */}

      {documentToDelete && (
        <AlertDialog open={!!documentToDelete} onOpenChange={() => setDocumentToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. El documento &quot;{documentToDelete.name}&quot; y todas sus versiones serán eliminados permanentemente del almacenamiento y de la base de datos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDocumentToDelete(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteDocument} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Sí, eliminar documento
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
       {templateToDelete && (
        <AlertDialog open={!!templateToDelete} onOpenChange={() => setTemplateToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar Plantilla?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. La plantilla &quot;{templateToDelete.name}&quot; será eliminada permanentemente.
                {templateToDelete.fileURL && " También se eliminará el archivo asociado del almacenamiento."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setTemplateToDelete(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteTemplate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Sí, eliminar plantilla
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {documentForNewVersion && currentUser &&(
        <UploadNewVersionDialog
          isOpen={isUploadNewVersionDialogOpen}
          onOpenChange={setIsUploadNewVersionDialogOpen}
          documentToUpdate={documentForNewVersion}
          currentUser={currentUser}
          onUploadSuccess={(docName, newVer) => handleUploadNewVersionSuccess(docName, newVer)}
        />
      )}

      {documentForVersionHistory && (
        <VersionHistoryDialog
          isOpen={isVersionHistoryDialogOpen}
          onOpenChange={setIsVersionHistoryDialogOpen}
          documentFile={documentForVersionHistory}
          onRestoreVersion={(docId, version) => handleRestoreVersion(docId, version, documentForVersionHistory.name)}
        />
      )}

      {currentUser && (
         <AddEditDocumentTemplateDialog
            isOpen={isTemplateDialogOpen}
            onOpenChange={setIsTemplateDialogOpen}
            templateToEdit={editingTemplate}
            currentUser={currentUser}
            onSaveSuccess={(tplName, isEdit) => handleSaveTemplateSuccess(tplName, isEdit)}
        />
      )}
      {currentUser && templateForGeneration && (
        <GenerateDocumentFromTemplateDialog
            isOpen={isGenerateDocumentDialogOpen}
            onOpenChange={setIsGenerateDocumentDialogOpen}
            template={templateForGeneration}
            currentUser={currentUser}
            onGenerateSuccess={handleGenerateDocumentSuccess}
            leads={leads}
            contacts={contacts}
        />
      )}
      {documentToView && (
        <DocumentViewerDialog
            isOpen={isDocumentViewerOpen}
            onOpenChange={setIsDocumentViewerOpen}
            documentFile={documentToView}
        />
      )}
    </div>
  );
}
