
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";import { useRouter } from 'next/navigation';
import type { ContactList, EmailCampaign, EmailTemplate, Contact, EmailCampaignAnalytics, EmailCampaignStatus } from "@/lib/types";
import { NAV_ITEMS } from "@/lib/constants";
import { Send, Users, FileText as TemplateIcon, PlusCircle, Construction, Import, SlidersHorizontal, FileSignature, LucideIcon, Palette, ListChecks, BarChart2, TestTube2, Clock, Search, Filter as FilterIcon, CalendarIcon, Eraser, Beaker } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, query, orderBy, Timestamp, setDoc, where, updateDoc, writeBatch, arrayRemove, onSnapshot } from "firebase/firestore";
import { AddEditContactListDialog } from "@/components/email-campaigns/add-edit-contact-list-dialog";
import { ContactListItem } from "@/components/email-campaigns/contact-list-item";
import { ManageContactsDialog } from "@/components/email-campaigns/manage-contacts-dialog";
import { AddEditEmailTemplateDialog } from "@/components/email-campaigns/add-edit-email-template-dialog";
import { EmailTemplateItem } from "@/components/email-campaigns/email-template-item";
import { AddEditEmailCampaignDialog } from "@/components/email-campaigns/add-edit-email-campaign-dialog";
import { PreviewEmailTemplateDialog } from "@/components/email-campaigns/preview-email-template-dialog";
import { EmailCampaignItem } from "@/components/email-campaigns/email-campaign-item";
import { EmailCampaignAnalyticsDialog } from "@/components/email-campaigns/email-campaign-analytics-dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { parseISO, isValid, isBefore, isEqual, startOfDay, endOfDay, format } from "date-fns";
import { es } from 'date-fns/locale';
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";


// Helper type from AddEditEmailCampaignDialog for campaignDataFromDialog
type EmailCampaignFormValues = {
  name: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  contactListId: string;
  emailTemplateId: string;
  scheduledDate?: Date;
  scheduledHour?: string;
  scheduledMinute?: string;
  abTest?: {
    isEnabled: boolean;
    variantBSubject?: string;
    variantBEmailTemplateId?: string;
    splitPercentage?: number;
    winnerCriteria?: string;
    testDurationHours?: number;
  }
};

const ITEMS_PER_PAGE = 12; // 4 filas de 3 campañas

