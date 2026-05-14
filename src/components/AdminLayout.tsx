import { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Sparkle, LogOut, LayoutDashboard, Briefcase, Users, FileText, UserCircle } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';

interface AdminLayoutProps {
  children: ReactNode;
  activeTab: string;
}

export default function AdminLayout({ children, activeTab }: AdminLayoutProps) {
  const { profile, isAdmin, isStaff } = useAuth();
  const navigate = useNavigate();

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
        <Link to="/" className="p-8 flex items-center gap-2 group hover:opacity-80 transition-opacity">
          <Sparkle className="w-6 h-6 text-ochre transition-transform group-hover:rotate-12" />
          <span className="font-serif text-xl font-bold tracking-tight">Pamnim</span>
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
        <header className="bg-white border-b border-charcoal/5 h-20 flex items-center justify-between px-8 sticky top-0 z-40">
          <div className="flex items-center gap-4">
             <Link to="/" className="md:hidden flex items-center justify-center">
                <Sparkle className="w-6 h-6 text-ochre" />
             </Link>
             <h1 className="text-xl font-bold capitalize">{activeTab.replace('-', ' ')}</h1>
          </div>
          
          <div className="flex items-center gap-4">
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

        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
