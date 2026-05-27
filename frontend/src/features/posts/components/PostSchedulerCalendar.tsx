import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';

import type { Post } from '../../../types';

// FullCalendar CSS imports omitted — package export doesn't expose CSS files.
// Styles can be added globally or via CDN if needed.

const STATUS_STYLES: Record<Post['status'], { color: string; border: string; label: string }> = {
  DRAFT: { color: '#64748b', border: '#94a3b8', label: 'Draft' },
  SCHEDULED: { color: '#2563eb', border: '#60a5fa', label: 'Scheduled' },
  PUBLISHED: { color: '#059669', border: '#34d399', label: 'Published' },
  FAILED: { color: '#dc2626', border: '#f87171', label: 'Failed' },
};

export interface PostSchedulerCalendarProps {
  posts: Post[];
  onDateClick: (date: Date) => void;
  onEventClick: (post: Post) => void;
}

export default function PostSchedulerCalendar({ posts, onDateClick, onEventClick }: PostSchedulerCalendarProps) {
  const events = posts.map(post => {
    const style = STATUS_STYLES[post.status];
    return {
      id: post.id,
      title: post.caption.slice(0, 38),
      start: post.scheduledAt ? post.scheduledAt : new Date().toISOString(),
      backgroundColor: style.color,
      borderColor: style.border,
      textColor: '#ffffff',
      extendedProps: { post },
    };
  });

  return (
    <div className="upe-calendar-card">
      <div className="upe-calendar-header">
        <div>
          <div className="upe-section-kicker">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Calendar
          </div>
          <h3>Post Schedule</h3>
        </div>
        <div className="upe-calendar-legend">
          {Object.entries(STATUS_STYLES).map(([status, style]) => (
            <span key={status} className="upe-legend-item">
              <i style={{ background: style.color }} />
              {style.label}
            </span>
          ))}
        </div>
      </div>

      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        height="auto"
        editable={false}
        selectable
        headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' }}
        events={events}
        dateClick={(arg: any) => onDateClick(arg.date)}
        eventClick={(arg: any) => onEventClick(arg.event.extendedProps.post as Post)}
        eventContent={arg => {
          const post = arg.event.extendedProps.post as Post;
          return (
            <div className="upe-calendar-event">
              <div className="upe-calendar-event-status">{STATUS_STYLES[post.status].label}</div>
              <div className="upe-calendar-event-title">{post.caption}</div>
            </div>
          );
        }}
      />
    </div>
  );
}