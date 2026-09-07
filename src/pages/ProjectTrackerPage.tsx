import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import ProjectTracker from '../components/ProjectTracker';
import PaymentLog from '../components/PaymentLog';
import ExpenseTracker from '../components/ExpenseTracker';
import ProjectChat from '../components/ProjectChat';
import ProjectReviewCard from '../components/ProjectReviewCard';
import ProjectCostEditor from '../components/ProjectCostEditor';
import { 
  ArrowLeft, Activity, CreditCard, MessageSquare, 
  Calendar, User, CheckCircle2, DollarSign, Clock, ShieldAlert, Layers
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function ProjectTrackerPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { profile, user, isStaff, isOwner } = useAuth();

  const [project, setProject] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs: 'progress' | 'payments' | 'chat'
  const [activeTab, setActiveTab] = useState<'progress' | 'payments' | 'chat'>('progress');
  const [chatTaggedContext, setChatTaggedContext] = useState<string | undefined>(undefined);

  // Financial quick summary state
  const [totalPaid, setTotalPaid] = useState<number>(0);

  // Saving cost state
  const [isSavingCost, setIsSavingCost] = useState(false);
  const [costFeedback, setCostFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!projectId) {
      setError('No project ID provided.');
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'projects', projectId);
    const unsubProject = onSnapshot(
      docRef,
      (snap) => {
        if (!snap.exists()) {
          setError('Project not found.');
          setProject(null);
        } else {
          setProject({ id: snap.id, ...snap.data() });
          setError(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching project:', err);
        setError('Failed to load project details.');
        setLoading(false);
      }
    );

    // Listen to payments to calculate running total paid
    const paymentsRef = collection(db, 'projects', projectId, 'payments');
    const unsubPayments = onSnapshot(paymentsRef, (snap) => {
      const sum = snap.docs.reduce((acc, d) => acc + (Number(d.data().amount) || 0), 0);
      setTotalPaid(sum);
    });

    return () => {
      unsubProject();
      unsubPayments();
    };
  }, [projectId]);

  const handleSaveCost = async (pId: string, newCost: string | number) => {
    setIsSavingCost(true);
    setCostFeedback(null);
    try {
      const numericVal = typeof newCost === 'string' ? parseFloat(newCost) : newCost;
      const ref = doc(db, 'projects', pId);
      await updateDoc(ref, {
        totalCost: numericVal,
        updatedAt: new Date().toISOString()
      });
      setCostFeedback({ type: 'success', message: 'Contract cost updated successfully.' });
      setTimeout(() => setCostFeedback(null), 4000);
    } catch (err: any) {
      console.error('Error saving cost:', err);
      setCostFeedback({ type: 'error', message: err.message || 'Failed to update cost.' });
    } finally {
      setIsSavingCost(false);
    }
  };

  const handleBack = () => {
    if (profile?.role === 'owner') {
      navigate('/admin');
    } else if (isStaff) {
      navigate('/dashboard');
    } else {
      navigate('/portal');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream/30 pt-28 pb-16 flex items-center justify-center">
        <div className="p-8 text-center space-y-3">
          <div className="w-10 h-10 border-3 border-ochre border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-charcoal/60">Loading project tracker...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-cream/30 pt-28 pb-16 px-4">
        <div className="max-w-xl mx-auto bg-white rounded-3xl p-8 border border-charcoal/10 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-charcoal">Unable to Load Project</h2>
          <p className="text-sm text-charcoal/60">{error || 'This project could not be found or you do not have permission to view it.'}</p>
          <button
            onClick={handleBack}
            className="px-6 py-2.5 rounded-xl bg-ochre text-white font-bold text-xs hover:bg-ochre-dark transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Access check: isStaff or project client
  const isClient = (profile?.uid && project.clientId === profile.uid) || (user?.uid && project.clientId === user.uid);
  if (!isStaff && !isClient) {
    return (
      <div className="min-h-screen bg-cream/30 pt-28 pb-16 px-4">
        <div className="max-w-xl mx-auto bg-white rounded-3xl p-8 border border-charcoal/10 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-ochre flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-charcoal">Access Restricted</h2>
          <p className="text-sm text-charcoal/60">You do not have authorization to view this project tracker.</p>
          <button
            onClick={handleBack}
            className="px-6 py-2.5 rounded-xl bg-charcoal text-white font-bold text-xs hover:bg-charcoal/80 transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Portal
          </button>
        </div>
      </div>
    );
  }

  const totalCost = Number(project.totalCost ?? 0);
  const balance = totalCost - totalPaid;

  return (
    <div className="min-h-screen bg-cream/30 pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Navigation & Header */}
        <div className="space-y-4">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-xs font-bold text-charcoal/60 hover:text-charcoal transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>

          {/* Project Banner Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-charcoal/10 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-ochre/10 text-ochre px-3 py-1 rounded-full border border-ochre/20">
                    Stage: {project.currentStageName || 'Started'}
                  </span>
                  {project.categoryTitle && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-charcoal/5 text-charcoal/60 px-3 py-1 rounded-full">
                      {project.categoryTitle}
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-charcoal tracking-tight">
                  {project.name}
                </h1>

                <div className="flex items-center gap-4 text-xs text-charcoal/50 flex-wrap">
                  <span className="flex items-center gap-1.5 font-medium">
                    <User className="w-3.5 h-3.5 text-ochre" /> Client: <strong className="text-charcoal">{project.clientName || 'Assigned Client'}</strong>
                  </span>
                  {project.createdAt && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Started: {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Staff Total Cost Editor */}
              {isStaff && (
                <div className="bg-cream/40 p-4 rounded-2xl border border-charcoal/10 space-y-2 shrink-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-charcoal/60">
                      Agreed Contract Cost
                    </span>
                    <span className="text-[10px] text-charcoal/40 font-medium">USD ($)</span>
                  </div>
                  <ProjectCostEditor
                    project={project}
                    onSaveCost={handleSaveCost}
                    isSaving={isSavingCost}
                    feedback={costFeedback}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-charcoal/10 gap-2 sm:gap-4 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('progress')}
            className={cn(
              "flex items-center gap-2 px-4 sm:px-6 py-3 font-bold text-xs sm:text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap",
              activeTab === 'progress'
                ? "border-ochre text-ochre"
                : "border-transparent text-charcoal/50 hover:text-charcoal hover:border-charcoal/20"
            )}
          >
            <Activity className="w-4 h-4" />
            <span>Progress & Updates</span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={cn(
              "flex items-center gap-2 px-4 sm:px-6 py-3 font-bold text-xs sm:text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap",
              activeTab === 'payments'
                ? "border-ochre text-ochre"
                : "border-transparent text-charcoal/50 hover:text-charcoal hover:border-charcoal/20"
            )}
          >
            <CreditCard className="w-4 h-4" />
            <span>Payments & Financial Ledger</span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={cn(
              "flex items-center gap-2 px-4 sm:px-6 py-3 font-bold text-xs sm:text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap",
              activeTab === 'chat'
                ? "border-ochre text-ochre"
                : "border-transparent text-charcoal/50 hover:text-charcoal hover:border-charcoal/20"
            )}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Project Chat</span>
          </button>
        </div>

        {/* Tab 1: Progress */}
        {activeTab === 'progress' && (
          <div className="space-y-8 animate-fade-in">
            {/* Core Progress Tracker */}
            <ProjectTracker
              project={project}
              isReadOnly={!isStaff}
              onOpenChatWithTag={(tag) => {
                setChatTaggedContext(tag);
                setActiveTab('chat');
              }}
            />

            {/* Financial Summary Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-charcoal/10 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <h3 className="text-xl font-bold text-charcoal">Financial Snapshot</h3>
                  </div>
                  <p className="text-xs text-charcoal/60">
                    High-level contract balance and payment summary.
                  </p>
                </div>

                <button
                  onClick={() => setActiveTab('payments')}
                  className="px-5 py-2.5 rounded-2xl bg-cream border border-charcoal/15 text-charcoal hover:border-ochre hover:text-ochre text-xs font-bold transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
                >
                  <CreditCard className="w-4 h-4 text-ochre" />
                  <span>View Full Payment Ledger</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 bg-cream/40 rounded-2xl border border-charcoal/10">
                  <span className="text-[11px] uppercase font-bold text-charcoal/50 block">Contract Total</span>
                  <span className="text-xl font-black text-charcoal mt-1 block">
                    ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                  <span className="text-[11px] uppercase font-bold text-emerald-700 block">Total Received</span>
                  <span className="text-xl font-black text-emerald-700 mt-1 block">
                    ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-4 bg-cream/40 rounded-2xl border border-charcoal/10">
                  <span className="text-[11px] uppercase font-bold text-charcoal/50 block">
                    {balance < 0 ? 'Overpaid' : 'Balance Remaining'}
                  </span>
                  <span className={cn(
                    "text-xl font-black mt-1 block",
                    balance < 0 ? "text-emerald-600" : balance === 0 ? "text-charcoal/70" : "text-red-600"
                  )}>
                    ${Math.abs(balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Internal Expense Tracker (Staff Only) */}
            {isStaff && (
              <ExpenseTracker projectId={project.id} isReadOnly={false} />
            )}

            {/* Leave a Review (Clients Only) */}
            {!isStaff && (
              <ProjectReviewCard project={project} />
            )}
          </div>
        )}

        {/* Tab 2: Payments & Ledger */}
        {activeTab === 'payments' && (
          <div className="animate-fade-in">
            <PaymentLog
              projectId={project.id}
              project={project}
              isStaff={isStaff}
            />
          </div>
        )}

        {/* Tab 3: Project Chat */}
        {activeTab === 'chat' && (
          <div className="animate-fade-in bg-white rounded-3xl p-6 sm:p-8 border border-charcoal/10 shadow-sm">
            <ProjectChat
              clientId={project.clientId}
              clientName={project.clientName || 'Client'}
              initialTaggedContext={chatTaggedContext}
              onClearTag={() => setChatTaggedContext(undefined)}
            />
          </div>
        )}

      </div>
    </div>
  );
}
