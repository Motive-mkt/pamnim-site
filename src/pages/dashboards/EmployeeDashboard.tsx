import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { collection, query, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Briefcase, MessageSquare, Plus, Users } from 'lucide-react';
import { cn } from '../../lib/utils';
import ProjectTracker from '../../components/ProjectTracker';
import ProjectChat from '../../components/ProjectChat';
import StartProjectModal from '../../components/StartProjectModal';
import UserManagementView from '../../components/UserManagementView';

export default function EmployeeDashboard() {
  const { profile, canApproveSignups } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [selectedChatClient, setSelectedChatClient] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'projects' | 'chat' | 'approvals'>('projects');
  const [showStartProjectModal, setShowStartProjectModal] = useState(false);
  const [chatTaggedContext, setChatTaggedContext] = useState<string | undefined>();

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

  return (
    <AdminLayout activeTab="overview">
      <div className="space-y-8">
        {/* Top Header & Navigation Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-charcoal/10 pb-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-charcoal">Employee Workspace</h2>
            <p className="text-sm text-charcoal/60">
              Role: <span className="font-bold text-ochre capitalize">{profile?.role?.replace('_', ' ')}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab('projects')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'projects'
                  ? 'bg-ochre text-white shadow-md'
                  : 'bg-white border text-charcoal hover:bg-cream'
              }`}
            >
              <Briefcase className="w-4 h-4" /> Projects & Tracker
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'chat'
                  ? 'bg-ochre text-white shadow-md'
                  : 'bg-white border text-charcoal hover:bg-cream'
              }`}
            >
              <MessageSquare className="w-4 h-4" /> Client Chat
            </button>
            {canApproveSignups && (
              <button
                onClick={() => setActiveTab('approvals')}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'approvals'
                    ? 'bg-ochre text-white shadow-md'
                    : 'bg-white border text-charcoal hover:bg-cream'
                }`}
              >
                <Users className="w-4 h-4" /> Sign-Up Approvals
              </button>
            )}
          </div>
        </div>

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
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Projects Sidebar Selector */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-charcoal/40 uppercase tracking-widest px-1">Projects</h4>
                  {projects.map((proj) => {
                    const isSelected = (selectedProject?.id || projects[0]?.id) === proj.id;
                    return (
                      <button
                        key={proj.id}
                        onClick={() => setSelectedProject(proj)}
                        className={cn(
                          "w-full text-left p-5 rounded-2xl border transition-all text-sm",
                          isSelected
                            ? "bg-ochre text-white border-ochre shadow-md shadow-ochre/20"
                            : "bg-white border-charcoal/10 hover:border-ochre/50 hover:bg-cream/50"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase", isSelected ? "bg-white/20 text-white" : "bg-ochre/10 text-ochre")}>
                            {proj.currentStageName || 'Started'}
                          </span>
                          <span className={cn("text-xs font-semibold truncate max-w-[160px]", isSelected ? "text-white/80" : "text-charcoal/50")}>
                            {proj.selectedServices && proj.selectedServices.length > 0
                              ? `${proj.selectedServices.length} Included Scopes`
                              : (proj.serviceName || proj.categoryTitle || 'Service')}
                          </span>
                        </div>
                        <h5 className="font-bold text-base mb-1">{proj.name}</h5>
                        <p className={cn("text-xs", isSelected ? "text-white/80" : "text-charcoal/60")}>
                          Client: {proj.clientName}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Tracker Component */}
                <div className="lg:col-span-2">
                  {(() => {
                    const activeProj = selectedProject || projects[0];
                    if (!activeProj) return null;
                    return (
                      <ProjectTracker
                        project={activeProj}
                        isReadOnly={false}
                        onOpenChatWithTag={(taggedCtx) => {
                          setChatTaggedContext(taggedCtx);
                          const clientMatch = clients.find(c => c.uid === activeProj.clientId || c.id === activeProj.clientId);
                          if (clientMatch) setSelectedChatClient(clientMatch);
                          setActiveTab('chat');
                        }}
                        onProjectUpdated={fetchData}
                      />
                    );
                  })()}
                </div>
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
