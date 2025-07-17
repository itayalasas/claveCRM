"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquareQuote } from "lucide-react";
import type { CannedResponse } from "@/lib/types";
import { useState, useEffect } from "react";
// Mock data - replace with actual data fetching
const MOCK_CANNED_RESPONSES: CannedResponse[] = [
  { id: "cr1", shortcut: "/saludo", text: "¡Hola! Gracias por contactarnos. ¿En qué podemos ayudarte hoy?", isGlobal: true },
  { id: "cr2", shortcut: "/despedida", text: "Gracias por tu consulta. ¡Que tengas un buen día!", isGlobal: true },
  { id: "cr3", shortcut: "/espera", text: "Un momento por favor, estoy revisando tu consulta.", isGlobal: true },
];

interface CannedResponsesProps {
  onSelectResponse: (text: string) => void;
}

export function CannedResponses({ onSelectResponse }: CannedResponsesProps) {
  const [responses, setResponses] = useState<CannedResponse[]>(MOCK_CANNED_RESPONSES);
  // TODO: Fetch canned responses from Firestore or a service

  return (
    <Card className="h-1/2 flex flex-col">
      <CardHeader className="p-2 pb-1">
        <CardTitle className="text-sm flex items-center gap-1">
            <MessageSquareQuote className="h-4 w-4 text-muted-foreground"/>
            Respuestas Rápidas
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 flex-grow overflow-hidden">
        {responses.length > 0 ? (
            <ScrollArea className="h-full">
                <div className="space-y-1">
                {responses.map(response => (
                    <Button 
                        key={response.id} 
                        variant="ghost" 
                        size="sm" 
                        className="w-full justify-start text-xs h-auto py-1.5"
                        onClick={() => onSelectResponse(response.text)}
                        title={`Insertar: ${response.text.substring(0,50)}...`}
                    >
                       <span className="font-mono text-primary text-[0.7rem] mr-1.5">{response.shortcut}</span> 
                       <span className="truncate">{response.text}</span>
                    </Button>
                ))}
                </div>
            </ScrollArea>
        ) : (
            <p className="text-xs text-muted-foreground text-center py-4">No hay respuestas rápidas configuradas.</p>
        )}
      </CardContent>
    </Card>
  );
}
