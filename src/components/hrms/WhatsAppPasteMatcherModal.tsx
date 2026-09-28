import React, { useState } from 'react';
import { Worker, WorkerPayment, WorkerPayoutProfile } from '../../types/hrms';
import { db } from '../../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { formatMoney } from '../../utils/pdfGenerator';
import { 
  MessageSquare, Check, AlertCircle, X, DollarSign, 
  Calendar, CheckCircle2, User, Phone, ArrowRight, ShieldCheck, Tag
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface WhatsAppPasteMatcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  workers: Worker[];
  projects: any[];
  onPaymentsLogged?: () => void;
}

interface MatchedCandidate {
  id: string;
  worker: Worker;
  matchedProfileLabel: string;
  matchedAccountName?: string;
  matchedAccountNumber?: string;
  amount: number;
  referenceCode: string;
  date: string;
  projectId: string;
  rawSnippet: string;
  selected: boolean;
}

// Normalize Kenyan phone numbers (e.g. 254712345678, 0712345678, +254712... -> last 9 digits '712345678')
function normalizePhone(num?: string): string {
  if (!num) return '';
  const digits = num.replace(/\D/g, '');
  if (digits.length >= 9) {
    return digits.slice(-9);
  }
  return digits;
}

// Clean string for fuzzy name matching
function cleanName(str?: string): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
}

