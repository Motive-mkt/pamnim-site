import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { collection, query, getDocs, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Sparkles, MessageSquare, Compass, Phone, ArrowRight, ExternalLink, Calendar } from 'lucide-react';
import ProjectChat from '../../components/ProjectChat';

export default function ClientPortal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatTaggedContext, setChatTaggedContext] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<'tracker' | 'chat'>('tracker');

  const isProjectActive = (p: any) => {
    const isComplete = p.currentStageName?.toLowerCase() === 'complete' ||
                       p.currentStageName?.toLowerCase() === 'finished' ||
                       p.currentStageIndex === 3 ||
                       p.isFinished === true ||
                       p.status === 'complete' ||
                       p.status === 'finished';
    return !isComplete;
  };

  useEffect(() => {
    if (profile?.uid) {
      fetchProjects();
    }
  }, [profile]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'projects'), where('clientId', '==', profile?.uid));
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProjects(list);
      if (list.length > 0) setSelectedProject(list[0]);

      // If exactly one active project, route straight into that project's tracker
      const activeList = list.filter(isProjectActive);
      const showListOnly = searchParams.get('list') === 'true';
      if (!showListOnly && activeList.length === 1) {
        navigate(`/tracker/${activeList[0].id}`, { replace: true });
        return;
      }
    } catch (err) {
      console.error('Error fetching client project:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout activeTab="my-project">
        <div className="p-12 text-center text-charcoal/40 animate-pulse">
          Loading your project portal...
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeTab="my-project">
      <div className="space-y-8">
        {/* Welcome Header */}
        <div className="bg-ochre text-white p-6 sm:p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="relative z-10 max-w-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-widest text-white/80 bg-white/10 px-3 py-1 rounded-full">
                Client Portal
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Hello, {profile?.name}!</h2>
            <p className="text-white/80 text-base leading-relaxed">
              Track your project progress in real-time through our 4-stage milestones, view photos and updates, or chat directly with our design team.
            </p>
          </div>
          <Sparkles className="absolute -bottom-10 -right-10 w-64 h-64 text-white/5 pointer-events-none" />

          {/* Navigation Tabs */}
          <div className="relative z-10 flex flex-wrap gap-2 bg-black/20 p-1.5 rounded-2xl shrink-0">
            <button
              onClick={() => setActiveTab('tracker')}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                activeTab === 'tracker'
                  ? 'bg-white text-ochre shadow-md'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Progress Tracker
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                activeTab === 'chat'
                  ? 'bg-white text-ochre shadow-md'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Chat Support
            </button>
          </div>
        </div>

        {/* Tab Switcher Body */}
        {activeTab === 'tracker' ? (
          <div>
            {projects.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-charcoal/10 shadow-sm text-charcoal/60">
                <Compass className="w-10 h-10 text-ochre/40 mx-auto mb-3" />
                <h3 className="font-bold text-lg mb-1">No Active Project Linked Yet</h3>
                <p className="text-sm text-charcoal/50">
                  Our team is assigning your project details. You can also send us a message in the Chat tab anytime!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {projects.map((proj) => (
                  <div
                    key={proj.id}
                    className="bg-white rounded-3xl p-6 sm:p-8 border border-charcoal/10 shadow-sm flex flex-col justify-between space-y-6 hover:shadow-md transition-shadow"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-ochre/10 text-ochre px-3 py-1 rounded-full border border-ochre/20">
                          Stage: {proj.currentStageName || 'Started'}
                        </span>
                        {proj.categoryTitle && (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-charcoal/5 text-charcoal/60 px-3 py-1 rounded-full">
                            {proj.categoryTitle}
                          </span>
                        )}
                      </div>

                      <h3 className="text-xl font-bold text-charcoal">{proj.name}</h3>

                      {proj.createdAt && (
                        <div className="flex items-center gap-1.5 text-xs text-charcoal/40">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Started: {new Date(proj.createdAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => navigate(`/tracker/${proj.id}`)}
                      className="w-full py-3 px-4 rounded-2xl bg-ochre text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-ochre/20 hover:bg-ochre-dark transition-all cursor-pointer"
                    >
                      <span>View Project Tracker</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <ProjectChat
              clientId={profile?.uid || ''}
              clientName={profile?.name || 'Client'}
              initialTaggedContext={chatTaggedContext}
              onClearTag={() => setChatTaggedContext(undefined)}
            />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
