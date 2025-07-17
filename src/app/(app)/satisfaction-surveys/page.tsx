
"use client";

import { useState, useEffect, useCallback } from "react";
import type { SurveyTemplate } from "@/lib/types";
import { NAV_ITEMS, SURVEY_TYPES, SURVEY_QUESTION_TYPES } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Smile, PlusCircle, Edit3, Trash2, AlertTriangle, BarChartHorizontalBig, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, query, orderBy, Timestamp, setDoc } from "firebase/firestore";
import { AddEditSurveyTemplateDialog } from "@/components/surveys/add-edit-survey-template-dialog";
import { useRouter } from 'next/navigation';
import { SurveyTemplateListItem } from "@/components/surveys/survey-template-list-item";
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

export default function SatisfactionSurveysPage() {
  const navItem = NAV_ITEMS.flatMap(item => item.subItems || []).find(item => item.href === '/satisfaction-surveys');
  const PageIcon = navItem?.icon || Smile;

  const [surveyTemplates, setSurveyTemplates] = useState<SurveyTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SurveyTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<SurveyTemplate | null>(null);

  const { currentUser, loading, hasPermission } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  // Permission check effect
  useEffect(() => {
    if (!loading) {
      if (!currentUser || !hasPermission('ver-encuestas')) {
        router.push('/access-denied');
      }
    }
  }, [currentUser, loading, hasPermission, router]);

  const fetchSurveyTemplates = useCallback(async () => {
    if (!currentUser) {
      setIsLoadingTemplates(false);
      return;
    }
    setIsLoadingTemplates(true);
    try {
      const q = query(collection(db, "surveyTemplates"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedTemplates = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || undefined,
        } as SurveyTemplate;
      });
      setSurveyTemplates(fetchedTemplates);
    } catch (error) {
      console.error("Error al obtener plantillas de encuesta:", error);
      toast({ title: "Error al Cargar Plantillas", variant: "destructive" });
    } finally {
      setIsLoadingTemplates(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    fetchSurveyTemplates();
  }, [fetchSurveyTemplates]);

  const handleSaveTemplate = async (templateData: Omit<SurveyTemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdByUserId'>, id?: string) => {
    if (!currentUser) {
      toast({ title: "Error de autenticación", variant: "destructive" });
      return false;
    }
    try {
      const docId = id || doc(collection(db, "surveyTemplates")).id;
      const dataToSave: any = {
        ...templateData,
        updatedAt: serverTimestamp(),
      };
      if (!id) {
        dataToSave.createdAt = serverTimestamp();
        dataToSave.createdByUserId = currentUser.id;
      }
      await setDoc(doc(db, "surveyTemplates", docId), dataToSave, { merge: true });
      toast({ title: id ? "Plantilla Actualizada" : "Plantilla Creada", description: `La plantilla "${templateData.name}" ha sido guardada.` });
      fetchSurveyTemplates();
      return true;
    } catch (error) {
      console.error("Error al guardar plantilla de encuesta:", error);
      toast({ title: "Error al Guardar Plantilla", variant: "destructive" });
      return false;
    }
  };

  const confirmDeleteTemplate = (template: SurveyTemplate) => {
    setTemplateToDelete(template);
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete || !currentUser) return;
    try {
      await deleteDoc(doc(db, "surveyTemplates", templateToDelete.id));
      toast({ title: "Plantilla Eliminada", description: `La plantilla "${templateToDelete.name}" ha sido eliminada.` });
      fetchSurveyTemplates();
    } catch (error) {
      console.error("Error al eliminar plantilla:", error);
      toast({ title: "Error al Eliminar Plantilla", variant: "destructive" });
    } finally {
      setTemplateToDelete(null);
    }
  };

  if (loading) {
    return <div>Cargando...</div>;
  }

  // Only render if user has permission (effect handles redirection if not)
  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <PageIcon className="h-6 w-6 text-primary" />
            {navItem?.label || "Encuestas de Satisfacción"}
          </CardTitle>
          <CardDescription>
            Mide la satisfacción de tus clientes (CSAT/NPS) enviando encuestas después de la resolución de tickets o interacciones clave.
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="templates"><FileText className="mr-2 h-4 w-4" />Plantillas de Encuestas</TabsTrigger>
          <TabsTrigger value="results" disabled><BarChartHorizontalBig className="mr-2 h-4 w-4" />Resultados y Analíticas (Próx.)</TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <Card className="mt-4">
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
                <CardTitle>Gestión de Plantillas de Encuestas</CardTitle>
                <Button onClick={() => { setEditingTemplate(null); setIsTemplateDialogOpen(true); }} disabled={isLoadingTemplates}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Nueva Plantilla de Encuesta
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingTemplates ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}
                </div>
              ) : surveyTemplates.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {surveyTemplates.map(template => (
                    <SurveyTemplateListItem
                      key={template.id}
                      template={template}
                      onEdit={() => { setEditingTemplate(template); setIsTemplateDialogOpen(true); }}
                      onDelete={() => confirmDeleteTemplate(template)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-lg">No hay plantillas de encuestas.</p>
                  <p>Crea tu primera plantilla para empezar a medir la satisfacción.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results">
           <Card className="mt-4">
            <CardHeader>
                <CardTitle>Resultados y Analíticas de Encuestas</CardTitle>
                <CardDescription>Visualiza las respuestas y métricas de tus encuestas.</CardDescription>
            </CardHeader>
            <CardContent className="text-center py-10 text-muted-foreground">
                <BarChartHorizontalBig className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg">Funcionalidad en Desarrollo</p>
                <p>Aquí podrás ver los resultados de las encuestas enviadas y analizar métricas como CSAT y NPS.</p>
            </CardContent>
           </Card>
        </TabsContent>
      </Tabs>

       <AddEditSurveyTemplateDialog
        isOpen={isTemplateDialogOpen}
        onOpenChange={setIsTemplateDialogOpen}
        templateToEdit={editingTemplate}
        onSave={handleSaveTemplate}
      />

      {templateToDelete && (
        <AlertDialog open={!!templateToDelete} onOpenChange={() => setTemplateToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar Plantilla de Encuesta?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. La plantilla &quot;{templateToDelete.name}&quot; será eliminada permanentemente.
                Las encuestas ya enviadas basadas en esta plantilla no se verán afectadas, pero no podrás crear nuevas encuestas con ella.
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
      
      <Card className="mt-4 bg-amber-50 border-amber-200">
        <CardHeader>
          <CardTitle className="flex items-center text-amber-700 text-lg gap-2">
            <AlertTriangle className="h-5 w-5" />
            Estado de Desarrollo de Encuestas de Satisfacción
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-amber-600">
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong>Gestión de Plantillas de Encuestas (Básico CSAT):</strong>
              <Badge variant="default" className="ml-2 bg-green-500 hover:bg-green-600 text-white">Implementado</Badge>
              <p className="text-xs pl-5">Puedes crear, editar y eliminar plantillas básicas de encuestas (nombre, descripción, tipo CSAT, pregunta principal).</p>
            </li>
            <li>
              <strong>Diseñador de Encuestas Avanzado (NPS, Preguntas Personalizadas):</strong>
              <Badge variant="outline" className="ml-2 border-blue-500 text-blue-600">En Desarrollo</Badge>
              <p className="text-xs pl-5">Se implementará un diseñador más flexible para crear preguntas de diferentes tipos (escala, abiertas, opción múltiple).</p>
            </li>
            <li>
              <strong>Envío Automático de Encuestas:</strong>
              <Badge variant="outline" className="ml-2 border-gray-500 text-gray-600">Pendiente (Backend)</Badge>
              <p className="text-xs pl-5">Se crearán Cloud Functions para enviar encuestas automáticamente (ej. tras cierre de ticket). La UI en TicketItem tiene un placeholder para esto.</p>
            </li>
            <li>
              <strong>Recopilación y Visualización de Respuestas:</strong>
              <Badge variant="outline" className="ml-2 border-gray-500 text-gray-600">Pendiente</Badge>
              <p className="text-xs pl-5">Se desarrollará una interfaz pública para que los clientes respondan y una sección en el CRM para ver las respuestas.</p>
            </li>
            <li>
              <strong>Cálculo de Métricas (CSAT/NPS) e Informes:</strong>
              <Badge variant="outline" className="ml-2 border-gray-500 text-gray-600">Pendiente</Badge>
              <p className="text-xs pl-5">Se implementarán los cálculos de puntajes y la visualización de tendencias.</p>
            </li>
          </ul>
          <p className="mt-4 font-semibold">Las funcionalidades se implementarán progresivamente.</p>
        </CardContent>
      </Card>

    </div>
  );
}