export default function WhatsAppPasteMatcherModal({
  isOpen,
  onClose,
  workers,
  projects,
  onPaymentsLogged
}: WhatsAppPasteMatcherModalProps) {
  const [pastedText, setPastedText] = useState('');
  const [hasParsed, setHasParsed] = useState(false);
  const [matchedItems, setMatchedItems] = useState<MatchedCandidate[]>([]);
  const [noDetailsFound, setNoDetailsFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  if (!isOpen) return null;

  // Build searchable profiles map for each worker
  const getWorkerProfiles = (w: Worker): WorkerPayoutProfile[] => {
    const list: WorkerPayoutProfile[] = [];

    // Always include worker's own primary profile
    list.push({
      id: 'primary',
      label: 'Primary Profile (Own)',
      accountName: w.mpesaName || w.name,
      accountNumber: w.phone,
      type: 'mpesa',
      isDefault: true
    });

    if (w.payoutProfiles && Array.isArray(w.payoutProfiles)) {
      w.payoutProfiles.forEach(p => {
        if (p && p.label) list.push(p);
      });
    }

    return list;
  };

  const handleParseMessage = () => {
    const text = pastedText.trim();
    if (!text) {
      setNoDetailsFound(true);
      setMatchedItems([]);
      setHasParsed(true);
      return;
    }

    setNoDetailsFound(false);
    setSuccessCount(null);

    // Split text into individual candidate chunks or lines
    // M-Pesa messages usually start with 10-char transaction code (e.g. QGH789XYZ) or contain "Confirmed. Ksh"
    const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
    const candidates: MatchedCandidate[] = [];

    // Also support parsing the entire block if it is a single multi-sentence text
    const blocksToInspect = lines.length > 0 ? lines : [text];

    for (const block of blocksToInspect) {
      // 1. Check for amount: Ksh / KES / amounts
      const amountMatch = block.match(/(?:(?:Ksh|KES)\.?\s*([\d,]+(?:\.\d{2})?)|([\d,]+(?:\.\d{2})?)\s*(?:Ksh|KES))/i);
      let parsedAmount = 0;
      if (amountMatch) {
        const rawNum = (amountMatch[1] || amountMatch[2] || '').replace(/,/g, '');
        parsedAmount = parseFloat(rawNum) || 0;
      }

      // If no amount found with prefix, search for standalone numbers that look like wages (e.g. 1000 - 99999)
      if (!parsedAmount) {
        const fallbackNum = block.match(/\b([1-9]\d{2,5}(?:\.\d{2})?)\b/);
        if (fallbackNum) {
          parsedAmount = parseFloat(fallbackNum[1]) || 0;
        }
      }

      // 2. Check for reference code (typically alphanumeric 8-12 chars, e.g. QGH89XYZ or after 'ref')
      let refCode = '';
      const refMatch = block.match(/\b([A-Z0-9]{8,12})\b/);
      if (refMatch) {
        refCode = refMatch[1];
      }

      // 3. Extract phone numbers from block
      const phoneMatches = block.match(/(?:\+?254|0)[17]\d{8}/g) || [];
      const normalizedBlockPhones = phoneMatches.map(p => normalizePhone(p));

      // 4. Try matching against workers and their saved payout profiles
      let matchedWorker: Worker | null = null;
      let matchedProfile: WorkerPayoutProfile | null = null;

      const blockClean = cleanName(block);

      for (const w of workers) {
        const profiles = getWorkerProfiles(w);

        for (const prof of profiles) {
          // A) Phone / Account number match
          const profNormPhone = normalizePhone(prof.accountNumber);
          if (profNormPhone && normalizedBlockPhones.includes(profNormPhone)) {
            matchedWorker = w;
            matchedProfile = prof;
            break;
          }

          // Also check direct text includes phone
          if (prof.accountNumber && prof.accountNumber.length >= 7 && block.includes(prof.accountNumber)) {
            matchedWorker = w;
            matchedProfile = prof;
            break;
          }

          // B) Account Name match
          const profNameClean = cleanName(prof.accountName);
          if (profNameClean && profNameClean.length >= 4) {
            // Check if full name in block or parts of name in block
            const nameTokens = profNameClean.split(' ').filter(t => t.length > 2);
            const matchesCount = nameTokens.filter(t => blockClean.includes(t)).length;
            if (matchesCount >= 2 || (nameTokens.length === 1 && blockClean.includes(nameTokens[0]))) {
              matchedWorker = w;
              matchedProfile = prof;
              break;
            }
          }

          // C) Worker own name check
          const workerNameClean = cleanName(w.name);
          const workerTokens = workerNameClean.split(' ').filter(t => t.length > 2);
          if (workerTokens.length > 0 && workerTokens.filter(t => blockClean.includes(t)).length >= 2) {
            matchedWorker = w;
            matchedProfile = prof;
            break;
          }
        }

        if (matchedWorker && matchedProfile) break;
      }

      // If matched and we found either an amount or worker, record candidate
      if (matchedWorker && matchedProfile) {
        candidates.push({
          id: Math.random().toString(36).substring(2, 9),
          worker: matchedWorker,
          matchedProfileLabel: matchedProfile.label,
          matchedAccountName: matchedProfile.accountName,
          matchedAccountNumber: matchedProfile.accountNumber,
          amount: parsedAmount || matchedWorker.dailyRate || 0,
          referenceCode: refCode,
          date: new Date().toISOString().split('T')[0],
          projectId: matchedWorker.assignedProjectId || '',
          rawSnippet: block,
          selected: true
        });
      }
    }

    if (candidates.length === 0) {
      setNoDetailsFound(true);
      setMatchedItems([]);
    } else {
      setNoDetailsFound(false);
      setMatchedItems(candidates);
    }

    setHasParsed(true);
  };

  const handleUpdateCandidate = (id: string, field: keyof MatchedCandidate, val: any) => {
    setMatchedItems(prev => prev.map(c => c.id === id ? { ...c, [field]: val } : c));
  };

  const handleConfirmPayouts = async () => {
    const selected = matchedItems.filter(c => c.selected && c.amount > 0);
    if (selected.length === 0) return;

    setSubmitting(true);
    try {
      for (const item of selected) {
        const proj = projects.find(p => p.id === item.projectId);
        const paymentData: Record<string, any> = {
          workerId: item.worker.id,
          workerName: item.worker.name,
          amount: Number(item.amount),
          paymentMethod: 'M-Pesa',
          type: 'settlement',
          date: item.date,
          referenceCode: item.referenceCode ? item.referenceCode.trim() : undefined,
          notes: `WhatsApp auto-match via profile "${item.matchedProfileLabel}" (${item.matchedAccountName || ''} - ${item.matchedAccountNumber || ''})`,
          recordedBy: 'Owner / Auto-match',
          createdAt: new Date().toISOString()
        };
        if (item.projectId) paymentData.projectId = item.projectId;
        if (proj?.name) paymentData.projectName = proj.name;

        await addDoc(collection(db, 'workerPayments'), paymentData);
      }

      setSuccessCount(selected.length);
      if (onPaymentsLogged) onPaymentsLogged();
    } catch (err: any) {
      console.error('Error logging WhatsApp matched payments:', err);
      alert('Could not record some payments: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-charcoal/10 animate-fade-in my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-charcoal/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-charcoal">WhatsApp Paste Matcher</h3>
              <p className="text-xs text-charcoal/50">
                Paste M-Pesa SMS or WhatsApp messages. We match names & numbers across all saved payout profiles.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-charcoal/40 hover:text-charcoal cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Banner */}
        {successCount !== null && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Successfully logged {successCount} worker wage payout{successCount > 1 ? 's' : ''}!</span>
            </div>
            <button
              onClick={onClose}
              className="px-3 py-1 bg-emerald-700 text-white rounded-lg text-xs hover:bg-emerald-800 cursor-pointer"
            >
              Done
            </button>
          </div>
        )}

        {/* Input Textarea */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70">
            Paste WhatsApp / M-Pesa Message Text
          </label>
          <textarea
            rows={4}
            value={pastedText}
            onChange={(e) => {
              setPastedText(e.target.value);
              setHasParsed(false);
              setNoDetailsFound(false);
            }}
            placeholder="e.g. QGH789XYZ Confirmed. Ksh3,500.00 sent to MARY WANJIKU 0722123456 on 28/09/2026..."
            className="w-full p-3.5 bg-cream/40 border border-charcoal/15 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none focus:border-ochre focus:bg-white resize-none"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleParseMessage}
              disabled={!pastedText.trim()}
              className="px-5 py-2.5 rounded-xl bg-ochre hover:bg-ochre-dark text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-ochre/20 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Match Against Worker Profiles</span>
            </button>
          </div>
        </div>

        {/* Plain text notice if no payment details found (no popup, no crash) */}
        {hasParsed && noDetailsFound && (
          <div className="p-4 bg-cream/70 border border-charcoal/10 rounded-2xl text-center space-y-1 animate-fade-in">
            <p className="text-xs font-semibold text-charcoal/70">
              No payment details were found in this message.
            </p>
            <p className="text-[11px] text-charcoal/40">
              Check that the pasted text includes an M-Pesa confirmation snippet or a phone number / name belonging to a registered worker profile.
            </p>
          </div>
        )}

        {/* REVIEW SCREEN: MATCHED ITEMS */}
        {hasParsed && matchedItems.length > 0 && (
          <div className="space-y-4 pt-2 border-t border-charcoal/10 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-charcoal">
                Review Matched Worker Payouts ({matchedItems.length})
              </span>
              <span className="text-[11px] text-charcoal/50">
                Check profile labels and confirm to log
              </span>
            </div>

            <div className="space-y-3">
              {matchedItems.map(item => (
                <div
                  key={item.id}
                  className={cn(
                    "p-4 rounded-2xl border transition-all space-y-3",
                    item.selected ? "bg-white border-ochre/30 shadow-xs" : "bg-cream/20 border-charcoal/10 opacity-60"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(e) => handleUpdateCandidate(item.id, 'selected', e.target.checked)}
                        className="mt-1 w-4 h-4 text-ochre accent-ochre rounded cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-sm text-charcoal">{item.worker.name}</h4>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-ochre/10 text-ochre font-bold uppercase">
                            {item.worker.skill}
                          </span>
                        </div>

                        {/* Matched Profile Badge */}
                        <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold">
                          <Tag className="w-3 h-3 text-emerald-600" />
                          <span>Matched Profile: <strong>{item.matchedProfileLabel}</strong></span>
                          {item.matchedAccountName && (
                            <span className="text-emerald-700">({item.matchedAccountName} • {item.matchedAccountNumber})</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-charcoal/40 block">Amount (KES)</span>
                      <input
                        type="number"
                        min="0"
                        value={item.amount}
                        onChange={(e) => handleUpdateCandidate(item.id, 'amount', Number(e.target.value))}
                        className="w-24 text-right font-mono font-bold text-sm text-charcoal px-2 py-1 bg-cream/50 border border-charcoal/15 rounded-lg focus:border-ochre focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Reference & Project controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-charcoal/5 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-charcoal/50 mb-0.5">Reference Code</label>
                      <input
                        type="text"
                        value={item.referenceCode}
                        onChange={(e) => handleUpdateCandidate(item.id, 'referenceCode', e.target.value.toUpperCase())}
                        placeholder="e.g. QGH789XYZ"
                        className="w-full px-2.5 py-1.5 bg-cream/30 border border-charcoal/15 rounded-lg text-xs font-mono font-bold focus:border-ochre focus:outline-none uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-charcoal/50 mb-0.5">Date</label>
                      <input
                        type="date"
                        value={item.date}
                        onChange={(e) => handleUpdateCandidate(item.id, 'date', e.target.value)}
                        className="w-full px-2 py-1.5 bg-cream/30 border border-charcoal/15 rounded-lg text-xs font-medium focus:border-ochre focus:outline-none cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-charcoal/50 mb-0.5">Project</label>
                      <select
                        value={item.projectId}
                        onChange={(e) => handleUpdateCandidate(item.id, 'projectId', e.target.value)}
                        className="w-full px-2 py-1.5 bg-cream/30 border border-charcoal/15 rounded-lg text-xs font-medium focus:border-ochre focus:outline-none cursor-pointer"
                      >
                        <option value="">General Workshop</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Confirm Actions */}
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-charcoal/10">
              <span className="text-xs font-medium text-charcoal/60">
                {matchedItems.filter(c => c.selected).length} payout{matchedItems.filter(c => c.selected).length !== 1 ? 's' : ''} selected to record.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-charcoal/60 hover:text-charcoal hover:bg-cream cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting || matchedItems.filter(c => c.selected).length === 0}
                  onClick={handleConfirmPayouts}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Logging...' : 'Confirm & Log Payouts'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
