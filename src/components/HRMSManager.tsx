import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Worker, WorkLog, WorkerPayment, WorkerSkill, WorkDuration } from '../types/hrms';
import { formatMoney } from '../utils/pdfGenerator';
import { 
  Users, UserCheck, HardHat, Calendar, DollarSign, Plus, Search, 
  Filter, Trash2, Edit2, CheckCircle2, AlertCircle, Clock, 
  Briefcase, Phone, CreditCard, ChevronRight, X, Download, RefreshCw,
  Zap, CalendarDays, CheckSquare, MessageSquareHeart, FileText, Copy
} from 'lucide-react';
import { cn } from '../lib/utils';
import DailyPayRun from './hrms/DailyPayRun';
import AttendanceCalendar from './hrms/AttendanceCalendar';
import WeeklySettlementView from './hrms/WeeklySettlementView';
import LeaveAndExtraRequests from './hrms/LeaveAndExtraRequests';

const SKILLS_LIST: WorkerSkill[] = [
  'Carpenter',
  'Gypsum & Ceiling Installer',
  'Painter & Finisher',
  'Electrician',
  'Plumber',
  'Mason & Tiler',
  'Welder & Fabricator',
  'Upholsterer',
  'Casual & Helper',
  'Site Supervisor'
];

type HRMSTab = 'payrun' | 'calendar' | 'settlement' | 'requests' | 'workers' | 'logs' | 'payments' | 'summary';

interface HRMSManagerProps {
  initialTab?: HRMSTab;
  initialOpenModal?: 'worker' | 'log' | 'payment';
}

