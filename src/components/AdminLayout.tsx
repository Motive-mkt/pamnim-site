import { ReactNode, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useCMS } from '../hooks/useCMS';
import { Sparkle, LogOut, LayoutDashboard, Briefcase, Users, FileText, UserCircle, Menu, X, Copy, Check, UserPlus } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface AdminLayoutProps {
  children: ReactNode;
  activeTab: string;
}

export default function AdminLayout({ children, activeTab }: AdminLayoutProps) {
  const { profile, isAdmin, isStaff } = useAuth();
  const { content } = useCMS();
  const navigate = useNavigate();
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

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, roles: ['owner', 'senior_designer', 'designer', 'project_manager'] },
    { id: 'projects', label: 'Projects', icon: Briefcase, roles: ['owner', 'senior_designer', 'designer', 'project_manager'] },
    { id: 'clients', label: 'Clients', icon: Users, roles: ['owner'] },
    { id: 'staff', label: 'Staff', icon: Users, roles: ['owner'] },
    { id: 'content', label: 'Site Content', icon: FileText, roles: ['owner'] },
    { id: 'my-project', label: 'My Project', icon: Briefcase, roles: ['client'] },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-charcoal text-white hidden md:flex flex-col sticky top-0 h-screen">
        <Link to="/" className="p-6 flex items-center group transition-opacity">
          {content?.logoUrl ? (
            <div className="bg-white/95 px-3 py-1.5 rounded-xl shadow-sm backdrop-blur-sm flex items-center justify-center group-hover:bg-white transition-colors">
              <img 
                src={content.logoUrl} 
                alt="Company Logo" 
                className="h-9 w-auto object-contain transition-transform duration-300 group-hover:scale-105" 
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="h-9 px-3 rounded-xl border border-dashed border-white/20 bg-white/5 flex items-center gap-2 text-xs font-medium text-white/50 group-hover:border-ochre/50 group-hover:text-ochre transition-all">
              <Sparkle className="w-4 h-4 text-ochre/70" />
              <span>Logo Placeholder</span>
            </div>
          )}
        </Link>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.filter(item => item.roles.includes(profile?.role || '')).map((item) => (
            <Link
              key={item.id}
              to="/dashboard"
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                activeTab === item.id ? "bg-ochre text-white shadow-lg shadow-ochre/20" : "text-white/60 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-6 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 text-white/60 hover:text-white transition-colors w-full px-4 py-3"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="flex-1 flex flex-col md:ml-0 overflow-x-hidden">
        <header className="bg-white border-b border-charcoal/5 h-20 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-40">
          <div className="flex items-center gap-3">
             <button
               onClick={() => setIsMobileOpen(true)}
               className="md:hidden flex items-center justify-center w-11 h-11 border border-charcoal/10 text-charcoal hover:bg-charcoal/5 rounded-full transition-all cursor-pointer"
               aria-label="Open Admin Menu"
             >
               <Menu className="w-5 h-5" />
             </button>
             <Link to="/" className="md:hidden flex items-center justify-center">
                {content?.logoUrl ? (
                  <img 
                    src={content.logoUrl} 
                    alt="Company Logo" 
                    className="h-8 w-auto object-contain" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-8 px-2.5 rounded-lg border border-dashed border-charcoal/20 bg-charcoal/5 flex items-center gap-1.5 text-xs text-charcoal/60 font-medium">
                    <Sparkle className="w-3.5 h-3.5 text-ochre/70" />
                    <span>Logo Placeholder</span>
                  </div>
                )}
             </Link>
             <h1 className="text-lg sm:text-xl font-bold capitalize truncate max-w-[120px] xs:max-w-none">{activeTab.replace('-', ' ')}</h1>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4">
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
                    <span className="hidden xs:inline">Copy Sign-Up Link</span>
                  </>
                )}
              </button>
            )}

            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold">{profile?.name}</p>
              <p className="text-xs text-charcoal/40 font-medium px-2 py-0.5 bg-cream rounded-full inline-block mt-1">
                {profile?.role.replace('_', ' ')}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-ochre/10 flex items-center justify-center text-ochre font-bold border border-ochre/20 cursor-pointer hover:bg-ochre/20 transition-all">
              {profile?.name?.charAt(0)}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8">
          {children}
        </main>
      </div>

      {/* Luxury Slide-out Drawer Panel for Dashboard Admin/User */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            {/* Dark background overlay backdrop with fade transitions */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden"
            />

            {/* Slide-out drawer menu panel */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-full max-w-xs bg-charcoal text-white z-50 shadow-2xl p-6 flex flex-col justify-between md:hidden"
            >
              <div>
                <div className="flex justify-between items-center mb-10">
                  <Link to="/" onClick={() => setIsMobileOpen(false)} className="flex items-center gap-2">
                    {content?.logoUrl ? (
                      <div className="bg-white/95 px-3 py-1.5 rounded-xl shadow-sm backdrop-blur-sm flex items-center justify-center">
                        <img 
                          src={content.logoUrl} 
                          alt="Company Logo" 
                          className="h-9 w-auto object-contain" 
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="h-9 px-3 rounded-xl border border-dashed border-white/20 bg-white/5 flex items-center gap-2 text-xs font-medium text-white/50">
                        <Sparkle className="w-4 h-4 text-ochre/70" />
                        <span>Logo Placeholder</span>
                      </div>
                    )}
                  </Link>
                  <button
                    onClick={() => setIsMobileOpen(false)}
                    className="flex items-center justify-center w-11 h-11 text-white/60 hover:text-white border border-white/5 hover:bg-white/5 rounded-full transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <nav className="space-y-2">
                  {navItems.filter(item => item.roles.includes(profile?.role || '')).map((item) => (
                    <Link
                      key={item.id}
                      to="/dashboard"
                      onClick={() => setIsMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                        activeTab === item.id ? "bg-ochre text-white shadow-lg shadow-ochre/20" : "text-white/60 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  ))}
                </nav>
              </div>

              <div className="border-t border-white/10 pt-6">
                <button
                  onClick={() => {
                    setIsMobileOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-3 text-white/60 hover:text-white transition-colors w-full px-4 py-3"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
