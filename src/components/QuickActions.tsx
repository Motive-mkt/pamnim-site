import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, query, onSnapshot, getDocs, addDoc, serverTimestamp, doc, getDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useCMS } from '../hooks/useCMS';
import { 
  FolderPlus, FileSignature, FileText, CreditCard, Tag, UserPlus, 
  Receipt, Users, HardHat, Clock, ArrowUpDown, DollarSign, Wallet,
  Search, X, CheckCircle2, AlertCircle, ChevronRight, ArrowRight,
  Sparkle, ExternalLink, Zap
} from 'lucide-react';
import { cn } from '../lib/utils';
import StartProjectModal from './StartProjectModal';
import CatalogManagerModal from './CatalogManagerModal';

interface QuickActionsProps {
  onNavigateTab: (tabId: string, options?: { subtab?: string; openModal?: string }) => void;
  projects?: any[];
  clients?: any[];
  onRefreshData?: () => void;
  onOpenHrmsModal?: (tab: 'payrun' | 'calendar' | 'settlement' | 'requests' | 'workers' | 'logs' | 'payments' | 'summary', modal?: 'worker' | 'log' | 'payment') => void;
}

export default function QuickActions({
  onNavigateTab,
  projects: propProjects,
  clients: propClients,
  onRefreshData,
  onOpenHrmsModal
}: QuickActionsProps) {
  const { profile, isOwner, isStaff, canApproveSignups } = useAuth();
  const { content } = useCMS();

  // Async states (Zero loading flash: badge loads async while grid renders immediately)
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number | null>(null);

  // Local fallback cache for projects and clients
  const [projectsList, setProjectsList] = useState<any[]>(propProjects || []);
  const [clientsList, setClientsList] = useState<any[]>(propClients || []);

  // Modals state
  const [showStartProject, setShowStartProject] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [showPaymentPickerModal, setShowPaymentPickerModal] = useState(false);
  const [showExpensePickerModal, setShowExpensePickerModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showWorkerWageRequestModal, setShowWorkerWageRequestModal] = useState(false);
  const [showWorkerBalanceModal, setShowWorkerBalanceModal] = useState(false);

  // Type-ahead states for Payment Logging
  const [paymentSearch, setPaymentSearch] = useState('');
  const [selectedPaymentProject, setSelectedPaymentProject] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'bank' | 'cash' | 'card'>('mpesa');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Type-ahead states for Expense Logging
  const [expenseSearch, setExpenseSearch] = useState('');
  const [selectedExpenseProject, setSelectedExpenseProject] = useState<any | null>(null);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<string>('Materials');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expenseNote, setExpenseNote] = useState('');
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [expenseSuccess, setExpenseSuccess] = useState<string | null>(null);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  // Add Customer / Lead state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerProjectType, setCustomerProjectType] = useState('Residential Interior');
  const [customerNotes, setCustomerNotes] = useState('');
  const [openWhatsAppOnAdd, setOpenWhatsAppOnAdd] = useState(true);
  const [submittingCustomer, setSubmittingCustomer] = useState(false);
  const [customerSuccess, setCustomerSuccess] = useState<string | null>(null);
  const [customerError, setCustomerError] = useState<string | null>(null);

  // Worker role state
  const [workerWageAmount, setWorkerWageAmount] = useState('');
  const [workerWageNote, setWorkerWageNote] = useState('');
  const [workerWageProjectId, setWorkerWageProjectId] = useState('');
  const [submittingWageRequest, setSubmittingWageRequest] = useState(false);
  const [workerBalanceData, setWorkerBalanceData] = useState<{ totalEarned: number; totalPaid: number; balance: number } | null>(null);
  const [wageSuccess, setWageSuccess] = useState<string | null>(null);

  // 1. Live listener for Pending Requests count (async, does not block initial grid)
  useEffect(() => {
    const profilesQuery = query(collection(db, 'profiles'));
    const unsub = onSnapshot(profilesQuery, (snap) => {
      const pendingCount = snap.docs.filter(d => {
        const data = d.data();
        return data.status === 'pending' || data.role === 'pending';
      }).length;
      setPendingRequestsCount(pendingCount);
    }, (err) => {
      console.warn('Could not listen to pending signups:', err);
    });

    return () => unsub();
  }, []);

  // 2. Fetch projects and clients if not provided via props
  useEffect(() => {
    if (propProjects && propProjects.length > 0) {
      setProjectsList(propProjects);
    } else {
      getDocs(collection(db, 'projects')).then(snap => {
        setProjectsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }).catch(err => console.warn('Error loading projects for quick actions:', err));
    }
  }, [propProjects]);

  useEffect(() => {
    if (propClients && propClients.length > 0) {
      setClientsList(propClients);
    } else {
      getDocs(collection(db, 'profiles')).then(snap => {
        const clients = snap.docs
          .map(d => ({ id: d.id, uid: d.id, ...d.data() }))
          .filter((p: any) => p.role === 'client' && p.status !== 'pending');
        setClientsList(clients);
      }).catch(err => console.warn('Error loading clients for quick actions:', err));
    }
  }, [propClients]);

  // 3. If worker role, calculate worker balance
  useEffect(() => {
    if (profile?.role === 'worker' && profile?.uid) {
      const fetchWorkerStats = async () => {
        try {
          const logsSnap = await getDocs(collection(db, 'workLogs'));
          const myLogs = logsSnap.docs
            .map(d => d.data())
            .filter((l: any) => l.workerId === profile.uid);

          const paymentsSnap = await getDocs(collection(db, 'workerPayments'));
          const myPayments = paymentsSnap.docs
            .map(d => d.data())
            .filter((p: any) => p.workerId === profile.uid);

          const totalPaid = myPayments.reduce((acc, p: any) => acc + (Number(p.amount) || 0), 0);
          const totalEarned = myLogs.reduce((acc, l: any) => {
            const rate = Number(l.dailyRate) || 1500;
            const factor = l.duration === 'half_day' ? 0.5 : l.duration === 'overtime' ? 1.5 : 1.0;
            return acc + (rate * factor);
          }, 0);

          setWorkerBalanceData({
            totalEarned,
            totalPaid,
            balance: Math.max(0, totalEarned - totalPaid)
          });
        } catch (err) {
          console.warn('Error fetching worker balance:', err);
        }
      };

      fetchWorkerStats();
    }
  }, [profile?.role, profile?.uid]);

  // Filtered projects for payment type-ahead
  const filteredPaymentProjects = useMemo(() => {
    if (!paymentSearch.trim()) return projectsList.slice(0, 10);
    const term = paymentSearch.toLowerCase().trim();
    return projectsList.filter(p => 
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.clientName && p.clientName.toLowerCase().includes(term)) ||
      (p.categoryTitle && p.categoryTitle.toLowerCase().includes(term))
    ).slice(0, 12);
  }, [projectsList, paymentSearch]);

  // Filtered projects for expense type-ahead
  const filteredExpenseProjects = useMemo(() => {
    if (!expenseSearch.trim()) return projectsList.slice(0, 10);
    const term = expenseSearch.toLowerCase().trim();
    return projectsList.filter(p => 
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.clientName && p.clientName.toLowerCase().includes(term)) ||
      (p.categoryTitle && p.categoryTitle.toLowerCase().includes(term))
    ).slice(0, 12);
  }, [projectsList, expenseSearch]);

  // Handler: Save Payment
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaymentProject) return;

    const numAmount = parseFloat(paymentAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setPaymentError('Please enter a valid amount greater than 0.');
      return;
    }

    setSubmittingPayment(true);
    setPaymentError(null);
    try {
      const paymentDateIso = new Date(paymentDate).toISOString();
      await addDoc(collection(db, 'projects', selectedPaymentProject.id, 'payments'), {
        amount: numAmount,
        date: paymentDateIso,
        method: paymentMethod,
        reference: paymentReference.trim(),
        recordedBy: profile?.name || 'Staff',
        note: paymentNote.trim(),
        createdAt: new Date().toISOString()
      });

      setPaymentSuccess(`Payment of KES ${numAmount.toLocaleString()} recorded successfully for "${selectedPaymentProject.name}".`);
      setPaymentAmount('');
      setPaymentReference('');
      setPaymentNote('');
      onRefreshData?.();

      setTimeout(() => {
        setPaymentSuccess(null);
        setSelectedPaymentProject(null);
        setShowPaymentPickerModal(false);
      }, 2000);
    } catch (err: any) {
      console.error('Error logging payment:', err);
      setPaymentError(err.message || 'Failed to record payment.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Handler: Save Expense
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpenseProject) return;

    const numAmount = parseFloat(expenseAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setExpenseError('Please enter a valid expense amount.');
      return;
    }

    setSubmittingExpense(true);
    setExpenseError(null);
    try {
      const expDateObj = new Date(expenseDate);
      await addDoc(collection(db, 'projects', selectedExpenseProject.id, 'expenses'), {
        amount: numAmount,
        category: expenseCategory,
        note: expenseNote.trim() || '',
        date: expDateObj,
        createdAt: serverTimestamp(),
        createdBy: profile?.name || 'Staff'
      });

      setExpenseSuccess(`Expense of KES ${numAmount.toLocaleString()} logged under ${expenseCategory}.`);
      setExpenseAmount('');
      setExpenseNote('');
      onRefreshData?.();

      setTimeout(() => {
        setExpenseSuccess(null);
        setSelectedExpenseProject(null);
        setShowExpensePickerModal(false);
      }, 2000);
    } catch (err: any) {
      console.error('Error logging expense:', err);
      setExpenseError(err.message || 'Failed to record expense.');
    } finally {
      setSubmittingExpense(false);
    }
  };

  // Handler: Save Customer (manual lead)
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) {
      setCustomerError('Customer name and phone number are required.');
      return;
    }

    setSubmittingCustomer(true);
    setCustomerError(null);
    try {
      const newInquiry = {
        name: customerName.trim(),
        phone: customerPhone.trim(),
        email: customerEmail.trim() || '',
        projectType: customerProjectType,
        message: customerNotes.trim() || 'Manual lead logged via Quick Actions.',
        status: 'new',
        createdAt: new Date().toISOString(),
        source: 'Quick Actions Lead Entry',
        recordedBy: profile?.name || 'Staff'
      };

      await addDoc(collection(db, 'inquiries'), newInquiry);

      setCustomerSuccess(`Lead "${customerName}" recorded in Customer Inquiries.`);

      if (openWhatsAppOnAdd && customerPhone.trim()) {
        const cleanPhone = customerPhone.replace(/\D/g, '');
        const messageText = `Hello ${customerName.trim()}, thank you for your interest in Pamnim Interior Designers. Our design team is ready to discuss your ${customerProjectType} project!`;
        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      }

      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setCustomerNotes('');
      onRefreshData?.();

      setTimeout(() => {
        setCustomerSuccess(null);
        setShowCustomerModal(false);
      }, 2000);
    } catch (err: any) {
      console.error('Error adding customer:', err);
      setCustomerError(err.message || 'Failed to add customer lead.');
    } finally {
      setSubmittingCustomer(false);
    }
  };

  // Handler: Submit Worker Wage Request (for worker role)
  const handleSubmitWageRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(workerWageAmount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    setSubmittingWageRequest(true);
    try {
      await addDoc(collection(db, 'workerPaymentRequests'), {
        workerId: profile?.uid,
        workerName: profile?.name || 'Worker',
        amount: numAmount,
        projectId: workerWageProjectId || '',
        notes: workerWageNote.trim() || '',
        date: new Date().toISOString(),
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      setWageSuccess('Payment request submitted to project manager.');
      setWorkerWageAmount('');
      setWorkerWageNote('');
      setTimeout(() => {
        setWageSuccess(null);
        setShowWorkerWageRequestModal(false);
      }, 2000);
    } catch (err) {
      console.error('Error requesting wage payment:', err);
    } finally {
      setSubmittingWageRequest(false);
    }
  };

  // Role permissions
  const role = profile?.role || '';
  const isWorker = role === 'worker';
  const isManager = role === 'project_manager' || isOwner;

  // Build the list of actionable cards based strictly on role permissions
  interface QuickCardConfig {
    id: string;
    icon: any;
    label: string;
    description: string;
    badge?: number | string | null;
    onClick: () => void;
  }

  const allCards: QuickCardConfig[] = [];

  // Worker-only cards
  if (isWorker) {
    allCards.push(
      {
        id: 'worker-payment-request',
        icon: DollarSign,
        label: 'Request Payment',
        description: 'Submit an advance or wage disbursement request',
        onClick: () => setShowWorkerWageRequestModal(true)
      },
      {
        id: 'worker-view-balance',
        icon: Wallet,
        label: 'View Balance',
        description: 'Review total earned wages and unpaid shift balance',
        onClick: () => setShowWorkerBalanceModal(true)
      }
    );
  } else {
    // 1. New Project (Owner, Project Managers, Designers, Elevated Employees)
    if (isOwner || isManager || role === 'senior_designer' || role === 'designer' || isStaff) {
      allCards.push({
        id: 'new-project',
        icon: FolderPlus,
        label: 'New Project',
        description: 'Launch a project with 4-stage tracker and service scopes',
        onClick: () => setShowStartProject(true)
      });
    }

    // 2. New Quote (Owner only)
    if (isOwner) {
      allCards.push({
        id: 'new-quote',
        icon: FileSignature,
        label: 'New Quote',
        description: 'Draft a formal quotation or cost estimate',
        onClick: () => onNavigateTab('quotes')
      });
    }

    // 3. New Invoice (Owner only)
    if (isOwner) {
      allCards.push({
        id: 'new-invoice',
        icon: FileText,
        label: 'New Invoice',
        description: 'Generate a PDF tax invoice or billing schedule',
        onClick: () => onNavigateTab('invoices')
      });
    }

    // 4. Log Payment (Owner, Elevated Employees)
    if (isOwner || canApproveSignups) {
      allCards.push({
        id: 'log-payment',
        icon: CreditCard,
        label: 'Log Payment',
        description: 'Record incoming M-Pesa, bank, or cash payment',
        onClick: () => {
          setSelectedPaymentProject(null);
          setPaymentSearch('');
          setPaymentSuccess(null);
          setPaymentError(null);
          setShowPaymentPickerModal(true);
        }
      });
    }

    // 5. Add Item (Owner only - Catalog management)
    if (isOwner) {
      allCards.push({
        id: 'add-item',
        icon: Tag,
        label: 'Add Item',
        description: 'Add a new product, material, or service to catalog',
        onClick: () => setShowCatalogModal(true)
      });
    }

    // 6. Add Customer (Owner, Project Managers, Designers, Staff)
    if (isStaff) {
      allCards.push({
        id: 'add-customer',
        icon: UserPlus,
        label: 'Add Customer',
        description: 'Record a new prospective lead or client inquiry',
        onClick: () => {
          setCustomerSuccess(null);
          setCustomerError(null);
          setShowCustomerModal(true);
        }
      });
    }

    // 7. Add Expense (Owner, Project Manager, Elevated Employees)
    if (isOwner || isManager || canApproveSignups) {
      allCards.push({
        id: 'add-expense',
        icon: Receipt,
        label: 'Add Expense',
        description: 'Record site materials, labor, or transport expense',
        onClick: () => {
          setSelectedExpenseProject(null);
          setExpenseSearch('');
          setExpenseSuccess(null);
          setExpenseError(null);
          setShowExpensePickerModal(true);
        }
      });
    }

    // 8. Pending Requests (Owner, Elevated Staff - with live Firestore badge)
    if (isOwner || canApproveSignups) {
      allCards.push({
        id: 'pending-requests',
        icon: Users,
        label: 'Pending Requests',
        description: 'Review and approve pending staff or client sign-ups',
        badge: pendingRequestsCount && pendingRequestsCount > 0 ? pendingRequestsCount : null,
        onClick: () => onNavigateTab(isOwner ? 'staff' : 'approvals')
      });
    }

    // 9. Log Worker Attendance / Add Worker (Site HRMS - Owner, Project Managers)
    if (isOwner || isManager) {
      allCards.push(
        {
          id: 'fast-daily-payrun',
          icon: Zap,
          label: 'Fast Daily Pay Run',
          description: 'Rapid end-of-day attendance and wage accrual logging',
          onClick: () => {
            if (onOpenHrmsModal) {
              onOpenHrmsModal('payrun' as any);
            } else {
              onNavigateTab('hrms', { subtab: 'payrun' });
            }
          }
        },
        {
          id: 'log-worker-attendance',
          icon: Clock,
          label: 'Log Worker Shift',
          description: 'Record daily attendance, shifts, and tasks for artisans',
          onClick: () => {
            if (onOpenHrmsModal) {
              onOpenHrmsModal('logs', 'log');
            } else {
              onNavigateTab('hrms', { subtab: 'logs', openModal: 'log' });
            }
          }
        },
        {
          id: 'add-worker',
          icon: HardHat,
          label: 'Add Worker',
          description: 'Register a new carpenter, mason, or electrician',
          onClick: () => {
            if (onOpenHrmsModal) {
              onOpenHrmsModal('workers', 'worker');
            } else {
              onNavigateTab('hrms', { subtab: 'workers', openModal: 'worker' });
            }
          }
        }
      );
    }

    // 10. View Transactions (Owner only)
    if (isOwner) {
      allCards.push({
        id: 'view-transactions',
        icon: ArrowUpDown,
        label: 'View Transactions',
        description: 'Inspect consolidated cash ledger and payment receipts',
        onClick: () => onNavigateTab('transactions')
      });
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8 w-full min-w-0">
      {/* Header section */}
      <div className="bg-white rounded-3xl p-5 sm:p-8 border border-charcoal/10 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-ochre animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-ochre">Fast Operations</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-charcoal">Quick Actions</h2>
          <p className="text-xs text-charcoal/60 mt-1 max-w-xl">
            Tappable shortcuts to launch projects, issue invoices, log site payments, and manage team approvals with zero friction.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <span className="text-xs font-semibold px-3 py-1.5 bg-cream text-charcoal/70 rounded-full border border-charcoal/10">
            {allCards.length} Actions Available
          </span>
        </div>
      </div>

      {/* Responsive Grid: 2 columns on mobile, 3-4 on desktop. Instant rendering, zero loading flash! */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
        {allCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              onClick={card.onClick}
              className="group relative flex flex-col justify-between text-left p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-charcoal/10 hover:border-ochre/40 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer min-h-[140px] sm:min-h-[160px] active:scale-[0.98] select-none"
            >
              {/* Top row: Icon and live badge */}
              <div className="flex items-start justify-between w-full gap-2">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-ochre/10 text-ochre group-hover:bg-ochre group-hover:text-white transition-colors flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>

                {card.badge !== undefined && card.badge !== null && (
                  <span className="px-2 py-0.5 text-[10px] sm:text-[11px] font-black rounded-full bg-ochre text-white shadow-sm animate-pulse shrink-0">
                    {card.badge} {typeof card.badge === 'number' ? 'New' : ''}
                  </span>
                )}
              </div>

              {/* Bottom row: Label, one-line description, and subtle arrow */}
              <div className="mt-3 sm:mt-4 w-full">
                <div className="flex items-center justify-between gap-1">
                  <h3 className="font-bold text-xs sm:text-sm text-charcoal group-hover:text-ochre transition-colors truncate">
                    {card.label}
                  </h3>
                  <ChevronRight className="w-3.5 h-3.5 text-charcoal/30 group-hover:text-ochre group-hover:translate-x-0.5 transition-all shrink-0 hidden xs:block" />
                </div>
                <p className="text-[10px] sm:text-xs text-charcoal/50 group-hover:text-charcoal/70 transition-colors line-clamp-2 leading-relaxed mt-0.5">
                  {card.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Modal 1: Start Project Modal (Reusing StartProjectModal directly) */}
      <StartProjectModal
        isOpen={showStartProject}
        onClose={() => setShowStartProject(false)}
        clients={clientsList}
        onProjectStarted={() => {
          setShowStartProject(false);
          onRefreshData?.();
        }}
      />

      {/* Modal 2: Add Item Catalog Modal (Reusing CatalogManagerModal with initialOpenAdd=true) */}
      <CatalogManagerModal
        isOpen={showCatalogModal}
        onClose={() => setShowCatalogModal(false)}
        initialOpenAdd={true}
      />

      {/* Modal 3: Log Payment Modal (Type-ahead project picker, then payment form) */}
      {showPaymentPickerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg p-5 sm:p-7 shadow-2xl relative max-h-[90vh] overflow-y-auto border border-charcoal/10">
            <button 
              type="button"
              onClick={() => {
                setShowPaymentPickerModal(false);
                setSelectedPaymentProject(null);
              }}
              className="absolute top-5 right-5 text-charcoal/40 hover:text-charcoal p-1 rounded-xl hover:bg-charcoal/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-charcoal">Log Client Payment</h3>
                <p className="text-xs text-charcoal/50">Record an installment, deposit, or final milestone payout.</p>
              </div>
            </div>

            {paymentSuccess ? (
              <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="text-sm font-bold text-emerald-800">{paymentSuccess}</p>
                <p className="text-xs text-emerald-600">Saved to project payment records.</p>
              </div>
            ) : !selectedPaymentProject ? (
              /* Step 1: Type-ahead project search picker */
              <div className="space-y-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60">
                  Select Project (Type to Filter)
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-charcoal/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by project name or client..."
                    value={paymentSearch}
                    onChange={(e) => setPaymentSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre focus:bg-white"
                    autoFocus
                  />
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {filteredPaymentProjects.length === 0 ? (
                    <div className="p-6 text-center text-xs text-charcoal/40 bg-cream/20 rounded-xl">
                      No matching projects found.
                    </div>
                  ) : (
                    filteredPaymentProjects.map(proj => (
                      <button
                        key={proj.id}
                        type="button"
                        onClick={() => setSelectedPaymentProject(proj)}
                        className="w-full flex items-center justify-between p-3 rounded-xl border border-charcoal/10 hover:border-ochre hover:bg-ochre/5 transition-all text-left text-xs"
                      >
                        <div>
                          <p className="font-bold text-charcoal text-xs sm:text-sm">{proj.name}</p>
                          <p className="text-[11px] text-charcoal/50">
                            Client: <span className="font-medium text-charcoal/70">{proj.clientName || 'Unassigned'}</span>
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cream text-charcoal/60 uppercase">
                          Select
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              /* Step 2: Payment Form for Selected Project */
              <form onSubmit={handleSavePayment} className="space-y-4">
                <div className="p-3 bg-cream/40 rounded-2xl border border-charcoal/10 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-ochre">Target Project</span>
                    <p className="text-xs sm:text-sm font-bold text-charcoal">{selectedPaymentProject.name}</p>
                    <p className="text-[11px] text-charcoal/50">Client: {selectedPaymentProject.clientName || 'Direct Client'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentProject(null)}
                    className="text-[11px] text-ochre font-bold hover:underline"
                  >
                    Change Project
                  </button>
                </div>

                {paymentError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{paymentError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                    Amount (KES) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    placeholder="e.g. 150000"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full p-3 bg-cream/40 border border-charcoal/15 rounded-xl text-sm font-bold focus:outline-none focus:border-ochre focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                      Payment Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full p-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs font-bold focus:outline-none focus:border-ochre focus:bg-white"
                    >
                      <option value="mpesa">M-Pesa</option>
                      <option value="bank">Bank Transfer</option>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full p-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs font-medium focus:outline-none focus:border-ochre focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                    Reference Code / Receipt Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. QJK992KL88"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="w-full p-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs font-mono focus:outline-none focus:border-ochre focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                    Internal Note / Scope Milestone
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 50% deposit for Gypsum & Woodwork"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    className="w-full p-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs focus:outline-none focus:border-ochre focus:bg-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentProject(null)}
                    className="px-4 py-2 rounded-xl border border-charcoal/15 text-charcoal/70 text-xs font-bold hover:bg-cream"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPayment}
                    className="px-5 py-2.5 rounded-xl bg-ochre text-white text-xs font-bold hover:bg-ochre-dark transition-all disabled:opacity-50"
                  >
                    {submittingPayment ? 'Saving...' : 'Record Payment'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal 4: Add Expense Modal (Type-ahead project picker, then expense form) */}
      {showExpensePickerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg p-5 sm:p-7 shadow-2xl relative max-h-[90vh] overflow-y-auto border border-charcoal/10">
            <button 
              type="button"
              onClick={() => {
                setShowExpensePickerModal(false);
                setSelectedExpenseProject(null);
              }}
              className="absolute top-5 right-5 text-charcoal/40 hover:text-charcoal p-1 rounded-xl hover:bg-charcoal/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-charcoal">Add Project Expense</h3>
                <p className="text-xs text-charcoal/50">Record site procurement, subcontractor fee, or materials purchase.</p>
              </div>
            </div>

            {expenseSuccess ? (
              <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="text-sm font-bold text-emerald-800">{expenseSuccess}</p>
                <p className="text-xs text-emerald-600">Saved to project expense ledger.</p>
              </div>
            ) : !selectedExpenseProject ? (
              /* Step 1: Type-ahead project search */
              <div className="space-y-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60">
                  Select Project (Type to Filter)
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-charcoal/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by project name or client..."
                    value={expenseSearch}
                    onChange={(e) => setExpenseSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre focus:bg-white"
                    autoFocus
                  />
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {filteredExpenseProjects.length === 0 ? (
                    <div className="p-6 text-center text-xs text-charcoal/40 bg-cream/20 rounded-xl">
                      No matching projects found.
                    </div>
                  ) : (
                    filteredExpenseProjects.map(proj => (
                      <button
                        key={proj.id}
                        type="button"
                        onClick={() => setSelectedExpenseProject(proj)}
                        className="w-full flex items-center justify-between p-3 rounded-xl border border-charcoal/10 hover:border-ochre hover:bg-ochre/5 transition-all text-left text-xs"
                      >
                        <div>
                          <p className="font-bold text-charcoal text-xs sm:text-sm">{proj.name}</p>
                          <p className="text-[11px] text-charcoal/50">
                            Client: <span className="font-medium text-charcoal/70">{proj.clientName || 'Direct Client'}</span>
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cream text-charcoal/60 uppercase">
                          Select
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              /* Step 2: Expense Form */
              <form onSubmit={handleSaveExpense} className="space-y-4">
                <div className="p-3 bg-cream/40 rounded-2xl border border-charcoal/10 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-ochre">Target Project</span>
                    <p className="text-xs sm:text-sm font-bold text-charcoal">{selectedExpenseProject.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedExpenseProject(null)}
                    className="text-[11px] text-ochre font-bold hover:underline"
                  >
                    Change Project
                  </button>
                </div>

                {expenseError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{expenseError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                    Amount (KES) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    placeholder="e.g. 24500"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full p-3 bg-cream/40 border border-charcoal/15 rounded-xl text-sm font-bold focus:outline-none focus:border-ochre focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                      Expense Category
                    </label>
                    <select
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value)}
                      className="w-full p-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs font-bold focus:outline-none focus:border-ochre focus:bg-white"
                    >
                      <option value="Materials">Materials & Supplies</option>
                      <option value="Labor & Wages">Labor & Wages</option>
                      <option value="Transport & Logistics">Transport & Logistics</option>
                      <option value="Subcontractor">Subcontractor</option>
                      <option value="Miscellaneous">Miscellaneous</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      required
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="w-full p-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs font-medium focus:outline-none focus:border-ochre focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                    Vendor / Description Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Crown Paints purchase receipt from Hardware Junction"
                    value={expenseNote}
                    onChange={(e) => setExpenseNote(e.target.value)}
                    className="w-full p-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs focus:outline-none focus:border-ochre focus:bg-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedExpenseProject(null)}
                    className="px-4 py-2 rounded-xl border border-charcoal/15 text-charcoal/70 text-xs font-bold hover:bg-cream"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submittingExpense}
                    className="px-5 py-2.5 rounded-xl bg-ochre text-white text-xs font-bold hover:bg-ochre-dark transition-all disabled:opacity-50"
                  >
                    {submittingExpense ? 'Saving...' : 'Save Expense'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal 5: Add Customer / Lead Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg p-5 sm:p-7 shadow-2xl relative max-h-[90vh] overflow-y-auto border border-charcoal/10">
            <button 
              type="button"
              onClick={() => setShowCustomerModal(false)}
              className="absolute top-5 right-5 text-charcoal/40 hover:text-charcoal p-1 rounded-xl hover:bg-charcoal/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-ochre/10 text-ochre flex items-center justify-center shrink-0">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-charcoal">Add Customer Lead</h3>
                <p className="text-xs text-charcoal/50">Record a new walk-in, phone lead, or prospective client inquiry.</p>
              </div>
            </div>

            {customerSuccess ? (
              <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="text-sm font-bold text-emerald-800">{customerSuccess}</p>
                <p className="text-xs text-emerald-600">Saved to Customer Inquiries pipeline.</p>
              </div>
            ) : (
              <form onSubmit={handleSaveCustomer} className="space-y-4">
                {customerError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{customerError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Patricia Mwangi"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full p-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                      Phone / WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +254 712 345678"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full p-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs font-mono focus:outline-none focus:border-ochre focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. client@example.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full p-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs focus:outline-none focus:border-ochre focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                    Project Type / Scope
                  </label>
                  <select
                    value={customerProjectType}
                    onChange={(e) => setCustomerProjectType(e.target.value)}
                    className="w-full p-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs font-bold focus:outline-none focus:border-ochre focus:bg-white"
                  >
                    <option value="Residential Interior">Residential Interior</option>
                    <option value="Commercial Office">Commercial Office</option>
                    <option value="Luxury Villa">Luxury Villa</option>
                    <option value="Bespoke Joinery & Gypsum">Bespoke Joinery & Gypsum</option>
                    <option value="Kitchen Remodel">Kitchen Remodel</option>
                    <option value="Full Fitout">Full Turnkey Fitout</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                    Requirements & Conversation Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Specific design preferences, budget range, location (e.g. Karen, Westlands, Kileleshwa)..."
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    className="w-full p-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs focus:outline-none focus:border-ochre focus:bg-white"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="openWhatsAppCheckbox"
                    checked={openWhatsAppOnAdd}
                    onChange={(e) => setOpenWhatsAppOnAdd(e.target.checked)}
                    className="w-4 h-4 rounded border-charcoal/20 accent-ochre cursor-pointer"
                  />
                  <label htmlFor="openWhatsAppCheckbox" className="text-xs text-charcoal/70 font-medium cursor-pointer">
                    Open WhatsApp in new tab after saving to send intro message
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowCustomerModal(false)}
                    className="px-4 py-2 rounded-xl border border-charcoal/15 text-charcoal/70 text-xs font-bold hover:bg-cream"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCustomer}
                    className="px-5 py-2.5 rounded-xl bg-ochre text-white text-xs font-bold hover:bg-ochre-dark transition-all disabled:opacity-50"
                  >
                    {submittingCustomer ? 'Saving Lead...' : 'Save Customer Lead'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Worker Modal: Request Wage Payment */}
      {showWorkerWageRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative border border-charcoal/10">
            <button 
              type="button"
              onClick={() => setShowWorkerWageRequestModal(false)}
              className="absolute top-5 right-5 text-charcoal/40 hover:text-charcoal p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-charcoal mb-2">Request Wage Payment</h3>
            <p className="text-xs text-charcoal/60 mb-4">Submit a payout request to the site supervisor or finance team.</p>

            {wageSuccess ? (
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-center text-xs font-bold text-emerald-800">
                {wageSuccess}
              </div>
            ) : (
              <form onSubmit={handleSubmitWageRequest} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-charcoal/60 mb-1">Amount Requested (KES) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={workerWageAmount}
                    onChange={(e) => setWorkerWageAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full p-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-charcoal/60 mb-1">Project Site</label>
                  <select
                    value={workerWageProjectId}
                    onChange={(e) => setWorkerWageProjectId(e.target.value)}
                    className="w-full p-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs font-bold"
                  >
                    <option value="">-- General Site Labor --</option>
                    {projectsList.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-charcoal/60 mb-1">Note (Optional)</label>
                  <input
                    type="text"
                    value={workerWageNote}
                    onChange={(e) => setWorkerWageNote(e.target.value)}
                    placeholder="e.g. Completed joinery sanding"
                    className="w-full p-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingWageRequest}
                  className="w-full py-2.5 bg-ochre text-white rounded-xl text-xs font-bold hover:bg-ochre-dark"
                >
                  {submittingWageRequest ? 'Submitting...' : 'Submit Request'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Worker Modal: View Balance */}
      {showWorkerBalanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative border border-charcoal/10 space-y-4">
            <button 
              type="button"
              onClick={() => setShowWorkerBalanceModal(false)}
              className="absolute top-5 right-5 text-charcoal/40 hover:text-charcoal p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-charcoal">My Wage Balance</h3>

            {workerBalanceData ? (
              <div className="space-y-3">
                <div className="p-4 bg-ochre/10 rounded-2xl border border-ochre/20">
                  <span className="text-[11px] font-bold text-ochre uppercase">Pending Balance</span>
                  <p className="text-2xl font-black text-charcoal">KES {workerBalanceData.balance.toLocaleString()}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-cream/40 rounded-xl border border-charcoal/10">
                    <span className="text-charcoal/50 text-[10px] uppercase font-bold">Total Earned</span>
                    <p className="font-bold text-charcoal mt-1">KES {workerBalanceData.totalEarned.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-cream/40 rounded-xl border border-charcoal/10">
                    <span className="text-charcoal/50 text-[10px] uppercase font-bold">Total Paid Out</span>
                    <p className="font-bold text-emerald-700 mt-1">KES {workerBalanceData.totalPaid.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-charcoal/50">
                Calculating balance records...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
