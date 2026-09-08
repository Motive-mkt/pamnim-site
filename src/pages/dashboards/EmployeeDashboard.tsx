import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout, { NavItemConfig } from '../../components/AdminLayout';
import { collection, query, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Briefcase, MessageSquare, Plus, Users, ArrowRight, Calendar, User } from 'lucide-react';
import { cn } from '../../lib/utils';
import ProjectChat from '../../components/ProjectChat';
import StartProjectModal from '../../components/StartProjectModal';
import UserManagementView from '../../components/UserManagementView';

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile, canApproveSignups } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [selectedChatClient, setSelectedChatClient] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const initialTab = (searchParams.get('tab') as 'projects' | 'chat' | 'approvals') || 'projects';
  const [activeTab, setActiveTab] = useState<'projects' | 'chat' | 'approvals'>(initialTab);
  const [showStartProjectModal, setShowStartProjectModal] = useState(false);
  const [chatTaggedContext, setChatTaggedContext] = useState<string | undefined>();

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && (tab === 'projects' || tab === 'chat' || tab === 'approvals')) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab as any);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', newTab);
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    if (profile?.uid) {
      fetchData();
    }
  }, [profile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all projects
      const projSnap = await getDocs(collection(db, 'projects'));
      const projList = projSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setProjects(projList);
      if (projList.length > 0 && !selectedProject) {
        setSelectedProject(projList[0]);
      }

      // Fetch clients
      const clientsSnap = await getDocs(collection(db, 'profiles'));
      const clientsList = clientsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((p: any) => p.role === 'client' && p.status !== 'pending');
      setClients(clientsList);
      if (clientsList.length > 0 && !selectedChatClient) {
        setSelectedChatClient(clientsList[0]);
      }
    } catch (err) {
      console.error('Error fetching employee dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout activeTab="overview">
        <div className="p-12 text-center text-charcoal/40 animate-pulse">
          Loading team portal...
        </div>
      </AdminLayout>
    );
  }

  const employeeNavItems: NavItemConfig[] = [
    { id: 'projects', label: 'Projects & Tracker', icon: Briefcase },
    { id: 'chat', label: 'Client Messages', icon: MessageSquare },
    ...(canApproveSignups ? [{ id: 'approvals', label: 'Sign-Up Approvals', icon: Users }] : []),
  ];

  return (
    <AdminLayout activeTab={activeTab} onTabChange={handleTabChange} navItems={employeeNavItems}>
      <div className="space-y-8">

        {/* Tab 1: Projects & 4-Stage Progress Tracker */}
        {activeTab === 'projects' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-white p-5 sm:p-8 rounded-3xl border border-charcoal/10 shadow-sm flex-wrap">
              <div>
                <h3 className="font-bold text-lg text-charcoal">Project Management</h3>
                <p className="text-xs text-charcoal/50">Start projects and manage stage media & status updates.</p>
              </div>

              <button
                onClick={() => setShowStartProjectModal(true)}
                className="px-5 py-2.5 rounded-2xl bg-ochre text-white text-xs font-bold flex items-center gap-2 shadow-md hover:bg-ochre-dark transition-all"
              >
                <Plus className="w-4 h-4" /> Start Project
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="p-12 text-center text-charcoal/40 bg-white rounded-3xl border border-charcoal/10">
                No active projects found. Click "Start Project" above to create one.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((proj) => {
                  return (
                    <div
                      key={proj.id}
                      className="bg-white rounded-3xl p-6 border border-charcoal/10 shadow-sm flex flex-col justify-between space-y-5 hover:shadow-md transition-shadow"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-ochre/10 text-ochre border border-ochre/20">
                            {proj.currentStageName || 'Started'}
                          </span>
                          <span className="text-[10px] font-semibold text-charcoal/50 truncate max-w-[150px]">
                            {proj.selectedServices && proj.selectedServices.length > 0
                              ? `${proj.selectedServices.length} Scopes`
                              : (proj.serviceName || proj.categoryTitle || 'Interior')}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-bold text-lg text-charcoal mb-1">{proj.name}</h4>
                          <p className="text-xs text-charcoal/60 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-ochre" /> Client: <span className="font-semibold text-charcoal">{proj.clientName}</span>
                          </p>
                        </div>

                        {proj.createdAt && (
                          <p className="text-[11px] text-charcoal/40 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Started: {new Date(proj.createdAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => navigate(`/tracker/${proj.id}`)}
                        className="w-full py-2.5 px-4 rounded-xl bg-ochre text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-ochre-dark transition-all cursor-pointer"
                      >
                        <span>View Tracker</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <StartProjectModal
              isOpen={showStartProjectModal}
              onClose={() => setShowStartProjectModal(false)}
              clients={clients}
              onProjectStarted={() => {
                fetchData();
                setShowStartProjectModal(false);
              }}
            />
          </div>
        )}

        {/* Tab 2: Client Chat */}
        {activeTab === 'chat' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-5 sm:p-8 border border-charcoal/10 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 flex-wrap">
              <div>
                <h3 className="text-xl font-bold">Client Chat Threads</h3>
                <p className="text-xs text-charcoal/50">Select a client below to converse in real-time or address stage comments.</p>
              </div>

              <select
                value={selectedChatClient?.uid || selectedChatClient?.id || (clients[0]?.uid || '')}
                onChange={e => {
                  const match = clients.find(c => c.uid === e.target.value || c.id === e.target.value);
                  if (match) setSelectedChatClient(match);
                }}
                className="w-full md:w-72 px-4 py-2.5 rounded-xl border border-charcoal/15 text-xs font-bold bg-white text-charcoal outline-none focus:border-ochre"
              >
                {clients.length === 0 ? (
                  <option value="">No clients available</option>
                ) : (
                  clients.map(c => (
                    <option key={c.uid || c.id} value={c.uid || c.id}>
                      {c.name} ({c.email || c.phone || 'Client'})
                    </option>
                  ))
                )}
              </select>
            </div>

            {(() => {
              const activeChatUser = selectedChatClient || clients[0];
              if (!activeChatUser) {
                return (
                  <div className="p-12 text-center text-charcoal/40 bg-white rounded-3xl border border-charcoal/10">
                    No active clients available for messaging yet.
                  </div>
                );
              }
              return (
                <ProjectChat
                  clientId={activeChatUser.uid || activeChatUser.id}
                  clientName={activeChatUser.name}
                  initialTaggedContext={chatTaggedContext}
                  onClearTag={() => setChatTaggedContext(undefined)}
                />
              );
            })()}
          </div>
        )}

        {/* Tab 3: Sign-Up Approvals (for Elevated Employees) */}
        {activeTab === 'approvals' && canApproveSignups && (
          <UserManagementView onRefreshData={fetchData} />
        )}
      </div>
    </AdminLayout>
  );
}
