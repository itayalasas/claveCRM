
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Task, Lead, User } from "@/lib/types";
import { NAV_ITEMS } from "@/lib/constants"; 
import { TaskItem } from "@/components/tasks/task-item";
import { AddEditTaskDialog } from "@/components/tasks/add-edit-task-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Search, Filter, ListChecks } from "lucide-react"; // Reemplazado el icono por defecto si no se encuentra
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, orderBy, where, Timestamp, writeBatch } from "firebase/firestore";
import { addMonths, setDate, startOfMonth, format, parseISO } from "date-fns";
import { es } from 'date-fns/locale';
import { logSystemEvent } from "@/lib/auditLogger";
import { useRouter } from "next/navigation"; 
import { getAllUsers } from "@/lib/userUtils"; // <-- AÑADIDO: Importar la nueva función

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]); 
  const [users, setUsers] = useState<User[]>([]);
  
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "completed">("all");
  const [filterPriority, setFilterPriority] = useState<"all" | Task['priority']>("all");

  const tasksNavItem = NAV_ITEMS.flatMap(item => item.subItems || item).find(item => item.href === '/tasks');
  const PageIcon = tasksNavItem?.icon || ListChecks; // Usar un icono por defecto si no se encuentra
  
  // CAMBIO: getAllUsers eliminado de useAuth()
  const { currentUser, loading: authLoading, hasPermission } = useAuth(); 
  const router = useRouter(); 
  const { toast } = useToast();

  const fetchTasks = useCallback(async () => {
    if (!currentUser) { 
      setIsLoadingTasks(false);
      return;
    }
    setIsLoadingTasks(true);
    try {
      const tasksCollectionRef = collection(db, "tasks");
      const q = query(tasksCollectionRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedTasks = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          title: data.title as string,
          description: data.description as string | undefined,
          createdAt: (data.createdAt instanceof Timestamp) ? data.createdAt.toDate().toISOString() : (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString()),
          dueDate: (data.dueDate instanceof Timestamp) ? data.dueDate.toDate().toISOString() : (typeof data.dueDate === 'string' ? data.dueDate : undefined),
          completed: data.completed as boolean,
          relatedLeadId: data.relatedLeadId as string | undefined,
          priority: data.priority as Task['priority'] | undefined,
          assigneeUserId: data.assigneeUserId as string | undefined,
          reporterUserId: data.reporterUserId as string,
          solutionDescription: data.solutionDescription as string | undefined,
          attachments: data.attachments as { name: string, url: string }[] | undefined,
          isMonthlyRecurring: data.isMonthlyRecurring as boolean | undefined,
        } as Task;
      });
      setTasks(fetchedTasks);
    } catch (error) {
      console.error("Error al obtener tareas:", error);
      toast({
        title: "Error al Cargar Tareas",
        description: "No se pudieron cargar las tareas desde la base de datos.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingTasks(false);
    }
  }, [currentUser, toast]);

  const fetchLeads = useCallback(async () => {
    setIsLoadingLeads(true);
    try {
      const leadsCollectionRef = collection(db, "leads");
      const querySnapshot = await getDocs(leadsCollectionRef);
      const fetchedLeads = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as Lead));
      setLeads(fetchedLeads);
    } catch (error) {
      console.error("Error al obtener leads:", error);
      toast({
        title: "Error al Cargar Leads",
        description: "No se pudieron cargar los datos de los leads.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingLeads(false);
    }
  }, [toast]);

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const fetchedUsers = await getAllUsers(); // CAMBIO: Usa la función importada
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error al obtener usuarios para la página de tareas:", error);
      toast({
        title: "Error al Cargar Usuarios",
        description: "No se pudieron cargar los datos de los usuarios para la asignación de tareas.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingUsers(false);
    }
  }, [toast]); // CAMBIO: getAllUsers eliminado de dependencias

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !hasPermission('ver-tareas')) {
        router.push('/access-denied');
        return; 
      }
      fetchUsers();
      fetchLeads();
      fetchTasks();
    } else if (!authLoading && !currentUser) {
        setTasks([]);
        setIsLoadingTasks(false);
        setLeads([]);
        setIsLoadingLeads(false);
        setUsers([]);
        setIsLoadingUsers(false);
    }
  // CAMBIO: fetchUsers ya no cambia su referencia innecesariamente
  }, [authLoading, currentUser, hasPermission, router, fetchUsers, fetchLeads, fetchTasks]);

  const handleSaveTask = async (taskData: Task) => {
    if (!currentUser) {
      toast({ title: "Error", description: "Usuario no autenticado.", variant: "destructive" });
      return;
    }
    setIsSubmittingTask(true);
    const isEditing = !!taskData.id && tasks.some(t => t.id === taskData.id);
    const taskId = taskData.id || doc(collection(db, "tasks")).id; 
    const taskToSave: Task = {
      ...taskData, 
      id: taskId,
      solutionDescription: taskData.solutionDescription || "",
      attachments: taskData.attachments || [],
      isMonthlyRecurring: taskData.isMonthlyRecurring || false,
      reporterUserId: taskData.reporterUserId || currentUser.id,
      createdAt: taskData.createdAt || new Date().toISOString(),
    };
    try {
      const taskDocRef = doc(db, "tasks", taskId);
      const firestoreSafeTask = {
        ...taskToSave,
        createdAt: Timestamp.fromDate(new Date(taskToSave.createdAt)),
        dueDate: taskToSave.dueDate ? Timestamp.fromDate(new Date(taskToSave.dueDate)) : null,
      };
      await setDoc(taskDocRef, firestoreSafeTask, { merge: true }); 
      fetchTasks(); 
      toast({
        title: isEditing ? "Tarea Actualizada" : "Tarea Creada",
        description: `La tarea "${taskToSave.title}" ha sido ${isEditing ? 'actualizada' : 'creada'} exitosamente.`,
      });
      const actionType = isEditing ? 'update' : 'create';
      const actionDetails = isEditing ? 
        `Tarea "${taskToSave.title}" actualizada.` : 
        `Tarea "${taskToSave.title}" creada.`;
      await logSystemEvent(currentUser, actionType, 'Task', taskId, actionDetails);
      setEditingTask(null);
      setIsTaskDialogOpen(false);
    } catch (error) {
      console.error("Error al guardar tarea:", error);
      toast({
        title: "Error al Guardar Tarea",
        description: "Ocurrió un error al guardar la tarea.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const handleToggleComplete = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !currentUser) return;
    const updatedTask = { ...task, completed: !task.completed };
    const batch = writeBatch(db);
    try {
      const taskDocRef = doc(db, "tasks", taskId);
      batch.update(taskDocRef, { completed: updatedTask.completed });
      let newRecurringTaskInstance: Task | null = null;
      if (updatedTask.completed && task.isMonthlyRecurring && task.dueDate) {
          const originalDueDate = parseISO(task.dueDate);
          let nextMonthDate = addMonths(originalDueDate, 1);
          const nextDueDate = startOfMonth(nextMonthDate);
          const newTaskId = doc(collection(db, "tasks")).id;
          newRecurringTaskInstance = {
            ...task,
            id: newTaskId,
            createdAt: new Date().toISOString(),
            dueDate: nextDueDate.toISOString(),
            completed: false,
            solutionDescription: "", 
            attachments: [], 
          };
          const newRecurringTaskDocRef = doc(db, "tasks", newRecurringTaskInstance.id);
          const firestoreSafeNewRecurringTask = {
              ...newRecurringTaskInstance,
              createdAt: Timestamp.fromDate(new Date(newRecurringTaskInstance.createdAt)),
              dueDate: newRecurringTaskInstance.dueDate ? Timestamp.fromDate(new Date(newRecurringTaskInstance.dueDate)) : null,
          }
          batch.set(newRecurringTaskDocRef, firestoreSafeNewRecurringTask);
      }
      await batch.commit();
      fetchTasks(); 
      toast({
        title: "Tarea Actualizada",
        description: `La tarea "${task.title}" ha sido marcada como ${updatedTask.completed ? 'completada' : 'pendiente'}.`,
      });
      await logSystemEvent(currentUser, 'update', 'Task', taskId, `Estado de tarea "${task.title}" cambiado a ${updatedTask.completed ? 'completada' : 'pendiente'}.`);
      if (newRecurringTaskInstance && newRecurringTaskInstance.dueDate) {
        toast({
          title: "Tarea Recurrente Creada",
          description: `Nueva instancia de "${newRecurringTaskInstance.title}" creada para el ${format(parseISO(newRecurringTaskInstance.dueDate), "PP", {locale: es})}.`
        });
        await logSystemEvent(currentUser, 'create', 'Task', newRecurringTaskInstance.id, `Tarea recurrente "${newRecurringTaskInstance.title}" creada.`);
      }
    } catch (error) {
      console.error("Error al cambiar estado de tarea completa y/o crear recurrencia:", error);
      toast({
        title: "Error al Actualizar Tarea",
        description: "No se pudo actualizar el estado de la tarea y/o crear la recurrencia.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const taskToDelete = tasks.find(t => t.id === taskId);
    if (!taskToDelete || !currentUser) return;
    if (window.confirm(`¿Estás seguro de que quieres eliminar la tarea "${taskToDelete.title}"?`)) {
      try {
        const taskDocRef = doc(db, "tasks", taskId);
        await deleteDoc(taskDocRef);
        fetchTasks(); 
        toast({
          title: "Tarea Eliminada",
          description: `La tarea "${taskToDelete.title}" ha sido eliminada.`,
        });
        await logSystemEvent(currentUser, 'delete', 'Task', taskId, `Tarea "${taskToDelete.title}" eliminada.`);
      } catch (error) {
        console.error("Error al eliminar tarea:", error);
        toast({
          title: "Error al Eliminar Tarea",
          description: "Ocurrió un error al eliminar la tarea.",
          variant: "destructive",
        });
      }
    }
  };

  const filteredTasks = useMemo(() => {
    if (!currentUser) return []; 
    return tasks 
      .filter(task => { 
        // CAMBIO: Usar hasPermission para admin/supervisor o verificar si es reporter/assignee
        if (hasPermission('ver-todas-tareas') || hasPermission('admin_tasks')) { // Asumiendo un permiso general para ver todas las tareas
          return true;
        }
        return task.reporterUserId === currentUser.id || task.assigneeUserId === currentUser.id;
      })
      .filter(task => { 
        if (filterStatus === "pending") return !task.completed;
        if (filterStatus === "completed") return task.completed;
        return true;
      })
      .filter(task => { 
        if (filterPriority === "all") return true;
        return task.priority === filterPriority;
      })
      .filter(task => 
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      .sort((a, b) => Number(a.completed) - Number(b.completed) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [tasks, searchTerm, filterStatus, filterPriority, currentUser, hasPermission]);

  const openDialogForNewTask = () => {
    setEditingTask(null); 
    setIsTaskDialogOpen(true);
  };

  const openDialogForEditTask = (task: Task) => {
    setEditingTask(task);
    setIsTaskDialogOpen(true);
  };

   if (authLoading) {
    return (
        <div className="flex flex-col gap-6 w-full p-6 items-center justify-center h-screen">
            <Skeleton className="h-12 w-1/4 self-start" /> 
            <Skeleton className="h-8 w-full" /> 
            <Skeleton className="h-20 w-full" /> 
            <Skeleton className="h-20 w-full" /> 
            <Skeleton className="h-20 w-full" /> 
        </div>
    );
  }

  if (!currentUser || !hasPermission('ver-tareas')) {
    // El useEffect ya se encarga de la redirección.
    // Este es un fallback para el estado inicial antes de que el efecto se ejecute.
    return <div className="flex justify-center items-center h-screen w-full"><p>Verificando permisos...</p></div>;
  }

  const isLoading = isLoadingTasks || isLoadingUsers || isLoadingLeads; // isLoading ya no depende de authLoading aquí

  return (
    // CAMBIO: Añadido w-full
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold">{tasksNavItem?.label || "Gestión de Tareas"}</h2>
         <AddEditTaskDialog
            trigger={
              // CAMBIO: Usar hasPermission para el botón
              <Button onClick={openDialogForNewTask} disabled={isLoadingUsers || isSubmittingTask || isLoadingLeads || !hasPermission('crear-tarea')}>
                <PlusCircle className="mr-2 h-5 w-5" /> Añadir Tarea
              </Button>
            }
            isOpen={isTaskDialogOpen}
            onOpenChange={setIsTaskDialogOpen}
            taskToEdit={editingTask} 
            leads={leads} 
            users={users} 
            onSave={handleSaveTask}
            isSubmitting={isSubmittingTask}
            currentUser={currentUser}
          />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar tareas..."
            className="pl-8 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="flex gap-2">
          <Select value={filterPriority} onValueChange={(value: Task['priority'] | "all") => setFilterPriority(value)} disabled={isLoading}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filtrar por prioridad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las Prioridades</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="medium">Media</SelectItem>
              <SelectItem value="low">Baja</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={filterStatus} onValueChange={(value) => setFilterStatus(value as "all" | "pending" | "completed")}>
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-flex">
          <TabsTrigger value="all" disabled={isLoading}>Todas las Tareas</TabsTrigger>
          <TabsTrigger value="pending" disabled={isLoading}>Pendientes</TabsTrigger>
          <TabsTrigger value="completed" disabled={isLoading}>Completadas</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && tasks.length === 0 ? (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : filteredTasks.length > 0 ? (
        <div className="space-y-4">
          {filteredTasks.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              leads={leads}
              users={users}
              onToggleComplete={handleToggleComplete}
              onEdit={() => openDialogForEditTask(task)}
              onDelete={handleDeleteTask}
              // CAMBIO: Usar hasPermission para acciones en TaskItem
              canEditTask={hasPermission('editar-tarea')}
              canDeleteTask={hasPermission('eliminar-tarea')}
              canCompleteTask={hasPermission('completar-tarea')}
              canAssignTask={hasPermission('asignar-tarea')} 
              currentUser={currentUser} // Pasar currentUser a TaskItem para lógica de asignación/edición
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-muted-foreground">
          <p className="text-lg">No se encontraron tareas.</p>
          <p>Intenta ajustar tus filtros o añade una nueva tarea.</p>
        </div>
      )}
    </div>
  );
}
