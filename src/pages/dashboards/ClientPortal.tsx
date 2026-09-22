import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout, { NavItemConfig } from '../../components/AdminLayout';
import { collection, query, getDocs, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { 
  Sparkles, MessageSquare, Compass, Phone, ArrowRight, ExternalLink, 
  Calendar, Briefcase, DollarSign, Receipt, CreditCard, Search, ArrowDownRight, 
  CheckCircle2, Download, HelpCircle
} from 'lucide-react';
import ProjectChat from '../../components/ProjectChat';
import OnboardingWalkthrough from '../../components/onboarding/OnboardingWalkthrough';

interface ClientPaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: string;
  reference: string;
  projectName: string;
  projectId?: string;
  invoiceNumber?: string;
  notes?: string;
  source: 'project' | 'receipt' | 'invoice';
}

export default function ClientPortal() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatTaggedContext, setChatTaggedContext] = useState<string | undefined>();
  const initialTab = (searchParams.get('tab') as 'tracker' | 'cashflow' | 'chat') || 'tracker';
  const [activeTab, setActiveTab] = useState<'tracker' | 'cashflow' | 'chat'>(initialTab);

  // Cash flow consolidated payments
  const [payments, setPayments] = useState<ClientPaymentRecord[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [forceOpenTour, setForceOpenTour] = useState(false);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && (tab === 'tracker' || tab === 'cashflow' || tab === 'chat')) {
      setActiveTab(tab as any);
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
      fetchConsolidatedPayments();
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
      if (!showListOnly && activeList.length === 1 && !searchParams.get('tab')) {
        navigate(`/tracker/${activeList[0].id}`, { replace: true });
        return;
      }
    } catch (err) {
      console.error('Error fetching client project:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all payments across projects and invoices
  const fetchConsolidatedPayments = async () => {
    if (!profile?.uid) return;
    setLoadingPayments(true);
    try {
      const consolidated: ClientPaymentRecord[] = [];
      const seenKeys = new Set<string>();

      // 1. Fetch payments from all client projects
      const projSnap = await getDocs(query(collection(db, 'projects'), where('clientId', '==', profile.uid)));
      for (const pDoc of projSnap.docs) {
        const pData = pDoc.data();
        try {
          const paySnap = await getDocs(collection(db, 'projects', pDoc.id, 'payments'));
          paySnap.docs.forEach(payDoc => {
            const pay = payDoc.data();
            const refCode = (pay.reference || '').trim();
            const dedupeKey = refCode ? `ref:${refCode.toLowerCase()}` : `proj:${pDoc.id}-${pay.date}-${pay.amount}`;
            
            if (!seenKeys.has(dedupeKey)) {
              seenKeys.add(dedupeKey);
              consolidated.push({
                id: payDoc.id,
                date: pay.date || pay.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
                amount: Number(pay.amount) || 0,
                method: pay.method || 'M-Pesa',
                reference: refCode || '—',
                projectName: pData.name || 'Custom Project',
                projectId: pDoc.id,
                notes: pay.notes || '',
                source: 'project'
              });
            }
          });
        } catch (err) {
          console.warn(`Could not read payments for project ${pDoc.id}:`, err);
        }
      }

      // 2. Fetch receipts and payment items from invoices linked to client
      try {
        const invSnap = await getDocs(query(collection(db, 'invoices'), where('clientId', '==', profile.uid)));
        for (const invDoc of invSnap.docs) {
          const invData = invDoc.data();
          const invName = invData.projectName || `Invoice #${invData.docNumber || 'INV'}`;
          
          // Payment receipts subcollection
          try {
            const recSnap = await getDocs(collection(db, 'invoices', invDoc.id, 'paymentReceipts'));
            recSnap.docs.forEach(rDoc => {
              const rData = rDoc.data();
              const refCode = (rData.referenceNumber || rData.receiptNumber || '').trim();
              const dedupeKey = refCode ? `ref:${refCode.toLowerCase()}` : `rec:${invDoc.id}-${rData.date}-${rData.amount}`;
              
              if (!seenKeys.has(dedupeKey)) {
                seenKeys.add(dedupeKey);
                consolidated.push({
                  id: rDoc.id,
                  date: rData.date || rData.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
                  amount: Number(rData.amount) || 0,
                  method: rData.paymentMethod || 'M-Pesa',
                  reference: refCode || '—',
                  projectName: invName,
                  projectId: invData.projectId,
                  invoiceNumber: invData.docNumber,
                  notes: rData.notes || 'Invoice Payment Receipt',
                  source: 'receipt'
                });
              }
            });
          } catch (rErr) {
            console.warn(`Could not fetch receipts for invoice ${invDoc.id}:`, rErr);
          }

          // If no receipts were created yet, check invoice items for recorded payments
          if (Array.isArray(invData.items)) {
            invData.items.forEach((item: any, idx: number) => {
              if (item.amount && Number(item.amount) > 0 && item.paymentType && item.paymentType !== 'Balance') {
                const itemRef = (item.refCode || '').trim();
                const dedupeKey = itemRef && itemRef !== '—' 
                  ? `ref:${itemRef.toLowerCase()}` 
                  : `item:${invDoc.id}-${idx}-${item.amount}`;
                
                if (!seenKeys.has(dedupeKey)) {
                  seenKeys.add(dedupeKey);
                  consolidated.push({
                    id: `${invDoc.id}-${idx}`,
                    date: item.date || invData.date || new Date().toISOString().split('T')[0],
                    amount: Number(item.amount),
                    method: item.paymentType || 'M-Pesa',
                    reference: itemRef || '—',
                    projectName: invName,
                    projectId: invData.projectId,
                    invoiceNumber: invData.docNumber,
                    notes: item.description || item.name || 'Invoice Payment',
                    source: 'invoice'
                  });
                }
              }
            });
          }
        }
      } catch (invErr) {
        console.warn('Could not query invoices for client cash flow:', invErr);
      }

      // Sort by date descending
      consolidated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPayments(consolidated);
    } catch (err) {
      console.error('Error fetching consolidated payments:', err);
    } finally {
      setLoadingPayments(false);
    }
  };

  const filteredPayments = payments.filter(p => {
    if (!paymentSearch.trim()) return true;
    const term = paymentSearch.toLowerCase();
    return (
      p.projectName.toLowerCase().includes(term) ||
      p.reference.toLowerCase().includes(term) ||
      p.method.toLowerCase().includes(term) ||
      (p.notes && p.notes.toLowerCase().includes(term)) ||
      (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(term))
    );
  });

  const totalPaidAll = payments.reduce((sum, p) => sum + p.amount, 0);

  const handleExportCSV = () => {
    if (payments.length === 0) return;
    const headers = ['Date', 'Project / Reference', 'Payment Method', 'Reference Code', 'Amount (KES)', 'Notes'];
    const rows = payments.map(p => [
      `"${p.date}"`,
      `"${p.projectName}"`,
      `"${p.method}"`,
      `"${p.reference}"`,
      p.amount,
      `"${(p.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Pamnim_Cash_Flow_${profile?.name || 'Client'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const clientNavItems: NavItemConfig[] = [
    { id: 'tracker', label: 'My Projects & Tracker', icon: Briefcase },
    { id: 'cashflow', label: 'Cash Flow', icon: DollarSign },
    { id: 'chat', label: 'Chat with Designers', icon: MessageSquare },
  ];

  return (
    <AdminLayout activeTab={activeTab} onTabChange={handleTabChange} navItems={clientNavItems}>
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
              Track your project progress in real-time, view your consolidated cash flow and payment receipts, or chat directly with our design team.
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForceOpenTour(true)}
              className="px-4 py-2.5 rounded-2xl bg-white text-ochre font-bold text-xs shadow-md hover:bg-cream transition-all flex items-center gap-2 cursor-pointer shrink-0"
              title="Start guided onboarding walkthrough"
            >
              <Compass className="w-4 h-4 text-ochre" />
              <span>Tour My Portal</span>
            </button>
          </div>

          <Sparkles className="absolute -bottom-10 -right-10 w-64 h-64 text-white/5 pointer-events-none" />
        </div>

        {/* Tab 1: Tracker */}
        {activeTab === 'tracker' && (
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
        )}

        {/* Tab 2: Cash Flow (Consolidated financial history across all projects & invoices) */}
        {activeTab === 'cashflow' && (
          <div className="space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="bg-white rounded-3xl p-6 border border-charcoal/10 shadow-sm space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-charcoal/50">Total Paid (All Projects)</span>
                <p className="text-2xl sm:text-3xl font-bold text-emerald-700 font-mono">
                  KES {totalPaidAll.toLocaleString()}
                </p>
                <p className="text-[11px] text-charcoal/50">Consolidated payments recorded across your invoices & projects</p>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-charcoal/10 shadow-sm space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-charcoal/50">Transactions Logged</span>
                <p className="text-2xl sm:text-3xl font-bold text-charcoal">
                  {payments.length}
                </p>
                <p className="text-[11px] text-charcoal/50">Verified receipts & milestone deposits</p>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-charcoal/10 shadow-sm space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-charcoal/50">Active Projects</span>
                <p className="text-2xl sm:text-3xl font-bold text-ochre">
                  {projects.length}
                </p>
                <p className="text-[11px] text-charcoal/50">Linked luxury interior designs</p>
              </div>
            </div>

            {/* Main Ledger Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-charcoal/10 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-charcoal">Consolidated Payment History</h3>
                  <p className="text-xs text-charcoal/60 mt-0.5">
                    Real-time financial statement of all deposits and installment receipts across your Pamnim projects.
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {payments.length > 0 && (
                    <button
                      onClick={handleExportCSV}
                      className="px-4 py-2.5 rounded-xl border border-charcoal/15 text-xs font-bold text-charcoal hover:bg-cream transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-ochre" />
                      <span>Download Statement (CSV)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-charcoal/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by project name, M-Pesa code, or payment method..."
                  value={paymentSearch}
                  onChange={(e) => setPaymentSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre focus:bg-white"
                />
              </div>

              {loadingPayments ? (
                <div className="p-12 text-center text-charcoal/40 animate-pulse text-sm">
                  Loading your payment history...
                </div>
              ) : filteredPayments.length === 0 ? (
                <div className="p-12 text-center bg-cream/20 rounded-2xl border border-dashed border-charcoal/15 space-y-2">
                  <Receipt className="w-8 h-8 text-charcoal/30 mx-auto" />
                  <p className="text-sm font-bold text-charcoal/70">
                    {paymentSearch ? 'No matching payment records found.' : 'No payments recorded yet.'}
                  </p>
                  <p className="text-xs text-charcoal/50 max-w-md mx-auto">
                    {paymentSearch 
                      ? 'Try adjusting your search keywords.' 
                      : 'Once your deposits or milestone payments are recorded by our accounting team, your receipts and confirmation codes will appear here automatically.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-charcoal/10 text-[10px] font-bold uppercase tracking-wider text-charcoal/50">
                        <th className="py-3 px-3">Date</th>
                        <th className="py-3 px-3">Project / Invoice</th>
                        <th className="py-3 px-3">Method</th>
                        <th className="py-3 px-3">Reference / Code</th>
                        <th className="py-3 px-3 text-right">Amount (KES)</th>
                        <th className="py-3 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-charcoal/5 text-xs">
                      {filteredPayments.map((p) => (
                        <tr key={p.id} className="hover:bg-cream/40 transition-colors">
                          <td className="py-3.5 px-3 whitespace-nowrap font-medium text-charcoal/70">
                            {new Date(p.date).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="font-bold text-charcoal block">{p.projectName}</span>
                            {p.invoiceNumber && (
                              <span className="text-[10px] text-charcoal/40 block">Inv #{p.invoiceNumber}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-charcoal/5 text-charcoal font-semibold text-[11px]">
                              <CreditCard className="w-3 h-3 text-ochre" />
                              {p.method}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 font-mono text-[11px] font-bold text-charcoal/80 whitespace-nowrap">
                            {p.reference}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                            KES {p.amount.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Verified
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Chat with Designers */}
        {activeTab === 'chat' && (
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

      {/* Guided Walkthrough for Client */}
      <OnboardingWalkthrough
        role="client"
        forceOpen={forceOpenTour}
        onClose={() => setForceOpenTour(false)}
        onNavigateTab={(tab) => handleTabChange(tab)}
      />
    </AdminLayout>
  );
}
