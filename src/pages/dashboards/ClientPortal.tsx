import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { collection, query, getDocs, where, doc, getDoc, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { CheckCircle2, Clock, ArrowRight, Download, MessageCircle, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function ClientPortal() {
  const { profile } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.uid) {
      fetchProject();
    }
  }, [profile]);

  const fetchProject = async () => {
    setLoading(true);
    const projectsPath = 'projects';
    try {
      const q = query(collection(db, projectsPath), where('clientId', '==', profile?.uid));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const pDoc = snap.docs[0];
        const pData = { id: pDoc.id, ...pDoc.data() };
        setProject(pData);

        // Listen for notes
        const notesPath = `projects/${pDoc.id}/progressNotes`;
        const notesQ = query(collection(db, notesPath), orderBy('createdAt', 'desc'));
        onSnapshot(notesQ, (nSnap) => {
          setNotes(nSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, notesPath);
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, projectsPath);
    } finally {
      setLoading(false);
    }
  };

  const [phoneNumber, setPhoneNumber] = useState(profile?.phone || '');

  if (loading) return <AdminLayout activeTab="my-project"><div className="animate-pulse">Loading project...</div></AdminLayout>;
  if (!project) return <AdminLayout activeTab="my-project"><div className="p-12 text-center text-charcoal/40">No active project found. Our team will link your project soon!</div></AdminLayout>;

  return (
    <AdminLayout activeTab="my-project">
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Welcome Card */}
          <div className="bg-ochre text-white p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
             <div className="relative z-10">
                <h2 className="text-4xl font-bold mb-4">Hello, {profile?.name}!</h2>
                <p className="text-white/80 text-lg max-w-md">Welcome to your project portal. Here you can track your home's transformation in real-time.</p>
             </div>
             <Sparkles className="absolute -bottom-10 -right-10 w-64 h-64 text-white/5" />
          </div>

          {/* Phase Tracker */}
          <div className="bg-white p-10 rounded-[2.5rem] border border-charcoal/5 shadow-sm">
             <h3 className="text-2xl font-bold mb-10">Your Project Timeline</h3>
             <div className="relative">
                {/* Connector Line */}
                <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-slate-100"></div>

                <div className="space-y-12">
                   {project.phases?.map((phase: any, index: number) => (
                      <div key={phase.name} className="flex gap-8 relative group">
                         <div className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center shrink-0 z-10 border-4 border-white transition-all duration-500",
                            phase.status === 'complete' ? "bg-emerald-500 text-white" : 
                            phase.status === 'active' ? "bg-ochre text-white ring-4 ring-ochre/20" : "bg-slate-200 text-slate-400"
                         )}>
                            {phase.status === 'complete' ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-5 h-5" />}
                         </div>
                         <div className="flex-1 pt-1">
                            <div className="flex justify-between items-start mb-2">
                               <h4 className={cn("text-xl font-bold", phase.status === 'active' ? "text-ochre" : "text-charcoal")}>{phase.name}</h4>
                               {phase.date && <span className="text-xs font-bold text-charcoal/30 uppercase">{phase.date}</span>}
                            </div>
                            <p className="text-charcoal/60 leading-relaxed">{phase.description}</p>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          </div>

          {/* Progress Notes */}
          <div className="bg-white p-10 rounded-[2.5rem] border border-charcoal/5 shadow-sm">
             <h3 className="text-2xl font-bold mb-8 flex items-center gap-3 text-charcoal">
                <MessageCircle className="w-6 h-6 text-ochre" />
                Team Updates
             </h3>
             <div className="space-y-6">
                {notes.map(note => (
                   <div key={note.id} className="p-6 bg-cream/50 rounded-2xl border border-charcoal/5">
                      <p className="text-charcoal/80 mb-4 whitespace-pre-line">{note.text}</p>
                      <div className="flex justify-between items-center text-xs">
                         <span className="font-bold text-ochre">{note.authorName}</span>
                         <span className="text-charcoal/30 uppercase tracking-widest">{format(new Date(note.createdAt), 'MMM d, h:mm a')}</span>
                      </div>
                   </div>
                ))}
                {notes.length === 0 && <p className="text-charcoal/40 italic">No updates posted yet.</p>}
             </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-8">
           {/* Downloads */}
           <div className="bg-cream/40 p-8 rounded-[2rem] border border-charcoal/5">
              <h4 className="font-bold mb-6">Resources</h4>
              <div className="space-y-4">
                 {[
                    { name: 'Initial Design Concept', type: 'PDF' },
                    { name: 'Lighting Layout Plan', type: 'PDF' },
                    { name: 'Material Board', type: 'Image' }
                 ].map(file => (
                    <button key={file.name} className="w-full flex items-center justify-between p-4 bg-white rounded-xl border border-charcoal/5 hover:border-ochre transition-all group">
                       <div className="text-left">
                          <p className="text-sm font-bold text-charcoal">{file.name}</p>
                          <p className="text-[10px] font-bold text-charcoal/40 uppercase">{file.type}</p>
                       </div>
                       <Download className="w-5 h-5 text-charcoal/20 group-hover:text-ochre transition-colors" />
                    </button>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </AdminLayout>
  );
}