export default function HRMSManager({ initialTab = 'payrun', initialOpenModal }: HRMSManagerProps = {}) {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<HRMSTab>(initialTab);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Data states
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [payments, setPayments] = useState<WorkerPayment[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & filter states
  const [searchWorker, setSearchWorker] = useState('');
  const [selectedSkillFilter, setSelectedSkillFilter] = useState<string>('all');

  // Modals
  const [showWorkerModal, setShowWorkerModal] = useState(initialOpenModal === 'worker');
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [showLogModal, setShowLogModal] = useState(initialOpenModal === 'log');
  const [showPaymentModal, setShowPaymentModal] = useState(initialOpenModal === 'payment');

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
    if (initialOpenModal === 'worker') setShowWorkerModal(true);
    if (initialOpenModal === 'log') setShowLogModal(true);
    if (initialOpenModal === 'payment') setShowPaymentModal(true);
  }, [initialTab, initialOpenModal]);
  const [submitting, setSubmitting] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Worker Form State
  const [workerForm, setWorkerForm] = useState<{
    name: string;
    phone: string;
    idNumber: string;
    skill: WorkerSkill;
    dailyRate: number | '';
    status: 'active' | 'on_leave' | 'inactive';
    assignedProjectId: string;
    notes: string;
  }>({
    name: '',
    phone: '',
    idNumber: '',
    skill: 'Carpenter',
    dailyRate: 1500,
    status: 'active',
    assignedProjectId: '',
    notes: ''
  });

  // Work Log Form State
  const [logForm, setLogForm] = useState<{
    workerId: string;
    projectId: string;
    date: string;
    duration: WorkDuration;
    tasksDone: string;
  }>({
    workerId: '',
    projectId: '',
    date: new Date().toISOString().split('T')[0],
    duration: 'full_day',
    tasksDone: ''
  });

  // Wage Payment Form State
  const [paymentForm, setPaymentForm] = useState<{
    workerId: string;
    projectId: string;
    amount: number | '';
    paymentMethod: 'M-Pesa' | 'Cash' | 'Bank Transfer';
    referenceCode: string;
    date: string;
    notes: string;
  }>({
    workerId: '',
    projectId: '',
    amount: '',
    paymentMethod: 'M-Pesa',
    referenceCode: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Edit Payment State
  const [editingPayment, setEditingPayment] = useState<WorkerPayment | null>(null);
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
  const [editPaymentForm, setEditPaymentForm] = useState<{
    amount: number | '';
    date: string;
    paymentMethod: 'M-Pesa' | 'Cash' | 'Bank Transfer';
    referenceCode: string;
    notes: string;
    type: 'wage' | 'extra';
  }>({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'M-Pesa',
    referenceCode: '',
    notes: '',
    type: 'wage'
  });

  // Real-time subscribers
  useEffect(() => {
    setLoading(true);

    // 1. Workers
    const unsubWorkers = onSnapshot(
      query(collection(db, 'workers'), orderBy('createdAt', 'desc')),
      (snap) => {
        setWorkers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Worker)));
      },
      (err) => console.error('Error fetching workers:', err)
    );

    // 2. Work Logs
    const unsubLogs = onSnapshot(
      query(collection(db, 'workLogs'), orderBy('date', 'desc')),
      (snap) => {
        setWorkLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkLog)));
      },
      (err) => console.error('Error fetching work logs:', err)
    );

    // 3. Payments
    const unsubPayments = onSnapshot(
      query(collection(db, 'workerPayments'), orderBy('date', 'desc')),
      (snap) => {
        setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkerPayment)));
      },
      (err) => console.error('Error fetching payments:', err)
    );

    // 4. Projects (for linking)
    const unsubProjects = onSnapshot(
      query(collection(db, 'projects'), orderBy('createdAt', 'desc')),
      (snap) => {
        setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching projects for HRMS:', err);
        setLoading(false);
      }
    );

    // 5. Pending Leave & Extra Requests Badge Count
    let pendingL = 0;
    let pendingE = 0;
    const unsubLeaveBadge = onSnapshot(collection(db, 'leaveRequests'), (snap) => {
      pendingL = snap.docs.filter(d => d.data().status === 'pending').length;
      setPendingRequestsCount(pendingL + pendingE);
    });
    const unsubExtraBadge = onSnapshot(collection(db, 'extraPaymentRequests'), (snap) => {
      pendingE = snap.docs.filter(d => d.data().status === 'pending').length;
      setPendingRequestsCount(pendingL + pendingE);
    });

    return () => {
      unsubWorkers();
      unsubLogs();
      unsubPayments();
      unsubProjects();
      unsubLeaveBadge();
      unsubExtraBadge();
    };
  }, []);

  const triggerSuccess = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  // Worker Handlers
  const handleCopySignupLink = () => {
    const link = `${window.location.origin}/signup?role=worker`;
    navigator.clipboard.writeText(link);
    triggerSuccess('Worker self-signup link copied! Share this link with artisans to register.');
  };

  const handleEditWorker = (w: Worker) => {
    setEditingWorker(w);
    setWorkerForm({
      name: w.name,
      phone: w.phone,
      idNumber: w.idNumber || '',
      skill: w.skill,
      dailyRate: w.dailyRate,
      status: w.status,
      assignedProjectId: w.assignedProjectId || '',
      notes: w.notes || ''
    });
    setShowWorkerModal(true);
  };

  const handleSaveWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerForm.name.trim() || !editingWorker?.id) return;

    try {
      setSubmitting(true);
      const proj = projects.find(p => p.id === workerForm.assignedProjectId);

      const workerData: Record<string, any> = {
        name: workerForm.name.trim(),
        phone: workerForm.phone.trim(),
        skill: workerForm.skill,
        dailyRate: Number(workerForm.dailyRate) || 0,
        status: workerForm.status,
        updatedAt: new Date().toISOString()
      };
      if (workerForm.idNumber.trim()) workerData.idNumber = workerForm.idNumber.trim();
      if (workerForm.assignedProjectId) workerData.assignedProjectId = workerForm.assignedProjectId;
      if (proj?.name) workerData.assignedProjectName = proj.name;
      if (workerForm.notes.trim()) workerData.notes = workerForm.notes.trim();

      await updateDoc(doc(db, 'workers', editingWorker.id), workerData);

      // Sync user profile and clear pending_signups if activating
      const targetUid = editingWorker.userId || editingWorker.id;
      if (targetUid) {
        try {
          const profileRef = doc(db, 'profiles', targetUid);
          const pSnap = await getDoc(profileRef);
          if (pSnap.exists()) {
            const profileData: Record<string, any> = {
              name: workerForm.name.trim(),
              phone: workerForm.phone.trim(),
              status: workerForm.status === 'pending' ? 'pending' : 'active',
              role: 'worker'
            };
            if (workerForm.idNumber.trim()) profileData.idNumber = workerForm.idNumber.trim();
            await updateDoc(profileRef, profileData);
          }

          if (workerForm.status === 'active') {
            const pendingRef = doc(db, 'pending_signups', targetUid);
            const pendSnap = await getDoc(pendingRef);
            if (pendSnap.exists()) {
              await deleteDoc(pendingRef);
            }
          }
        } catch (profileErr) {
          console.warn('Could not sync worker status to user profile:', profileErr);
        }
      }

      triggerSuccess(`Updated worker details for ${workerForm.name}${workerForm.status === 'active' ? ' (Account Approved & Active)' : ''}`);
      setShowWorkerModal(false);
    } catch (err) {
      console.error('Error saving worker:', err);
      alert('Could not save worker details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWorker = async (w: Worker) => {
    if (!w.id) return;
    if (confirm(`Are you sure you want to remove ${w.name} from the workers database?`)) {
      try {
        await deleteDoc(doc(db, 'workers', w.id));
        triggerSuccess(`Removed ${w.name}`);
      } catch (err) {
        console.error('Error deleting worker:', err);
      }
    }
  };

  // Payment Edit & Delete Handlers
  const handleOpenEditPayment = (pay: WorkerPayment) => {
    setEditingPayment(pay);
    setEditPaymentForm({
      amount: pay.amount,
      date: pay.date,
      paymentMethod: (pay.paymentMethod as any) || 'M-Pesa',
      referenceCode: pay.referenceCode || '',
      notes: pay.notes || '',
      type: pay.type || 'wage'
    });
    setShowEditPaymentModal(true);
  };

  const handleSaveEditPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment?.id || !editPaymentForm.amount) return;

    try {
      setSubmitting(true);
      const updateData: Record<string, any> = {
        amount: Number(editPaymentForm.amount),
        date: editPaymentForm.date,
        paymentMethod: editPaymentForm.paymentMethod,
        type: editPaymentForm.type,
        updatedAt: new Date().toISOString()
      };
      if (editPaymentForm.referenceCode.trim()) updateData.referenceCode = editPaymentForm.referenceCode.trim();
      if (editPaymentForm.notes.trim()) updateData.notes = editPaymentForm.notes.trim();

      await updateDoc(doc(db, 'workerPayments', editingPayment.id), updateData);
      triggerSuccess(`Updated payment record of KES ${formatMoney(Number(editPaymentForm.amount))}`);
      setShowEditPaymentModal(false);
    } catch (err: any) {
      console.error('Error updating payment:', err);
      alert(`Failed to update payment record. ${err?.message || err}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayment = async (pay: WorkerPayment) => {
    if (!pay.id) return;
    if (confirm(`Delete payment record of KES ${formatMoney(pay.amount)} for ${pay.workerName}?`)) {
      try {
        await deleteDoc(doc(db, 'workerPayments', pay.id));
        triggerSuccess(`Deleted payment record for ${pay.workerName}`);
      } catch (err) {
        console.error('Error deleting payment:', err);
        alert('Could not delete payment record.');
      }
    }
  };

  // Work Log Handlers
  const handleOpenNewLog = () => {
    setLogForm({
      workerId: workers[0]?.id || '',
      projectId: projects[0]?.id || '',
      date: new Date().toISOString().split('T')[0],
      duration: 'full_day',
      tasksDone: ''
    });
    setShowLogModal(true);
  };

  const handleSaveWorkLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logForm.workerId) {
      alert('Please choose a worker.');
      return;
    }

    try {
      setSubmitting(true);
      const worker = workers.find(w => w.id === logForm.workerId);
      const project = projects.find(p => p.id === logForm.projectId);

      const multiplier = logForm.duration === 'full_day' ? 1.0 : logForm.duration === 'half_day' ? 0.5 : 1.5;
      const rate = worker?.dailyRate || 0;
      const wageDue = Math.round(rate * multiplier);

      const logData: Record<string, any> = {
        workerId: logForm.workerId,
        workerName: worker?.name || 'Worker',
        date: logForm.date,
        duration: logForm.duration,
        wageDue,
        tasksDone: logForm.tasksDone.trim(),
        status: 'approved',
        recordedBy: profile?.name || 'Manager',
        createdAt: new Date().toISOString()
      };
      if (worker?.skill) logData.workerSkill = worker.skill;
      if (logForm.projectId) logData.projectId = logForm.projectId;
      if (project?.name) logData.projectName = project.name;

      await addDoc(collection(db, 'workLogs'), logData);
      triggerSuccess(`Logged ${logForm.duration.replace('_', ' ')} for ${worker?.name}`);
      setShowLogModal(false);
    } catch (err: any) {
      console.error('Error saving work log:', err);
      alert(`Could not save work log. ${err?.message || err}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Wage Payment Handlers
  const handleOpenNewPayment = (prefillWorkerId?: string) => {
    const defaultWorker = prefillWorkerId 
      ? workers.find(w => w.id === prefillWorkerId) 
      : workers[0];

    // Compute unpaid wage for this worker
    let suggestedAmount: number | '' = '';
    if (defaultWorker?.id) {
      const earned = workLogs.filter(l => l.workerId === defaultWorker.id).reduce((s, l) => s + l.wageDue, 0);
      const paid = payments.filter(p => p.workerId === defaultWorker.id).reduce((s, p) => s + p.amount, 0);
      const bal = earned - paid;
      if (bal > 0) suggestedAmount = bal;
    }

    setPaymentForm({
      workerId: defaultWorker?.id || '',
      projectId: defaultWorker?.assignedProjectId || projects[0]?.id || '',
      amount: suggestedAmount,
      paymentMethod: 'M-Pesa',
      referenceCode: '',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setShowPaymentModal(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.workerId || !paymentForm.amount || Number(paymentForm.amount) <= 0) {
      alert('Please select worker and enter a valid payment amount.');
      return;
    }

    try {
      setSubmitting(true);
      const worker = workers.find(w => w.id === paymentForm.workerId);
      const project = projects.find(p => p.id === paymentForm.projectId);
      const amt = Number(paymentForm.amount);

      const paymentData: Record<string, any> = {
        workerId: paymentForm.workerId,
        workerName: worker?.name || 'Worker',
        amount: amt,
        paymentMethod: paymentForm.paymentMethod,
        type: 'wage',
        date: paymentForm.date,
        recordedBy: profile?.name || 'Manager',
        createdAt: new Date().toISOString()
      };
      if (paymentForm.projectId) paymentData.projectId = paymentForm.projectId;
      if (project?.name) paymentData.projectName = project.name;
      if (paymentForm.referenceCode.trim()) paymentData.referenceCode = paymentForm.referenceCode.trim();
      if (paymentForm.notes.trim()) paymentData.notes = paymentForm.notes.trim();

      await addDoc(collection(db, 'workerPayments'), paymentData);

      // Auto-sync into Project Expense tracker under "Labor & Wages" category if tied to a project
      if (paymentForm.projectId) {
        try {
          const expRef = collection(db, 'projects', paymentForm.projectId, 'expenses');
          await addDoc(expRef, {
            description: `Site Labor: ${worker?.name || 'Worker'} (${worker?.skill || 'Labor'})`,
            amount: amt,
            category: 'Labor & Wages',
            date: paymentForm.date,
            method: paymentForm.paymentMethod === 'M-Pesa' ? 'mpesa' : paymentForm.paymentMethod === 'Bank Transfer' ? 'bank' : 'cash',
            vendor: worker?.name || 'Laborer',
            referenceNumber: paymentForm.referenceCode || 'WAGE-PAYOUT',
            status: 'paid',
            recordedBy: profile?.name || 'Manager',
            createdAt: new Date().toISOString()
          });
        } catch (expErr) {
          console.warn('Could not auto-write to project expenses subcollection:', expErr);
        }
      }

      triggerSuccess(`Recorded KES ${formatMoney(amt)} wage payout to ${worker?.name}`);
      setShowPaymentModal(false);
    } catch (err: any) {
      console.error('Error saving wage payout:', err);
      alert(`Could not record wage payout. ${err?.message || err}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Calculations for summary & cards
  const totalActiveWorkers = workers.filter(w => w.status === 'active').length;
  
  const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
  const logsThisMonth = workLogs.filter(l => l.date.startsWith(currentMonthStr));
  const daysLoggedThisMonth = logsThisMonth.length;
  const wagesAccruedThisMonth = logsThisMonth.reduce((sum, l) => sum + (Number(l.wageDue) || 0), 0);
  const wagesPaidThisMonth = payments
    .filter(p => p.date.startsWith(currentMonthStr))
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const totalAllTimeWagesEarned = workLogs.reduce((sum, l) => sum + (Number(l.wageDue) || 0), 0);
  const totalAllTimeWagesPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalOutstandingWages = Math.max(0, totalAllTimeWagesEarned - totalAllTimeWagesPaid);

  // Filtered workers list
  const filteredWorkers = useMemo(() => {
    return workers.filter(w => {
      const matchesSearch = !searchWorker || 
        w.name.toLowerCase().includes(searchWorker.toLowerCase()) ||
        w.phone.includes(searchWorker) ||
        (w.idNumber && w.idNumber.includes(searchWorker));
      
      const matchesSkill = selectedSkillFilter === 'all' || w.skill === selectedSkillFilter;
      return matchesSearch && matchesSkill;
    });
  }, [workers, searchWorker, selectedSkillFilter]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2.5">
            <HardHat className="w-6 h-6 text-ochre" />
            <span>Site HRMS & Worker Management</span>
          </h2>
          <p className="text-xs sm:text-sm text-charcoal/60 mt-1">
            Manage skilled site fundis, carpenters, painters, daily site attendance, wage logs, and M-Pesa payouts.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('payrun')}
            className="px-4 py-2.5 rounded-xl bg-ochre hover:bg-ochre-dark text-white transition-all text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-ochre/20 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 fill-white" />
            <span>Fast Daily Pay Run</span>
          </button>

          <button
            onClick={handleOpenNewLog}
            className="px-4 py-2.5 rounded-xl bg-white border border-charcoal/10 hover:bg-cream text-charcoal transition-all text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-ochre" />
            <span>Log Daily Site Work</span>
          </button>

          <button
            onClick={() => handleOpenNewPayment()}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Pay Worker Wage</span>
          </button>

          <button
            onClick={handleCopySignupLink}
            className="px-4 py-2.5 rounded-xl bg-charcoal text-white hover:bg-ochre transition-all text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            title="Copy worker self-signup registration link"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Worker Signup Link</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successBanner && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-charcoal/10 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal/50">Active Site Force</span>
            <div className="w-8 h-8 rounded-xl bg-ochre/10 text-ochre flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-charcoal font-mono">
            {totalActiveWorkers} <span className="text-xs text-charcoal/40 font-normal">of {workers.length} total</span>
          </div>
          <p className="text-[11px] text-charcoal/40">Carpenters, painters, electricians</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-charcoal/10 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal/50">Days Logged (This Month)</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-charcoal font-mono">
            {daysLoggedThisMonth} <span className="text-xs text-charcoal/40 font-normal">site shifts</span>
          </div>
          <p className="text-[11px] text-charcoal/40">KES {formatMoney(wagesAccruedThisMonth)} in labor value</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-charcoal/10 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal/50">Wages Paid (This Month)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700 font-mono">
            KES {formatMoney(wagesPaidThisMonth)}
          </div>
          <p className="text-[11px] text-charcoal/40">Synced to project expenses</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-charcoal/10 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal/50">Pending Wage Balance</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-700 font-mono">
            KES {formatMoney(totalOutstandingWages)}
          </div>
          <p className="text-[11px] text-charcoal/40">Earned labor pending payout</p>
        </div>
      </div>

      {/* Navigation Sub-tabs */}
      <div className="flex items-center gap-2 border-b border-charcoal/10 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('payrun')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0",
            activeTab === 'payrun' ? "bg-ochre text-white shadow-xs" : "bg-white text-charcoal/70 hover:bg-cream border border-charcoal/10"
          )}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Daily Pay Run</span>
        </button>

        <button
          onClick={() => setActiveTab('settlement')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0",
            activeTab === 'settlement' ? "bg-ochre text-white shadow-xs" : "bg-white text-charcoal/70 hover:bg-cream border border-charcoal/10"
          )}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Weekly Settlements</span>
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0",
            activeTab === 'calendar' ? "bg-ochre text-white shadow-xs" : "bg-white text-charcoal/70 hover:bg-cream border border-charcoal/10"
          )}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Attendance Calendar</span>
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0",
            activeTab === 'requests' ? "bg-ochre text-white shadow-xs" : "bg-white text-charcoal/70 hover:bg-cream border border-charcoal/10"
          )}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Leave & Extras</span>
          {pendingRequestsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-ochre text-white text-[10px] font-bold">
              {pendingRequestsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('workers')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0",
            activeTab === 'workers' ? "bg-ochre text-white shadow-xs" : "bg-white text-charcoal/70 hover:bg-cream border border-charcoal/10"
          )}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Workers Directory ({workers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0",
            activeTab === 'logs' ? "bg-ochre text-white shadow-xs" : "bg-white text-charcoal/70 hover:bg-cream border border-charcoal/10"
          )}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Daily Logs ({workLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0",
            activeTab === 'payments' ? "bg-ochre text-white shadow-xs" : "bg-white text-charcoal/70 hover:bg-cream border border-charcoal/10"
          )}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Wage Payouts ({payments.length})</span>
        </button>
      </div>

      {/* VIEW: FAST DAILY PAY RUN */}
      {activeTab === 'payrun' && (
        <DailyPayRun workers={workers} projects={projects} />
      )}

      {/* VIEW: WEEKLY SETTLEMENTS */}
      {activeTab === 'settlement' && (
        <WeeklySettlementView workers={workers} projects={projects} />
      )}

      {/* VIEW: ATTENDANCE CALENDAR */}
      {activeTab === 'calendar' && (
        <AttendanceCalendar workers={workers} projects={projects} />
      )}

      {/* VIEW: LEAVE & EXTRA REQUESTS */}
      {activeTab === 'requests' && (
        <LeaveAndExtraRequests workers={workers} projects={projects} />
      )}

      {/* TAB 1: WORKERS DIRECTORY */}
      {activeTab === 'workers' && (
        <div className="space-y-6">
          {/* Search, Skill Filter & Signup Link */}
          <div className="bg-white p-4 rounded-2xl border border-charcoal/10 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-charcoal/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search worker name, phone, ID..."
                value={searchWorker}
                onChange={(e) => setSearchWorker(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-cream/40 border border-charcoal/10 rounded-xl text-xs focus:outline-none focus:border-ochre focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto flex-wrap justify-between md:justify-end">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-charcoal/50 uppercase tracking-wider shrink-0">Trade:</span>
                <select
                  value={selectedSkillFilter}
                  onChange={(e) => setSelectedSkillFilter(e.target.value)}
                  className="p-2 bg-cream/40 border border-charcoal/10 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre cursor-pointer"
                >
                  <option value="all">All Trades & Skills</option>
                  {SKILLS_LIST.map(skill => (
                    <option key={skill} value={skill}>{skill}</option>
                  ))}
                </select>
              </div>

              {/* Worker Self-Signup Share Link */}
              <button
                type="button"
                onClick={handleCopySignupLink}
                className="px-3.5 py-2 rounded-xl bg-ochre hover:bg-ochre-dark text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
                title="Copy registration link for workers"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Signup Link</span>
              </button>
            </div>
          </div>

          {/* Workers Grid */}
          {loading ? (
            <div className="p-16 text-center text-charcoal/40 text-xs flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-ochre" />
              <span>Loading worker directory...</span>
            </div>
          ) : filteredWorkers.length === 0 ? (
            <div className="p-16 text-center text-charcoal/40 text-xs space-y-3 bg-white rounded-2xl border border-dashed border-charcoal/20">
              <HardHat className="w-8 h-8 text-charcoal/20 mx-auto" />
              <p className="font-bold text-charcoal/60">No workers found in directory.</p>
              <p className="text-[11px] text-charcoal/50 max-w-sm mx-auto">
                Workers register through self-signup. Copy and share the worker registration link below with site artisans.
              </p>
              <button
                type="button"
                onClick={handleCopySignupLink}
                className="px-4 py-2.5 rounded-xl bg-ochre hover:bg-ochre-dark text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm shadow-ochre/20"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Worker Signup Link</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredWorkers.map(w => {
                // Compute worker financial summary
                const earned = workLogs.filter(l => l.workerId === w.id).reduce((s, l) => s + (l.wageDue || 0), 0);
                const paid = payments.filter(p => p.workerId === w.id).reduce((s, p) => s + (p.amount || 0), 0);
                const balance = Math.max(0, earned - paid);

                return (
                  <div key={w.id} className="p-5 rounded-2xl bg-white border border-charcoal/10 shadow-sm flex flex-col justify-between hover:border-ochre/30 transition-all space-y-4">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-ochre/10 text-ochre inline-block mb-1">
                            {w.skill}
                          </span>
                          <h3 className="font-bold text-base text-charcoal">{w.name}</h3>
                        </div>
                        <span className={cn(
                          "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                          w.status === 'active' ? "bg-emerald-100 text-emerald-800" : 
                          w.status === 'pending' ? "bg-amber-100 text-amber-800" :
                          w.status === 'on_leave' ? "bg-blue-100 text-blue-800" : "bg-charcoal/10 text-charcoal/60"
                        )}>
                          {w.status === 'pending' ? 'Pending Approval' : w.status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs text-charcoal/70 pt-2 border-t border-charcoal/5">
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-charcoal/40" />
                          <span>{w.phone || 'No phone'}</span>
                        </div>
                        {w.idNumber && (
                          <div className="text-[11px] text-charcoal/50">
                            ID: <span className="font-mono">{w.idNumber}</span>
                          </div>
                        )}
                        {w.assignedProjectName && (
                          <div className="flex items-center gap-1.5 text-[11px] text-ochre font-medium">
                            <Briefcase className="w-3 h-3" />
                            <span className="truncate">{w.assignedProjectName}</span>
                          </div>
                        )}
                      </div>

                      {/* Daily Rate & Balance */}
                      <div className="grid grid-cols-2 gap-2 mt-4 p-3 bg-cream/40 rounded-xl text-xs">
                        <div>
                          <span className="text-[10px] uppercase text-charcoal/50 font-bold block">Daily Rate</span>
                          <span className="font-mono font-bold text-charcoal">KES {formatMoney(w.dailyRate)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-charcoal/50 font-bold block">Unpaid Wage</span>
                          <span className={cn("font-mono font-bold", balance > 0 ? "text-amber-700" : "text-emerald-700")}>
                            KES {formatMoney(balance)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-charcoal/5 gap-2">
                      <button
                        onClick={() => handleOpenNewPayment(w.id)}
                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0"
                      >
                        <DollarSign className="w-3 h-3" />
                        <span>Pay</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleEditWorker(w)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                            w.status === 'pending'
                              ? "bg-amber-500 hover:bg-amber-600 text-white shadow-xs"
                              : "bg-cream/60 hover:bg-cream text-charcoal"
                          )}
                          title="Edit worker information & status"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>{w.status === 'pending' ? 'Approve / Edit' : 'Edit Info'}</span>
                        </button>

                        <button
                          onClick={() => handleDeleteWorker(w)}
                          className="p-1.5 text-charcoal/40 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Worker"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DAILY WORK & ATTENDANCE LOGS */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-charcoal/60">
              Track who worked on which site, hours/shifts logged, and labor expenses accumulated.
            </p>
            <button
              onClick={handleOpenNewLog}
              className="px-3.5 py-2 rounded-xl bg-ochre text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Work Log</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-charcoal/10 shadow-sm overflow-hidden">
            {workLogs.length === 0 ? (
              <div className="p-16 text-center text-charcoal/40 text-xs space-y-2">
                <Calendar className="w-8 h-8 text-charcoal/20 mx-auto" />
                <p className="font-bold text-charcoal/60">No work logs recorded yet.</p>
                <p className="text-[11px]">Log site shifts to track daily wages and project progress.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-charcoal text-white text-[11px] font-bold uppercase tracking-wider">
                      <th className="p-3.5 pl-5">Date</th>
                      <th className="p-3.5">Worker Name</th>
                      <th className="p-3.5">Project / Site</th>
                      <th className="p-3.5">Shift Duration</th>
                      <th className="p-3.5">Tasks Done</th>
                      <th className="p-3.5 text-right">Wage Due (KES)</th>
                      <th className="p-3.5 pr-5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-charcoal/5 text-xs">
                    {workLogs.map(log => (
                      <tr key={log.id} className="hover:bg-cream/20 transition-all">
                        <td className="p-3.5 pl-5 font-mono text-charcoal/70 whitespace-nowrap">
                          {log.date}
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-charcoal">{log.workerName}</div>
                          {log.workerSkill && (
                            <div className="text-[10px] text-charcoal/40">{log.workerSkill}</div>
                          )}
                        </td>
                        <td className="p-3.5">
                          <div className="font-medium text-charcoal">{log.projectName || 'General Workshop'}</div>
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-cream border border-charcoal/10">
                            {log.duration.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3.5 max-w-xs text-charcoal/70 truncate" title={log.tasksDone}>
                          {log.tasksDone || '—'}
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-charcoal whitespace-nowrap">
                          KES {formatMoney(log.wageDue)}
                        </td>
                        <td className="p-3.5 pr-5 text-right">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                            log.status === 'paid' ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                          )}>
                            {log.status}
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

      {/* TAB 3: WAGE PAYOUTS LEDGER */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-charcoal/60">
              Official record of worker wages paid via M-Pesa, Cash, or Bank Transfer.
            </p>
            <button
              onClick={() => handleOpenNewPayment()}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Payout</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-charcoal/10 shadow-sm overflow-hidden">
            {payments.length === 0 ? (
              <div className="p-16 text-center text-charcoal/40 text-xs space-y-2">
                <DollarSign className="w-8 h-8 text-charcoal/20 mx-auto" />
                <p className="font-bold text-charcoal/60">No wage payouts recorded yet.</p>
                <p className="text-[11px]">Payouts logged here will also appear under project labor expenses.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-charcoal text-white text-[11px] font-bold uppercase tracking-wider">
                      <th className="p-3.5 pl-5">Date</th>
                      <th className="p-3.5">Worker Name</th>
                      <th className="p-3.5">Project Attributed</th>
                      <th className="p-3.5">Payment Method</th>
                      <th className="p-3.5">Reference Code</th>
                      <th className="p-3.5 text-right">Amount Paid</th>
                      <th className="p-3.5">Recorded By</th>
                      <th className="p-3.5 pr-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-charcoal/5 text-xs">
                    {payments.map(pay => (
                      <tr key={pay.id} className="hover:bg-cream/20 transition-all">
                        <td className="p-3.5 pl-5 font-mono text-charcoal/70 whitespace-nowrap">
                          {pay.date}
                        </td>
                        <td className="p-3.5 font-bold text-charcoal">
                          {pay.workerName}
                        </td>
                        <td className="p-3.5 text-charcoal/70">
                          {pay.projectName || 'General Workshop / Overhead'}
                        </td>
                        <td className="p-3.5">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                            pay.paymentMethod === 'M-Pesa' ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                          )}>
                            {pay.paymentMethod}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-[11px] text-charcoal/60">
                          {pay.referenceCode || '—'}
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-emerald-700 text-sm whitespace-nowrap">
                          KES {formatMoney(pay.amount)}
                        </td>
                        <td className="p-3.5 text-charcoal/50 text-[11px]">
                          {pay.recordedBy || 'Manager'}
                        </td>
                        <td className="p-3.5 pr-5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditPayment(pay)}
                              className="p-1.5 text-charcoal/50 hover:text-ochre hover:bg-cream/60 rounded-lg transition-colors cursor-pointer"
                              title="Edit payment"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePayment(pay)}
                              className="p-1.5 text-charcoal/40 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete payment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

      {/* MODAL: ADD / EDIT WORKER */}
      {showWorkerModal && (
        <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-charcoal/10 animate-fade-in my-8">
            <div className="flex items-center justify-between pb-3 border-b border-charcoal/10">
              <h3 className="text-xl font-bold text-charcoal flex items-center gap-2">
                <HardHat className="w-5 h-5 text-ochre" />
                <span>{editingWorker?.status === 'pending' ? 'Review & Approve Worker' : 'Edit Worker Profile & Rates'}</span>
              </h3>
              <button
                onClick={() => setShowWorkerModal(false)}
                className="p-1 rounded-xl text-charcoal/40 hover:text-charcoal cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWorker} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Mwangi"
                  value={workerForm.name}
                  onChange={(e) => setWorkerForm({ ...workerForm, name: e.target.value })}
                  className="w-full p-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Phone (M-Pesa) *</label>
                  <input
                    type="text"
                    required
                    placeholder="+254 7..."
                    value={workerForm.phone}
                    onChange={(e) => setWorkerForm({ ...workerForm, phone: e.target.value })}
                    className="w-full p-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs focus:outline-none focus:border-ochre focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">National ID No.</label>
                  <input
                    type="text"
                    placeholder="e.g. 28491023"
                    value={workerForm.idNumber}
                    onChange={(e) => setWorkerForm({ ...workerForm, idNumber: e.target.value })}
                    className="w-full p-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs focus:outline-none focus:border-ochre focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Trade / Skill *</label>
                  <select
                    value={workerForm.skill}
                    onChange={(e) => setWorkerForm({ ...workerForm, skill: e.target.value as WorkerSkill })}
                    className="w-full p-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre"
                  >
                    {SKILLS_LIST.map(skill => (
                      <option key={skill} value={skill}>{skill}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Daily Wage Rate (KES) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="50"
                    placeholder="1500"
                    value={workerForm.dailyRate}
                    onChange={(e) => setWorkerForm({ ...workerForm, dailyRate: e.target.value ? parseFloat(e.target.value) : '' })}
                    className="w-full p-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-ochre focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Status</label>
                  <select
                    value={workerForm.status}
                    onChange={(e) => setWorkerForm({ ...workerForm, status: e.target.value as any })}
                    className="w-full p-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre"
                  >
                    <option value="active">Active (Approved & On Duty)</option>
                    <option value="pending">Pending Approval</option>
                    <option value="on_leave">On Leave / Rest</option>
                    <option value="inactive">Inactive / Standby</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Assigned Project</label>
                  <select
                    value={workerForm.assignedProjectId}
                    onChange={(e) => setWorkerForm({ ...workerForm, assignedProjectId: e.target.value })}
                    className="w-full p-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre"
                  >
                    <option value="">General / Unassigned</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Notes / Emergency Contact</label>
                <textarea
                  rows={2}
                  placeholder="Specialization, tools owned, emergency kin contact..."
                  value={workerForm.notes}
                  onChange={(e) => setWorkerForm({ ...workerForm, notes: e.target.value })}
                  className="w-full p-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs focus:outline-none focus:border-ochre focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-charcoal/10">
                <button
                  type="button"
                  onClick={() => setShowWorkerModal(false)}
                  className="px-4 py-2 text-xs font-bold text-charcoal/60 hover:text-charcoal cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-ochre text-white text-xs font-bold hover:bg-ochre-dark transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-ochre/20"
                >
                  {submitting ? 'Saving...' : editingWorker ? 'Update Worker' : 'Register Worker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LOG DAILY WORK */}
      {showLogModal && (
        <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-charcoal/10 animate-fade-in my-8">
            <div className="flex items-center justify-between pb-3 border-b border-charcoal/10">
              <h3 className="text-xl font-bold text-charcoal flex items-center gap-2">
                <Calendar className="w-5 h-5 text-ochre" />
                <span>Log Daily Site Work</span>
              </h3>
              <button
                onClick={() => setShowLogModal(false)}
                className="p-1 rounded-xl text-charcoal/40 hover:text-charcoal cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWorkLog} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Select Worker *</label>
                <select
                  required
                  value={logForm.workerId}
                  onChange={(e) => setLogForm({ ...logForm, workerId: e.target.value })}
                  className="w-full p-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre cursor-pointer"
                >
                  <option value="">-- Choose Worker --</option>
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.skill}) — KES {formatMoney(w.dailyRate)}/day
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Site / Project *</label>
                <select
                  value={logForm.projectId}
                  onChange={(e) => setLogForm({ ...logForm, projectId: e.target.value })}
                  className="w-full p-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre cursor-pointer"
                >
                  <option value="">General Workshop / In-House</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={logForm.date}
                    onChange={(e) => setLogForm({ ...logForm, date: e.target.value })}
                    className="w-full p-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Duration *</label>
                  <select
                    value={logForm.duration}
                    onChange={(e) => setLogForm({ ...logForm, duration: e.target.value as WorkDuration })}
                    className="w-full p-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre"
                  >
                    <option value="full_day">Full Day (1.0x)</option>
                    <option value="half_day">Half Day (0.5x)</option>
                    <option value="overtime">Overtime (1.5x)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Tasks Completed</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Wardrobe carcass assembly, primed kitchen cabinets..."
                  value={logForm.tasksDone}
                  onChange={(e) => setLogForm({ ...logForm, tasksDone: e.target.value })}
                  className="w-full p-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs focus:outline-none focus:border-ochre focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-charcoal/10">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2 text-xs font-bold text-charcoal/60 hover:text-charcoal cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-ochre text-white text-xs font-bold hover:bg-ochre-dark transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-ochre/20"
                >
                  {submitting ? 'Saving...' : 'Record Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PAY WORKER WAGE */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-charcoal/10 animate-fade-in my-8">
            <div className="flex items-center justify-between pb-3 border-b border-charcoal/10">
              <h3 className="text-xl font-bold text-charcoal flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <span>Record Wage Payout</span>
              </h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1 rounded-xl text-charcoal/40 hover:text-charcoal cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Select Worker *</label>
                <select
                  required
                  value={paymentForm.workerId}
                  onChange={(e) => {
                    const wid = e.target.value;
                    const w = workers.find(x => x.id === wid);
                    let sug: number | '' = '';
                    if (w?.id) {
                      const earned = workLogs.filter(l => l.workerId === w.id).reduce((s, l) => s + l.wageDue, 0);
                      const paid = payments.filter(p => p.workerId === w.id).reduce((s, p) => s + p.amount, 0);
                      const bal = earned - paid;
                      if (bal > 0) sug = bal;
                    }
                    setPaymentForm({
                      ...paymentForm,
                      workerId: wid,
                      amount: sug,
                      projectId: w?.assignedProjectId || paymentForm.projectId
                    });
                  }}
                  className="w-full p-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre cursor-pointer"
                >
                  <option value="">-- Choose Worker --</option>
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.skill})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Attribute to Project</label>
                <select
                  value={paymentForm.projectId}
                  onChange={(e) => setPaymentForm({ ...paymentForm, projectId: e.target.value })}
                  className="w-full p-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre cursor-pointer"
                >
                  <option value="">General Overhead / Workshop</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-charcoal/50 mt-1">
                  If selected, this payout is automatically logged in the Project Expense Tracker under "Labor & Wages".
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Amount (KES) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 5000"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value ? parseFloat(e.target.value) : '' })}
                    className="w-full p-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-ochre focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Method</label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value as any })}
                    className="w-full p-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre"
                  >
                    <option value="M-Pesa">M-Pesa</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Reference / Code</label>
                  <input
                    type="text"
                    placeholder="M-Pesa Code / Voucher #"
                    value={paymentForm.referenceCode}
                    onChange={(e) => setPaymentForm({ ...paymentForm, referenceCode: e.target.value })}
                    className="w-full p-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-mono focus:outline-none focus:border-ochre focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={paymentForm.date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                    className="w-full p-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Notes / Period Covered</label>
                <input
                  type="text"
                  placeholder="e.g. Week 2 Living room installation"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full p-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs focus:outline-none focus:border-ochre focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-charcoal/10">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-xs font-bold text-charcoal/60 hover:text-charcoal cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 cursor-pointer shadow-md"
                >
                  {submitting ? 'Recording...' : 'Record Payout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT PAYMENT */}
      {showEditPaymentModal && editingPayment && (
        <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-charcoal/10 animate-fade-in my-8">
            <div className="flex items-center justify-between pb-3 border-b border-charcoal/10">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-ochre" />
                <div>
                  <h3 className="text-lg font-bold text-charcoal">Edit Payment Record</h3>
                  <p className="text-xs text-charcoal/50">{editingPayment.workerName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditPaymentModal(false)}
                className="p-1 rounded-xl text-charcoal/40 hover:text-charcoal cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditPayment} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">
                  Amount (KES) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="50"
                  value={editPaymentForm.amount}
                  onChange={(e) => setEditPaymentForm({ ...editPaymentForm, amount: e.target.value ? parseFloat(e.target.value) : '' })}
                  className="w-full p-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-ochre focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Payment Method</label>
                  <select
                    value={editPaymentForm.paymentMethod}
                    onChange={(e) => setEditPaymentForm({ ...editPaymentForm, paymentMethod: e.target.value as any })}
                    className="w-full p-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre"
                  >
                    <option value="M-Pesa">M-Pesa</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Payment Type</label>
                  <select
                    value={editPaymentForm.type}
                    onChange={(e) => setEditPaymentForm({ ...editPaymentForm, type: e.target.value as any })}
                    className="w-full p-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre"
                  >
                    <option value="wage">Weekly Wage Payout</option>
                    <option value="extra">Extra / Advance Payout</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={editPaymentForm.date}
                    onChange={(e) => setEditPaymentForm({ ...editPaymentForm, date: e.target.value })}
                    className="w-full p-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Reference Code</label>
                  <input
                    type="text"
                    placeholder="e.g. QK81..."
                    value={editPaymentForm.referenceCode}
                    onChange={(e) => setEditPaymentForm({ ...editPaymentForm, referenceCode: e.target.value })}
                    className="w-full p-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-mono uppercase focus:outline-none focus:border-ochre focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Notes / Description</label>
                <input
                  type="text"
                  placeholder="Notes or description"
                  value={editPaymentForm.notes}
                  onChange={(e) => setEditPaymentForm({ ...editPaymentForm, notes: e.target.value })}
                  className="w-full p-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs focus:outline-none focus:border-ochre focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-charcoal/10">
                <button
                  type="button"
                  onClick={() => setShowEditPaymentModal(false)}
                  className="px-4 py-2 text-xs font-bold text-charcoal/60 hover:text-charcoal cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-ochre text-white text-xs font-bold hover:bg-ochre-dark transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-ochre/20"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
