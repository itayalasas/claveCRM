
"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { NAV_ITEMS, INITIAL_KB_ARTICLES } from "@/lib/constants";
import { Brain, AlertTriangle, Link as LinkIcon, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState, useEffect } from "react";
import type { KnowledgeBaseArticle } from "@/lib/types";
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';

export default function KnowledgeBasePage() {
  const { currentUser, loading, hasPermission } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!currentUser || !hasPermission('ver-base-conocimiento')) {
        router.push('/access-denied');
      }
    }
  }, [currentUser, loading, hasPermission, router]);

  const navItem = NAV_ITEMS.flatMap(item => item.subItems || item).find(item => item.href === '/knowledge-base');
  const PageIcon = navItem?.icon || Brain;
  const [searchTerm, setSearchTerm] = useState("");

  // TODO: Fetch articles from Firestore when KB management is implemented
  const articles: KnowledgeBaseArticle[] = INITIAL_KB_ARTICLES;

  const filteredArticles = articles.filter(article =>
    article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (article.tags && article.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))) ||
    (article.category && article.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

   if (loading) {
    return <div>Cargando...</div>;
  }


  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <PageIcon className="h-6 w-6 text-primary" />
            {navItem?.label || "Base de Conocimiento"}
          </CardTitle>
          <CardDescription>
            Encuentra artículos y guías para resolver dudas y mejorar la eficiencia del soporte. La creación y gestión completa está en desarrollo.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <div className="relative mb-6">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar artículos por título, contenido o etiqueta..."
              className="pl-8 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {filteredArticles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredArticles.map(article => (
                <Card key={article.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary"/>
                        {article.title}
                    </CardTitle>
                    {article.category && <Badge variant="outline" className="mt-1 text-xs">{article.category}</Badge>}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3">{article.content}</p>
                    {article.tags && article.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                            {article.tags.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                        </div>
                    )}
                  </CardContent>
                  <CardFooter className="text-xs text-muted-foreground">
                    <p>Visibilidad: {article.visibility === 'public' ? 'Público' : 'Interno'}</p>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {searchTerm ? "No se encontraron artículos con ese criterio." : "No hay artículos disponibles actualmente."}
            </p>
          )}


          <div className="mt-8 space-y-4 p-6 border rounded-lg bg-amber-50 border-amber-200">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-semibold">Funcionalidad en Desarrollo</h3>
            </div>
            <p className="text-sm text-amber-600">
              La gestión completa de la Base de Conocimiento (creación y edición de artículos, más categorías) está planeada y se implementará próximamente. La funcionalidad para sugerir artículos desde los tickets ya está parcialmente implementada.
            </p>
            <div className="mt-3">
              <h4 className="font-medium text-amber-700">Características Planeadas:</h4>
              <ul className="list-disc list-inside text-sm text-amber-600 space-y-1 mt-1">
                <li>Creación y edición de artículos con formato enriquecido. <Badge variant="outline" className="ml-1 border-amber-500 text-amber-700 text-[10px] px-1 py-0">Pendiente</Badge></li>
                <li>Organización por categorías y etiquetas. <Badge variant="outline" className="ml-1 border-amber-500 text-amber-700 text-[10px] px-1 py-0">Parcial</Badge></li>
                <li>Búsqueda potente de artículos. <Badge variant="outline" className="ml-1 border-green-500 text-green-700 text-[10px] px-1 py-0">Básico Impl.</Badge></li>
                <li>Control de visibilidad (interno/público). <Badge variant="outline" className="ml-1 border-green-500 text-green-700 text-[10px] px-1 py-0">Parcial</Badge></li>
                <li>Sistema de valoración y comentarios de artículos. <Badge variant="outline" className="ml-1 border-amber-500 text-amber-700 text-[10px] px-1 py-0">Pendiente</Badge></li>
                <li>
                  <LinkIcon className="inline h-4 w-4 mr-1"/>
                  Vinculación y sugerencia de artículos a tickets de soporte. <Badge variant="outline" className="ml-1 border-green-500 text-green-700 text-[10px] px-1 py-0">Parcial</Badge>
                </li>
              </ul>
            </div>
            <Badge variant="outline" className="mt-3 border-amber-500 text-amber-700">Próximamente</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
