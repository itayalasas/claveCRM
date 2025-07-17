
"use client";

import { useState, useEffect } from "react";
import type { Ticket, KnowledgeBaseArticle } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Search, Lightbulb, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SuggestKbArticleDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: Ticket;
  kbArticles: KnowledgeBaseArticle[];
  onArticleSuggested: (article: KnowledgeBaseArticle) => void;
}

export function SuggestKbArticleDialog({
  isOpen,
  onOpenChange,
  ticket,
  kbArticles,
  onArticleSuggested,
}: SuggestKbArticleDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredArticles, setFilteredArticles] = useState<KnowledgeBaseArticle[]>(kbArticles);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm(""); // Reset search on open
      // Simple initial suggestion based on ticket title (can be improved)
      const ticketKeywords = ticket.title.toLowerCase().split(/\s+/).filter(k => k.length > 2);
      const initialSuggestions = kbArticles.filter(article =>
        ticketKeywords.some(keyword => 
            article.title.toLowerCase().includes(keyword) || 
            article.content.toLowerCase().includes(keyword) ||
            (article.tags && article.tags.some(tag => tag.toLowerCase().includes(keyword)))
        )
      );
      setFilteredArticles(initialSuggestions.length > 0 ? initialSuggestions : kbArticles);
    }
  }, [isOpen, ticket, kbArticles]);

  useEffect(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    if (!lowerSearchTerm) {
      setFilteredArticles(kbArticles);
      return;
    }
    setFilteredArticles(
      kbArticles.filter(article =>
        article.title.toLowerCase().includes(lowerSearchTerm) ||
        article.content.toLowerCase().includes(lowerSearchTerm) ||
        (article.tags && article.tags.some(tag => tag.toLowerCase().includes(lowerSearchTerm))) ||
        (article.category && article.category.toLowerCase().includes(lowerSearchTerm))
      )
    );
  }, [searchTerm, kbArticles]);

  const handleSuggest = (article: KnowledgeBaseArticle) => {
    onArticleSuggested(article);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Sugerir Artículo de Base de Conocimiento
          </DialogTitle>
          <DialogDescription>
            Busca y selecciona un artículo relevante para el ticket: &quot;{ticket.title}&quot;.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar artículos por título, contenido o etiqueta..."
              className="pl-8 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <ScrollArea className="h-72 border rounded-md">
            {filteredArticles.length > 0 ? (
              <div className="p-2 space-y-2">
                {filteredArticles.map(article => (
                  <Card key={article.id} className="hover:bg-muted/50 transition-colors">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-semibold">{article.title}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{article.content}</p>
                          {article.category && <Badge variant="secondary" className="text-xs mt-1">{article.category}</Badge>}
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleSuggest(article)}>
                          <Lightbulb className="mr-1.5 h-3.5 w-3.5" /> Sugerir
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="p-4 text-sm text-center text-muted-foreground">
                {searchTerm ? "No se encontraron artículos con ese criterio." : "No hay artículos en la base de conocimiento."}
              </p>
            )}
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
