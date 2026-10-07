import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useCMS } from '../hooks/useCMS';
import {
  LogOut, LayoutDashboard, Zap, Briefcase, Users, FileText, Menu, X, Copy, Check,
  FileSignature, MessageSquare, LayoutGrid, Mail, Globe, Palette, Receipt, HardHat,
  Layers, ExternalLink
} from 'lucide-react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { cn, getOptimizedImageUrl } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import NotificationCenter from './NotificationCenter';

export interface NavItemConfig {
  id: string;
  label: string;
  icon: any;
  badge?: number | string;
  roles?: string[];
}

interface AdminLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange?: (tabId: string) => void;
  navItems?: NavItemConfig[];
}

/** Sidebar sections. Items the map does not know about stay in the general section. */
const NAV_GROUPS: Record<string, string> = {
  overview: 'Workspace',
  'quick-actions': 'Workspace',
  projects: 'Workspace',
  'my-project': 'Workspace',
  chat: 'Workspace',
  invoices: 'Money',
  catalog: 'Money',
  quotes: 'Money',
  transactions: 'Money',
  hrms: 'People',
  staff: 'People',
  services: 'Website',
  'detailed-services': 'Website',
  inquiries: 'Website',
  media: 'Website',
  content: 'Website'
};
const GROUP_ORDER = ['Workspace', 'Money', 'People', 'Website'];

const roleLabel = (role?: string) => {
  if (role === 'owner') return 'Owner';
  if (role === 'client') return 'Client';
  return 'Staff';
};

function BrandMark({ light = false, size = 'md' }: { light?: boolean; size?: 'sm' | 'md' }) {
  const { content } = useCMS();
  if (content?.logoUrl) {
    return (
      <span className={cn('inline-flex rounded-md', light ? 'bg-white px-2.5 py-1.5' : '')}>
        <img
          src={getOptimizedImageUrl(content.logoUrl, 200)}
          alt="Pamnim Interior Designers"
          className={cn('w-auto object-contain', size === 'sm' ? 'h-7' : 'h-8')}
          referrerPolicy="no-referrer"
          loading="eager"
        />
      </span>
    );
  }
  return (
    <span className="flex flex-col leading-none">
      <span className={cn('font-serif text-2xl font-semibold tracking-tight', light ? 'text-white' : 'text-charcoal')}>pamnim</span>
      <span className={cn('mt-1 text-[10px] font-semibold uppercase tracking-[0.18em]', light ? 'text-ochre-light' : 'text-ochre')}>
        Interior Designers
      </span>
    </span>
  );
}

