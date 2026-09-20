import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { Worker, WorkerSkill, AttendanceRecord, AttendanceStatus } from '../../types/hrms';
import { formatMoney } from '../../utils/pdfGenerator';
import { getWeekId, getDayMultiplier } from '../../utils/hrmsUtils';
import { 
  Zap, CheckCircle2, XCircle, AlertCircle, Clock, Calendar, 
  Filter, Sparkles, RefreshCw, ChevronDown, HardHat, Check, X,
  ShieldCheck, ArrowRight
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface DailyPayRunProps {
  workers: Worker[];
  projects: any[];
  onComplete?: () => void;
}

interface WorkerDailyEntry {
  workerId: string;
  workerName: string;
  skill: WorkerSkill;
  dailyRate: number;
  assignedProjectId?: string;
  status: AttendanceStatus;
  notes: string;
}

export default function DailyPayRun({ workers, projects, onComplete }: DailyPayRunProps) {
  const { profile } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [skillFilter, setSkillFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [entries, setEntries] = useState<Record<string, WorkerDailyEntry>>({});
  const [existingRecordsMap, setExistingRecordsMap] = useState<Record<string, AttendanceRecord>>({});
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const activeWorkers = useMemo(() => {
    return workers.filter(w => w.status === 'active');
  }, [workers]);

  // Load existing records for the selected date to allow review & backfilling
  useEffect(() => {
    async function loadDateAttendance() {
      if (!selectedDate) return;
      setLoadingExisting(true);
      try {
        const q = query(collection(db, 'attendanceRecords'), where('date', '==', selectedDate));
        const snap = await getDocs(q);
        const map: Record<string, AttendanceRecord> = {};
        snap.forEach(docSnap => {
          const data = { id: docSnap.id, ...docSnap.data() } as AttendanceRecord;
          map[data.workerId] = data;
        });
        setExistingRecordsMap(map);

        // Populate initial entries
        const initialMap: Record<string, WorkerDailyEntry> = {};
        activeWorkers.forEach(worker => {
          const wId = worker.id || '';
          const existing = map[wId];
          initialMap[wId] = {
            workerId: wId,
            workerName: worker.name,
            skill: worker.skill,
            dailyRate: Number(worker.dailyRate) || 0,
            assignedProjectId: worker.assignedProjectId || '',
            status: existing ? existing.status : 'present_full', // default to Present (Full Day)
            notes: existing?.notes || ''
          };
        });
        setEntries(initialMap);
      } catch (err) {
        console.error('Error fetching existing attendance records:', err);
      } finally {
        setLoadingExisting(false);
      }
    }

    loadDateAttendance();
  }, [selectedDate, activeWorkers]);

  // Filtered workers list
  const filteredWorkers = useMemo(() => {
    return activeWorkers.filter(w => {
      if (skillFilter !== 'all' && w.skill !== skillFilter) return false;
      if (projectFilter !== 'all' && (w.assignedProjectId || 'unassigned') !== projectFilter) return false;
      return true;
    });
  }, [activeWorkers, skillFilter, projectFilter]);

  // Stats calculation
  const stats = useMemo(() => {
    let presentFull = 0;
    let presentHalf = 0;
    let absent = 0;
    let onLeave = 0;
    let holiday = 0;
    let totalAccruedWage = 0;

    (Object.values(entries) as WorkerDailyEntry[]).forEach((entry: WorkerDailyEntry) => {
      const mult = getDayMultiplier(entry.status);
      totalAccruedWage += entry.dailyRate * mult;

      if (entry.status === 'present_full' || entry.status === 'present') presentFull++;
      else if (entry.status === 'present_half') presentHalf++;
      else if (entry.status === 'absent') absent++;
      else if (entry.status === 'approved_leave' || entry.status === 'leave') onLeave++;
      else if (entry.status === 'holiday') holiday++;
    });

    return {
      presentFull,
      presentHalf,
      absent,
      onLeave,
      holiday,
      totalWorkers: activeWorkers.length,
      totalAccruedWage
    };
  }, [entries, activeWorkers]);

  const handleStatusChange = (workerId: string, status: AttendanceStatus) => {
    setEntries(prev => ({
      ...prev,
      [workerId]: {
        ...prev[workerId],
        status
      }
    }));
  };

  const handleBulkAction = (action: 'all_present' | 'all_absent' | 'all_holiday') => {
    const updated = { ...entries };
    filteredWorkers.forEach(w => {
      const wId = w.id || '';
      if (updated[wId]) {
        if (action === 'all_present') updated[wId].status = 'present_full';
        else if (action === 'all_absent') updated[wId].status = 'absent';
        else if (action === 'all_holiday') updated[wId].status = 'holiday';
      }
    });
    setEntries(updated);
  };

  const handleConfirmAndSave = async () => {
    setSubmitting(true);
    setStatusMessage(null);
    try {
      const weekId = getWeekId(selectedDate);
      const batch = writeBatch(db);

      for (const worker of activeWorkers) {
        const wId = worker.id || '';
        const entry = entries[wId];
        if (!entry) continue;

        const dayMultiplier = getDayMultiplier(entry.status);
        const wageDue = Math.round(entry.dailyRate * dayMultiplier);
        const existing = existingRecordsMap[wId];
        const workerEffectiveId = worker.userId || worker.id || wId;

        const recordPayload = {
          workerId: workerEffectiveId,
          workerDocId: wId,
          workerName: entry.workerName,
          workerSkill: entry.skill,
          date: selectedDate,
          status: entry.status,
          dayMultiplier,
          dailyRate: entry.dailyRate,
          wageDue,
          weekId,
          projectId: entry.assignedProjectId || '',
          notes: entry.notes || '',
          recordedBy: profile?.name || 'Owner / Supervisor',
          updatedAt: new Date().toISOString()
        };

        if (existing?.id) {
          const docRef = doc(db, 'attendanceRecords', existing.id);
          batch.update(docRef, recordPayload);
        } else {
          const newDocRef = doc(collection(db, 'attendanceRecords'));
          batch.set(newDocRef, {
            ...recordPayload,
            createdAt: new Date().toISOString()
          });
        }
      }

      await batch.commit();

      setShowConfirmModal(false);
      setStatusMessage({
        type: 'success',
        text: `Daily pay run for ${selectedDate} confirmed successfully! Total accrued: ${formatMoney(stats.totalAccruedWage)} across ${activeWorkers.length} site workers.`
      });

      if (onComplete) onComplete();
    } catch (err) {
      console.error('Error saving daily pay run:', err);
      setStatusMessage({
        type: 'error',
        text: 'Failed to save daily pay run. Please check your network and try again.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const statusOptions: { value: AttendanceStatus; label: string; short: string; color: string; activeColor: string }[] = [
    { value: 'present_full', label: 'Full Day (1.0x)', short: 'Full', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', activeColor: 'bg-emerald-600 text-white shadow-xs' },
    { value: 'present_half', label: 'Half Day (0.5x)', short: 'Half', color: 'text-amber-700 bg-amber-50 border-amber-200', activeColor: 'bg-amber-600 text-white shadow-xs' },
    { value: 'absent', label: 'Absent (0x)', short: 'Absent', color: 'text-rose-700 bg-rose-50 border-rose-200', activeColor: 'bg-rose-600 text-white shadow-xs' },
    { value: 'approved_leave', label: 'Leave (1.0x)', short: 'Leave', color: 'text-blue-700 bg-blue-50 border-blue-200', activeColor: 'bg-blue-600 text-white shadow-xs' },
    { value: 'holiday', label: 'Holiday (1.0x)', short: 'Holiday', color: 'text-purple-700 bg-purple-50 border-purple-200', activeColor: 'bg-purple-600 text-white shadow-xs' }
  ];

  const uniqueSkills = useMemo(() => {
    return Array.from(new Set(activeWorkers.map(w => w.skill)));
  }, [activeWorkers]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Date Selector */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-charcoal/10 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-ochre font-bold text-xs uppercase tracking-widest">
              <Zap className="w-4 h-4" />
              <span>Fast End-of-Day Logging</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-charcoal">Daily Pay Run</h2>
            <p className="text-xs text-charcoal/60 mt-0.5">
              Rapid attendance check for site supervisors & owner. Defaults all active workers to Full Day.
            </p>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-3 bg-cream/40 p-2.5 rounded-2xl border border-charcoal/10 shrink-0">
            <Calendar className="w-4 h-4 text-ochre shrink-0" />
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-widest text-charcoal/40">Pay Run Date</span>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-transparent text-sm font-bold text-charcoal outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Tally Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2">
          <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-2xl p-3">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest block">Full Day</span>
            <span className="text-lg font-bold text-emerald-900">{stats.presentFull}</span>
          </div>
          <div className="bg-amber-50/70 border border-amber-200/60 rounded-2xl p-3">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-widest block">Half Day</span>
            <span className="text-lg font-bold text-amber-900">{stats.presentHalf}</span>
          </div>
          <div className="bg-rose-50/70 border border-rose-200/60 rounded-2xl p-3">
            <span className="text-[10px] font-bold text-rose-800 uppercase tracking-widest block">Absent</span>
            <span className="text-lg font-bold text-rose-900">{stats.absent}</span>
          </div>
          <div className="bg-blue-50/70 border border-blue-200/60 rounded-2xl p-3">
            <span className="text-[10px] font-bold text-blue-800 uppercase tracking-widest block">On Leave</span>
            <span className="text-lg font-bold text-blue-900">{stats.onLeave}</span>
          </div>
          <div className="bg-purple-50/70 border border-purple-200/60 rounded-2xl p-3">
            <span className="text-[10px] font-bold text-purple-800 uppercase tracking-widest block">Holiday</span>
            <span className="text-lg font-bold text-purple-900">{stats.holiday}</span>
          </div>
          <div className="bg-ochre/10 border border-ochre/20 rounded-2xl p-3">
            <span className="text-[10px] font-bold text-ochre uppercase tracking-widest block">Daily Accrual</span>
            <span className="text-base sm:text-lg font-bold text-charcoal truncate block">
              {formatMoney(stats.totalAccruedWage)}
            </span>
          </div>
        </div>

        {/* Quick Bulk Actions & Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-charcoal/5">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => handleBulkAction('all_present')}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-xs font-bold transition-all shrink-0 cursor-pointer"
            >
              Mark All Present
            </button>
            <button
              type="button"
              onClick={() => handleBulkAction('all_absent')}
              className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-bold transition-all shrink-0 cursor-pointer"
            >
              Mark All Absent (Closure/Rain)
            </button>
            <button
              type="button"
              onClick={() => handleBulkAction('all_holiday')}
              className="px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 text-xs font-bold transition-all shrink-0 cursor-pointer"
            >
              Mark All Paid Holiday
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Trade Filter */}
            <select
              value={skillFilter}
              onChange={e => setSkillFilter(e.target.value)}
              aria-label="Filter by Trade / Skill"
              className="px-3 py-1.5 rounded-xl bg-cream/40 border border-charcoal/15 text-xs font-bold text-charcoal outline-none cursor-pointer"
            >
              <option value="all">All Trades ({activeWorkers.length})</option>
              {uniqueSkills.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Project Filter */}
            <select
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              aria-label="Filter by Project"
              className="px-3 py-1.5 rounded-xl bg-cream/40 border border-charcoal/15 text-xs font-bold text-charcoal outline-none cursor-pointer"
            >
              <option value="all">All Projects</option>
              <option value="unassigned">General Pool (Unassigned)</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className={cn(
          "p-4 rounded-2xl flex items-center gap-3 text-xs font-bold animate-fade-in",
          statusMessage.type === 'success' ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"
        )}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Workers Grid / Rapid Sheet */}
      <div className="space-y-3">
        {loadingExisting ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-charcoal/10">
            <RefreshCw className="w-6 h-6 animate-spin text-ochre mx-auto mb-2" />
            <span className="text-xs text-charcoal/60 font-medium">Checking records for {selectedDate}...</span>
          </div>
        ) : filteredWorkers.length === 0 ? (
          <div className="p-10 text-center bg-white rounded-3xl border border-charcoal/10">
            <HardHat className="w-8 h-8 text-charcoal/30 mx-auto mb-2" />
            <p className="text-sm font-bold text-charcoal">No active site workers found</p>
            <p className="text-xs text-charcoal/60 mt-1">Check filter settings or register workers in the Site Workers tab.</p>
          </div>
        ) : (
          filteredWorkers.map(worker => {
            const wId = worker.id || '';
            const entry = entries[wId] || {
              workerId: wId,
              workerName: worker.name,
              skill: worker.skill,
              dailyRate: Number(worker.dailyRate) || 0,
              assignedProjectId: worker.assignedProjectId || '',
              status: 'present_full',
              notes: ''
            };
            const currentStatus = entry.status;
            const multiplier = getDayMultiplier(currentStatus);
            const calculatedPay = Math.round(entry.dailyRate * multiplier);
            const projectName = projects.find(p => p.id === worker.assignedProjectId)?.name || 'General Pool';

            return (
              <div 
                key={wId}
                className={cn(
                  "bg-white rounded-2xl p-4 sm:p-5 border transition-all shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4",
                  currentStatus === 'absent' ? "border-rose-200 bg-rose-50/20" : "border-charcoal/10 hover:border-ochre/30"
                )}
              >
                {/* Worker Identity */}
                <div className="space-y-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-charcoal text-sm">{worker.name}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cream/70 text-charcoal/70 border border-charcoal/10">
                      {worker.skill}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-charcoal/50">
                    <span>{worker.phone}</span>
                    <span>•</span>
                    <span className="truncate max-w-[150px]">{projectName}</span>
                  </div>
                </div>

                {/* Status Toggle Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {statusOptions.map(opt => {
                    const isSelected = currentStatus === opt.value || 
                      (opt.value === 'present_full' && currentStatus === 'present') ||
                      (opt.value === 'approved_leave' && currentStatus === 'leave');

                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleStatusChange(wId, opt.value)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                          isSelected
                            ? opt.activeColor
                            : "bg-white border-charcoal/15 text-charcoal/70 hover:bg-cream/50"
                        )}
                      >
                        <span className="hidden sm:inline">{opt.label}</span>
                        <span className="sm:hidden">{opt.short}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Accrued Amount for Worker */}
                <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-charcoal/5 min-w-[120px] shrink-0 text-right">
                  <div className="text-left md:text-right">
                    <span className="text-[10px] uppercase font-bold text-charcoal/40 block">Accrued Day Pay</span>
                    <span className={cn(
                      "text-sm font-bold",
                      calculatedPay > 0 ? "text-emerald-700" : "text-charcoal/40"
                    )}>
                      {formatMoney(calculatedPay)}
                    </span>
                  </div>
                  <span className="text-[11px] text-charcoal/40 hidden sm:inline">
                    ({multiplier}d)
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating / Sticky Bottom Bar with "Confirm & Log All" */}
      <div className="sticky bottom-4 z-20 bg-charcoal text-white rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-white/10">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-10 h-10 rounded-2xl bg-ochre text-white flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white/70">Total Day Accrual:</span>
              <span className="text-base sm:text-lg font-bold text-ochre">
                {formatMoney(stats.totalAccruedWage)}
              </span>
            </div>
            <span className="text-[11px] text-white/50 block">
              {stats.presentFull + stats.presentHalf} paid on {selectedDate} ({stats.absent} absent)
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowConfirmModal(true)}
          disabled={submitting || activeWorkers.length === 0}
          className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-ochre hover:bg-ochre-dark text-white font-bold text-sm shadow-lg shadow-ochre/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Confirm & Log All</span>
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-charcoal/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 sm:p-8 shadow-2xl border border-charcoal/10 space-y-5 animate-fade-in">
            <div className="flex items-center gap-3 text-ochre">
              <div className="w-10 h-10 rounded-2xl bg-ochre/10 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-charcoal">Confirm Daily Pay Run</h3>
                <span className="text-xs text-charcoal/50">{selectedDate}</span>
              </div>
            </div>

            <div className="p-4 bg-cream/30 rounded-2xl border border-charcoal/10 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-charcoal/60">Active Site Workers:</span>
                <span className="font-bold text-charcoal">{activeWorkers.length} workers</span>
              </div>
              <div className="flex justify-between">
                <span className="text-charcoal/60">Present (Full / Half):</span>
                <span className="font-bold text-emerald-700">{stats.presentFull} Full, {stats.presentHalf} Half</span>
              </div>
              <div className="flex justify-between">
                <span className="text-charcoal/60">Absent / Leave / Holiday:</span>
                <span className="font-bold text-charcoal">{stats.absent} absent, {stats.onLeave + stats.holiday} leave/holiday</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-charcoal/10 text-sm">
                <span className="font-bold text-charcoal">Total Accrued Wage:</span>
                <span className="font-bold text-ochre">{formatMoney(stats.totalAccruedWage)}</span>
              </div>
            </div>

            <p className="text-[11px] text-charcoal/60 leading-relaxed">
              This updates attendance records for all active workers for {selectedDate}. Their daily wages will be added to this week's settlement sheet.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-5 py-2.5 rounded-xl border border-charcoal/15 text-xs font-bold text-charcoal/70 hover:bg-cream/60 transition-all cursor-pointer"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleConfirmAndSave}
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-ochre hover:bg-ochre-dark text-white text-xs font-bold shadow-md shadow-ochre/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{submitting ? 'Saving Records...' : 'Confirm & Save'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
