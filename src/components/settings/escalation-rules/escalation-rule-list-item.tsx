"use client";

import type { EscalationRule, User, SupportQueue, TicketPriority } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClockIcon, Edit3, Trash2, AlertTriangle, CheckCircle, UserCircle, LayersIcon, ShieldAlert } from "lucide-react";
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { ESCALATION_CONDITION_TYPES, ESCALATION_ACTION_TYPES } from "@/lib/constants";

interface EscalationRuleListItemProps {
  rule: EscalationRule;
  users: User[];
  supportQueues: SupportQueue[];
  onEdit: (rule: EscalationRule) => void;
  onDelete: (ruleId: string) => void;
}

export function EscalationRuleListItem({ rule, users, supportQueues, onEdit, onDelete }: EscalationRuleListItemProps) {
  const conditionLabel = ESCALATION_CONDITION_TYPES.find(c => c.value === rule.conditionType)?.label || rule.conditionType;
  const actionLabel = ESCALATION_ACTION_TYPES.find(a => a.value === rule.actionType)?.label || rule.actionType;

  let conditionValueDisplay = String(rule.conditionValue || "");
  const conditionConfig = ESCALATION_CONDITION_TYPES.find(c => c.value === rule.conditionType);
  if (conditionConfig?.requiresValue === 'priority') {
    conditionValueDisplay = rule.conditionValue ? String(rule.conditionValue).charAt(0).toUpperCase() + String(rule.conditionValue).slice(1) : 'N/A';
  } else if (conditionConfig?.requiresValue === 'queue' && rule.conditionValue) {
    const queue = supportQueues.find(q => q.id === rule.conditionValue);
    conditionValueDisplay = queue ? queue.name : String(rule.conditionValue);
  } else if (conditionConfig?.requiresValue === 'number' && rule.conditionValue) {
    conditionValueDisplay = `${rule.conditionValue} horas`;
  }


  let actionTargetDisplay = "";
  const actionConfig = ESCALATION_ACTION_TYPES.find(a => a.value === rule.actionType);
  if (actionConfig?.targetType === 'user' && rule.actionTargetUserId) {
    const user = users.find(u => u.id === rule.actionTargetUserId);
    actionTargetDisplay = user ? user.name : rule.actionTargetUserId;
  } else if (actionConfig?.targetType === 'queue' && rule.actionTargetQueueId) {
    const queue = supportQueues.find(q => q.id === rule.actionTargetQueueId);
    actionTargetDisplay = queue ? queue.name : rule.actionTargetQueueId;
  } else if (actionConfig?.targetType === 'priority' && rule.actionTargetPriority) {
    actionTargetDisplay = rule.actionTargetPriority.charAt(0).toUpperCase() + rule.actionTargetPriority.slice(1);
  } else if (actionConfig?.targetType === 'group' && rule.actionTargetGroupId) {
    actionTargetDisplay = `Grupo: ${rule.actionTargetGroupId}`; // Placeholder for group name
  }


  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
             <ClockIcon className={`h-5 w-5 ${rule.isEnabled ? 'text-green-500' : 'text-muted-foreground'}`} />
            <CardTitle className="text-base truncate" title={rule.name}>
              {rule.name} (Orden: {rule.order})
            </CardTitle>
            <Badge variant={rule.isEnabled ? "default" : "secondary"} className={rule.isEnabled ? "bg-green-100 text-green-700" : ""}>
                {rule.isEnabled ? "Activa" : "Inactiva"}
            </Badge>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => onEdit(rule)} className="h-8 w-8">
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(rule.id)} className="h-8 w-8 text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
         {rule.description && (
          <CardDescription className="text-xs pt-1 line-clamp-2">{rule.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="pb-3 space-y-2 text-sm text-muted-foreground">
        <div className="text-xs">
            <p><strong>Condición:</strong> {conditionLabel} {conditionValueDisplay && `(${conditionValueDisplay})`}</p>
            <p><strong>Acción:</strong> {actionLabel} {actionTargetDisplay && `(${actionTargetDisplay})`}</p>
        </div>
      </CardContent>
       <CardFooter className="pt-2 pb-3 border-t text-xs text-muted-foreground">
            <p>Creada: {isValid(parseISO(rule.createdAt)) ? format(parseISO(rule.createdAt), "PPp", { locale: es }) : 'Fecha inválida'}</p>
      </CardFooter>
    </Card>
  );
}
