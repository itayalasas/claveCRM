"use client";

import { useState, useMemo } from "react";
import type { Meeting, Lead, User, Resource } from "@/lib/types";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MeetingListItem } from "./meeting-list-item"; 
import { format, isSameDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface CalendarViewProps {
  meetings: Meeting[];
  onEditMeeting: (meeting: Meeting) => void;
  leads: Lead[]; 
  users: User[];
  resources: Resource[];
}

export function CalendarView({ meetings, onEditMeeting, leads, users, resources }: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const meetingsForSelectedDay = useMemo(() => meetings.filter(meeting => 
    selectedDate && isSameDay(parseISO(meeting.startTime), selectedDate)
  ).sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()), [meetings, selectedDate]);

  const eventDays = useMemo(() => meetings.map(meeting => parseISO(meeting.startTime)), [meetings]);
  
  const modifiers = {
    hasEvents: eventDays,
    selected: selectedDate || new Date(), // Keep selected day distinct
  };

  const modifiersClassNames = {
    hasEvents: 'bg-primary/10 text-primary-foreground rounded-full relative',
    // Ensure selected style takes precedence or combines well
    selected: 'bg-primary text-primary-foreground rounded-md focus:bg-primary focus:text-primary-foreground',
  };
  
  // Custom day renderer to add a dot
  const DayWithDot: React.FC<{ date: Date; displayMonth: Date }> = ({ date, displayMonth }) => {
    const isEventDay = eventDays.some(eventDate => isSameDay(eventDate, date));
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {format(date, "d")}
        {isEventDay && <span className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full"></span>}
      </div>
    );
  };


  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
      <Card className="md:col-span-1 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Seleccionar Fecha</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="rounded-md"
            locale={es}
            modifiers={modifiers}
            modifiersClassNames={modifiersClassNames}
            components={{
                DayContent: DayWithDot,
            }}
          />
        </CardContent>
         <CardContent>
            <div className="flex items-center space-x-2 text-sm">
                <span className="w-3 h-3 bg-primary/10 rounded-full inline-block relative">
                    <span className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full"></span>
                </span>
                <span>Día con eventos</span>
            </div>
             <div className="flex items-center space-x-2 text-sm mt-1">
                <span className="w-3 h-3 bg-primary text-primary-foreground rounded-sm inline-block"></span>
                <span>Día seleccionado</span>
            </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">
            Reuniones para {selectedDate ? format(selectedDate, "PPP", { locale: es }) : "Hoy"}
            <Badge variant="secondary" className="ml-2">{meetingsForSelectedDay.length} reunión(es)</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {meetingsForSelectedDay.length > 0 ? (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {meetingsForSelectedDay.map(meeting => (
                <MeetingListItem
                  key={meeting.id}
                  meeting={meeting}
                  onEdit={onEditMeeting}
                  onDelete={() => { /* Implement delete or pass handler if needed here */ }} 
                  leads={leads} 
                  users={users} 
                  resources={resources}
                />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No hay reuniones programadas para esta fecha.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}