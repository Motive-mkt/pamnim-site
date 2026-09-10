import { ReactNode, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useCMS } from '../hooks/useCMS';
import { Sparkle, LogOut, LayoutDashboard, Briefcase, Users, FileText, UserCircle, Menu, X, Copy, Check, UserPlus, FileSignature, MessageSquare, LayoutGrid, Sparkles, Mail, Globe, Palette, Receipt, HardHat } from 'lucide-react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { cn, getOptimizedImageUrl } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

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

export default function AdminLayout({ children, activeTab, onTabChange, navItems: customNavItems }: AdminLayoutProps) {
  const { profile, isAdmin, isStaff } = useAuth();
  const { content } = useCMS();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
    { id: 'projects', label: 'Projects & Tracker', icon: Briefcase, roles: ['owner', 'senior_designer', 'designer', 'project_manager'] },
    { id: 'invoices', label: 'Invoices & Billing', icon: FileText, roles: ['owner'] },
    { id: 'quotes', label: 'Formal Quotations', icon: FileSignature, roles: ['owner'] },
    { id: 'transactions', label: 'Transactions & Receipts', icon: Receipt, roles: ['owner'] },
    { id: 'hrms', label: 'Site HRMS & Workers', icon: HardHat, roles: ['owner', 'project_manager'] },
    { id: 'chat', label: 'Client Messages', icon: MessageSquare, roles: ['owner', 'senior_designer', 'designer', 'project_manager', 'client'] },
    { id: 'staff', label: 'Team & Approvals', icon: Users, roles: ['owner'] },
    { id: 'services', label: 'Services', icon: LayoutGrid, roles: ['owner'] },
    { id: 'detailed-services', label: 'Sub-Services CMS', icon: Sparkles, roles: ['owner'] },
    { id: 'inquiries', label: 'Contact Inquiries', icon: Mail, roles: ['owner'] },
    { id: 'media', label: 'Media Library', icon: Globe, roles: ['owner'] },
    { id: 'content', label: 'Homepage Editor', icon: Palette, roles: ['owner'] },
    { id: 'my-project', label: 'My Project', icon: Briefcase, roles: ['client'] },
  ];

  const effectiveNavItems = customNavItems && customNavItems.length > 0
    ? customNavItems
    : defaultNavItems.filter(item => !item.roles || item.roles.includes(profile?.role || ''));

  const handleNavClick = (itemId: string) => {
    if (onTabChange) {
      onTabChange(itemId);
    }
    // Also update URL parameter for linkability and bookmarking
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', itemId);
      return next;
    }, { replace: true });
    setIsMobileOpen(false);
  };

  const currentActiveItem = effectiveNavItems.find(i => i.id === activeTab);
  const activeLabel = currentActiveItem?.label || activeTab.replace('-', ' ');

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Unified Desktop Sidebar */}
      <aside className="w-64 bg-charcoal text-white hidden md:flex flex-col sticky top-0 h-screen z-30 shrink-0 border-r border-white/5">
        <Link to="/" className="p-5 flex items-center group transition-opacity border-b border-white/5">
          {content?.logoUrl ? (
            <div className="bg-white/95 px-3 py-1.5 rounded-xl shadow-sm backdrop-blur-sm flex items-center justify-center group-hover:bg-white transition-colors">
              <img 
                src={getOptimizedImageUrl(content.logoUrl, 200)} 
                alt="Company Logo" 
                className="h-8 w-auto object-contain transition-transform duration-300 group-hover:scale-105" 
                referrerPolicy="no-referrer"
                loading="eager"
              />
            </div>
          ) : (
            <div className="h-8 px-3 rounded-xl border border-dashed border-white/20 bg-white/5 flex items-center gap-2 text-xs font-medium text-white/50 group-hover:border-ochre/50 group-hover:text-ochre transition-all">
              <Sparkle className="w-4 h-4 text-ochre/70" />
              <span>Pamnim Interiors</span>
            </div>
          )}
        </Link>

        {/* Navigation List */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-white/30">
            {profile?.role === 'owner' ? 'Owner Portal' : profile?.role === 'client' ? 'Client Portal' : 'Staff Portal'}
          </div>
          {effectiveNavItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 text-xs font-semibold cursor-pointer text-left",
                  isActive
                    ? "bg-ochre text-white shadow-md shadow-ochre/20 font-bold"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                )}
              >
                <div className="flex items-center gap-3 truncate">
                  <item.icon className={cn("w-4 h-4 shrink-0", isActive ? "text-white" : "text-ochre/80")} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className={cn(
                    "px-1.5 py-0.5 text-[10px] font-bold rounded-full leading-none",
                    isActive ? "bg-white text-ochre" : "bg-ochre/20 text-ochre"
                  )}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Info & Sign Out Footer */}
        <div className="p-4 border-t border-white/10 space-y-2 bg-charcoal/80">
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="w-8 h-8 rounded-full bg-ochre/20 flex items-center justify-center text-ochre text-xs font-bold border border-ochre/30 shrink-0">
              {profile?.name?.charAt(0) || 'U'}
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-white truncate">{profile?.name || 'User'}</p>
              <p className="text-[10px] text-white/40 capitalize truncate">{profile?.role?.replace('_', ' ')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2.5 text-white/60 hover:text-white transition-colors w-full px-2 py-2 rounded-lg hover:bg-white/5 text-xs font-medium cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-white/50" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col md:ml-0 overflow-x-hidden min-w-0">
        <header className="bg-white border-b border-charcoal/5 h-16 sm:h-20 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-40">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="md:hidden flex items-center justify-center w-10 h-10 border border-charcoal/10 text-charcoal hover:bg-charcoal/5 rounded-xl transition-all cursor-pointer shrink-0"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link to="/" className="md:hidden flex items-center justify-center shrink-0">
              {content?.logoUrl ? (
                <img 
                  src={getOptimizedImageUrl(content.logoUrl, 180)} 
                  alt="Company Logo" 
                  className="h-7 w-auto object-contain" 
                  referrerPolicy="no-referrer"
                  loading="eager"
                />
              ) : (
                <div className="h-7 px-2 rounded-lg border border-dashed border-charcoal/20 bg-charcoal/5 flex items-center gap-1 text-[11px] text-charcoal/60 font-medium">
                  <Sparkle className="w-3 h-3 text-ochre/70" />
                  <span>Pamnim</span>
                </div>
              )}
            </Link>
            <div className="flex items-center gap-2 min-w-0">
              <span className="hidden sm:inline text-xs text-charcoal/40 font-medium">Workspace /</span>
              <h1 className="text-base sm:text-xl font-bold text-charcoal truncate">{activeLabel}</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {profile?.role !== 'client' && (
              <button
                onClick={handleCopySignupLink}
                className="px-3 py-2 sm:px-4 sm:py-2 bg-ochre/10 text-ochre hover:bg-ochre hover:text-white transition-all rounded-xl font-bold text-xs flex items-center gap-2 border border-ochre/20 shadow-sm cursor-pointer"
                title="Copy Sign-Up Page Link to Clipboard"
              >
                {copiedSignupLink ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                    <span>Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span className="hidden xs:inline">Sign-Up Link</span>
                  </>
                )}
              </button>
            )}

            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-charcoal">{profile?.name}</p>
              <p className="text-[11px] text-charcoal/50 font-medium px-2 py-0.5 bg-cream rounded-full inline-block mt-0.5 capitalize">
                {profile?.role?.replace('_', ' ')}
              </p>
            </div>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-ochre/10 flex items-center justify-center text-ochre font-bold border border-ochre/20">
              {profile?.name?.charAt(0) || 'U'}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>

      {/* Luxury Mobile Slide-out Drawer Panel */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden"
            />

            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-full max-w-xs bg-charcoal text-white z-50 shadow-2xl p-5 flex flex-col justify-between md:hidden"
            >
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-center pb-5 border-b border-white/10 mb-4 shrink-0">
                  <Link to="/" onClick={() => setIsMobileOpen(false)} className="flex items-center gap-2">
                    {content?.logoUrl ? (
                      <div className="bg-white/95 px-3 py-1.5 rounded-xl shadow-sm backdrop-blur-sm flex items-center justify-center">
                        <img 
                          src={getOptimizedImageUrl(content.logoUrl, 180)} 
                          alt="Company Logo" 
                          className="h-8 w-auto object-contain" 
                          referrerPolicy="no-referrer"
                          loading="eager"
                        />
                      </div>
                    ) : (
                      <div className="h-8 px-3 rounded-xl border border-dashed border-white/20 bg-white/5 flex items-center gap-2 text-xs font-medium text-white/50">
                        <Sparkle className="w-4 h-4 text-ochre/70" />
                        <span>Pamnim Interiors</span>
                      </div>
                    )}
                  </Link>
                  <button
                    onClick={() => setIsMobileOpen(false)}
                    className="flex items-center justify-center w-9 h-9 text-white/60 hover:text-white border border-white/10 hover:bg-white/10 rounded-xl transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
                  <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-white/30">
                    Navigation Menu
                  </div>
                  {effectiveNavItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavClick(item.id)}
                        className={cn(
                          "w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all duration-200 text-xs font-semibold cursor-pointer text-left",
                          isActive
                            ? "bg-ochre text-white shadow-md shadow-ochre/20 font-bold"
                            : "text-white/70 hover:text-white hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <item.icon className={cn("w-4 h-4 shrink-0", isActive ? "text-white" : "text-ochre/80")} />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {item.badge !== undefined && (
                          <span className={cn(
                            "px-1.5 py-0.5 text-[10px] font-bold rounded-full leading-none",
                            isActive ? "bg-white text-ochre" : "bg-ochre/20 text-ochre"
                          )}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="border-t border-white/10 pt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-3 text-white/60 hover:text-white transition-colors w-full px-3 py-2.5 rounded-xl hover:bg-white/5 text-xs font-medium cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-white/50" />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
