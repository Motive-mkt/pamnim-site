import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { 
  collection, getDocs, doc, setDoc, updateDoc, writeBatch, query, where, onSnapshot 
} from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { Worker, AttendanceRecord, AttendanceStatus, PublicHoliday } from '../../types/hrms';
import { formatMoney } from '../../utils/pdfGenerator';
import { 
  getKenyanPublicHolidays, getAllHolidays, getWeekId, getWeekDates, 
  getDayMultiplier, formatAttendanceStatus 
} from '../../utils/hrmsUtils';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, 
  CheckCircle2, Users, AlertCircle, Sparkles, Filter, HardHat, 
  Check, Clock, Sun, CloudRain
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface AttendanceCalendarProps {
  workers: Worker[];
  projects: any[];
}

export default function AttendanceCalendar({ workers, projects }: AttendanceCalendarProps) {
  const { profile } = useAuth();
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [customHolidays, setCustomHolidays] = useState<PublicHoliday[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Day Attendance Sheet Modal
  const [selectedDayModal, setSelectedDayModal] = useState<string | null>(null);
  const [sheetEntries, setSheetEntries] = useState<Record<string, { status: AttendanceStatus; recordId?: string }>>({});
  const [sheetSaving, setSheetSaving] = useState(false);

  // Custom Holiday Modal
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [newHolidayLabel, setNewHolidayLabel] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState(new Date().toISOString().split('T')[0]);

  // Load custom holidays from hrmsSettings/holidays
  useEffect(() => {
    const unsubHolidays = onSnapshot(doc(db, 'hrmsSettings', 'holidays'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setCustomHolidays(data.customHolidays || []);
      }
    });

    return () => unsubHolidays();
  }, []);

  // Compute current year's all holidays
  const currentYear = currentDate.getFullYear();
  const allHolidays = useMemo(() => {
    return getAllHolidays(currentYear, customHolidays);
  }, [currentYear, customHolidays]);

  // Holiday map by date string YYYY-MM-DD
  const holidayMap = useMemo(() => {
    const map = new Map<string, PublicHoliday>();
    allHolidays.forEach(h => {
      map.set(h.date, h);
    });
    return map;
  }, [allHolidays]);

  // Real-time listener for attendance records of the current month/view
  useEffect(() => {
    setLoading(true);
    // Fetch a broad window of attendance records
    const unsub = onSnapshot(collection(db, 'attendanceRecords'), (snap) => {
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
      setAttendanceRecords(records);
      setLoading(false);
    }, (err) => {
      console.error('Error listening to attendance records:', err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Map of attendance by date
  const recordsByDate = useMemo(() => {
    const map: Record<string, AttendanceRecord[]> = {};
    attendanceRecords.forEach(rec => {
      if (!map[rec.date]) map[rec.date] = [];
      map[rec.date].push(rec);
    });
    return map;
  }, [attendanceRecords]);

  // Navigation handlers
  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    } else {
      setCurrentDate(prev => {
        const d = new Date(prev);
        d.setDate(d.getDate() - 7);
        return d;
      });
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    } else {
      setCurrentDate(prev => {
        const d = new Date(prev);
        d.setDate(d.getDate() + 7);
        return d;
      });
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Month grid calculations
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    // Adjust to Monday start: 0 for Monday ... 6 for Sunday
    const startOffset = (firstDayIndex + 6) % 7;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Prepend trailing days of previous month
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dateStr, dayNum: d, isCurrentMonth: false });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dateStr, dayNum: d, isCurrentMonth: true });
    }

    // Trailing days of next month to complete the row
    const totalCells = Math.ceil(days.length / 7) * 7;
    let nextDay = 1;
    while (days.length < totalCells) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
      days.push({ dateStr, dayNum: nextDay, isCurrentMonth: false });
      nextDay++;
    }

    return days;
  }, [currentDate]);

  // Week view calculation
  const weekDays = useMemo(() => {
    return getWeekDates(currentDate);
  }, [currentDate]);

  // Tapping a day opens Day Attendance Sheet Modal
  const handleOpenDaySheet = (dateStr: string) => {
    const dayRecords = recordsByDate[dateStr] || [];
    const recordMap: Record<string, AttendanceRecord> = {};
    dayRecords.forEach(r => {
      recordMap[r.workerId] = r;
    });

    const isHoli = holidayMap.has(dateStr);
    const initialSheet: Record<string, { status: AttendanceStatus; recordId?: string }> = {};

    workers.filter(w => w.status !== 'inactive').forEach(w => {
      const wId = w.id || '';
      const existing = recordMap[wId];
      initialSheet[wId] = {
        status: existing ? existing.status : isHoli ? 'holiday' : 'present_full',
        recordId: existing?.id
      };
    });

    setSheetEntries(initialSheet);
    setSelectedDayModal(dateStr);
  };

  const handleUpdateSheetStatus = (workerId: string, status: AttendanceStatus) => {
    setSheetEntries(prev => ({
      ...prev,
      [workerId]: {
        ...prev[workerId],
        status
      }
    }));
  };

  const handleSaveDaySheet = async () => {
    if (!selectedDayModal) return;
    setSheetSaving(true);
    try {
      const batch = writeBatch(db);
      const weekId = getWeekId(selectedDayModal);

      workers.filter(w => w.status !== 'inactive').forEach(w => {
        const wId = w.id || '';
        const entry = sheetEntries[wId];
        if (!entry) return;

        const dayMultiplier = getDayMultiplier(entry.status);
        const wageDue = Math.round((Number(w.dailyRate) || 0) * dayMultiplier);

        const payload = {
          workerId: wId,
          workerName: w.name,
          workerSkill: w.skill,
          date: selectedDayModal,
          status: entry.status,
          dayMultiplier,
          dailyRate: Number(w.dailyRate) || 0,
          wageDue,
          weekId,
          projectId: w.assignedProjectId || '',
          recordedBy: profile?.name || 'Owner',
          updatedAt: new Date().toISOString()
        };

        if (entry.recordId) {
          const ref = doc(db, 'attendanceRecords', entry.recordId);
          batch.update(ref, payload);
        } else {
          const newRef = doc(collection(db, 'attendanceRecords'));
          batch.set(newRef, {
            ...payload,
            createdAt: new Date().toISOString()
          });
        }
      });

      await batch.commit();
      setSelectedDayModal(null);
    } catch (err) {
      console.error('Error saving day attendance sheet:', err);
      alert('Failed to save attendance sheet. Please try again.');
    } finally {
      setSheetSaving(false);
    }
  };

  // Add Custom Holiday or Site Closure Day
  const handleAddCustomHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayLabel.trim() || !newHolidayDate) return;

    try {
      const newHol: PublicHoliday = {
        id: `custom-${Date.now()}`,
        name: newHolidayLabel.trim(),
        date: newHolidayDate,
        isCustom: true
      };

      const updated = [...customHolidays, newHol];
      await setDoc(doc(db, 'hrmsSettings', 'holidays'), {
        customHolidays: updated,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setCustomHolidays(updated);
      setNewHolidayLabel('');
      setShowHolidayModal(false);
    } catch (err) {
      console.error('Error adding custom holiday:', err);
      alert('Could not save custom holiday. Please try again.');
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* Calendar Header & View Controls */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-charcoal/10 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-ochre font-bold text-xs uppercase tracking-widest">
            <CalendarIcon className="w-4 h-4" />
            <span>Attendance & Site Closure Calendar</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-charcoal">
            {viewMode === 'month' 
              ? currentDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
              : `Week ${currentDate.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })} – ${new Date(currentDate.getTime() + 6 * 86400000).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}`
            }
          </h2>
          <p className="text-xs text-charcoal/60 mt-0.5">
            Kenyan public holidays pre-loaded. Tap any date to inspect or update the worker attendance sheet.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Switcher */}
          <div className="flex items-center p-1 rounded-2xl bg-cream/50 border border-charcoal/10">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                viewMode === 'month' ? "bg-white text-charcoal shadow-xs" : "text-charcoal/60 hover:text-charcoal"
              )}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                viewMode === 'week' ? "bg-white text-charcoal shadow-xs" : "text-charcoal/60 hover:text-charcoal"
              )}
            >
              7-Day Week
            </button>
          </div>

          {/* Prev / Today / Next */}
          <div className="flex items-center gap-1 bg-cream/40 p-1 rounded-2xl border border-charcoal/10">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous month"
              className="p-1.5 rounded-xl hover:bg-white text-charcoal/70 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-bold text-charcoal hover:text-ochre transition-colors cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next month"
              className="p-1.5 rounded-xl hover:bg-white text-charcoal/70 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Add Custom Closure / Holiday */}
          <button
            type="button"
            onClick={() => setShowHolidayModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-ochre/10 hover:bg-ochre/20 text-ochre text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Site Closure / Holiday</span>
          </button>
        </div>
      </div>

      {/* Legend & Summary Info */}
      <div className="flex items-center gap-4 text-xs font-medium text-charcoal/60 flex-wrap px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>Present</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <span>Half Day</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
          <span>Absent</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
          <span>Leave</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
          <span>Kenyan Public Holiday / Closure</span>
        </div>
      </div>

      {/* MONTH VIEW */}
      {viewMode === 'month' && (
        <div className="bg-white rounded-3xl border border-charcoal/10 shadow-xs overflow-hidden">
          {/* Day Names Header */}
          <div className="grid grid-cols-7 bg-cream/40 border-b border-charcoal/10 text-center py-2.5 text-[11px] font-bold text-charcoal/60 uppercase tracking-wider">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
            <span>Sun</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-charcoal/5">
            {monthDays.map(({ dateStr, dayNum, isCurrentMonth }, idx) => {
              const dayRecords = recordsByDate[dateStr] || [];
              const holiday = holidayMap.get(dateStr);
              const isToday = dateStr === todayStr;

              let presentCount = 0;
              let halfCount = 0;
              let absentCount = 0;
              let leaveCount = 0;

              dayRecords.forEach(r => {
                if (r.status === 'present_full' || r.status === 'present') presentCount++;
                else if (r.status === 'present_half') halfCount++;
                else if (r.status === 'absent') absentCount++;
                else if (r.status === 'approved_leave' || r.status === 'leave') leaveCount++;
              });

              return (
                <div
                  key={idx}
                  onClick={() => handleOpenDaySheet(dateStr)}
                  className={cn(
                    "min-h-[85px] sm:min-h-[110px] p-2 sm:p-3 transition-colors cursor-pointer flex flex-col justify-between group",
                    !isCurrentMonth ? "bg-cream/15 text-charcoal/30" : "bg-white hover:bg-cream/30",
                    isToday && "ring-2 ring-ochre/80 bg-ochre/5"
                  )}
                >
                  {/* Date Number & Badges */}
                  <div className="flex items-start justify-between gap-1">
                    <span className={cn(
                      "text-xs sm:text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full",
                      isToday ? "bg-ochre text-white shadow-xs" : isCurrentMonth ? "text-charcoal" : "text-charcoal/30"
                    )}>
                      {dayNum}
                    </span>

                    {holiday && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200 truncate max-w-[80px]" title={holiday.name}>
                        {holiday.name}
                      </span>
                    )}
                  </div>

                  {/* Worker Attendance Stats on this Day */}
                  <div className="space-y-1 mt-1">
                    {dayRecords.length > 0 ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          <span>{presentCount} full{halfCount > 0 ? `, ${halfCount} half` : ''}</span>
                        </div>
                        {absentCount > 0 && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-rose-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            <span>{absentCount} absent</span>
                          </div>
                        )}
                        {leaveCount > 0 && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            <span>{leaveCount} leave</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-charcoal/30 italic group-hover:text-ochre block">
                        Tap to log
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7-DAY WEEK VIEW */}
      {viewMode === 'week' && (
        <div className="bg-white rounded-3xl border border-charcoal/10 shadow-xs overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-charcoal/10">
            {weekDays.map(({ date, dayName }) => {
              const dayRecords = recordsByDate[date] || [];
              const holiday = holidayMap.get(date);
              const isToday = date === todayStr;

              let presentCount = 0;
              let halfCount = 0;
              let absentCount = 0;
              let leaveCount = 0;

              dayRecords.forEach(r => {
                if (r.status === 'present_full' || r.status === 'present') presentCount++;
                else if (r.status === 'present_half') halfCount++;
                else if (r.status === 'absent') absentCount++;
                else if (r.status === 'approved_leave' || r.status === 'leave') leaveCount++;
              });

              return (
                <div
                  key={date}
                  onClick={() => handleOpenDaySheet(date)}
                  className={cn(
                    "p-4 transition-all cursor-pointer flex flex-col justify-between min-h-[160px] group",
                    isToday ? "bg-ochre/5 ring-1 ring-ochre" : "bg-white hover:bg-cream/40"
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-charcoal/50 uppercase tracking-widest">{dayName}</span>
                      <span className={cn(
                        "text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center",
                        isToday ? "bg-ochre text-white" : "text-charcoal"
                      )}>
                        {new Date(date + 'T00:00:00').getDate()}
                      </span>
                    </div>

                    {holiday && (
                      <div className="p-2 rounded-xl bg-purple-50 border border-purple-200 mt-2">
                        <span className="text-[10px] font-bold text-purple-900 block leading-tight">
                          {holiday.name}
                        </span>
                        <span className="text-[9px] text-purple-700">Paid Public Holiday</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-charcoal/5 mt-4 space-y-1.5">
                    {dayRecords.length > 0 ? (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-charcoal/50">Present:</span>
                          <span className="font-bold text-emerald-700">{presentCount} full{halfCount > 0 ? `, ${halfCount} half` : ''}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-charcoal/50">Absent:</span>
                          <span className="font-bold text-rose-700">{absentCount}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-charcoal/50">Leave:</span>
                          <span className="font-bold text-blue-700">{leaveCount}</span>
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-charcoal/40 italic block text-center group-hover:text-ochre">
                        No logs recorded (Tap to fill)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Day Attendance Sheet Modal */}
      {selectedDayModal && (
        <div className="fixed inset-0 z-50 bg-charcoal/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white max-w-2xl w-full rounded-3xl p-6 sm:p-8 shadow-2xl border border-charcoal/10 my-8 space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-charcoal/10 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-ochre block">Attendance Sheet</span>
                <h3 className="text-xl font-bold text-charcoal">
                  {new Date(selectedDayModal + 'T00:00:00').toLocaleDateString('en-GB', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                  })}
                </h3>
                {holidayMap.has(selectedDayModal) && (
                  <span className="inline-block mt-1 text-xs font-bold text-purple-800 bg-purple-100 px-2.5 py-0.5 rounded-full">
                    {holidayMap.get(selectedDayModal)?.name}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedDayModal(null)}
                aria-label="Close modal"
                className="p-2 rounded-xl text-charcoal/40 hover:text-charcoal hover:bg-cream/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Workers List with Quick Status Toggles */}
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {workers.filter(w => w.status !== 'inactive').map(w => {
                const wId = w.id || '';
                const currentStatus = sheetEntries[wId]?.status || 'present_full';

                return (
                  <div key={wId} className="p-3.5 rounded-2xl border border-charcoal/10 bg-cream/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-charcoal">{w.name}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-charcoal/10 text-charcoal/70">
                          {w.skill}
                        </span>
                      </div>
                      <span className="text-xs text-charcoal/50">{w.phone}</span>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap">
                      {[
                        { val: 'present_full', label: 'Full', active: 'bg-emerald-600 text-white' },
                        { val: 'present_half', label: 'Half', active: 'bg-amber-600 text-white' },
                        { val: 'absent', label: 'Absent', active: 'bg-rose-600 text-white' },
                        { val: 'approved_leave', label: 'Leave', active: 'bg-blue-600 text-white' },
                        { val: 'holiday', label: 'Holiday', active: 'bg-purple-600 text-white' },
                      ].map(btn => (
                        <button
                          key={btn.val}
                          type="button"
                          onClick={() => handleUpdateSheetStatus(wId, btn.val as AttendanceStatus)}
                          className={cn(
                            "px-2.5 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                            currentStatus === btn.val
                              ? `${btn.active} border-transparent shadow-xs`
                              : "bg-white border-charcoal/15 text-charcoal/60 hover:bg-cream/50"
                          )}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-charcoal/10">
              <button
                type="button"
                onClick={() => setSelectedDayModal(null)}
                className="px-5 py-2.5 rounded-xl border border-charcoal/15 text-xs font-bold text-charcoal/70 hover:bg-cream/50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDaySheet}
                disabled={sheetSaving}
                className="px-6 py-2.5 rounded-xl bg-ochre hover:bg-ochre-dark text-white text-xs font-bold shadow-md shadow-ochre/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{sheetSaving ? 'Saving Changes...' : 'Save Attendance Sheet'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Holiday / Closure Modal */}
      {showHolidayModal && (
        <div className="fixed inset-0 z-50 bg-charcoal/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 sm:p-8 shadow-2xl border border-charcoal/10 space-y-5 animate-fade-in">
            <div className="flex items-start justify-between gap-4 border-b border-charcoal/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-ochre/10 text-ochre flex items-center justify-center">
                  <CloudRain className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-charcoal">Add Site Closure / Holiday</h3>
                  <p className="text-xs text-charcoal/50">Custom weather day, public gazette, or site closure.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHolidayModal(false)}
                aria-label="Close modal"
                className="p-2 rounded-xl text-charcoal/40 hover:text-charcoal hover:bg-cream/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomHoliday} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/50 mb-1.5">
                  Closure / Holiday Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newHolidayLabel}
                  onChange={e => setNewHolidayLabel(e.target.value)}
                  placeholder="e.g. Site closed - Heavy Rain / Transport Strike"
                  className="w-full px-4 py-3 rounded-2xl border border-charcoal/15 text-sm font-medium text-charcoal outline-none focus:border-ochre"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/50 mb-1.5">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={newHolidayDate}
                  onChange={e => setNewHolidayDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-charcoal/15 text-sm font-bold text-charcoal outline-none focus:border-ochre cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-charcoal/10">
                <button
                  type="button"
                  onClick={() => setShowHolidayModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-charcoal/15 text-xs font-bold text-charcoal/70 hover:bg-cream/50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-ochre hover:bg-ochre-dark text-white text-xs font-bold shadow-md shadow-ochre/20 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Holiday / Closure</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
