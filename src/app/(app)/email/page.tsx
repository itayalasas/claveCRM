'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  Timestamp
} from 'firebase/firestore';
import type { EmailMessage, FolderType, User } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';
import { formatDistanceToNowStrict, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { EmailComposer } from '@/components/email/email-composer';
import { EmailDetailView } from '@/components/email/email-detail-view';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { NAV_ITEMS } from '@/lib/constants';
import {
  Mail as MailIconLucide,
  Send,
  Inbox,
  Archive as ArchiveIcon,
  Trash2,
  PlusCircle,
  Loader2,
  Clock,
  Search,
  Reply
} from 'lucide-react';
import { cn, getUserInitials } from '@/lib/utils';

const ITEMS_PER_PAGE = 10;

// ————— Helpers —————
function parseAddressString(str?: string) {
  if (!str) return { email: 'desconocido@sistema.com', name: 'Desconocido' };
  const m = str.trim().match(/^(.*?)\s*<([^>]+)>$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { email: str.trim() };
}
function parseAddressStringToArray(str?: string) {
  return str ? str.split(',').map(s => parseAddressString(s)) : [];
}
function parseFirestoreDateToISO(v: any) {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === 'string') {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return undefined;
}
function mapDoc(
  docSnap: any,
  userId: string,
  defaultStatus: EmailMessage['status'],
  source: 'incomingEmails' | 'outgoingEmails'
): EmailMessage | null {
  const data = docSnap.data();
  if (!data) return null;
  let from = parseAddressString(data.from);
  let to = Array.isArray(data.to_parsed)
    ? data.to_parsed.map((x: any) => ({ email: x.address, name: x.name }))
    : parseAddressStringToArray(data.to);
  if (!to.length) to = [{ email: 'desconocido@sistema.com', name: 'Desconocido' }];
  const cc = parseAddressStringToArray(data.cc);
  const bcc = parseAddressStringToArray(data.bcc);
  const mailDate =
    source === 'incomingEmails'
      ? parseFirestoreDateToISO(data.date) || new Date(0).toISOString()
      : parseFirestoreDateToISO(data.sentAt) ||
        parseFirestoreDateToISO(data.createdAt) ||
        new Date(0).toISOString();
  const receivedAt =
    source === 'incomingEmails'
      ? parseFirestoreDateToISO(data.receivedAt) || mailDate
      : undefined;
  const isRead = typeof data.isRead === 'boolean' ? data.isRead : source !== 'incomingEmails';
  return {
    id: docSnap.id,
    from,
    to,
    cc: cc.length ? cc : undefined,
    bcc: bcc.length ? bcc : undefined,
    subject: data.subject || '(Sin Asunto)',
    bodyHtml: data.bodyHtml || data.html || '',
    bodyText: data.text || '',
    date: mailDate,
    receivedAt,
    status: data.status || defaultStatus,
    isRead,
    attachments: Array.isArray(data.attachments)
      ? data.attachments.map((a: any) => ({
          name: a.name,
          url: a.url,
          size: a.size,
          type: a.type
        }))
      : [],
    collectionSource: source,
    userId: data.userId || userId,
    relatedLeadId: data.relatedLeadId,
    relatedContactId: data.relatedContactId,
    relatedTicketId: data.relatedTicketId
  };
}

export default function EmailPage() {
  const { currentUser, loading: loadingAuth } = useAuth();
  const router = useRouter();
  const toast = useToast().toast;

  const [folder, setFolder] = useState<FolderType>('inbox');
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<EmailMessage | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerKey, setComposerKey] = useState(Date.now());
  const [composerData, setComposerData] = useState<any>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // redirect if no auth
  useEffect(() => {
    if (!loadingAuth && !currentUser) router.push('/access-denied');
  }, [loadingAuth, currentUser, router]);

  // real-time unread count
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'incomingEmails'),
      where('userId', '==', currentUser.id),
      where('isRead', '==', false)
    );
    const u = onSnapshot(q, s => setUnreadCount(s.size));
    return () => u();
  }, [currentUser]);

  // load folder emails
  useEffect(() => {
    if (!currentUser) return setLoadingEmails(false);
    setLoadingEmails(true);
    let src: 'incomingEmails' | 'outgoingEmails';
    let q;
    switch (folder) {
      case 'inbox':
        src = 'incomingEmails';
        q = query(
          collection(db, src),
          where('userId', '==', currentUser.id),
          orderBy('receivedAt', 'desc')
        );
        break;
      case 'sent':
        src = 'outgoingEmails';
        q = query(
          collection(db, src),
          where('userId', '==', currentUser.id),
          where('status', '==', 'sent'),
          orderBy('sentAt', 'desc')
        );
        break;
      case 'pending':
        src = 'outgoingEmails';
        q = query(
          collection(db, src),
          where('userId', '==', currentUser.id),
          where('status', '==', 'pending'),
          orderBy('createdAt', 'desc')
        );
        break;
      case 'drafts':
        src = 'outgoingEmails';
        q = query(
          collection(db, src),
          where('userId', '==', currentUser.id),
          where('status', '==', 'draft'),
          orderBy('updatedAt', 'desc')
        );
        break;
      case 'trash':
        src = 'outgoingEmails';
        q = query(
          collection(db, src),
          where('userId', '==', currentUser.id),
          where('status', '==', 'deleted'),
          orderBy('updatedAt', 'desc')
        );
        break;
    }
    const u = onSnapshot(
      q,
      snap => {
        const arr = snap.docs
          .map(d => mapDoc(d, currentUser.id, 'received', src))
          .filter(Boolean) as EmailMessage[];
        setEmails(arr);
        setLoadingEmails(false);
      },
      e => {
        toast({ title: 'Error cargando', description: e.message, variant: 'destructive' });
        setLoadingEmails(false);
      }
    );
    return () => u();
  }, [folder, currentUser, toast]);

  // mark read
  const markRead = useCallback(
    async (e: EmailMessage) => {
      if (e.collectionSource !== 'incomingEmails') return;
      try {
        await updateDoc(doc(db, 'incomingEmails', e.id), {
          isRead: true,
          updatedAt: Timestamp.now()
        });
      } catch {
        toast({ title: 'Error', description: 'No se pudo marcar leído', variant: 'destructive' });
      }
    },
    [toast]
  );

  // actions
  const openComposer = useCallback(
    (init: any, did: string | null) => {
      setComposerData(init);
      setDraftId(did);
      setComposerKey(did || 'new-composer');
      setComposerOpen(true);
      setSelected(null);
    },
    []
  );
  const reply    = (e: EmailMessage) => openComposer(
    { to: e.from.email, subject: `Re: ${e.subject}`, body: `\n\n\n----\nDe: ${e.from.name||e.from.email}\nAsunto: ${e.subject}\n\n${e.bodyText}` },
    null
  );
  const replyAll = (e: EmailMessage) => {
    const rec = [
      e.from.email,
      ...e.to.map(t => t.email),
      ...(e.cc||[]).map(c => c.email)
    ]
      .filter((v,i,a)=>v!==currentUser?.email && a.indexOf(v)===i)
      .join(',');
    openComposer({ to: rec, subject: `Re: ${e.subject}`, body: `\n\n\n----\nDe: ${e.from.name||e.from.email}\nAsunto: ${e.subject}\n\n${e.bodyText}` }, null);
  };
  const forward  = (e: EmailMessage) => openComposer(
    { subject: `Fwd: ${e.subject}`, body: `\n\n\n----\nDe: ${e.from.name||e.from.email}\nAsunto: ${e.subject}\n\n${e.bodyHtml||e.bodyText}` },
    null
  );
  const del      = async (e: EmailMessage) => {
    try {
      await updateDoc(doc(db, e.collectionSource!, e.id), {
        status: 'deleted',
        updatedAt: Timestamp.now()
      });
      setSelected(null);
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar', variant: 'destructive' });
    }
  };
  const view     = (e: EmailMessage) => {
    setSelected(e);
    setComposerOpen(false);
    if (!e.isRead && e.collectionSource==='incomingEmails') markRead(e);
  };

  // filtered + pagination
  const filt = emails.filter(x=>
    x.subject.toLowerCase().includes(search.toLowerCase()) ||
    x.from.email.toLowerCase().includes(search.toLowerCase())
  );
  const total = Math.ceil(filt.length/ITEMS_PER_PAGE);
  const pageArr = filt.slice((page-1)*ITEMS_PER_PAGE, page*ITEMS_PER_PAGE);

  // folder sidebar config
  const folders = useMemo(() => [
    { name:'inbox',   label:'Bandeja de Entrada', icon:Inbox,    count:unreadCount },
    { name:'pending', label:'Enviando',          icon:Clock,    count:0 },
    { name:'sent',    label:'Enviados',          icon:Send,     count:0 },
    { name:'drafts',  label:'Borradores',        icon:ArchiveIcon,count:0 },
    { name:'trash',   label:'Papelera',          icon:Trash2,   count:0 }
  ] as const, [unreadCount]);

  const navItem = NAV_ITEMS.find(i=>i.href==='/email');
  const Icon    = navItem?.icon||MailIconLucide;

  return (
    <div className="flex flex-col h-full">
      <Card className="shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Icon className="w-5 h-5 text-primary"/> {navItem?.label||'Correo'}
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-60 bg-gray-100 border-r p-2 flex flex-col">
          <Button size="sm" className="mb-2" onClick={()=>openComposer({},null)}>
            <PlusCircle className="mr-1 h-4 w-4"/> Nuevo
          </Button>
          <div className="flex-1 overflow-auto">
            <nav className="space-y-1">
              {folders.map(f=>(
                <Button
                  key={f.name}
                  variant={folder===f.name?'secondary':'ghost'}
                  className="w-full justify-between"
                  onClick={()=>{ setFolder(f.name); setSelected(null); setComposerOpen(false); setPage(1); }}
                >
                  <div className="flex items-center gap-2">
                    <f.icon className="w-4 h-4"/> {f.label}
                  </div>
                  {f.count>0 && (
                    <Badge variant="destructive" className="text-xs">
                      {f.count>99?'99+':f.count}
                    </Badge>
                  )}
                </Button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Email list */}
        <section className="w-96 bg-white border-r">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"/>
              <Input
                placeholder="Buscar correo..."
                className="pl-8"
                value={search}
                onChange={e=>{ setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {loadingEmails
              ? <Loader2 className="animate-spin m-auto mt-6"/>
              : pageArr.map(e=> {
                  const unread = e.status==='received' && !e.isRead;
                  const d = e.status==='received'?e.receivedAt:e.date;
                  return (
                    <div
                      key={e.id}
                      className={cn(
                        'flex items-start gap-2 p-2 cursor-pointer hover:bg-gray-100',
                        selected?.id===e.id && 'bg-blue-50',
                        unread && 'font-semibold border-l-4 border-blue-500'
                      )}
                      onClick={()=>view(e)}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={`https://avatar.vercel.sh/${e.from.email}.png`}/>
                        <AvatarFallback>{getUserInitials(e.from.name||e.from.email)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between">
                          <p className="truncate">{e.from.name||e.from.email}</p>
                          <time className="text-xs text-gray-500">
                            {d && isValid(parseISO(d))
                              ? formatDistanceToNowStrict(parseISO(d), { addSuffix:true, locale:es })
                              : ''}
                          </time>
                        </div>
                        <p className="truncate">{e.subject}</p>
                      </div>
                      {e.status==='pending' && <Clock className="animate-pulse text-yellow-500"/>}
                    </div>
                  );
                })
            }
          </div>
          {total>1 && (
            <div className="p-2 border-t flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={e=>{e.preventDefault(); setPage(p=>Math.max(1,p-1));}}
                      disabled={page===1}
                    />
                  </PaginationItem>
                  {[...Array(total)].map((_,i)=>(
                    <PaginationItem key={i}>
                      <PaginationLink
                        isActive={page===i+1}
                        onClick={e=>{e.preventDefault(); setPage(i+1);}}
                      >{i+1}</PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={e=>{e.preventDefault(); setPage(p=>Math.min(total,p+1));}}
                      disabled={page===total}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </section>

        {/* Detail / Composer */}
        <main className="flex-1 bg-white">
          {composerOpen ? (
            <EmailComposer
              key={composerKey}
              initialTo={composerData?.to}
              initialSubject={composerData?.subject}
              initialBody={composerData?.body}
              onQueueEmail={async()=>true}
              onSaveDraft={async()=>true}
              isSending={false}
              isSavingDraft={false}
              onClose={()=>setComposerOpen(false)}
              leads={[]}
              contacts={[]}
            />
          ) : selected ? (
            <EmailDetailView
              email={selected}
              onClose={()=>setSelected(null)}
              onReply={reply}
              onReplyAll={replyAll}
              onForward={forward}
              onDelete={del}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              Selecciona un correo o crea uno nuevo
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
