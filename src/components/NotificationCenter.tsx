import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, CheckCheck, Trash2, Mail, MessageSquare, 
  Briefcase, HardHat, DollarSign, Sparkles, X, Check, ExternalLink 
} from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { AppNotification } from '../services/notificationService';
import { cn } from '../lib/utils';

interface NotificationCenterProps {
  className?: string;
  buttonClassName?: string;
}

export default function NotificationCenter({ className, buttonClassName }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { 
    notifications, 
    unreadCount, 
    loading, 
    permission, 
    requestPermission, 
    markAsRead, 
    markAllRead, 
    removeNotification 
  } = useNotifications();

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.read) {
      await markAsRead(notif.id);
    }
    setIsOpen(false);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'inquiry':
        return <Mail className="w-4 h-4 text-ochre" />;
      case 'chat':
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'project':
        return <Briefcase className="w-4 h-4 text-emerald-600" />;
      case 'payment':
        return <DollarSign className="w-4 h-4 text-amber-500" />;
      case 'worker':
        return <HardHat className="w-4 h-4 text-purple-600" />;
      default:
        return <Sparkles className="w-4 h-4 text-charcoal/60" />;
    }
  };

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <div className={cn("relative inline-block text-left", className)} ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative p-2.5 rounded-xl border border-charcoal/10 text-charcoal/70 hover:text-charcoal hover:bg-cream transition-all flex items-center justify-center cursor-pointer",
          isOpen && "bg-cream text-charcoal",
          buttonClassName
        )}
        aria-label="Notifications"
        title="View Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white font-black text-[10px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center shadow-xs animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-charcoal/10 z-50 overflow-hidden animate-scale-up">
          {/* Header */}
          <div className="p-4 border-b border-charcoal/10 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-charcoal">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-[11px] font-bold text-ochre hover:text-ochre-dark flex items-center gap-1 transition-colors cursor-pointer"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-charcoal/40 hover:text-charcoal hover:bg-cream transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Desktop Notification Permission Banner */}
          {permission === 'default' && (
            <div className="p-3 bg-ochre/10 border-b border-ochre/20 flex items-center justify-between gap-2 text-xs">
              <span className="text-charcoal/80 font-medium text-[11px]">
                Enable desktop alerts for live updates?
              </span>
              <button
                type="button"
                onClick={requestPermission}
                className="px-2.5 py-1 bg-ochre text-white text-[10px] font-bold rounded-lg hover:bg-ochre-dark transition-colors cursor-pointer shrink-0"
              >
                Enable
              </button>
            </div>
          )}

          {/* List of Notifications */}
          <div className="max-h-80 overflow-y-auto divide-y divide-charcoal/5">
            {loading ? (
              <div className="p-8 text-center text-charcoal/40 text-xs animate-pulse">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-cream text-charcoal/30 flex items-center justify-center mx-auto">
                  <Bell className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-charcoal/70">All caught up!</p>
                <p className="text-[11px] text-charcoal/40">
                  You have no unread alerts or notifications.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={cn(
                    "p-3.5 flex items-start gap-3 hover:bg-cream/40 transition-colors group relative cursor-pointer",
                    !notif.read && "bg-ochre/5 font-medium"
                  )}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div className="w-8 h-8 rounded-xl bg-white border border-charcoal/10 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                    {getNotificationIcon(notif.type)}
                  </div>

                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className={cn("text-xs text-charcoal truncate", !notif.read ? "font-bold" : "font-semibold")}>
                        {notif.title}
                      </h4>
                      {!notif.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-ochre shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-charcoal/60 line-clamp-2 mt-0.5 leading-snug">
                      {notif.body}
                    </p>
                    <span className="text-[10px] text-charcoal/40 mt-1 block">
                      {formatRelativeTime(notif.createdAt)}
                    </span>
                  </div>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNotification(notif.id);
                    }}
                    className="absolute right-3 top-3 p-1 rounded-md text-charcoal/30 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    title="Dismiss notification"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-2.5 bg-cream/30 border-t border-charcoal/5 text-center">
              <span className="text-[10px] text-charcoal/40">
                Click any notification to open its details
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
