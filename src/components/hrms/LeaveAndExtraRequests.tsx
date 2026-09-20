import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { 
  collection, doc, updateDoc, onSnapshot, query, orderBy, setDoc 
} from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { LeaveRequest, ExtraRequest, Worker } from '../../types/hrms';
import { formatMoney } from '../../utils/pdfGenerator';
import { getWeekId } from '../../utils/hrmsUtils';
import { 
  Calendar, DollarSign, CheckCircle2, XCircle, AlertCircle, 
  Clock, Check, X, Filter, HardHat, FileText, ChevronRight 
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface LeaveAndExtraRequestsProps {
  workers: Worker[];
  projects: any[];
}

export default function LeaveAndExtraRequests({ workers, projects }: LeaveAndExtraRequestsProps) {
  const { profile } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'leave' | 'extras'>('leave');
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [extraRequests, setExtraRequests] = useState<ExtraRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Review state
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<{
    type: 'leave' | 'extra';
    action: 'approve' | 'reject';
    item: any;
  } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [approvedAmount, setApprovedAmount] = useState<number | ''>('');

  useEffect(() => {
    setLoading(true);

    // 1. Leave Requests
    const unsubLeave = onSnapshot(
      query(collection(db, 'leaveRequests'), orderBy('createdAt', 'desc')),
      (snap) => {
        setLeaveRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest)));
      },
      (err) => console.error('Error fetching leave requests:', err)
    );

    // 2. Extra Payment Requests
    const unsubExtras = onSnapshot(
      query(collection(db, 'extraPaymentRequests'), orderBy('createdAt', 'desc')),
      (snap) => {
        setExtraRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExtraRequest)));
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching extra payment requests:', err);
        setLoading(false);
      }
    );

    return () => {
      unsubLeave();
      unsubExtras();
    };
  }, []);

  const pendingLeaveCount = leaveRequests.filter(r => r.status === 'pending').length;
  const pendingExtrasCount = extraRequests.filter(r => r.status === 'pending').length;

  const handleOpenAction = (type: 'leave' | 'extra', action: 'approve' | 'reject', item: any) => {
    setActionModal({ type, action, item });
    setReviewNote('');
    setApprovedAmount(item.amount || '');
  };

  const handleConfirmAction = async () => {
    if (!actionModal) return;
    const { type, action, item } = actionModal;
    setProcessingId(item.id);

    try {
      if (type === 'leave') {
        const leaveRef = doc(db, 'leaveRequests', item.id);
        await updateDoc(leaveRef, {
          status: action === 'approve' ? 'approved' : 'declined',
          reviewedBy: profile?.name || 'Owner',
          reviewedAt: new Date().toISOString(),
          reviewNotes: reviewNote.trim()
        });

        // If approved, mark the attendance calendar for the dates as approved_leave
        if (action === 'approve' && item.dates && Array.isArray(item.dates)) {
          const workerObj = workers.find(w => w.id === item.workerId);
          const dailyRate = Number(workerObj?.dailyRate) || 0;

          for (const dateStr of item.dates) {
            const weekId = getWeekId(dateStr);
            const recordId = `${item.workerId}_${dateStr}`;
            await setDoc(doc(db, 'attendanceRecords', recordId), {
              workerId: item.workerId,
              workerName: item.workerName,
              workerSkill: workerObj?.skill || 'General',
              date: dateStr,
              status: 'approved_leave',
              dayMultiplier: 1.0,
              dailyRate,
              wageDue: dailyRate,
              weekId,
              projectId: workerObj?.assignedProjectId || '',
              notes: `Approved leave: ${item.reason || ''}`,
              recordedBy: profile?.name || 'Owner',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }, { merge: true });
          }
        }
      } else {
        // Extra payment request
        const extraRef = doc(db, 'extraPaymentRequests', item.id);
        const finalApprovedAmount = action === 'approve' ? Number(approvedAmount) || item.amount : 0;
        await updateDoc(extraRef, {
          status: action === 'approve' ? 'approved' : 'declined',
          approvedAmount: finalApprovedAmount,
          reviewedBy: profile?.name || 'Owner',
          reviewedAt: new Date().toISOString(),
          reviewNotes: reviewNote.trim()
        });
      }

      setActionModal(null);
    } catch (err) {
      console.error('Error processing request:', err);
      alert('Could not update request status. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Subtab Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-white rounded-3xl p-4 sm:p-5 border border-charcoal/10 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-charcoal">Leave & Extra Payment Requests</h2>
          <p className="text-xs text-charcoal/60 mt-0.5">
            Worker-initiated submissions requiring owner or supervisor authorization.
          </p>
        </div>

        <div className="flex items-center p-1 rounded-2xl bg-cream/60 border border-charcoal/10">
          <button
            type="button"
            onClick={() => setActiveSubTab('leave')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
              activeSubTab === 'leave' ? "bg-white text-charcoal shadow-xs" : "text-charcoal/60 hover:text-charcoal"
            )}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Leave Requests</span>
            {pendingLeaveCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-ochre text-white text-[10px] font-bold">
                {pendingLeaveCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('extras')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
              activeSubTab === 'extras' ? "bg-white text-charcoal shadow-xs" : "text-charcoal/60 hover:text-charcoal"
            )}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Extra Pay & Overtime</span>
            {pendingExtrasCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                {pendingExtrasCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* LEAVE REQUESTS LIST */}
      {activeSubTab === 'leave' && (
        <div className="space-y-3">
          {leaveRequests.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-charcoal/10">
              <Calendar className="w-8 h-8 text-charcoal/30 mx-auto mb-2" />
              <p className="text-sm font-bold text-charcoal">No leave requests found</p>
              <p className="text-xs text-charcoal/60 mt-1">When site workers submit time off, they will appear here.</p>
            </div>
          ) : (
            leaveRequests.map(req => {
              const isPending = req.status === 'pending';
              const datesList = req.dates || [];
              const dateRangeStr = datesList.length === 1 
                ? datesList[0] 
                : `${datesList[0]} to ${datesList[datesList.length - 1]} (${datesList.length} days)`;

              return (
                <div 
                  key={req.id}
                  className="bg-white rounded-3xl p-5 sm:p-6 border border-charcoal/10 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-base text-charcoal">{req.workerName}</span>
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        req.status === 'approved' ? "bg-emerald-100 text-emerald-800" :
                        req.status === 'declined' ? "bg-rose-100 text-rose-800" :
                        "bg-amber-100 text-amber-800"
                      )}>
                        {req.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-charcoal/60 flex-wrap">
                      <span className="font-bold text-charcoal/80">Period: {dateRangeStr}</span>
                      <span>•</span>
                      <span>Submitted: {new Date(req.createdAt).toLocaleDateString('en-GB')}</span>
                    </div>

                    {req.reason && (
                      <p className="text-xs text-charcoal/70 bg-cream/40 p-2.5 rounded-xl border border-charcoal/5 max-w-xl">
                        "{req.reason}"
                      </p>
                    )}

                    {req.reviewNotes && (
                      <p className="text-xs text-charcoal/50 italic">
                        Owner note: {req.reviewNotes}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {isPending ? (
                    <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-charcoal/10 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenAction('leave', 'reject', req)}
                        className="px-4 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-all cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenAction('leave', 'approve', req)}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve Leave</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-charcoal/40 text-right shrink-0">
                      Reviewed by {req.reviewedBy || 'Owner'}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* EXTRA PAYMENT REQUESTS LIST */}
      {activeSubTab === 'extras' && (
        <div className="space-y-3">
          {extraRequests.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-charcoal/10">
              <DollarSign className="w-8 h-8 text-charcoal/30 mx-auto mb-2" />
              <p className="text-sm font-bold text-charcoal">No extra payment requests found</p>
              <p className="text-xs text-charcoal/60 mt-1">Workers can submit requests for overtime, transport, or material reimbursements.</p>
            </div>
          ) : (
            extraRequests.map(req => {
              const isPending = req.status === 'pending';

              return (
                <div 
                  key={req.id}
                  className="bg-white rounded-3xl p-5 sm:p-6 border border-charcoal/10 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-base text-charcoal">{req.workerName}</span>
                      <span className="text-base font-bold text-emerald-700">
                        {formatMoney(req.approvedAmount !== undefined && req.status === 'approved' ? req.approvedAmount : req.amount)}
                      </span>
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        req.status === 'approved' ? "bg-emerald-100 text-emerald-800" :
                        req.status === 'declined' ? "bg-rose-100 text-rose-800" :
                        "bg-amber-100 text-amber-800"
                      )}>
                        {req.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-charcoal/60 flex-wrap">
                      <span>Date: {req.date}</span>
                      <span>•</span>
                      <span>Submitted: {new Date(req.createdAt).toLocaleDateString('en-GB')}</span>
                    </div>

                    {req.reason && (
                      <p className="text-xs text-charcoal/70 bg-cream/40 p-2.5 rounded-xl border border-charcoal/5 max-w-xl">
                        "{req.reason}"
                      </p>
                    )}

                    {req.reviewNotes && (
                      <p className="text-xs text-charcoal/50 italic">
                        Owner note: {req.reviewNotes}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {isPending ? (
                    <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-charcoal/10 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenAction('extra', 'reject', req)}
                        className="px-4 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-all cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenAction('extra', 'approve', req)}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve Extra Pay</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-charcoal/40 text-right shrink-0">
                      Reviewed by {req.reviewedBy || 'Owner'}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Review Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 bg-charcoal/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 sm:p-8 shadow-2xl border border-charcoal/10 space-y-5 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center",
                actionModal.action === 'approve' ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
              )}>
                {actionModal.action === 'approve' ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-lg font-bold text-charcoal capitalize">
                  {actionModal.action} {actionModal.type === 'leave' ? 'Leave Request' : 'Extra Pay'}
                </h3>
                <span className="text-xs text-charcoal/50">{actionModal.item.workerName}</span>
              </div>
            </div>

            {actionModal.type === 'extra' && actionModal.action === 'approve' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/50 mb-1.5">
                  Approved Amount (KES)
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={approvedAmount}
                  onChange={e => setApprovedAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-2xl border border-charcoal/15 text-sm font-bold text-charcoal outline-none focus:border-ochre"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-charcoal/50 mb-1.5">
                Note / Feedback (Optional)
              </label>
              <textarea
                rows={2}
                value={reviewNote}
                onChange={e => setReviewNote(e.target.value)}
                placeholder="Add optional comments for the worker..."
                className="w-full p-3 rounded-2xl border border-charcoal/15 text-xs sm:text-sm font-medium text-charcoal outline-none focus:border-ochre resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className="px-5 py-2.5 rounded-xl border border-charcoal/15 text-xs font-bold text-charcoal/70 hover:bg-cream/50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={!!processingId}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-white text-xs font-bold shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50",
                  actionModal.action === 'approve' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                )}
              >
                <Check className="w-4 h-4" />
                <span>{processingId ? 'Processing...' : 'Confirm Decision'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