export default function EmailCampaignsPage() {
  const router = useRouter();
  const navItem = NAV_ITEMS.flatMap(item => item.subItems || item).find(item => item.href === '/email-campaigns');
  const PageIcon = navItem?.icon || Send;

  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);
  const [isLoadingContactLists, setIsLoadingContactLists] = useState(true);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);

  const [isContactListDialogOpen, setIsContactListDialogOpen] = useState(false);
  const [isManageContactsDialogOpen, setIsManageContactsDialogOpen] = useState(false);
  const [selectedListForContacts, setSelectedListForContacts] = useState<ContactList | null>(null);
  const [listToDelete, setListToDelete] = useState<ContactList | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<EmailTemplate | null>(null);
  const [isDeleteTemplateDialogOpen, setIsDeleteTemplateDialogOpen] = useState(false);
  const [isPreviewTemplateDialogOpen, setIsPreviewTemplateDialogOpen] = useState(false);
  const [templateToPreview, setTemplateToPreview] = useState<EmailTemplate | null>(null);


  const [isCampaignDialogOpen, setIsCampaignDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<EmailCampaign | null>(null);
  const [campaignToDelete, setCampaignToDelete] = useState<EmailCampaign | null>(null);
  const [isDeleteCampaignDialogOpen, setIsDeleteCampaignDialogOpen] = useState(false);

  const [isAnalyticsDialogOpen, setIsAnalyticsDialogOpen] = useState(false);
  const [selectedCampaignForAnalytics, setSelectedCampaignForAnalytics] = useState<EmailCampaign | null>(null);

  // State for filters and pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [createdAfter, setCreatedAfter] = useState<Date | undefined>(undefined);
  const [createdBefore, setCreatedBefore] = useState<Date | undefined>(undefined);
  const [sentAfter, setSentAfter] = useState<Date | undefined>(undefined);
  const [sentBefore, setSentBefore] = useState<Date | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);

  const { toast } = useToast();
  const { currentUser, loading, hasPermission } = useAuth();

  const fetchContactLists = useCallback(async () => {
    setIsLoadingContactLists(true);
    try {
      const q = query(collection(db, "contactLists"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedLists = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          contactCount: data.contactCount || 0,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        } as ContactList;
      });
      setContactLists(fetchedLists);
    } catch (error) {
      console.error("Error al obtener listas de contactos:", error);
      toast({ title: "Error al Cargar Listas", description: "No se pudieron cargar las listas de contactos.", variant: "destructive" });
    } finally {
      setIsLoadingContactLists(false);
    }
  }, [toast]);

  const fetchAllContacts = useCallback(async () => {
    setIsLoadingContacts(true);
    try {
        const q = query(collection(db, "contacts"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedContacts = querySnapshot.docs.map(docSnap => {
            const data = docSnap.data();
            const createdAtRaw = data.createdAt;
            let createdAtISO = new Date().toISOString();
            if (createdAtRaw instanceof Timestamp) {
                createdAtISO = createdAtRaw.toDate().toISOString();
            } else if (typeof createdAtRaw === 'string' && isValid(parseISO(createdAtRaw))) {
                createdAtISO = createdAtRaw;
            }

            return {
                id: docSnap.id,
                ...data,
                createdAt: createdAtISO,
                subscribed: data.subscribed === undefined ? true : data.subscribed, 
            } as Contact;
        });
        setContacts(fetchedContacts);
    } catch (error) {
        console.error("Error al obtener todos los contactos:", error);
        toast({ title: "Error al Cargar Contactos", description: "No se pudieron cargar los contactos generales.", variant: "destructive" });
    } finally {
      setIsLoadingContacts(false);
    }
  }, [toast]);

  const fetchTemplates = useCallback(async () => {
    setIsLoadingTemplates(true);
    try {
      const q = query(collection(db, "emailTemplates"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedTemplates = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: (docSnap.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: (docSnap.data().updatedAt as Timestamp)?.toDate().toISOString() || undefined,
      } as EmailTemplate));
      setTemplates(fetchedTemplates);
    } catch (error) {
      console.error("Error al obtener plantillas:", error);
      toast({ title: "Error al Cargar Plantillas", variant: "destructive" });
    } finally {
      setIsLoadingTemplates(false);
    }
  }, [toast]);


  useEffect(() => {
    fetchContactLists();
  }, [fetchContactLists]);

  useEffect(() => {
    fetchAllContacts();
  }, [fetchAllContacts]);

  useEffect(() => {
    fetchAllContacts();
    fetchTemplates();

    let unsubscribeCampaigns: (() => void) | undefined;

    if (currentUser) {
      setIsLoadingCampaigns(true);
      const q = query(collection(db, "emailCampaigns"), orderBy("createdAt", "desc"));
      unsubscribeCampaigns = onSnapshot(q, (querySnapshot) => {
        const fetchedCampaigns = querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          
          const parseTimestampToISO = (timestamp: any): string | undefined => {
            if (!timestamp) return undefined;
            if (timestamp instanceof Timestamp) {
              return timestamp.toDate().toISOString();
            }
            if (typeof timestamp === 'string') {
              const parsedDate = parseISO(timestamp);
              if (isValid(parsedDate)) {
                  return parsedDate.toISOString();
              }
            }
             // Fallback or log error if format is unexpected
            console.warn(`Invalid date format for campaign ${docSnap.id}:`, timestamp);
            return undefined;
          };

          const analyticsData = data.analytics || {};
          
          const processedUniqueOpens = Array.isArray(analyticsData.uniqueOpens) 
                                       ? analyticsData.uniqueOpens.length 
                                       : (typeof analyticsData.uniqueOpens === 'number' ? analyticsData.uniqueOpens : 0);
          const processedUniqueClicks = Array.isArray(analyticsData.uniqueClicks) 
                                        ? analyticsData.uniqueClicks.length 
                                        : (typeof analyticsData.uniqueClicks === 'number' ? analyticsData.uniqueClicks : 0);


          return {
            id: docSnap.id,
            ...data,
            createdAt: parseTimestampToISO(data.createdAt) || new Date(0).toISOString(), 
            updatedAt: parseTimestampToISO(data.updatedAt),
            scheduledAt: parseTimestampToISO(data.scheduledAt),
            sentAt: parseTimestampToISO(data.sentAt),
            analytics: {
              totalRecipients: analyticsData.totalRecipients || 0,
              emailsSent: analyticsData.emailsSent || 0,
              emailsDelivered: analyticsData.emailsDelivered || 0,
              emailsOpened: analyticsData.emailsOpened || 0, // Use this for total opens
              uniqueOpens: processedUniqueOpens, // Store the count
              emailsClicked: analyticsData.emailsClicked || 0, // Use this for total clicks
              uniqueClicks: processedUniqueClicks, // Store the count
              bounceCount: analyticsData.bounceCount || 0,
              unsubscribeCount: analyticsData.unsubscribeCount || 0,
              spamReports: analyticsData.spamReports || 0,
            },
            abTest: data.abTest || null,
          } as EmailCampaign;
        });
        setCampaigns(fetchedCampaigns);
        setIsLoadingCampaigns(false);
      }, (error) => {
        console.error("Error al obtener campañas en tiempo real:", error);
        toast({ title: "Error al Cargar Campañas", variant: "destructive" });
        setIsLoadingCampaigns(false);
      });
    } else {
      setIsLoadingCampaigns(false);
      setCampaigns([]);
    }

    return () => {
      if (unsubscribeCampaigns) {
        unsubscribeCampaigns();
      }
    };
  }, [currentUser, toast, fetchTemplates]);

  // Permission check effect
 useEffect(() => {
    if (!loading && (!currentUser || !hasPermission('ver-campañas-correo'))) {
      router.push('/access-denied');
    }
 }, [currentUser, loading, hasPermission, router]);


  const handleSaveContactList = async (listData: Omit<ContactList, 'id' | 'createdAt' | 'contactCount'>) => {
    try {
      await addDoc(collection(db, "contactLists"), {
        ...listData,
        contactCount: 0,
        createdAt: serverTimestamp(),
      });
      toast({ title: "Lista Creada", description: `La lista "${listData.name}" ha sido creada exitosamente.` });
      fetchContactLists();
      return true;
    } catch (error) {
      console.error("Error al crear lista de contactos:", error);
      toast({ title: "Error al Crear Lista", variant: "destructive" });
      return false;
    }
  };

  const confirmDeleteList = (list: ContactList) => {
    setListToDelete(list);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteContactList = async () => {
    if (!listToDelete) return;
    try {
      const contactsQuery = query(collection(db, "contacts"), where("listIds", "array-contains", listToDelete.id));
      const contactsSnapshot = await getDocs(contactsQuery);
      const batch = writeBatch(db);
      contactsSnapshot.forEach(contactDoc => {
          batch.update(contactDoc.ref, {
              listIds: arrayRemove(listToDelete.id)
          });
      });
      await batch.commit();

      await deleteDoc(doc(db, "contactLists", listToDelete.id));
      toast({ title: "Lista Eliminada", description: `La lista "${listToDelete.name}" ha sido eliminada.` });
      fetchContactLists();
      fetchAllContacts(); 
    } catch (error) {
      console.error("Error al eliminar lista de contactos:", error);
      toast({ title: "Error al Eliminar Lista", variant: "destructive" });
    } finally {
        setIsDeleteDialogOpen(false);
        setListToDelete(null);
    }
  };

  const handleOpenManageContacts = (list: ContactList) => {
    setSelectedListForContacts(list);
    setIsManageContactsDialogOpen(true);
  };

  const handleSaveTemplate = async (templateData: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => {
    try {
      const docRefId = id || doc(collection(db, "emailTemplates")).id;
      await setDoc(doc(db, "emailTemplates", docRefId), {
        ...templateData,
        [id ? 'updatedAt' : 'createdAt']: serverTimestamp(), 
        ...(id && {updatedAt: serverTimestamp()}) 
      }, { merge: !!id });
      toast({ title: id ? "Plantilla Actualizada" : "Plantilla Creada", description: `Plantilla "${templateData.name}" guardada.` });
      fetchTemplates();
      return true;
    } catch (error) {
      console.error("Error al guardar plantilla:", error);
      toast({ title: "Error al Guardar Plantilla", variant: "destructive" });
      return false;
    }
  };

  const confirmDeleteTemplate = (template: EmailTemplate) => {
    setTemplateToDelete(template);
    setIsDeleteTemplateDialogOpen(true);
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;
    try {
      await deleteDoc(doc(db, "emailTemplates", templateToDelete.id));
      toast({ title: "Plantilla Eliminada", description: `La plantilla "${templateToDelete.name}" fue eliminada.` });
      fetchTemplates();
    } catch (error) {
      console.error("Error al eliminar plantilla:", error);
      toast({ title: "Error al Eliminar Plantilla", variant: "destructive" });
    } finally {
      setIsDeleteTemplateDialogOpen(false);
      setTemplateToDelete(null);
    }
  };

  const handlePreviewTemplate = (template: EmailTemplate) => {
    setTemplateToPreview(template);
    setIsPreviewTemplateDialogOpen(true);
  };

  const handleSaveCampaign = async (
    campaignDataFromForm: Omit<EmailCampaignFormValues, 'scheduledDate' | 'scheduledHour' | 'scheduledMinute'> & { scheduledAt?: string },
    id?: string
  ) => {
    setIsCampaignDialogOpen(false); 
    toast({ title: "Guardando Campaña...", description: "Por favor espera." });

    try {
      const docRefId = id || doc(collection(db, "emailCampaigns")).id;
      const existingCampaign = id ? campaigns.find(c => c.id === id) : null;

      const initialAnalytics: EmailCampaignAnalytics = {
        totalRecipients: 0, emailsSent: 0, emailsDelivered: 0, emailsOpened: 0, uniqueOpens: 0,
        emailsClicked: 0, uniqueClicks: 0, bounceCount: 0, unsubscribeCount: 0, spamReports: 0,
      };

      let determinedStatus: EmailCampaignStatus = 'Borrador';
      let effectiveScheduledAt: Timestamp | null = null;
      let effectiveSentAt: Timestamp | null = (existingCampaign?.sentAt && isValid(parseISO(existingCampaign.sentAt))) ? Timestamp.fromDate(parseISO(existingCampaign.sentAt)) : null;

      if (campaignDataFromForm.scheduledAt) {
        const scheduledDateObj = parseISO(campaignDataFromForm.scheduledAt); // This is already UTC
        if (isValid(scheduledDateObj)) {
          effectiveScheduledAt = Timestamp.fromDate(scheduledDateObj);
          const now = new Date();
          
          // Check if scheduled time is in the past or within the next minute
          if (isBefore(scheduledDateObj, new Date(now.getTime() + 60000))) { 
            if (existingCampaign?.status !== 'Enviada' && existingCampaign?.status !== 'Enviando') {
                determinedStatus = 'Enviando';
            } else if (existingCampaign?.status) {
                determinedStatus = existingCampaign.status;
            }
          } else if (isBefore(now, scheduledDateObj)) { 
            determinedStatus = 'Programada';
            effectiveSentAt = null; 
          } else if (existingCampaign?.status) {
             determinedStatus = existingCampaign.status === 'Borrador' ? 'Fallida' : existingCampaign.status;
          }
        }
      } else {
         if (existingCampaign?.status && existingCampaign.status !== 'Borrador') {
            determinedStatus = existingCampaign.status;
         } else {
            determinedStatus = 'Borrador';
         }
         effectiveSentAt = null;
      }

      const dataToSave: any = {
        ...campaignDataFromForm,
        analytics: existingCampaign?.analytics || initialAnalytics, 
        updatedAt: serverTimestamp(),
        status: determinedStatus,
        scheduledAt: effectiveScheduledAt,
        sentAt: effectiveSentAt,
        abTest: campaignDataFromForm.abTest?.isEnabled ? campaignDataFromForm.abTest : null,
      };

      if (!id) {
        dataToSave.createdAt = serverTimestamp();
      } else {
        dataToSave.createdAt = (existingCampaign?.createdAt && isValid(parseISO(existingCampaign.createdAt))) ? Timestamp.fromDate(parseISO(existingCampaign.createdAt)) : serverTimestamp();
      }

      await setDoc(doc(db, "emailCampaigns", docRefId), dataToSave, { merge: true });

      let toastMessage = `Campaña "${campaignDataFromForm.name}" guardada con estado: ${dataToSave.status}.`;
      if (dataToSave.status === 'Enviando') {
        toastMessage += " La campaña se está procesando para su envío por la Cloud Function.";
      } else if (dataToSave.status === 'Programada' && effectiveScheduledAt) {
        toastMessage += ` Programada para: ${format(effectiveScheduledAt.toDate(), "PPp", {locale: es})}.`;
      } else if (dataToSave.status === 'Borrador') {
         toastMessage += " La campaña está en borrador.";
      }

      toast({ title: id ? "Campaña Actualizada" : "Campaña Creada", description: toastMessage, duration: 7000 });
      return true;
    } catch (error) {
      console.error("Error al guardar campaña:", error);
      toast({ title: "Error al Guardar Campaña", variant: "destructive", description: String(error) });
      return false;
    }
  };


  const confirmDeleteCampaign = (campaign: EmailCampaign) => {
    setCampaignToDelete(campaign);
    setIsDeleteCampaignDialogOpen(true);
  };

  const handleDeleteCampaign = async () => {
    if (!campaignToDelete) return;
    try {
      await deleteDoc(doc(db, "emailCampaigns", campaignToDelete.id));
      toast({ title: "Campaña Eliminada", description: `La campaña "${campaignToDelete.name}" fue eliminada.` });
    } catch (error) {
      console.error("Error al eliminar campaña:", error);
      toast({ title: "Error al Eliminar Campaña", variant: "destructive" });
    } finally {
      setIsDeleteCampaignDialogOpen(false);
      setCampaignToDelete(null);
    }
  };

  const handleViewAnalytics = (campaign: EmailCampaign) => {
    setSelectedCampaignForAnalytics(campaign);
    setIsAnalyticsDialogOpen(true);
  };

  const renderPlaceHolderContent = (title: string, features: string[], Icon?: LucideIcon, implemented: boolean = false, partiallyImplemented: boolean = false) => (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          {Icon ? <Icon className={`h-5 w-5 ${implemented ? 'text-green-500' : (partiallyImplemented ? 'text-yellow-500' : 'text-primary')}`} /> : <Construction className="h-5 w-5 text-amber-500" />}
          {title}
        </CardTitle>
        <CardDescription>{implemented ? "Funcionalidad implementada." : (partiallyImplemented ? "Funcionalidad parcialmente implementada." : "Esta sección está planificada y se implementará próximamente.")}</CardDescription>
      </CardHeader>
      <CardContent>
        <h4 className="font-semibold mb-2">Funcionalidades {implemented ? 'Implementadas' : (partiallyImplemented ? 'Actuales/Planeadas' : 'Planeadas')}:</h4>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm">
          {features.map(feature => <li key={feature}>{feature}</li>)}
        </ul>
      </CardContent>
    </Card>
  );

  const filteredAndSortedCampaigns = useMemo(() => {
    return campaigns
      .filter(campaign => {
        const searchTermLower = searchTerm.toLowerCase();
        const nameMatch = campaign.name.toLowerCase().includes(searchTermLower);
        const subjectMatch = campaign.subject.toLowerCase().includes(searchTermLower);
        
        let dateCreatedMatch = true;
        if (createdAfter) {
          const campaignCreatedAt = parseISO(campaign.createdAt);
          if (!isValid(campaignCreatedAt) || isBefore(campaignCreatedAt, startOfDay(createdAfter))) {
            dateCreatedMatch = false;
          }
        }
        if (createdBefore && dateCreatedMatch) {
          const campaignCreatedAt = parseISO(campaign.createdAt);
          if (!isValid(campaignCreatedAt) || isAfter(campaignCreatedAt, endOfDay(createdBefore))) {
            dateCreatedMatch = false;
          }
        }

        let dateSentMatch = true;
        if (sentAfter || sentBefore) { 
          if (!campaign.sentAt || !isValid(parseISO(campaign.sentAt))) {
            dateSentMatch = false; 
          } else {
            const campaignSentAt = parseISO(campaign.sentAt);
            if (sentAfter && isBefore(campaignSentAt, startOfDay(sentAfter))) {
              dateSentMatch = false;
            }
            if (sentBefore && dateSentMatch && isAfter(campaignSentAt, endOfDay(sentBefore))) {
              dateSentMatch = false;
            }
          }
        }
        return (nameMatch || subjectMatch) && dateCreatedMatch && dateSentMatch;
      });
  }, [campaigns, searchTerm, createdAfter, createdBefore, sentAfter, sentBefore]);

  useEffect(() => {
    setCurrentPage(1); 
  }, [filteredAndSortedCampaigns.length]);


  const totalPages = Math.ceil(filteredAndSortedCampaigns.length / ITEMS_PER_PAGE);
  const paginatedCampaigns = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredAndSortedCampaigns.slice(startIndex, endIndex);
  }, [filteredAndSortedCampaigns, currentPage]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setCreatedAfter(undefined);
    setCreatedBefore(undefined);
    setSentAfter(undefined);
    setSentBefore(undefined);
    setCurrentPage(1);
  };


  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <PageIcon className="h-6 w-6 text-primary" />
            {navItem?.label || "Campañas de Email Marketing"}
          </CardTitle>
          <CardDescription>
            Gestiona tus campañas de email marketing, segmenta listas, envía correos masivos y utiliza plantillas personalizables.
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="campaigns" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="campaigns">
            <Send className="mr-2 h-4 w-4" /> Campañas
          </TabsTrigger>
          <TabsTrigger value="contact-lists">
            <Users className="mr-2 h-4 w-4" /> Listas y Contactos
          </TabsTrigger>
          <TabsTrigger value="templates">
            <TemplateIcon className="mr-2 h-4 w-4" /> Plantillas
          </TabsTrigger>
        </TabsList>

        {/* CAMPAIGNS TAB */}
        <TabsContent value="campaigns">
          <Card className="mt-4">
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
                <h3 className="text-xl font-semibold">Gestión de Campañas</h3>
                <AddEditEmailCampaignDialog
                  trigger={
                    <Button onClick={() => { setEditingCampaign(null); setIsCampaignDialogOpen(true); }} disabled={isLoadingContactLists || isLoadingTemplates}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Nueva Campaña
                    </Button>
                  }
                  isOpen={isCampaignDialogOpen}
                  onOpenChange={setIsCampaignDialogOpen}
                  onSave={handleSaveCampaign}
                  campaignToEdit={editingCampaign}
                  contactLists={contactLists}
                  emailTemplates={templates}
                />
              </div>
              {/* Filters */}
              <div className="space-y-4 p-4 border rounded-md bg-muted/50 mb-6">
                <div className="flex items-center gap-2">
                    <FilterIcon className="h-5 w-5 text-muted-foreground" />
                    <h4 className="font-semibold">Filtros de Campaña</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Buscar por nombre o asunto..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !createdAfter && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />{createdAfter ? format(createdAfter, "PPP", {locale: es}) : <span>Creada Desde</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={createdAfter} onSelect={setCreatedAfter} initialFocus /></PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !createdBefore && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />{createdBefore ? format(createdBefore, "PPP", {locale: es}) : <span>Creada Hasta</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={createdBefore} onSelect={setCreatedBefore} initialFocus /></PopoverContent>
                  </Popover>
                   <Popover>
                    <PopoverTrigger asChild>
                      <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !sentAfter && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />{sentAfter ? format(sentAfter, "PPP", {locale: es}) : <span>Enviada Desde</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={sentAfter} onSelect={setSentAfter} initialFocus /></PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !sentBefore && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />{sentBefore ? format(sentBefore, "PPP", {locale: es}) : <span>Enviada Hasta</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={sentBefore} onSelect={setSentBefore} initialFocus /></PopoverContent>
                  </Popover>
                  <Button onClick={handleClearFilters} variant="ghost" className="text-muted-foreground hover:text-primary lg:col-start-3">
                    <Eraser className="mr-2 h-4 w-4" /> Limpiar Filtros
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingCampaigns ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(ITEMS_PER_PAGE)].map((_, i) => <Skeleton key={i} className="h-56 w-full" />)}
                </div>
              ) : paginatedCampaigns.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginatedCampaigns.map(campaign => (
                    <EmailCampaignItem
                      key={campaign.id}
                      campaign={campaign}
                      onEdit={() => { setEditingCampaign(campaign); setIsCampaignDialogOpen(true); }}
                      onDelete={() => confirmDeleteCampaign(campaign)}
                      onViewAnalytics={handleViewAnalytics}
                    />
                  ))}
                </div>
              ) : (
                <Card className="col-span-full">
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    <Send className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-lg font-medium">
                      {searchTerm || createdAfter || createdBefore || sentAfter || sentBefore ? "No se encontraron campañas con los filtros aplicados." : "No hay campañas todavía."}
                    </p>
                    <p>
                      {searchTerm || createdAfter || createdBefore || sentAfter || sentBefore ? "Intenta ajustar tus filtros o " : ""}
                      Crea tu primera campaña para comunicarte con tus contactos.
                    </p>
                  </CardContent>
                </Card>
              )}
              {totalPages > 1 && (
                <div className="flex items-center justify-center space-x-2 mt-6 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Siguiente
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          {renderPlaceHolderContent("Funciones Avanzadas de Campaña", [
                "Envío por Cloud Functions (Implementado).",
                "Programación de envíos con hora específica (Implementado).",
                "Analíticas básicas: destinatarios, enviados (Implementado, vía Cloud Function).",
                "Detalles de analíticas: aperturas, clics, rebotes (Implementado, vía Webhook SendGrid).",
                "Pruebas A/B para asuntos y contenido (Configuración UI Implementada. Lógica de ejecución y análisis avanzado pendiente).",
            ], Send, false, true)}
        </TabsContent>

        {/* CONTACT LISTS TAB */}
        <TabsContent value="contact-lists">
          <div className="flex justify-between items-center my-4">
            <h3 className="text-xl font-semibold">Listas de Contactos</h3>
            <AddEditContactListDialog
                trigger={
                    <Button onClick={() => setIsContactListDialogOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Nueva Lista de Contactos
                    </Button>
                }
                isOpen={isContactListDialogOpen}
                onOpenChange={setIsContactListDialogOpen}
                onSave={handleSaveContactList}
            />
          </div>
          {isLoadingContactLists ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : contactLists.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contactLists.map(list => (
                <ContactListItem
                  key={list.id}
                  list={list}
                  onDelete={() => confirmDeleteList(list)}
                  onManageContacts={() => handleOpenManageContacts(list)}
                />
              ))}
            </div>
          ) : (
            <Card className="mt-6 col-span-full">
              <CardContent className="pt-6 text-center text-muted-foreground">
                <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg font-medium">No hay listas de contactos todavía.</p>
                <p>Crea tu primera lista para empezar a organizar tus contactos.</p>
                 <AddEditContactListDialog
                    trigger={
                        <Button className="mt-4" onClick={() => setIsContactListDialogOpen(true)}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Crear Lista
                        </Button>
                    }
                    isOpen={isContactListDialogOpen}
                    onOpenChange={setIsContactListDialogOpen}
                    onSave={handleSaveContactList}
                />
              </CardContent>
            </Card>
          )}
           <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
             {renderPlaceHolderContent("Importar/Exportar", ["Importación y exportación de contactos (CSV) (Próximamente)."], Import, false)}
             {renderPlaceHolderContent("Segmentación y Gestión", ["Gestión individual de contactos (Crear, Editar, Eliminar de lista - Implementado).", "Segmentación basada en etiquetas, actividad o campos personalizados (Próximamente)."], SlidersHorizontal, true)}
             {renderPlaceHolderContent("Formularios Suscripción", ["Formularios de suscripción/desuscripción (Próximamente)."], FileSignature, false)}
           </div>
        </TabsContent>

        {/* TEMPLATES TAB */}
        <TabsContent value="templates">
           <div className="flex justify-between items-center my-4">
            <h3 className="text-xl font-semibold">Plantillas de Correo</h3>
             <AddEditEmailTemplateDialog
                trigger={
                    <Button onClick={() => { setEditingTemplate(null); setIsTemplateDialogOpen(true); }}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Nueva Plantilla
                    </Button>
                }
                isOpen={isTemplateDialogOpen}
                onOpenChange={setIsTemplateDialogOpen}
                onSave={handleSaveTemplate}
                templateToEdit={editingTemplate}
            />
          </div>
          {isLoadingTemplates ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
            </div>
          ) : templates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map(template => (
                <EmailTemplateItem
                    key={template.id}
                    template={template}
                    onEdit={() => { setEditingTemplate(template); setIsTemplateDialogOpen(true); }}
                    onDelete={() => confirmDeleteTemplate(template)}
                    onPreview={handlePreviewTemplate}
                />
              ))}
            </div>
          ) : (
             <Card className="mt-6 col-span-full">
                <CardContent className="pt-6 text-center text-muted-foreground">
                    <TemplateIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-lg font-medium">No hay plantillas todavía.</p>
                    <p>Crea tu primera plantilla para agilizar tus envíos de correo.</p>
                    <AddEditEmailTemplateDialog
                        trigger={
                            <Button className="mt-4" onClick={() => { setEditingTemplate(null); setIsTemplateDialogOpen(true); }}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Crear Plantilla
                            </Button>
                        }
                        isOpen={isTemplateDialogOpen}
                        onOpenChange={setIsTemplateDialogOpen}
                        onSave={handleSaveTemplate}
                        templateToEdit={editingTemplate}
                    />
                </CardContent>
             </Card>
          )}
          {renderPlaceHolderContent("Editor Avanzado y Previsualización", [
                "Editor visual (arrastrar y soltar) (Próximamente).",
                "Opción para importar/editar HTML directamente (Implementado).",
                "Biblioteca de plantillas pre-diseñadas (Implementado).",
                "Personalización con variables (ej. {{nombre_contacto}}) (Implementado, se aplica en Cloud Function).",
                "Previsualización en escritorio y móvil (Implementado).",
             ], Palette, true)}
        </TabsContent>
      </Tabs>

      {/* Dialogs for Deletion Confirmation */}
      {listToDelete && (
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                  Esta acción no se puede deshacer. Esto eliminará permanentemente la lista de contactos &quot;{listToDelete.name}&quot;.
                  Los contactos asociados no serán eliminados de la base de datos general, solo la asociación a esta lista.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setListToDelete(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteContactList} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Sí, eliminar lista
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

       {templateToDelete && (
        <AlertDialog open={isDeleteTemplateDialogOpen} onOpenChange={setIsDeleteTemplateDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar Plantilla?</AlertDialogTitle>
              <AlertDialogDescription>
                  Esto eliminará permanentemente la plantilla &quot;{templateToDelete.name}&quot;. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setTemplateToDelete(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteTemplate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {campaignToDelete && (
        <AlertDialog open={isDeleteCampaignDialogOpen} onOpenChange={setIsDeleteCampaignDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar Campaña?</AlertDialogTitle>
              <AlertDialogDescription>
                  Esto eliminará permanentemente la campaña &quot;{campaignToDelete.name}&quot;. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setCampaignToDelete(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteCampaign} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Manage Contacts Dialog */}
      {selectedListForContacts && (
        <ManageContactsDialog
            isOpen={isManageContactsDialogOpen}
            onOpenChange={setIsManageContactsDialogOpen}
            list={selectedListForContacts}
            allContacts={contacts}
            onContactsUpdated={() => { fetchAllContacts(); fetchContactLists(); }}
        />
      )}
       {/* Preview Template Dialog */}
      <PreviewEmailTemplateDialog
        template={templateToPreview}
        isOpen={isPreviewTemplateDialogOpen}
        onOpenChange={setIsPreviewTemplateDialogOpen}
      />
      {/* Analytics Dialog */}
      <EmailCampaignAnalyticsDialog
        campaign={selectedCampaignForAnalytics}
        isOpen={isAnalyticsDialogOpen}
        onOpenChange={setIsAnalyticsDialogOpen}
      />
    </div>
  );
}
    
