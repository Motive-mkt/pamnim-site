import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { 
  Activity, CheckCircle2, Clock, ArrowRight, Search, Layers, 
  ExternalLink, Sparkles, User, Users, Camera, AlertCircle, 
  Filter, Play, Image as ImageIcon, ChevronRight, Plus, Briefcase
} from 'lucide-react';
import { cn } from '../lib/utils';

export interface ProjectActivityFeedProps {
  projects: any[];
  staff: any[];
  clients: any[];
  onNavigateToTracker: (projectId: string) => void;
  onSelectProjectInTab?: (project: any) => void;
  onStartNewProject?: () => void;
}

interface RecentUpdate {
  id: string;
  projectId: string;
  projectName: string;
  stageName: string;
  stageIndex: number;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  note?: string;
  uploadedBy?: string;
  createdAt: string;
}

export default function ProjectActivityFeed({
  projects,
  staff,
  clients,
  onNavigateToTracker,
  onSelectProjectInTab,
  onStartNewProject
}: ProjectActivityFeedProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [recentUpdates, setRecentUpdates] = useState<RecentUpdate[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(true);

  // Helper for relative time formatting
  const formatTimeAgo = (isoString?: string | null) => {
    if (!isoString) return 'Recently';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Recently';
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Listen to recent updates across the most recent projects
  useEffect(() => {
    if (!projects || projects.length === 0) {
      setRecentUpdates([]);
      setLoadingUpdates(false);
      return;
    }

    setLoadingUpdates(true);

    // Watch updates from the most recent 6 projects
    const topProjects = projects.slice(0, 6);
    const unsubs: Array<() => void> = [];
    const updatesMap = new Map<string, RecentUpdate[]>();

    topProjects.forEach((proj) => {
      const q = query(
        collection(db, 'projects', proj.id, 'updates'),
        orderBy('createdAt', 'desc'),
        limit(5)
      );

      const unsub = onSnapshot(
        q,
        (snap) => {
          const list: RecentUpdate[] = snap.docs.map((docSnap) => ({
            id: docSnap.id,
            projectId: proj.id,
            projectName: proj.name || 'Untitled Project',
            stageName: docSnap.data().stageName || 'Stage Update',
            stageIndex: typeof docSnap.data().stageIndex === 'number' ? docSnap.data().stageIndex : 0,
            mediaUrl: docSnap.data().mediaUrl || '',
            mediaType: docSnap.data().mediaType || 'image',
            note: docSnap.data().note || '',
            uploadedBy: docSnap.data().uploadedBy || 'Team Member',
            createdAt: docSnap.data().createdAt || new Date().toISOString()
          }));

          updatesMap.set(proj.id, list);

          // Flatten and sort by createdAt descending
          const allFlat: RecentUpdate[] = [];
          updatesMap.forEach((uList) => allFlat.push(...uList));
          allFlat.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setRecentUpdates(allFlat.slice(0, 8));
          setLoadingUpdates(false);
        },
        (err) => {
          console.warn(`Error fetching updates for project ${proj.id}:`, err);
          setLoadingUpdates(false);
        }
      );

      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [projects]);

  // Stage distribution counts
  const stageStats = React.useMemo(() => {
    let started = 0;
    let inProgress = 0;
    let almostDone = 0;
    let completed = 0;

    projects.forEach((p) => {
      const idx = typeof p.currentStageIndex === 'number' ? p.currentStageIndex : 0;
      const isComplete = p.isFinished || idx === 3 || p.currentStageName?.toLowerCase() === 'complete';

      if (isComplete) {
        completed += 1;
      } else if (idx === 0) {
        started += 1;
      } else if (idx === 1) {
        inProgress += 1;
      } else if (idx === 2) {
        almostDone += 1;
      }
    });

    const activeTotal = started + inProgress + almostDone;
    return { started, inProgress, almostDone, completed, activeTotal };
  }, [projects]);

  // Filtered project list
  const filteredProjects = React.useMemo(() => {
    return projects.filter((p) => {
      const idx = typeof p.currentStageIndex === 'number' ? p.currentStageIndex : 0;
      const isComplete = p.isFinished || idx === 3 || p.currentStageName?.toLowerCase() === 'complete';

      if (filter === 'active' && isComplete) return false;
      if (filter === 'completed' && !isComplete) return false;

      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase();
        const matchesName = p.name?.toLowerCase().includes(queryLower);
        const matchesClient = p.clientName?.toLowerCase().includes(queryLower);
        const matchesCategory = p.categoryTitle?.toLowerCase().includes(queryLower) || p.serviceName?.toLowerCase().includes(queryLower);
        return matchesName || matchesClient || matchesCategory;
      }

      return true;
    });
  }, [projects, filter, searchQuery]);

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-charcoal/5 space-y-8">
      {/* Top Header & Metrics */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-charcoal/5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-ochre">Live Project Operations</span>
          </div>
          <h2 className="text-2xl font-bold text-charcoal flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-ochre" />
            Project Activity & Operations
          </h2>
          <p className="text-sm text-charcoal/60 mt-1">
            Monitor real-time job progress, site photo logs, stage progressions, and active contracts across Kenya.
          </p>
        </div>

        {onStartNewProject && (
          <button
            onClick={onStartNewProject}
            className="flex items-center gap-2 bg-ochre text-white px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold hover:bg-ochre-dark transition-all shadow-md shadow-ochre/20 shrink-0 cursor-pointer self-start lg:self-center"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Start New Project</span>
          </button>
        )}
      </div>

      {/* 4-Stage Lifecycle Distribution Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-cream/40 p-4 rounded-2xl border border-charcoal/5">
          <div className="flex items-center justify-between text-xs font-semibold text-charcoal/60 mb-1">
            <span>1. Started</span>
            <span className="text-ochre font-bold">25%</span>
          </div>
          <div className="text-2xl font-black text-charcoal">{stageStats.started}</div>
          <p className="text-[11px] text-charcoal/40 mt-0.5">Initial layout & prep</p>
        </div>

        <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
          <div className="flex items-center justify-between text-xs font-semibold text-blue-700 mb-1">
            <span>2. In Progress</span>
            <span className="text-blue-600 font-bold">50%</span>
          </div>
          <div className="text-2xl font-black text-blue-900">{stageStats.inProgress}</div>
          <p className="text-[11px] text-blue-600/70 mt-0.5">Active site execution</p>
        </div>

        <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-700 mb-1">
            <span>3. Almost Done</span>
            <span className="text-amber-600 font-bold">75%</span>
          </div>
          <div className="text-2xl font-black text-amber-900">{stageStats.almostDone}</div>
          <p className="text-[11px] text-amber-600/70 mt-0.5">Finishing & fittings</p>
        </div>

        <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 mb-1">
            <span>4. Complete</span>
            <span className="text-emerald-600 font-bold">100%</span>
          </div>
          <div className="text-2xl font-black text-emerald-900">{stageStats.completed}</div>
          <p className="text-[11px] text-emerald-600/70 mt-0.5">Delivered & verified</p>
        </div>
      </div>

      {/* Split Section: Recent Activity Timeline + Interactive Project Progress List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Live Site Updates & Media Stream (5 cols) */}
        <div className="lg:col-span-5 bg-cream/20 p-5 rounded-3xl border border-charcoal/5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-charcoal text-base flex items-center gap-2">
              <Camera className="w-4 h-4 text-ochre" />
              Recent Site Uploads & Actions
            </h3>
            <span className="text-[11px] font-bold text-charcoal/40 uppercase tracking-wider">Live Log</span>
          </div>

          {loadingUpdates ? (
            <div className="py-12 text-center text-charcoal/40 space-y-2">
              <div className="w-6 h-6 border-2 border-ochre border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs">Loading live site updates...</p>
            </div>
          ) : recentUpdates.length === 0 ? (
            <div className="py-10 px-4 text-center text-charcoal/50 bg-white/60 rounded-2xl border border-dashed border-charcoal/10 space-y-2">
              <Sparkles className="w-8 h-8 text-charcoal/20 mx-auto" />
              <p className="text-xs font-semibold">No recent site uploads recorded yet.</p>
              <p className="text-[11px] text-charcoal/40">
                Staff photos, milestone notes, and video walkthroughs logged inside the Project Tracker will appear here in real time.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentUpdates.map((update) => (
                <div
                  key={update.id}
                  onClick={() => onNavigateToTracker(update.projectId)}
                  className="p-3.5 bg-white rounded-2xl border border-charcoal/5 hover:border-ochre/30 hover:shadow-sm transition-all cursor-pointer group flex items-start gap-3"
                >
                  {/* Media Thumbnail or Stage Icon */}
                  {update.mediaUrl ? (
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-charcoal/5 shrink-0 relative border border-charcoal/10">
                      {update.mediaType === 'video' ? (
                        <div className="w-full h-full bg-charcoal text-white flex items-center justify-center">
                          <Play className="w-5 h-5 fill-white text-white" />
                        </div>
                      ) : (
                        <img
                          src={update.mediaUrl}
                          alt={update.note || 'Site media'}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-ochre/10 text-ochre flex items-center justify-center shrink-0 mt-0.5">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4 className="text-xs font-bold text-charcoal truncate group-hover:text-ochre transition-colors">
                        {update.projectName}
                      </h4>
                      <span className="text-[10px] text-charcoal/40 shrink-0 font-medium">
                        {formatTimeAgo(update.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-ochre/10 text-ochre text-[10px] font-bold">
                        {update.stageName}
                      </span>
                      <span className="text-[10px] text-charcoal/40 truncate">
                        by {update.uploadedBy}
                      </span>
                    </div>

                    {update.note && (
                      <p className="text-[11px] text-charcoal/70 line-clamp-2 italic">
                        "{update.note}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Interactive Active Projects Matrix & Steppers (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-cream/60 p-1 rounded-2xl border border-charcoal/5 self-start">
              <button
                onClick={() => setFilter('all')}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  filter === 'all'
                    ? "bg-white text-charcoal shadow-xs"
                    : "text-charcoal/60 hover:text-charcoal"
                )}
              >
                All ({projects.length})
              </button>
              <button
                onClick={() => setFilter('active')}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  filter === 'active'
                    ? "bg-white text-charcoal shadow-xs"
                    : "text-charcoal/60 hover:text-charcoal"
                )}
              >
                Active ({stageStats.activeTotal})
              </button>
              <button
                onClick={() => setFilter('completed')}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  filter === 'completed'
                    ? "bg-white text-charcoal shadow-xs"
                    : "text-charcoal/60 hover:text-charcoal"
                )}
              >
                Completed ({stageStats.completed})
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-charcoal/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter by project/client..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-cream/40 border border-charcoal/10 rounded-xl text-xs font-medium focus:outline-none focus:border-ochre focus:bg-white"
              />
            </div>
          </div>

          {/* Projects List */}
          {filteredProjects.length === 0 ? (
            <div className="p-8 text-center text-charcoal/40 bg-cream/20 rounded-2xl border border-dashed border-charcoal/10 space-y-3">
              <Briefcase className="w-8 h-8 mx-auto text-charcoal/20" />
              <p className="text-sm font-bold">No projects match this view</p>
              {onStartNewProject && (
                <button
                  onClick={onStartNewProject}
                  className="px-4 py-2 rounded-xl bg-ochre text-white text-xs font-bold hover:bg-ochre-dark transition-all cursor-pointer"
                >
                  Start New Project
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProjects.map((proj) => {
                const stageIndex = typeof proj.currentStageIndex === 'number' ? proj.currentStageIndex : 0;
                const isComplete = proj.isFinished || stageIndex === 3 || proj.currentStageName?.toLowerCase() === 'complete';
                const progressPct = isComplete ? 100 : stageIndex === 0 ? 25 : stageIndex === 1 ? 50 : 75;
                const projStaff = staff.filter(
                  (s) =>
                    proj.employeeIds?.includes(s.uid || s.id) ||
                    proj.assignedStaffUids?.includes(s.uid || s.id)
                );

                return (
                  <div
                    key={proj.id}
                    className="p-4 sm:p-5 bg-cream/20 rounded-2xl border border-charcoal/5 hover:border-ochre/40 hover:bg-white hover:shadow-xs transition-all space-y-3"
                  >
                    {/* Top Row: Title, Client, Financials */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-charcoal text-sm sm:text-base">
                            {proj.name}
                          </h4>
                          {isComplete && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md uppercase tracking-wider">
                              Done
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-charcoal/60 mt-0.5">
                          Client: <strong className="text-charcoal">{proj.clientName || 'Private Client'}</strong>
                          {proj.categoryTitle ? ` • ${proj.categoryTitle}` : proj.serviceName ? ` • ${proj.serviceName}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {typeof proj.totalCost === 'number' && (
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-charcoal/40 block">Value</span>
                            <span className="text-xs font-bold text-charcoal">
                              ${proj.totalCost.toLocaleString()}
                            </span>
                          </div>
                        )}

                        <button
                          onClick={() => onNavigateToTracker(proj.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-ochre text-white text-xs font-bold hover:bg-ochre-dark transition-all flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
                        >
                          <span>Tracker</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar & Stage Indicator */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span className="text-charcoal/60">
                          Stage: <strong className="text-ochre">{proj.currentStageName || 'Started'}</strong>
                        </span>
                        <span className="text-charcoal/50 font-bold">{progressPct}%</span>
                      </div>

                      {/* Bar */}
                      <div className="w-full h-2 rounded-full bg-charcoal/10 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            isComplete ? "bg-emerald-500" : "bg-ochre"
                          )}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Footer Row: Assigned Team & Action shortcuts */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-charcoal/5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-charcoal/40">Team:</span>
                        {projStaff.length > 0 ? (
                          <div className="flex items-center -space-x-1.5">
                            {projStaff.map((s, idx) => (
                              <div
                                key={s.id || idx}
                                className="w-6 h-6 rounded-full bg-ochre text-white text-[9px] font-bold flex items-center justify-center border-2 border-white shadow-xs"
                                title={s.name}
                              >
                                {s.name ? s.name.charAt(0).toUpperCase() : 'S'}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-charcoal/40 italic">Unassigned</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-charcoal/40">
                          Updated {formatTimeAgo(proj.updatedAt || proj.createdAt)}
                        </span>
                        {onSelectProjectInTab && (
                          <button
                            onClick={() => onSelectProjectInTab(proj)}
                            className="text-[11px] font-bold text-ochre hover:text-ochre-dark flex items-center gap-1 cursor-pointer ml-2"
                          >
                            <span>Manage</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
