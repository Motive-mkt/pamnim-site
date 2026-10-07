import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { 
  collection, addDoc, query, where, orderBy, onSnapshot, doc, getDoc, getDocs, setDoc 
} from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { 
  AttendanceRecord, WorkerPayment, LeaveRequest, ExtraRequest, PublicHoliday, Worker, WorkerPayoutProfile 
} from '../../types/hrms';
import { formatMoney } from '../../utils/pdfGenerator';
import { 
  getKenyanPublicHolidays, getAllHolidays, getWeekId, getWeekDates, formatWeekRange, getDayMultiplier 
} from '../../utils/hrmsUtils';
import { HardHat, Calendar, DollarSign, Clock, CheckCircle2, AlertCircle, Plus, LogOut, Phone, CreditCard, ChevronRight, Check, X, ArrowDownLeft, RefreshCw, FileText, Compass, Briefcase, Trash2, Edit3, User, PlusCircle, Shield } from 'lucide-react';
import { cn } from '../../lib/utils';
import OnboardingWalkthrough from '../../components/onboarding/OnboardingWalkthrough';

export default function WorkerDashboard() {
  const { profile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'attendance' | 'requests' | 'payments'>('overview');
  const [forceOpenTour, setForceOpenTour] = useState(false);

  // Worker's own profile and saved payout profiles
  const [workerRecord, setWorkerRecord] = useState<Worker | null>(null);

  // Payout profile modal state
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutLabel, setPayoutLabel] = useState('');
  const [payoutAccountName, setPayoutAccountName] = useState('');
  const [payoutAccountNumber, setPayoutAccountNumber] = useState('');
  const [payoutType, setPayoutType] = useState<'mpesa' | 'bank' | 'cash' | 'other'>('mpesa');
  const [savingPayout, setSavingPayout] = useState(false);

  // Real-time data strictly for this worker
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [payments, setPayments] = useState<WorkerPayment[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [extraRequests, setExtraRequests] = useState<ExtraRequest[]>([]);
  const [customHolidays, setCustomHolidays] = useState<PublicHoliday[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms / Modals
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveStartDate, setLeaveStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [leaveEndDate, setLeaveEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [leaveType, setLeaveType] = useState<'sick' | 'casual' | 'emergency'>('casual');
  const [leaveReason, setLeaveReason] = useState('');
  const [submittingLeave, setSubmittingLeave] = useState(false);

  const [showExtraModal, setShowExtraModal] = useState(false);
  const [extraAmount, setExtraAmount] = useState<number | ''>('');
  const [extraProject, setExtraProject] = useState('');
  const [extraReason, setExtraReason] = useState('');
  const [submittingExtra, setSubmittingExtra] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const allHolidays = useMemo(() => {
    return getAllHolidays(currentYear, customHolidays);
  }, [currentYear, customHolidays]);

  const currentWeekId = useMemo(() => {
    return getWeekId(new Date());
  }, []);

  const weekDates = useMemo(() => {
    return getWeekDates(new Date());
  }, []);

  useEffect(() => {
    if (!profile?.uid) return;
    setLoading(true);

    const workerUid = profile.uid;

    // 0. Worker's own worker profile record (rates, assigned project, multiple payout profiles)
    const unsubWorker = onSnapshot(doc(db, 'workers', workerUid), (docSnap) => {
      if (docSnap.exists()) {
        setWorkerRecord({ id: docSnap.id, ...docSnap.data() } as Worker);
      } else {
        getDocs(query(collection(db, 'workers'), where('userId', '==', workerUid))).then(res => {
          if (!res.empty) {
            setWorkerRecord({ id: res.docs[0].id, ...res.docs[0].data() } as Worker);
          }
        }).catch(err => console.warn('Could not query worker by userId:', err));
      }
    }, (err) => console.warn('Worker doc snapshot error:', err));

    // 1. Worker's own attendance records
    const unsubAttendance = onSnapshot(
      query(collection(db, 'attendanceRecords'), where('workerId', '==', workerUid)),
      (snap) => {
        setAttendanceRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord)));
      },
      (err) => console.error('Error fetching worker attendance:', err)
    );

    // 2. Worker's own payments / settlements
    const unsubPayments = onSnapshot(
      query(collection(db, 'workerPayments'), where('workerId', '==', workerUid)),
      (snap) => {
        setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkerPayment)));
      },
      (err) => console.error('Error fetching worker payments:', err)
    );

    // 3. Worker's own leave requests
    const unsubLeave = onSnapshot(
      query(collection(db, 'leaveRequests'), where('workerId', '==', workerUid)),
      (snap) => {
        setLeaveRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest)));
      },
      (err) => console.error('Error fetching worker leave:', err)
    );

    // 4. Worker's own extra payment requests
    const unsubExtras = onSnapshot(
      query(collection(db, 'extraPaymentRequests'), where('workerId', '==', workerUid)),
      (snap) => {
        setExtraRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExtraRequest)));
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching worker extras:', err);
        setLoading(false);
      }
    );

    // 5. Holidays (public read)
    const unsubHolidays = onSnapshot(doc(db, 'hrmsSettings', 'holidays'), (snap) => {
      if (snap.exists()) {
        setCustomHolidays(snap.data().customHolidays || []);
      }
    });

    return () => {
      unsubWorker();
      unsubAttendance();
      unsubPayments();
      unsubLeave();
      unsubExtras();
      unsubHolidays();
    };
  }, [profile?.uid]);

  // Calculations for current week
  const currentWeekMetrics = useMemo(() => {
    const weekAttendance = attendanceRecords.filter(r => r.weekId === currentWeekId);
    const daysWorked = weekAttendance.reduce((acc, r) => acc + (r.dayMultiplier || 1.0), 0);
    const accruedEarnings = weekAttendance.reduce((acc, r) => acc + (r.wageDue || 0), 0);

    const weekExtras = extraRequests.filter(e => 
      e.status === 'approved' && 
      (e.weekId === currentWeekId || weekDates.some(wd => wd.date === e.date))
    );
    const approvedExtrasTotal = weekExtras.reduce((acc, e) => acc + (e.approvedAmount || e.amount), 0);

    const weekAdvances = payments.filter(p => 
      p.type === 'extra' && 
      (p.weekId === currentWeekId || weekDates.some(wd => wd.date === p.date))
    );
    const advancesTotal = weekAdvances.reduce((acc, p) => acc + p.amount, 0);

    const netEstimatedPay = Math.max(0, (accruedEarnings + approvedExtrasTotal) - advancesTotal);

    return {
      daysWorked,
      accruedEarnings,
      approvedExtrasTotal,
      advancesTotal,
      netEstimatedPay
    };
  }, [attendanceRecords, extraRequests, payments, currentWeekId, weekDates]);

  // Submit Leave Request
  const handleCreateLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid || !leaveStartDate || !leaveEndDate) return;

    setSubmittingLeave(true);
    try {
      // Build array of dates between start and end
      const datesList: string[] = [];
      const cur = new Date(leaveStartDate + 'T00:00:00');
      const end = new Date(leaveEndDate + 'T00:00:00');

      while (cur <= end) {
        const y = cur.getFullYear();
        const mm = String(cur.getMonth() + 1).padStart(2, '0');
        const dd = String(cur.getDate()).padStart(2, '0');
        datesList.push(`${y}-${mm}-${dd}`);
        cur.setDate(cur.getDate() + 1);
      }

      await addDoc(collection(db, 'leaveRequests'), {
        workerId: profile.uid,
        workerName: profile.name || 'Site Worker',
        workerPhone: profile.phone || '',
        dates: datesList,
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        type: leaveType,
        reason: leaveReason.trim() || `${leaveType} leave request`,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      setShowLeaveModal(false);
      setLeaveReason('');
      setToastMessage('Leave request sent to site management for approval.');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('Error submitting leave:', err);
      alert('Could not submit leave request. Please try again.');
    } finally {
      setSubmittingLeave(false);
    }
  };

  // Submit Extra Payment Request
  const handleCreateExtraRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid || !extraAmount) return;

    setSubmittingExtra(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      await addDoc(collection(db, 'extraPaymentRequests'), {
        workerId: profile.uid,
        workerName: profile.name || 'Site Worker',
        workerPhone: profile.phone || '',
        amount: Number(extraAmount),
        projectName: extraProject.trim() || 'General Site Task',
        reason: extraReason.trim(),
        date: todayStr,
        weekId: getWeekId(todayStr),
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      setShowExtraModal(false);
      setExtraAmount('');
      setExtraProject('');
      setExtraReason('');
      setToastMessage('Extra payment request submitted to site management.');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('Error submitting extra pay request:', err);
      alert('Could not submit extra payment request. Please try again.');
    } finally {
      setSubmittingExtra(false);
    }
  };

  // Add / Save Payout Profile
  const handleSavePayoutProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;
    if (!payoutLabel.trim() || !payoutAccountNumber.trim()) {
      alert('Please provide a profile label and account number.');
      return;
    }

    setSavingPayout(true);
    try {
      const newProfile: WorkerPayoutProfile = {
        id: Math.random().toString(36).substring(2, 9),
        label: payoutLabel.trim(),
        accountName: payoutAccountName.trim() || workerRecord?.name || profile.name || 'Account Holder',
        accountNumber: payoutAccountNumber.trim(),
        type: payoutType
      };

      const existing = workerRecord?.payoutProfiles || [];
      const updated = [...existing, newProfile];

      const workerDocId = workerRecord?.id || profile.uid;
      await setDoc(doc(db, 'workers', workerDocId), {
        payoutProfiles: updated
      }, { merge: true });

      setToastMessage(`Saved payout profile "${payoutLabel.trim()}"!`);
      setShowPayoutModal(false);
      setPayoutLabel('');
      setPayoutAccountName('');
      setPayoutAccountNumber('');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      console.error('Error saving payout profile:', err);
      alert('Could not save payout profile: ' + err.message);
    } finally {
      setSavingPayout(false);
    }
  };

  // Delete Payout Profile
  const handleDeletePayoutProfile = async (profId: string) => {
    if (!profile?.uid) return;
    const workerDocId = workerRecord?.id || profile.uid;
    if (!window.confirm('Are you sure you want to remove this saved payout profile?')) return;

    try {
      const existing = workerRecord?.payoutProfiles || [];
      const updated = existing.filter(p => p.id !== profId);
      await setDoc(doc(db, 'workers', workerDocId), {
        payoutProfiles: updated
      }, { merge: true });

      setToastMessage('Payout profile removed.');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error('Error removing payout profile:', err);
      alert('Could not remove payout profile: ' + err.message);
    }
  };

  return (
    <div className="app-ui min-h-screen bg-cream text-charcoal flex flex-col pb-16">
      {/* Mobile-First Header */}
      <header className="bg-charcoal text-white px-4 py-4 sm:px-8 border-b border-charcoal/20 sticky top-0 z-30 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-ochre flex items-center justify-center text-white shrink-0">
              <HardHat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg text-white truncate max-w-[180px] sm:max-w-xs">
                  {profile?.name || 'Site Worker'}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-ochre border border-white/15">
                  Worker Portal
                </span>
              </div>
              <p className="text-xs text-white/60">{profile?.phone || 'M-Pesa Connected'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setForceOpenTour(true)}
              className="px-3 py-2 rounded-xl bg-ochre/20 hover:bg-ochre/30 text-ochre text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border border-ochre/30"
              title="Start guided onboarding walkthrough"
            >
              <Compass className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tour Portal</span>
            </button>

            <button
              type="button"
              onClick={logout}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 pt-6 space-y-6 flex-1">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-charcoal/10">
          {[
            { id: 'overview', label: 'My Wages & Week', icon: DollarSign, domId: 'worker-nav-settlement' },
            { id: 'profile', label: 'My Profile & Payouts', icon: User, domId: 'worker-nav-profile' },
            { id: 'attendance', label: 'My Attendance Calendar', icon: Calendar, domId: 'worker-nav-logs' },
            { id: 'requests', label: 'My Requests', icon: Clock, domId: 'worker-nav-requests' },
            { id: 'payments', label: 'Payment History', icon: CreditCard, domId: 'worker-nav-payments' }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={tab.domId}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer border",
                  isActive 
                    ? "bg-ochre text-white border-ochre shadow-md" 
                    : "bg-white text-charcoal/70 border-charcoal/10 hover:bg-cream/60"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Toast */}
        {toastMessage && (
          <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* TAB 1: OVERVIEW & WEEK EARNINGS */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Weekly Earnings Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-charcoal/10 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-bold text-ochre uppercase tracking-widest block">
                    Current Week ({currentWeekId})
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-charcoal">Weekly Accrued Pay</h2>
                  <p className="text-xs text-charcoal/60 mt-0.5">
                    Settled every Saturday to your registered M-Pesa line.
                  </p>
                </div>

                <div className="bg-cream/40 p-3.5 rounded-2xl border border-charcoal/10 text-left sm:text-right shrink-0">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-charcoal/60 block">Estimated Net Balance</span>
                  <span className="text-2xl font-bold text-emerald-700 block">
                    {formatMoney(currentWeekMetrics.netEstimatedPay)}
                  </span>
                </div>
              </div>

              {/* Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-4 rounded-2xl bg-cream/30 border border-charcoal/10">
                  <span className="text-[11px] uppercase font-bold text-charcoal/65 block">Days Worked</span>
                  <span className="text-lg font-bold text-charcoal">{currentWeekMetrics.daysWorked} days</span>
                </div>
                <div className="p-4 rounded-2xl bg-cream/30 border border-charcoal/10">
                  <span className="text-[11px] uppercase font-bold text-charcoal/65 block">Base Accrual</span>
                  <span className="text-lg font-bold text-charcoal">{formatMoney(currentWeekMetrics.accruedEarnings)}</span>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/60">
                  <span className="text-[11px] uppercase font-bold text-emerald-800 block">Approved Extras</span>
                  <span className="text-lg font-bold text-emerald-900">+{formatMoney(currentWeekMetrics.approvedExtrasTotal)}</span>
                </div>
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/60">
                  <span className="text-[11px] uppercase font-bold text-amber-800 block">Advances Taken</span>
                  <span className="text-lg font-bold text-amber-900">-{formatMoney(currentWeekMetrics.advancesTotal)}</span>
                </div>
              </div>

              {/* Quick Actions Strip */}
              <div className="flex items-center gap-3 pt-4 border-t border-charcoal/10 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(true)}
                  className="px-5 py-2.5 rounded-2xl bg-cream/60 hover:bg-cream text-charcoal border border-charcoal/15 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Calendar className="w-4 h-4 text-ochre" />
                  <span>Request Leave / Time Off</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowExtraModal(true)}
                  className="px-5 py-2.5 rounded-2xl bg-ochre hover:bg-ochre-dark text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Request Extra Pay / Overtime</span>
                </button>
              </div>
            </div>

            {/* This Week Days List */}
            <div className="bg-white rounded-3xl p-6 border border-charcoal/10 shadow-xs space-y-4">
              <h3 className="font-bold text-base text-charcoal">This Week's Attendance Log</h3>
              <div className="space-y-2.5">
                {weekDates.map(({ date, dayName }) => {
                  const record = attendanceRecords.find(r => r.date === date);
                  const isToday = date === new Date().toISOString().split('T')[0];

                  return (
                    <div 
                      key={date}
                      className={cn(
                        "p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs",
                        isToday ? "bg-ochre/5 border-ochre/30" : "bg-cream/20 border-charcoal/10"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-charcoal/70 w-8">{dayName}</span>
                        <span className="text-charcoal/65">{date}</span>
                      </div>

                      <div>
                        {record ? (
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "px-2.5 py-0.5 rounded-full font-bold text-[11px] uppercase",
                              record.status === 'present_full' || record.status === 'present' ? "bg-emerald-100 text-emerald-800" :
                              record.status === 'present_half' ? "bg-amber-100 text-amber-800" :
                              record.status === 'approved_leave' ? "bg-blue-100 text-blue-800" :
                              record.status === 'holiday' ? "bg-purple-100 text-purple-800" :
                              "bg-rose-100 text-rose-800"
                            )}>
                              {record.status === 'present_full' || record.status === 'present' ? 'Full Day' :
                               record.status === 'present_half' ? 'Half Day' :
                               record.status === 'approved_leave' ? 'Approved Leave' :
                               record.status === 'holiday' ? 'Public Holiday' : 'Absent'}
                            </span>
                            <span className="font-bold text-charcoal">
                              {formatMoney(record.wageDue || 0)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-charcoal/60 italic">Not logged yet</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB: MY PROFILE & SAVED PAYOUT PROFILES */}
        {activeTab === 'profile' && (
          <div className="space-y-6 animate-fade-in">
            {/* Worker Profile Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-charcoal/10 shadow-xs space-y-5">
              <div className="flex items-start justify-between gap-4 border-b border-charcoal/10 pb-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-ochre/10 text-ochre flex items-center justify-center font-bold text-lg">
                    {(profile?.name || 'W').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-charcoal">{profile?.name || workerRecord?.name || 'Site Worker'}</h2>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-ochre/15 text-ochre uppercase tracking-wider inline-block mt-1">
                      {workerRecord?.skill || (profile as any)?.skill || 'Artisan / Worker'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal/60 block">Daily Wage</span>
                  <span className="font-mono font-bold text-base text-charcoal">
                    KES {formatMoney(workerRecord?.dailyRate || 0)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div className="p-3.5 bg-cream/40 rounded-2xl border border-charcoal/10">
                  <span className="text-[11px] uppercase font-bold text-charcoal/65 block">Phone / WhatsApp</span>
                  <span className="font-bold text-xs text-charcoal flex items-center gap-1.5 mt-0.5">
                    <Phone className="w-3.5 h-3.5 text-ochre" />
                    {profile?.phone || workerRecord?.phone || 'Not set'}
                  </span>
                </div>

                <div className="p-3.5 bg-cream/40 rounded-2xl border border-charcoal/10">
                  <span className="text-[11px] uppercase font-bold text-charcoal/65 block">National ID</span>
                  <span className="font-mono font-bold text-xs text-charcoal block mt-0.5">
                    {workerRecord?.idNumber || (profile as any)?.idNumber || 'On file'}
                  </span>
                </div>

                <div className="p-3.5 bg-cream/40 rounded-2xl border border-charcoal/10">
                  <span className="text-[11px] uppercase font-bold text-charcoal/65 block">Assigned Project / Site</span>
                  <span className="font-bold text-xs text-ochre flex items-center gap-1.5 mt-0.5">
                    <Briefcase className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{workerRecord?.assignedProjectName || 'Workshop / In-House'}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Saved Payout Profiles Section */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-charcoal/10 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-charcoal/10 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-charcoal flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-ochre" />
                    <span>Saved Payout Profiles</span>
                  </h3>
                  <p className="text-xs text-charcoal/60 mt-0.5">
                    Save alternate numbers (e.g. wife's M-Pesa, brother's, or bank) so WhatsApp payments match automatically.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPayoutModal(true)}
                  className="px-4 py-2.5 rounded-2xl bg-ochre hover:bg-ochre-dark text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Payout Profile</span>
                </button>
              </div>

              <div className="space-y-3">
                {/* Default Primary Profile */}
                <div className="p-4 bg-cream/40 rounded-2xl border border-charcoal/10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                      M
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-charcoal">Own M-Pesa (Primary)</span>
                        <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          Primary
                        </span>
                      </div>
                      <div className="text-[11px] text-charcoal/60 mt-0.5 space-x-2">
                        <span>Account Name: <strong className="text-charcoal">{workerRecord?.mpesaName || workerRecord?.name || profile?.name || 'Self'}</strong></span>
                        <span>•</span>
                        <span>Number: <strong className="font-mono text-charcoal">{workerRecord?.phone || profile?.phone}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Saved Payout Profiles */}
                {(!workerRecord?.payoutProfiles || workerRecord.payoutProfiles.length === 0) ? (
                  <div className="p-6 bg-cream/20 rounded-2xl border border-dashed border-charcoal/20 text-center space-y-1">
                    <p className="text-xs font-semibold text-charcoal/60">No alternate payout profiles saved.</p>
                    <p className="text-[11px] text-charcoal/60">
                      Do you receive wages to a family member's M-Pesa or bank? Click "Add Payout Profile" above to save it.
                    </p>
                  </div>
                ) : (
                  workerRecord.payoutProfiles.map(prof => (
                    <div key={prof.id} className="p-4 bg-white rounded-2xl border border-charcoal/15 flex items-center justify-between gap-3 hover:border-ochre/30 transition-all shadow-2xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-ochre/10 text-ochre flex items-center justify-center font-bold text-xs shrink-0 uppercase">
                          {prof.type === 'bank' ? 'B' : 'M'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-charcoal truncate">{prof.label}</span>
                            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cream text-charcoal/70">
                              {prof.type === 'bank' ? 'Bank Transfer' : 'M-Pesa'}
                            </span>
                          </div>
                          <div className="text-[11px] text-charcoal/60 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>Account Name: <strong className="text-charcoal">{prof.accountName}</strong></span>
                            <span>•</span>
                            <span>Number: <strong className="font-mono text-charcoal">{prof.accountNumber}</strong></span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeletePayoutProfile(prof.id)}
                        className="p-2 text-charcoal/60 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer shrink-0"
                        title="Delete this payout profile"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ATTENDANCE CALENDAR */}
        {activeTab === 'attendance' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-charcoal/10 shadow-xs space-y-4">
            <div>
              <h3 className="text-lg font-bold text-charcoal">Your Work Attendance & Kenyan Holidays</h3>
              <p className="text-xs text-charcoal/60 mt-0.5">
                Displays your logged days, approved leaves, and public holidays.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {attendanceRecords.length === 0 ? (
                <div className="p-8 text-center text-xs text-charcoal/65 bg-cream/20 rounded-2xl">
                  No attendance records recorded yet. Your site supervisor will log your attendance during daily pay runs.
                </div>
              ) : (
                attendanceRecords.slice(0, 30).map(rec => (
                  <div key={rec.id || rec.date} className="p-3.5 bg-cream/20 rounded-2xl border border-charcoal/10 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-charcoal block">{rec.date}</span>
                      <span className="text-[11px] text-charcoal/65">{rec.notes || 'Daily logged attendance'}</span>
                    </div>

                    <div className="text-right">
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full font-bold text-[11px] inline-block mb-1",
                        rec.status === 'present_full' || rec.status === 'present' ? "bg-emerald-100 text-emerald-800" :
                        rec.status === 'present_half' ? "bg-amber-100 text-amber-800" :
                        rec.status === 'approved_leave' ? "bg-blue-100 text-blue-800" :
                        rec.status === 'holiday' ? "bg-purple-100 text-purple-800" :
                        "bg-rose-100 text-rose-800"
                      )}>
                        {rec.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="block font-bold text-charcoal">{formatMoney(rec.wageDue || 0)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: REQUESTS */}
        {activeTab === 'requests' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap bg-white rounded-3xl p-5 border border-charcoal/10">
              <div>
                <h3 className="text-lg font-bold text-charcoal">Your Requests</h3>
                <p className="text-xs text-charcoal/60 mt-0.5">Track time-off and extra pay authorisations.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(true)}
                  className="px-4 py-2 rounded-2xl bg-cream/70 hover:bg-cream text-charcoal border border-charcoal/15 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Request Leave</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowExtraModal(true)}
                  className="px-4 py-2 rounded-2xl bg-ochre hover:bg-ochre-dark text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Request Extra Pay</span>
                </button>
              </div>
            </div>

            {/* Leave Requests Submissions */}
            <div className="bg-white rounded-3xl p-6 border border-charcoal/10 shadow-xs space-y-4">
              <h4 className="font-bold text-sm text-charcoal">Leave Requests</h4>
              {leaveRequests.length === 0 ? (
                <p className="text-xs text-charcoal/65 italic">No leave requests made yet.</p>
              ) : (
                <div className="space-y-3">
                  {leaveRequests.map(r => (
                    <div key={r.id} className="p-4 rounded-2xl border border-charcoal/10 bg-cream/20 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-charcoal">
                          {r.dates ? `${r.dates[0]} to ${r.dates[r.dates.length - 1]}` : r.createdAt}
                        </span>
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full font-bold text-[11px] uppercase",
                          r.status === 'approved' ? "bg-emerald-100 text-emerald-800" :
                          r.status === 'declined' ? "bg-rose-100 text-rose-800" :
                          "bg-amber-100 text-amber-800"
                        )}>
                          {r.status}
                        </span>
                      </div>
                      <p className="text-charcoal/70">"{r.reason}"</p>
                      {r.reviewNotes && (
                        <p className="text-charcoal/65 italic text-[11px]">Management note: {r.reviewNotes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Extra Pay Requests Submissions */}
            <div className="bg-white rounded-3xl p-6 border border-charcoal/10 shadow-xs space-y-4">
              <h4 className="font-bold text-sm text-charcoal">Extra Payment / Overtime Requests</h4>
              {extraRequests.length === 0 ? (
                <p className="text-xs text-charcoal/65 italic">No extra payment requests made yet.</p>
              ) : (
                <div className="space-y-3">
                  {extraRequests.map(r => (
                    <div key={r.id} className="p-4 rounded-2xl border border-charcoal/10 bg-cream/20 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-charcoal text-sm">{formatMoney(r.amount)}</span>
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full font-bold text-[11px] uppercase",
                          r.status === 'approved' ? "bg-emerald-100 text-emerald-800" :
                          r.status === 'declined' ? "bg-rose-100 text-rose-800" :
                          "bg-amber-100 text-amber-800"
                        )}>
                          {r.status}
                        </span>
                      </div>
                      <p className="text-charcoal/70">"{r.reason}"</p>
                      {r.reviewNotes && (
                        <p className="text-charcoal/65 italic text-[11px]">Management note: {r.reviewNotes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: PAYMENT HISTORY */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-charcoal/10 shadow-xs space-y-4">
            <div>
              <h3 className="text-lg font-bold text-charcoal">Your Payment History</h3>
              <p className="text-xs text-charcoal/60 mt-0.5">
                Past settlements and advances transferred via M-Pesa.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {payments.length === 0 ? (
                <div className="p-8 text-center text-xs text-charcoal/65 bg-cream/20 rounded-2xl">
                  No payment records found yet.
                </div>
              ) : (
                payments.map(pay => (
                  <div key={pay.id} className="p-4 bg-cream/20 rounded-2xl border border-charcoal/10 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-charcoal">{formatMoney(pay.amount)}</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[11px] font-bold",
                          pay.type === 'settlement' ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        )}>
                          {pay.type === 'settlement' ? 'Weekly Settlement' : 'Advance Payout'}
                        </span>
                      </div>
                      <div className="text-[11px] text-charcoal/65 mt-1 space-x-2">
                        <span>Paid on: {pay.date}</span>
                        {pay.referenceCode && (
                          <span className="font-mono text-ochre font-bold">M-Pesa Ref: {pay.referenceCode}</span>
                        )}
                      </div>
                    </div>

                    <span className="text-xs font-bold text-charcoal/70">
                      {pay.paymentMethod || 'M-Pesa'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Leave Request Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 bg-charcoal/60 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 sm:p-8 shadow-2xl border border-charcoal/10 space-y-5 animate-fade-in">
            <div className="flex items-start justify-between gap-4 border-b border-charcoal/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-ochre/10 text-ochre flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-charcoal">Submit Leave Request</h3>
                  <p className="text-xs text-charcoal/65">Request time off from the site supervisor.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="p-2 rounded-xl text-charcoal/60 hover:text-charcoal hover:bg-cream/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLeaveRequest} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/65 mb-1.5">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={leaveStartDate}
                    onChange={e => setLeaveStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-charcoal/15 text-xs font-bold text-charcoal outline-none focus:border-ochre"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/65 mb-1.5">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={leaveEndDate}
                    onChange={e => setLeaveEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-charcoal/15 text-xs font-bold text-charcoal outline-none focus:border-ochre"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/65 mb-1.5">
                  Leave Type
                </label>
                <select
                  value={leaveType}
                  onChange={e => setLeaveType(e.target.value as any)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-charcoal/15 bg-white text-xs font-medium text-charcoal outline-none focus:border-ochre cursor-pointer"
                >
                  <option value="casual">Casual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="emergency">Family / Emergency Leave</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/65 mb-1.5">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={leaveReason}
                  onChange={e => setLeaveReason(e.target.value)}
                  placeholder="Explain why you need time off..."
                  className="w-full p-3 rounded-2xl border border-charcoal/15 text-xs sm:text-sm font-medium text-charcoal outline-none focus:border-ochre resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-charcoal/10">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-charcoal/15 text-xs font-bold text-charcoal/70 hover:bg-cream/50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLeave}
                  className="px-6 py-2.5 rounded-xl bg-ochre hover:bg-ochre-dark text-white text-xs font-bold shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{submittingLeave ? 'Submitting...' : 'Send Request'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Extra Payment Request Modal */}
      {showExtraModal && (
        <div className="fixed inset-0 z-50 bg-charcoal/60 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 sm:p-8 shadow-2xl border border-charcoal/10 space-y-5 animate-fade-in">
            <div className="flex items-start justify-between gap-4 border-b border-charcoal/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-ochre/10 text-ochre flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-charcoal">Request Extra Pay / Overtime</h3>
                  <p className="text-xs text-charcoal/65">Transport, overtime hours, or material reimbursement.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExtraModal(false)}
                className="p-2 rounded-xl text-charcoal/60 hover:text-charcoal hover:bg-cream/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExtraRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/65 mb-1.5">
                  Amount Requested (KES) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={50}
                  step={50}
                  required
                  value={extraAmount}
                  onChange={e => setExtraAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 500"
                  className="w-full px-4 py-3 rounded-2xl border border-charcoal/15 text-sm font-bold text-charcoal outline-none focus:border-ochre"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/65 mb-1.5">
                  Project / Task
                </label>
                <input
                  type="text"
                  value={extraProject}
                  onChange={e => setExtraProject(e.target.value)}
                  placeholder="e.g. Westlands Penthouse / Late Ceiling Fix"
                  className="w-full px-4 py-3 rounded-2xl border border-charcoal/15 text-xs sm:text-sm font-medium text-charcoal outline-none focus:border-ochre"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/65 mb-1.5">
                  Reason / Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={extraReason}
                  onChange={e => setExtraReason(e.target.value)}
                  placeholder="Explain why extra payment is requested (overtime hours, transport allowance, material purchase)..."
                  className="w-full p-3 rounded-2xl border border-charcoal/15 text-xs sm:text-sm font-medium text-charcoal outline-none focus:border-ochre resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-charcoal/10">
                <button
                  type="button"
                  onClick={() => setShowExtraModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-charcoal/15 text-xs font-bold text-charcoal/70 hover:bg-cream/50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingExtra}
                  className="px-6 py-2.5 rounded-xl bg-ochre hover:bg-ochre-dark text-white text-xs font-bold shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{submittingExtra ? 'Submitting...' : 'Submit Extra Pay Request'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Saved Payout Profile */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 bg-charcoal/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 sm:p-8 shadow-2xl border border-charcoal/10 space-y-5 animate-fade-in my-8">
            <div className="flex items-start justify-between gap-4 border-b border-charcoal/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-ochre/10 text-ochre flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-charcoal">Add Saved Payout Profile</h3>
                  <p className="text-xs text-charcoal/65">Save an alternate M-Pesa line or bank account.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPayoutModal(false)}
                className="p-2 rounded-xl text-charcoal/60 hover:text-charcoal hover:bg-cream/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayoutProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/65 mb-1.5">
                  Profile Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wife's M-Pesa, Brother's Line, Equity Bank"
                  value={payoutLabel}
                  onChange={(e) => setPayoutLabel(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre text-charcoal"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/65 mb-1.5">
                  Name on Account <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MARY WANJIKU"
                  value={payoutAccountName}
                  onChange={(e) => setPayoutAccountName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre text-charcoal"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/65 mb-1.5">
                  Phone or Account Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 0722 123 456 or 0123456789"
                  value={payoutAccountNumber}
                  onChange={(e) => setPayoutAccountNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:border-ochre text-charcoal"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/65 mb-1.5">
                  Payout Type
                </label>
                <select
                  value={payoutType}
                  onChange={(e) => setPayoutType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre text-charcoal cursor-pointer"
                >
                  <option value="mpesa">M-Pesa</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="cash">Cash / Direct</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-charcoal/10">
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-charcoal/60 hover:text-charcoal cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPayout}
                  className="px-6 py-2.5 bg-ochre hover:bg-ochre-dark text-white rounded-xl text-xs font-bold transition-all shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {savingPayout ? 'Saving...' : 'Save Payout Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Guided Walkthrough for Site Workers */}
      <OnboardingWalkthrough
        role="worker"
        forceOpen={forceOpenTour}
        onClose={() => setForceOpenTour(false)}
        onNavigateTab={(tab) => {
          if (tab === 'attendance' || tab === 'logs') setActiveTab('attendance');
          else if (tab === 'settlement' || tab === 'overview') setActiveTab('overview');
          else if (tab === 'requests') setActiveTab('requests');
          else if (tab === 'payments') setActiveTab('payments');
        }}
      />
    </div>
  );
}