export default function AdminLayout({ children, activeTab, onTabChange, navItems: customNavItems }: AdminLayoutProps) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [copiedSignupLink, setCopiedSignupLink] = useState(false);

  const handleCopySignupLink = () => {
    const signupUrl = `${window.location.origin}/signup`;
    navigator.clipboard.writeText(signupUrl);
    setCopiedSignupLink(true);
    setTimeout(() => setCopiedSignupLink(false), 3000);
  };

  const handleLogout = () => {
    auth.signOut();
    navigate('/');
  };

  const defaultNavItems: NavItemConfig[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, roles: ['owner', 'senior_designer', 'designer', 'project_manager'] },
    { id: 'quick-actions', label: 'Quick actions', icon: Zap, roles: ['owner', 'senior_designer', 'designer', 'project_manager', 'elevated_employee', 'regular_employee', 'worker'] },
    { id: 'projects', label: 'Projects and tracker', icon: Briefcase, roles: ['owner', 'senior_designer', 'designer', 'project_manager'] },
    { id: 'invoices', label: 'Invoices and billing', icon: FileText, roles: ['owner'] },
    { id: 'quotes', label: 'Quotations', icon: FileSignature, roles: ['owner'] },
    { id: 'transactions', label: 'Transactions and receipts', icon: Receipt, roles: ['owner'] },
    { id: 'hrms', label: 'Site workers (HRMS)', icon: HardHat, roles: ['owner', 'project_manager'] },
    { id: 'chat', label: 'Client messages', icon: MessageSquare, roles: ['owner', 'senior_designer', 'designer', 'project_manager', 'client'] },
    { id: 'staff', label: 'Team and approvals', icon: Users, roles: ['owner'] },
    { id: 'services', label: 'Services', icon: LayoutGrid, roles: ['owner'] },
    { id: 'detailed-services', label: 'Service pages', icon: Layers, roles: ['owner'] },
    { id: 'inquiries', label: 'Contact inquiries', icon: Mail, roles: ['owner'] },
    { id: 'media', label: 'Media library', icon: Globe, roles: ['owner'] },
    { id: 'content', label: 'Homepage editor', icon: Palette, roles: ['owner'] },
    { id: 'my-project', label: 'My project', icon: Briefcase, roles: ['client'] }
  ];

  const effectiveNavItems = customNavItems && customNavItems.length > 0
    ? customNavItems
    : defaultNavItems.filter((item) => !item.roles || item.roles.includes(profile?.role || ''));

  // Group the items into sections while keeping their order inside each section
  const sections = useMemo(() => {
    const buckets = new Map<string, NavItemConfig[]>();
    effectiveNavItems.forEach((item) => {
      const group = NAV_GROUPS[item.id] || 'More';
      if (!buckets.has(group)) buckets.set(group, []);
      buckets.get(group)!.push(item);
    });
    const ordered = [...GROUP_ORDER, 'More'].filter((g) => buckets.has(g));
    return ordered.map((title) => ({ title, items: buckets.get(title)! }));
  }, [effectiveNavItems]);
  const showSectionTitles = sections.length > 1;

  const handleNavClick = (itemId: string) => {
    onTabChange?.(itemId);
    // Keep the tab in the URL so it can be bookmarked and shared
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', itemId);
      return next;
    }, { replace: true });
    setIsMobileOpen(false);
  };

  // Escape closes the mobile drawer; the page behind it does not scroll while it is open
  useEffect(() => {
    if (!isMobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsMobileOpen(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isMobileOpen]);

  const currentActiveItem = effectiveNavItems.find((i) => i.id === activeTab);
  const activeLabel = currentActiveItem?.label || activeTab.replace(/-/g, ' ');
  const initial = (profile?.name || 'U').charAt(0).toUpperCase();

  const renderNav = (idPrefix: string, touch: boolean) => (
    <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Dashboard">
      {sections.map((section) => (
        <div key={section.title} className="mb-5 last:mb-0">
          {showSectionTitles && (
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">{section.title}</p>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    id={`${idPrefix}${item.id}`}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'relative flex w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm transition-colors',
                      touch ? 'min-h-12' : 'min-h-10',
                      isActive
                        ? 'bg-white/[0.12] font-semibold text-white before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-ochre-light'
                        : 'font-medium text-white/75 hover:bg-white/[0.07] hover:text-white'
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <item.icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-ochre-light' : 'text-white/55')} aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge !== undefined && item.badge !== 0 && item.badge !== '' && (
                      <span className="min-w-[1.375rem] rounded-full bg-ochre-light px-1.5 py-0.5 text-center text-[11px] font-semibold leading-none text-charcoal">
                        {item.badge}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const sidebarFooter = (onNavigate?: () => void) => (
    <div className="shrink-0 space-y-1 border-t border-white/10 p-3">
      <Link
        to="/"
        onClick={onNavigate}
        className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/75 hover:bg-white/[0.07] hover:text-white"
      >
        <ExternalLink className="h-[18px] w-[18px] text-white/55" aria-hidden="true" />
        View website
      </Link>
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          handleLogout();
        }}
        className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-white/75 hover:bg-white/[0.07] hover:text-white"
      >
        <LogOut className="h-[18px] w-[18px] text-white/55" aria-hidden="true" />
        Sign out
      </button>
    </div>
  );

  return (
    <div className="app-ui flex min-h-screen bg-cream">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="dark-surface sticky top-0 z-30 hidden h-screen w-64 shrink-0 flex-col bg-charcoal text-white md:flex">
        <Link to="/" className="flex h-[72px] shrink-0 items-center border-b border-white/10 px-5" aria-label="Pamnim, view website">
          <BrandMark light />
        </Link>
        <p className="px-6 pt-4 text-xs font-medium text-white/60">{roleLabel(profile?.role)} workspace</p>
        {renderNav('nav-item-', false)}
        {sidebarFooter()}
      </aside>

      {/* Workspace */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-[72px] items-center justify-between gap-4 border-b border-charcoal/10 bg-white px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-charcoal/15 text-charcoal hover:bg-charcoal/5 md:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="truncate text-lg font-semibold first-letter:uppercase sm:text-xl">{activeLabel}</h1>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {profile?.role !== 'client' && (
              <button
                type="button"
                onClick={handleCopySignupLink}
                className="btn btn-outline btn-sm"
                title="Copy the sign-up page link"
              >
                {copiedSignupLink ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                    <span>Link copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Copy sign-up link</span>
                  </>
                )}
              </button>
            )}

            <NotificationCenter />

            <div className="flex items-center gap-3 pl-1">
              <div className="hidden text-right sm:block">
                <p className="max-w-[10rem] truncate text-sm font-semibold leading-tight text-charcoal">{profile?.name}</p>
                <p className="text-xs capitalize text-charcoal/65">{profile?.role?.replace('_', ' ')}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-charcoal text-sm font-semibold text-white" aria-hidden="true">
                {initial}
              </div>
            </div>
          </div>
        </header>

        <main id="main-content" className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 z-50 bg-charcoal/55 md:hidden"
              aria-hidden="true"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              className="dark-surface fixed inset-y-0 left-0 z-50 flex w-full max-w-xs flex-col bg-charcoal text-white shadow-2xl md:hidden"
            >
              <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/10 px-5">
                <Link to="/" onClick={() => setIsMobileOpen(false)} aria-label="Pamnim, view website">
                  <BrandMark light size="sm" />
                </Link>
                <button
                  type="button"
                  onClick={() => setIsMobileOpen(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
                  aria-label="Close navigation menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {renderNav('mobile-nav-item-', true)}
              {sidebarFooter(() => setIsMobileOpen(false))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
