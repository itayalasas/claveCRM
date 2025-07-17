
"use client";

import type { LiveChatWidgetSettings } from "@/lib/types";
import { MessageCircle, Send, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatWidgetPreviewProps {
  settings: LiveChatWidgetSettings;
}

export function ChatWidgetPreview({ settings }: ChatWidgetPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!settings.widgetEnabled) {
    return (
      <div className="relative w-full h-64 bg-muted rounded-md flex items-center justify-center text-muted-foreground overflow-hidden border">
        Widget de Chat Deshabilitado
      </div>
    );
  }

  return (
    <div className="relative w-full h-80 bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center overflow-hidden border">
      {/* Simulated website content area */}
      <div className="absolute inset-0 p-4 text-xs text-gray-400 dark:text-gray-500">
        <p>Contenido simulado del sitio web...</p>
        <div className="w-3/4 h-3 bg-gray-300 dark:bg-gray-600 rounded mt-2"></div>
        <div className="w-1/2 h-3 bg-gray-300 dark:bg-gray-600 rounded mt-1"></div>
      </div>

      {/* Chat Button */}
      {!isOpen && (
        <Button
          style={{ backgroundColor: settings.primaryColor }}
          className={cn(
            "absolute text-white rounded-full shadow-lg w-14 h-14 flex items-center justify-center",
            settings.widgetPosition === "bottom-right" ? "bottom-4 right-4" : "bottom-4 left-4"
          )}
          onClick={() => setIsOpen(true)}
          aria-label="Abrir chat"
        >
          <MessageCircle size={28} />
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className={cn(
            "absolute w-72 h-[26rem] bg-background rounded-lg shadow-xl flex flex-col overflow-hidden border",
            settings.widgetPosition === "bottom-right" ? "bottom-4 right-4" : "bottom-4 left-4"
          )}
        >
          {/* Header */}
          <div
            style={{ backgroundColor: settings.primaryColor }}
            className="p-3 text-white flex justify-between items-center"
          >
            <h3 className="font-semibold text-sm">{settings.chatHeaderText || "Chatea con Nosotros"}</h3>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-white/20" onClick={() => setIsOpen(false)} aria-label="Cerrar chat">
              <X size={18} />
            </Button>
          </div>

          {/* Messages Area */}
          <div className="flex-grow p-3 space-y-2 overflow-y-auto">
            {/* Welcome Message */}
            <div className="flex">
              <div className="bg-muted p-2 rounded-lg rounded-bl-none max-w-[80%]">
                <p className="text-xs">{settings.welcomeMessage}</p>
              </div>
            </div>
            {/* Example User Message (Simulated) */}
            <div className="flex justify-end">
              <div className="p-2 rounded-lg rounded-br-none max-w-[80%]" style={{ backgroundColor: `${settings.primaryColor}20`, color: settings.primaryColor }}>
                <p className="text-xs">Tengo una pregunta...</p>
              </div>
            </div>
          </div>

          {/* Input Area */}
          <div className="p-2 border-t flex items-center gap-2 bg-background">
            <input
              type="text"
              placeholder="Escribe tu mensaje..."
              className="flex-grow p-2 border rounded-md text-xs focus:ring-1 focus:outline-none"
              style={{ borderColor: settings.primaryColor, "--tw-ring-color": settings.primaryColor } as React.CSSProperties}
              disabled
            />
            <Button size="icon" className="h-8 w-8" style={{ backgroundColor: settings.primaryColor }} disabled>
              <Send size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
