import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { 
  collection, addDoc, getDocs, query, where, orderBy, onSnapshot, doc, updateDoc 
} from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { Worker, AttendanceRecord, WorkerPayment, ExtraRequest } from '../../types/hrms';
import { formatMoney } from '../../utils/pdfGenerator';
import { getWeekId, getWeekDates, formatWeekRange } from '../../utils/hrmsUtils';
import { 
  DollarSign, CheckCircle2, AlertCircle, Download, Plus, 
  Search, Filter, ChevronLeft, ChevronRight, CreditCard, 
  HardHat, RefreshCw, X, Check, ArrowDownLeft, ArrowUpRight
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface WeeklySettlementViewProps {
  workers: Worker[];
  projects: any[];
}

export default function WeeklySettlementView({ workers, projects }: WeeklySettlementViewProps) {
  const { profile } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [payments, setPayments] = useState<WorkerPayment[]>([]);
  const [approvedExtras, setApprovedExtras] = useState<ExtraRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceWorkerId, setAdvanceWorkerId] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState<number | ''>('');
  const [advanceNotes, setAdvanceNotes] = useState('');
  const [advanceDate, setAdvanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [submittingAdvance, setSubmittingAdvance] = useState(false);

  // Settle Worker Modal
  const [settleWorker, setSettleWorker] = useState<{
    worker: Worker;
    accrued: number;
    extras: number;
    advances: number;
    netDue: number;
  } | null>(null);
  const [settleMpesaRef, setSettleMpesaRef] = useState('');
  const [settleMethod, setSettleMethod] = useState<'M-Pesa' | 'Cash' | 'Bank Transfer'>('M-Pesa');
  const [submittingSettle, setSubmittingSettle] = useState(false);

  // Current selected week identifier
  const weekId = useMemo(() => {
    return getWeekId(selectedDate);
  }, [selectedDate]);

  // Trade category filter state
  const [selectedTradeFilter, setSelectedTradeFilter] = useState<string>('all');
  const [showSettleAllModal, setShowSettleAllModal] = useState(false);
  const [settleAllMethod, setSettleAllMethod] = useState<'M-Pesa' | 'Cash' | 'Bank Transfer'>('M-Pesa');
  const [settleAllMpesaRef, setSettleAllMpesaRef] = useState('');
  const [submittingSettleAll, setSubmittingSettleAll] = useState(false);

  const weekDates = useMemo(() => {
    return getWeekDates(selectedDate);
  }, [selectedDate]);

  const weekRangeLabel = useMemo(() => {
    return formatWeekRange(weekDates);
  }, [weekDates]);

  // Real-time data listeners
  useEffect(() => {
    setLoading(true);

    // 1. Attendance Records for this week
    const unsubAttendance = onSnapshot(
      query(collection(db, 'attendanceRecords'), where('weekId', '==', weekId)),
      (snap) => {
        setAttendanceRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord)));
      },
      (err) => console.error('Error fetching attendance for week:', err)
    );

    // 2. Payments / Advances
    const unsubPayments = onSnapshot(
      query(collection(db, 'workerPayments'), orderBy('date', 'desc')),
      (snap) => {
        setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkerPayment)));
      },
      (err) => console.error('Error fetching payments:', err)
    );

    // 3. Approved Extras for this week
    const unsubExtras = onSnapshot(
      query(collection(db, 'extraPaymentRequests'), where('status', '==', 'approved')),
      (snap) => {
        setApprovedExtras(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExtraRequest)));
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching extras:', err);
        setLoading(false);
      }
    );

    return () => {
      unsubAttendance();
      unsubPayments();
      unsubExtras();
    };
  }, [weekId]);

  // Navigation across weeks
  const handlePrevWeek = () => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const handleNextWeek = () => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const handleCurrentWeek = () => {
    setSelectedDate(new Date());
  };

  // Compute Weekly Ledger per Worker (Active approved workers only)
  const workerLedgers = useMemo(() => {
    return workers.filter(w => w.status === 'active').map(w => {
      const wId = w.id || '';
      const uId = w.userId || '';

      // Matches any record tied to this worker
      const isRecordForWorker = (recordWorkerId?: string, recordDocId?: string) => {
        return (
          recordWorkerId === wId ||
          (uId && recordWorkerId === uId) ||
          (recordDocId && recordDocId === wId)
        );
      };

      // Days worked & Accrued wage
      const workerAttendance = attendanceRecords.filter(r => isRecordForWorker(r.workerId, (r as any).workerDocId));
      const daysCount = workerAttendance.reduce((acc, r) => acc + (r.dayMultiplier || 1.0), 0);
      const accruedWage = workerAttendance.reduce((acc, r) => acc + (r.wageDue || 0), 0);

      // Advances in this week
      const workerAdvances = payments.filter(p => 
        isRecordForWorker(p.workerId, (p as any).workerDocId) && 
        p.type === 'extra' && 
        (p.weekId === weekId || (!p.weekId && weekDates.some(wd => wd.date === p.date)))
      );
      const totalAdvances = workerAdvances.reduce((acc, p) => acc + p.amount, 0);

      // Approved Extras in this week
      const workerExtras = approvedExtras.filter(e => 
        isRecordForWorker(e.workerId) && 
        (e.weekId === weekId || (!e.weekId && weekDates.some(wd => wd.date === e.date)))
      );
      const totalExtras = workerExtras.reduce((acc, e) => acc + (e.approvedAmount || e.amount), 0);

      // Settlements already paid for this week
      const workerSettlements = payments.filter(p => 
        isRecordForWorker(p.workerId, (p as any).workerDocId) && 
        p.type === 'settlement' && 
        (p.weekId === weekId || (!p.weekId && weekDates.some(wd => wd.date === p.date)))
      );
      const totalSettled = workerSettlements.reduce((acc, p) => acc + p.amount, 0);

      // Net Due = (Accrued + Approved Extras) - Advances - Settled
      const netDue = Math.max(0, (accruedWage + totalExtras) - (totalAdvances + totalSettled));

      return {
        worker: w,
        daysCount,
        accruedWage,
        totalAdvances,
        totalExtras,
        totalSettled,
        netDue,
        isFullySettled: totalSettled > 0 && netDue === 0
      };
    });
  }, [workers, attendanceRecords, payments, approvedExtras, weekId, weekDates]);

  // Overall Week Totals
  const weekTotals = useMemo(() => {
    return workerLedgers.reduce((acc, l) => ({
      accrued: acc.accrued + l.accruedWage,
      extras: acc.extras + l.totalExtras,
      advances: acc.advances + l.totalAdvances,
      settled: acc.settled + l.totalSettled,
      netDue: acc.netDue + l.netDue
    }), { accrued: 0, extras: 0, advances: 0, settled: 0, netDue: 0 });
  }, [workerLedgers]);

  // Submit Advance Payment
  const handleSaveAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceWorkerId || !advanceAmount) return;

    const workerObj = workers.find(w => w.id === advanceWorkerId);
    setSubmittingAdvance(true);

    try {
      await addDoc(collection(db, 'workerPayments'), {
        workerId: workerObj?.userId || advanceWorkerId,
        workerDocId: advanceWorkerId,
        workerName: workerObj?.name || 'Worker',
        projectId: workerObj?.assignedProjectId || '',
        projectName: projects.find(p => p.id === workerObj?.assignedProjectId)?.name || '',
        amount: Number(advanceAmount),
        paymentMethod: 'M-Pesa',
        type: 'extra', // 'extra' represents deduction/advance in this system
        date: advanceDate,
        weekId: getWeekId(advanceDate),
        notes: advanceNotes.trim() || 'Mid-week wage advance',
        recordedBy: profile?.name || 'Owner',
        createdAt: new Date().toISOString()
      });

      setShowAdvanceModal(false);
      setAdvanceAmount('');
      setAdvanceNotes('');
    } catch (err) {
      console.error('Error saving advance:', err);
      alert('Could not record advance. Please try again.');
    } finally {
      setSubmittingAdvance(false);
    }
  };

  // Submit Settle Week for Worker
  const handleConfirmSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleWorker) return;
    setSubmittingSettle(true);

    try {
      const paymentPayload: Record<string, any> = {
        workerId: settleWorker.worker.userId || settleWorker.worker.id,
        workerDocId: settleWorker.worker.id,
        workerName: settleWorker.worker.name,
        projectId: settleWorker.worker.assignedProjectId || '',
        projectName: projects.find(p => p.id === settleWorker.worker.assignedProjectId)?.name || '',
        amount: settleWorker.netDue,
        paymentMethod: settleMethod,
        type: 'settlement',
        date: new Date().toISOString().split('T')[0],
        weekId,
        notes: `Weekly settlement for ${weekRangeLabel}`,
        recordedBy: profile?.name || 'Owner',
        createdAt: new Date().toISOString()
      };
      if (settleMpesaRef.trim()) {
        paymentPayload.referenceCode = settleMpesaRef.trim();
      }

      await addDoc(collection(db, 'workerPayments'), paymentPayload);

      setSettleWorker(null);
      setSettleMpesaRef('');
    } catch (err) {
      console.error('Error settling worker payment:', err);
      alert('Could not record settlement. Please try again.');
    } finally {
      setSubmittingSettle(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Worker Name', 'Trade', 'Days Worked', 'Daily Rate (KES)', 'Accrued Wage (KES)', 'Approved Extras (KES)', 'Advances Deducted (KES)', 'Net Paid/Due (KES)', 'Status'];
    const rows = workerLedgers.map(l => [
      `"${l.worker.name}"`,
      `"${l.worker.skill}"`,
      l.daysCount,
      l.worker.dailyRate,
      l.accruedWage,
      l.totalExtras,
      l.totalAdvances,
      l.netDue,
      l.isFullySettled ? 'Settled' : 'Pending Settlement'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Pamnim_HRMS_Settlement_${weekId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Available Trades from active workers
  const availableTrades = useMemo(() => {
    const trades = new Set<string>();
    workerLedgers.forEach(l => {
      if (l.worker.skill) trades.add(l.worker.skill);
    });
    return Array.from(trades);
  }, [workerLedgers]);

  const filteredLedgers = useMemo(() => {
    return workerLedgers.filter(l => {
      const matchesSearch = l.worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.worker.skill.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTrade = selectedTradeFilter === 'all' || l.worker.skill === selectedTradeFilter;
      return matchesSearch && matchesTrade;
    });
  }, [workerLedgers, searchTerm, selectedTradeFilter]);

  // Unsettled workers in current trade filter
  const pendingSettlementInFilter = useMemo(() => {
    return filteredLedgers.filter(l => !l.isFullySettled && l.netDue > 0);
  }, [filteredLedgers]);

  const totalBatchAmount = useMemo(() => {
    return pendingSettlementInFilter.reduce((sum, l) => sum + l.netDue, 0);
  }, [pendingSettlementInFilter]);

  // Batch Settle All
  const handleConfirmSettleAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingSettlementInFilter.length === 0) return;
    setSubmittingSettleAll(true);
    try {
      const promises = pendingSettlementInFilter.map(l => {
        const wId = l.worker.id;
        const uId = l.worker.userId;
        const itemPayload: Record<string, any> = {
          workerId: uId || wId,
          workerDocId: wId,
          workerName: l.worker.name,
          projectId: l.worker.assignedProjectId || '',
          projectName: projects.find(p => p.id === l.worker.assignedProjectId)?.name || '',
          amount: l.netDue,
          paymentMethod: settleAllMethod,
          type: 'wage',
          date: new Date().toISOString().split('T')[0],
          weekId: weekId,
          notes: `Batch weekly settlement for ${weekId} (${selectedTradeFilter === 'all' ? 'All Trades' : selectedTradeFilter})`,
          recordedBy: profile?.name || 'Owner',
          createdAt: new Date().toISOString()
        };
        if (settleAllMpesaRef.trim()) {
          itemPayload.referenceCode = settleAllMpesaRef.trim();
        }
        return addDoc(collection(db, 'workerPayments'), itemPayload);
      });

      await Promise.all(promises);
      setShowSettleAllModal(false);
      setSettleAllMpesaRef('');
    } catch (err) {
      console.error('Error in batch settlement:', err);
      alert('Could not complete batch settlement. Please try again.');
    } finally {
      setSubmittingSettleAll(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Week Navigator */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-charcoal/10 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-ochre font-bold text-xs uppercase tracking-widest">
              <DollarSign className="w-4 h-4" />
              <span>Weekly Wage Ledger & M-Pesa Payouts</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-charcoal">Weekly Settlements</h2>
            <p className="text-xs text-charcoal/60 mt-0.5">
              Net Pay = (Accrued Wage + Approved Extras) − Deductions/Advances.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Week Switcher */}
            <div className="flex items-center gap-1 bg-cream/40 p-1.5 rounded-2xl border border-charcoal/10">
              <button
                type="button"
                onClick={handlePrevWeek}
                aria-label="Previous week"
                className="p-2 rounded-xl hover:bg-white text-charcoal transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-3 text-center">
                <span className="block text-[10px] font-bold uppercase tracking-widest text-charcoal/40">{weekId}</span>
                <span className="text-xs font-bold text-charcoal">{weekRangeLabel}</span>
              </div>
              <button
                type="button"
                onClick={handleNextWeek}
                aria-label="Next week"
                className="p-2 rounded-xl hover:bg-white text-charcoal transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleCurrentWeek}
              className="px-3 py-2 rounded-xl bg-cream/60 hover:bg-cream border border-charcoal/10 text-xs font-bold text-charcoal transition-all cursor-pointer"
            >
              Current Week
            </button>

            {/* Give Advance Button */}
            <button
              type="button"
              onClick={() => {
                setAdvanceWorkerId(workers[0]?.id || '');
                setShowAdvanceModal(true);
              }}
              className="px-4 py-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowDownLeft className="w-3.5 h-3.5 text-amber-700" />
              <span>Give Advance</span>
            </button>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-4 py-2.5 rounded-2xl bg-cream/50 hover:bg-cream text-charcoal/80 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-charcoal/10"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Tally Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="bg-cream/40 rounded-2xl p-4 border border-charcoal/10">
            <span className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest block">Total Accrued</span>
            <span className="text-base sm:text-lg font-bold text-charcoal">{formatMoney(weekTotals.accrued)}</span>
          </div>
          <div className="bg-emerald-50/70 rounded-2xl p-4 border border-emerald-200/60">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest block">Approved Extras</span>
            <span className="text-base sm:text-lg font-bold text-emerald-900">+{formatMoney(weekTotals.extras)}</span>
          </div>
          <div className="bg-amber-50/70 rounded-2xl p-4 border border-amber-200/60">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-widest block">Advances Deducted</span>
            <span className="text-base sm:text-lg font-bold text-amber-900">-{formatMoney(weekTotals.advances)}</span>
          </div>
          <div className="bg-ochre/10 rounded-2xl p-4 border border-ochre/20">
            <span className="text-[10px] font-bold text-ochre uppercase tracking-widest block">Net Balance Due</span>
            <span className="text-base sm:text-lg font-bold text-charcoal">{formatMoney(weekTotals.netDue)}</span>
          </div>
        </div>

        {/* Search & Category Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal/40" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search worker by name or trade..."
              className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-cream/20 border border-charcoal/15 text-xs font-medium text-charcoal outline-none focus:border-ochre focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedTradeFilter}
              onChange={e => setSelectedTradeFilter(e.target.value)}
              className="px-3 py-2.5 rounded-2xl bg-cream/30 border border-charcoal/15 text-xs font-semibold text-charcoal outline-none focus:border-ochre cursor-pointer w-full sm:w-auto"
            >
              <option value="all">All Trades ({workerLedgers.length})</option>
              {availableTrades.map(trade => (
                <option key={trade} value={trade}>{trade}</option>
              ))}
            </select>

            {pendingSettlementInFilter.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSettleAllModal(true)}
                className="px-4 py-2.5 rounded-2xl bg-ochre hover:bg-ochre-dark text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-ochre/20 whitespace-nowrap cursor-pointer"
                title={`Batch settle ${pendingSettlementInFilter.length} workers with outstanding balances`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Settle All ({pendingSettlementInFilter.length})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Workers Ledger Sheet */}
      <div className="space-y-3">
        {filteredLedgers.length === 0 ? (
          <div className="p-10 text-center bg-white rounded-3xl border border-charcoal/10">
            <HardHat className="w-8 h-8 text-charcoal/30 mx-auto mb-2" />
            <p className="text-sm font-bold text-charcoal">No workers found</p>
          </div>
        ) : (
          filteredLedgers.map(l => {
            return (
              <div
                key={l.worker.id}
                className="bg-white rounded-3xl p-5 sm:p-6 border border-charcoal/10 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all hover:border-ochre/30"
              >
                {/* Worker Identity */}
                <div className="space-y-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base text-charcoal">{l.worker.name}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cream/60 border border-charcoal/10 text-charcoal/70">
                      {l.worker.skill}
                    </span>
                    {l.isFullySettled && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Paid & Settled</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-charcoal/50">
                    <span>Phone: {l.worker.phone}</span>
                    <span>•</span>
                    <span>Rate: {formatMoney(l.worker.dailyRate)}/day</span>
                  </div>
                </div>

                {/* Calculation Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-cream/20 p-3 rounded-2xl border border-charcoal/5">
                  <div>
                    <span className="text-charcoal/50 block text-[10px] uppercase font-bold">Days / Accrued</span>
                    <span className="font-bold text-charcoal">{l.daysCount}d ({formatMoney(l.accruedWage)})</span>
                  </div>
                  <div>
                    <span className="text-emerald-800 block text-[10px] uppercase font-bold">Extras</span>
                    <span className="font-bold text-emerald-700">+{formatMoney(l.totalExtras)}</span>
                  </div>
                  <div>
                    <span className="text-amber-800 block text-[10px] uppercase font-bold">Advances</span>
                    <span className="font-bold text-amber-700">-{formatMoney(l.totalAdvances)}</span>
                  </div>
                  <div>
                    <span className="text-charcoal/50 block text-[10px] uppercase font-bold">Settled</span>
                    <span className="font-bold text-charcoal/70">{formatMoney(l.totalSettled)}</span>
                  </div>
                </div>

                {/* Net Due & Settle Action */}
                <div className="flex items-center justify-between lg:justify-end gap-4 pt-2 lg:pt-0 border-t lg:border-t-0 border-charcoal/5">
                  <div className="text-left lg:text-right">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-charcoal/40 block">Net Balance Due</span>
                    <span className={cn(
                      "text-base font-bold",
                      l.netDue > 0 ? "text-ochre" : "text-emerald-700"
                    )}>
                      {formatMoney(l.netDue)}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={l.netDue <= 0}
                    onClick={() => setSettleWorker({
                      worker: l.worker,
                      accrued: l.accruedWage,
                      extras: l.totalExtras,
                      advances: l.totalAdvances,
                      netDue: l.netDue
                    })}
                    className={cn(
                      "px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0",
                      l.netDue > 0 
                        ? "bg-ochre hover:bg-ochre-dark text-white shadow-ochre/20" 
                        : "bg-charcoal/10 text-charcoal/40 cursor-not-allowed"
                    )}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Settle Week</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Give Advance Modal */}
      {showAdvanceModal && (
        <div className="fixed inset-0 z-50 bg-charcoal/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 sm:p-8 shadow-2xl border border-charcoal/10 space-y-5 animate-fade-in">
            <div className="flex items-start justify-between gap-4 border-b border-charcoal/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-charcoal">Record Wage Advance</h3>
                  <p className="text-xs text-charcoal/50">Deducts immediately from current week's net settlement.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdvanceModal(false)}
                className="p-2 rounded-xl text-charcoal/40 hover:text-charcoal hover:bg-cream/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdvance} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/50 mb-1.5">
                  Select Site Worker <span className="text-red-500">*</span>
                </label>
                <select
                  value={advanceWorkerId}
                  onChange={e => setAdvanceWorkerId(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-2xl border border-charcoal/15 bg-white text-sm font-medium text-charcoal outline-none focus:border-ochre cursor-pointer"
                >
                  {workers.filter(w => w.status !== 'inactive').map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.skill})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/50 mb-1.5">
                  Advance Amount (KES) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={100}
                  step={50}
                  required
                  value={advanceAmount}
                  onChange={e => setAdvanceAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 1000"
                  className="w-full px-4 py-3 rounded-2xl border border-charcoal/15 text-sm font-bold text-charcoal outline-none focus:border-ochre"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/50 mb-1.5">
                  Date Given <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={advanceDate}
                  onChange={e => setAdvanceDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-charcoal/15 text-sm font-bold text-charcoal outline-none focus:border-ochre cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/50 mb-1.5">
                  Reason / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={advanceNotes}
                  onChange={e => setAdvanceNotes(e.target.value)}
                  placeholder="e.g. Fare home, lunch allowance, family emergency"
                  className="w-full px-4 py-3 rounded-2xl border border-charcoal/15 text-xs sm:text-sm font-medium text-charcoal outline-none focus:border-ochre"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-charcoal/10">
                <button
                  type="button"
                  onClick={() => setShowAdvanceModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-charcoal/15 text-xs font-bold text-charcoal/70 hover:bg-cream/50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdvance}
                  className="px-6 py-2.5 rounded-xl bg-ochre hover:bg-ochre-dark text-white text-xs font-bold shadow-md shadow-ochre/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{submittingAdvance ? 'Saving Advance...' : 'Confirm Advance'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Week Modal */}
      {settleWorker && (
        <div className="fixed inset-0 z-50 bg-charcoal/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 sm:p-8 shadow-2xl border border-charcoal/10 space-y-5 animate-fade-in">
            <div className="flex items-start justify-between gap-4 border-b border-charcoal/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-ochre/10 text-ochre flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-charcoal">Settle Weekly Wage</h3>
                  <p className="text-xs text-charcoal/50">{settleWorker.worker.name} • {weekId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSettleWorker(null)}
                className="p-2 rounded-xl text-charcoal/40 hover:text-charcoal hover:bg-cream/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Payment Summary Box */}
            <div className="p-4 bg-cream/30 rounded-2xl border border-charcoal/10 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-charcoal/60">Accrued Workdays:</span>
                <span className="font-bold text-charcoal">{formatMoney(settleWorker.accrued)}</span>
              </div>
              {settleWorker.extras > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Approved Extras / Overtime:</span>
                  <span className="font-bold">+{formatMoney(settleWorker.extras)}</span>
                </div>
              )}
              {settleWorker.advances > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>Less Advances Taken:</span>
                  <span className="font-bold">-{formatMoney(settleWorker.advances)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-charcoal/10 text-sm">
                <span className="font-bold text-charcoal">Net Payout to Worker:</span>
                <span className="font-bold text-ochre">{formatMoney(settleWorker.netDue)}</span>
              </div>
            </div>

            <form onSubmit={handleConfirmSettlement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/50 mb-1.5">
                  Payment Method
                </label>
                <select
                  value={settleMethod}
                  onChange={e => setSettleMethod(e.target.value as any)}
                  className="w-full px-4 py-3 rounded-2xl border border-charcoal/15 bg-white text-sm font-medium text-charcoal outline-none focus:border-ochre cursor-pointer"
                >
                  <option value="M-Pesa">M-Pesa (To {settleWorker.worker.phone})</option>
                  <option value="Cash">Cash Payout</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/50 mb-1.5">
                  M-Pesa / Receipt Reference (Optional)
                </label>
                <input
                  type="text"
                  value={settleMpesaRef}
                  onChange={e => setSettleMpesaRef(e.target.value)}
                  placeholder="e.g. SLK89XZ21M"
                  className="w-full px-4 py-3 rounded-2xl border border-charcoal/15 text-sm font-mono text-charcoal outline-none focus:border-ochre uppercase"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-charcoal/10">
                <button
                  type="button"
                  onClick={() => setSettleWorker(null)}
                  className="px-5 py-2.5 rounded-xl border border-charcoal/15 text-xs font-bold text-charcoal/70 hover:bg-cream/50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSettle}
                  className="px-6 py-2.5 rounded-xl bg-ochre hover:bg-ochre-dark text-white text-xs font-bold shadow-md shadow-ochre/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{submittingSettle ? 'Recording Payout...' : 'Confirm & Mark Paid'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle All (Category) Modal */}
      {showSettleAllModal && (
        <div className="fixed inset-0 z-50 bg-charcoal/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-3xl p-6 sm:p-8 shadow-2xl border border-charcoal/10 space-y-5 animate-fade-in">
            <div className="flex items-start justify-between gap-4 border-b border-charcoal/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-ochre/10 text-ochre flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-charcoal">Batch Settle Week</h3>
                  <p className="text-xs text-charcoal/50">
                    {selectedTradeFilter === 'all' ? 'All Trades' : selectedTradeFilter} • {pendingSettlementInFilter.length} workers • {weekId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSettleAllModal(false)}
                className="p-2 rounded-xl text-charcoal/40 hover:text-charcoal hover:bg-cream/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of workers to be settled */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal/50">
                Workers to Settle ({pendingSettlementInFilter.length})
              </span>
              <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-cream/30 rounded-2xl border border-charcoal/10 divide-y divide-charcoal/5 text-xs">
                {pendingSettlementInFilter.map(l => (
                  <div key={l.worker.id} className="pt-1.5 first:pt-0 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-charcoal">{l.worker.name}</span>
                      <span className="text-charcoal/40 ml-1.5">({l.worker.skill})</span>
                    </div>
                    <span className="font-mono font-bold text-ochre">KES {formatMoney(l.netDue)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Batch Total Summary */}
            <div className="p-4 bg-cream/30 rounded-2xl border border-charcoal/10 flex items-center justify-between text-sm">
              <span className="font-bold text-charcoal">Total Batch Payout:</span>
              <span className="text-lg font-bold text-ochre font-mono">KES {formatMoney(totalBatchAmount)}</span>
            </div>

            <form onSubmit={handleConfirmSettleAll} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/50 mb-1.5">
                  Payment Method
                </label>
                <select
                  value={settleAllMethod}
                  onChange={e => setSettleAllMethod(e.target.value as any)}
                  className="w-full px-4 py-3 rounded-2xl border border-charcoal/15 bg-white text-sm font-medium text-charcoal outline-none focus:border-ochre cursor-pointer"
                >
                  <option value="M-Pesa">M-Pesa</option>
                  <option value="Cash">Cash Payout</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/50 mb-1.5">
                  Batch Receipt / M-Pesa Code (Optional)
                </label>
                <input
                  type="text"
                  value={settleAllMpesaRef}
                  onChange={e => setSettleAllMpesaRef(e.target.value)}
                  placeholder="e.g. BATCH-PAYROLL-01"
                  className="w-full px-4 py-3 rounded-2xl border border-charcoal/15 text-sm font-mono text-charcoal outline-none focus:border-ochre uppercase"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-charcoal/10">
                <button
                  type="button"
                  onClick={() => setShowSettleAllModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-charcoal/15 text-xs font-bold text-charcoal/70 hover:bg-cream/50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSettleAll}
                  className="px-6 py-2.5 rounded-xl bg-ochre hover:bg-ochre-dark text-white text-xs font-bold shadow-md shadow-ochre/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{submittingSettleAll ? 'Processing Batch...' : `Settle All (${pendingSettlementInFilter.length})`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
