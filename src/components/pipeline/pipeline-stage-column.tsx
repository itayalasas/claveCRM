"use client";

import type { PipelineStage, Lead } from "@/lib/types";
import { LeadCard } from "./lead-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PipelineStageColumnProps {
  stage: PipelineStage;
  leads: Lead[];
  onEditLead: (lead: Lead) => void;
}

export function PipelineStageColumn({ stage, leads, onEditLead }: PipelineStageColumnProps) {
  return (
    <Card className="w-full min-w-[300px] md:w-[320px] flex-shrink-0 h-full flex flex-col bg-muted/30">
      <CardHeader className={`p-3 sticky top-0 z-10 bg-muted/50 border-b ${stage.color ? stage.color.replace('bg-', 'border-') : 'border-border'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {stage.color && <span className={`w-3 h-3 rounded-full ${stage.color}`}></span>}
            <CardTitle className="text-base font-semibold">{stage.name}</CardTitle>
          </div>
          <span className="text-sm font-medium text-muted-foreground bg-background px-2 py-0.5 rounded-md">
            {leads.length}
          </span>
        </div>
      </CardHeader>
      <ScrollArea className="flex-grow">
        <CardContent className="p-3 space-y-3 h-full">
          {leads.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground py-8">
              No hay leads en esta etapa.
            </div>
          ) : (
            leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} onEdit={onEditLead} />
            ))
          )}
        </CardContent>
      </ScrollArea>
    </Card>
  );
}
