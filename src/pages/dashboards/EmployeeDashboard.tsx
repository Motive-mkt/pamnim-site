import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { collection, query, getDocs, where, doc, getDoc, updateDoc, addDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Briefcase, CheckCircle2, Circle, Clock, MessageSquare, Phone, Mail, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function EmployeeDashboard() {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (profile?.uid) {
      fetchProjects();
    }
  }, [profile]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      // For simplicity, we query all projects where employeeId is in array
      const q = query(collection(db, 'projects'), where('employeeIds', 'array-contains', profile?.uid));
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProjects(list);
      if (list.length > 0) setSelectedProject(list[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updatePhaseStatus = async (phaseIndex: number, status: 'pending' | 'active' | 'complete') => {
    if (!selectedProject) return;
    const newPhases = [...selectedProject.phases];
    newPhases[phaseIndex].status = status;
    newPhases[phaseIndex].date = new Date().toLocaleDateString();

    await updateDoc(doc(db, 'projects', selectedProject.id), { phases: newPhases });
    setSelectedProject({ ...selectedProject, phases: newPhases });
    setProjects(projects.map(p => p.id === selectedProject.id ? { ...p, phases: newPhases } : p));
  };

  const addProgressNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim() || !selectedProject) return;

    const noteData = {
      text: note,
      authorId: profile?.uid,
      authorName: profile?.name,
      createdAt: new Date().toISOString()
    };

    await addDoc(collection(db, 'projects', selectedProject.id, 'progressNotes'), noteData);
    setNote('');
    alert('Note added successfully!');
  };

  return (
    <AdminLayout activeTab="overview">
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left: Projects List */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-sm font-bold text-charcoal/40 uppercase tracking-widest px-2">Assigned Projects</h2>
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedProject(p)}
              className={cn(
                "w-full text-left p-6 rounded-3xl transition-all duration-300 border",
                selectedProject?.id === p.id 
                  ? "bg-white border-ochre shadow-lg shadow-ochre/10 translate-x-2" 
                  : "bg-white border-charcoal/5 hover:bg-cream hover:border-charcoal/10"
              )}
            >
              <h3 className="font-bold text-lg mb-1">{p.name}</h3>
              <p className="text-sm text-charcoal/40">{p.status} • {p.phases?.filter((ph:any) => ph.status === 'complete').length}/6 Complete</p>
            </button>
          ))}
        </div>

        {/* Right: Project Details */}
        <div className="lg:col-span-2">
          {selectedProject ? (
            <div className="space-y-8">
              {/* Client Info Card */}
              <div className="bg-white rounded-3xl p-8 border border-charcoal/5 shadow-sm">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-3xl font-bold mb-2">{selectedProject.name}</h2>
                    <p className="text-charcoal/60">Manage project phases and updates for this client.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-charcoal/40 uppercase mb-2">CLIENT CONTACT</p>
                    <div className="flex items-center gap-4 text-sm justify-end">
                       <a href={`tel:${selectedProject.clientPhone}`} className="p-2 bg-ochre/10 text-ochre rounded-lg hover:bg-ochre hover:text-white transition-all">
                          <Phone className="w-4 h-4" />
                       </a>
                       <a href={`mailto:${selectedProject.clientEmail}`} className="p-2 bg-ochre/10 text-ochre rounded-lg hover:bg-ochre hover:text-white transition-all">
                          <Mail className="w-4 h-4" />
                       </a>
                    </div>
                  </div>
                </div>

                {/* Timeline Controller */}
                <div className="space-y-6">
                  {selectedProject.phases?.map((phase: any, index: number) => (
                    <div key={phase.name} className="flex items-center gap-6 p-4 rounded-2xl bg-cream/50 border border-charcoal/5">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                        phase.status === 'complete' ? "bg-emerald-100 text-emerald-600" : 
                        phase.status === 'active' ? "bg-ochre/20 text-ochre animate-pulse" : "bg-slate-200 text-slate-400"
                      )}>
                        {phase.status === 'complete' ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-lg">{phase.name}</h4>
                        <p className="text-sm text-charcoal/40">{phase.status} {phase.date ? `on ${phase.date}` : ''}</p>
                      </div>
                      <div className="flex gap-2">
                        <select 
                          className="bg-white border rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-ochre"
                          value={phase.status}
                          onChange={(e) => updatePhaseStatus(index, e.target.value as any)}
                        >
                          <option value="pending">Pending</option>
                          <option value="active">Active</option>
                          <option value="complete">Complete</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress Note Form */}
              <div className="bg-white rounded-3xl p-8 border border-charcoal/5 shadow-sm">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-ochre" />
                  Add Progress Update
                </h3>
                <form onSubmit={addProgressNote} className="space-y-4">
                  <textarea
                    rows={4}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Share an update with the client..."
                    className="w-full p-6 bg-cream border border-charcoal/5 rounded-2xl focus:outline-none focus:border-ochre transition-all"
                  />
                  <button className="bg-ochre text-white font-bold px-8 py-3 rounded-xl hover:bg-ochre/90 transition-all">
                    Post Note to Portal
                  </button>
                </form>
              </div>
            </div>
          ) : (
             <div className="bg-white rounded-3xl p-12 border border-dashed border-charcoal/20 text-center">
                <Briefcase className="w-12 h-12 text-charcoal/20 mx-auto mb-4" />
                <p className="text-charcoal/40">Select a project from the left to view details.</p>
             </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
