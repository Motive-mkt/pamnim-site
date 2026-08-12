import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, getDocs, doc, setDoc, deleteDoc, onSnapshot, where, updateDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { 
  Users, UserPlus, CheckCircle2, Copy, Shield, Phone, Mail, 
  ExternalLink, Sparkles, Check, Clock, UserCheck, AlertCircle, ArrowUpRight
} from 'lucide-react';

interface UserManagementViewProps {
  onRefreshData?: () => void;
}

export default function UserManagementView({ onRefreshData }: UserManagementViewProps) {
  const { profile, isOwner, canApproveSignups } = useAuth();
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [activeStaff, setActiveStaff] = useState<any[]>([]);
  const [activeClients, setActiveClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  // Selected role mapping for pending requests approval
  const [assignedRoles, setAssignedRoles] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = () => {
    setLoading(true);

    // Listen to profiles
    const profilesQuery = query(collection(db, 'profiles'));
    const unsub = onSnapshot(profilesQuery, (snap) => {
      const allProfiles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const pending = allProfiles.filter((p: any) => p.status === 'pending' || p.role === 'pending');
      const staff = allProfiles.filter((p: any) => p.status !== 'pending' && p.role !== 'client' && p.role !== 'pending');
      const clients = allProfiles.filter((p: any) => p.status !== 'pending' && p.role === 'client');

      setPendingRequests(pending);
      setActiveStaff(staff);
      setActiveClients(clients);

      // Initialize default role selection for pending requests to 'client'
      const initialRoles: Record<string, string> = {};
      pending.forEach((p: any) => {
        initialRoles[p.id] = 'client';
      });
      setAssignedRoles(initialRoles);

      setLoading(false);
    }, (err) => {
      console.error('Error fetching users:', err);
      setLoading(false);
    });

    return unsub;
  };

  const handleCopySignupLink = () => {
    const link = `${window.location.origin}/signup`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleRoleSelectionChange = (reqId: string, role: string) => {
    setAssignedRoles(prev => ({ ...prev, [reqId]: role }));
  };

  const handleApproveRequest = async (req: any) => {
    if (!canApproveSignups) {
      alert('You do not have permission to approve sign-up requests.');
      return;
    }

    const targetRole = assignedRoles[req.id] || 'client';
    setProcessingId(req.id);

    try {
      // Update profile in Firestore
      const userDocRef = doc(db, 'profiles', req.id);
      await setDoc(userDocRef, {
        uid: req.uid || req.id,
        name: req.name || 'User',
        email: req.email || '',
        phone: req.phone || '',
        whatsapp: req.whatsapp || req.phone || '',
        role: targetRole,
        status: 'active',
        approvedBy: profile?.name || 'Admin',
        approvedAt: new Date().toISOString()
      }, { merge: true });

      // Clean up pending_signups collection if document exists there
      try {
        await deleteDoc(doc(db, 'pending_signups', req.id));
      } catch (e) {
        // Document might only exist in profiles
      }

      // Automated WhatsApp notification message
      const whatsappNumber = (req.whatsapp || req.phone || '').replace(/\D/g, '');
      const readableRoleName = targetRole === 'client' ? 'Client' : targetRole === 'elevated_employee' ? 'Elevated Employee' : 'Regular Employee';
      const loginUrl = `${window.location.origin}/login`;
      const messageText = `Hello ${req.name}! Your request for Pamnim Interiors has been approved as a ${readableRoleName}.\n\nYou can log into your portal here:\n${loginUrl}`;

      if (whatsappNumber) {
        const waUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(messageText)}`;
        window.open(waUrl, '_blank');
      } else {
        alert(`Request approved as ${readableRoleName}! Please share this login link with the user:\n${loginUrl}`);
      }

      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Error approving request:', err);
      alert('Failed to approve request: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpdateEmployeeRole = async (staffUid: string, newRole: 'regular_employee' | 'elevated_employee') => {
    if (!isOwner) {
      alert('Only the Owner can promote or modify employee access levels.');
      return;
    }

    try {
      await updateDoc(doc(db, 'profiles', staffUid), {
        role: newRole,
        updatedAt: new Date().toISOString()
      });
      alert(`Employee role updated to ${newRole === 'elevated_employee' ? 'Elevated Employee' : 'Regular Employee'}.`);
    } catch (err: any) {
      console.error('Error updating employee role:', err);
      alert('Failed to update employee role.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Share Link Banner */}
      <div className="bg-ochre text-white p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-white/80" />
            <span className="text-xs font-bold uppercase tracking-widest text-white/90">Share Access Link</span>
          </div>
          <h3 className="text-2xl font-bold">Client & Employee Registration</h3>
          <p className="text-white/80 text-sm max-w-lg mt-1">
            Share this link with prospective clients or employees. Once they submit, review and assign their role below.
          </p>
        </div>

        <button
          onClick={handleCopySignupLink}
          className="px-6 py-3.5 bg-white text-ochre font-bold text-sm rounded-2xl shadow-lg hover:bg-cream transition-all flex items-center gap-2 shrink-0"
        >
          {copiedLink ? (
            <>
              <Check className="w-4 h-4 text-emerald-600" /> Link Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" /> Copy Sign-Up Link
            </>
          )}
        </button>
      </div>

      {/* Pending Approval Requests Section */}
      {canApproveSignups && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-charcoal/10 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-charcoal/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-charcoal">Pending Sign-Up Requests</h3>
                <p className="text-xs text-charcoal/50">Review registration requests and label as Client or Employee.</p>
              </div>
            </div>

            <span className="text-xs font-bold px-3 py-1 bg-amber-100 text-amber-800 rounded-full">
              {pendingRequests.length} Pending
            </span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-charcoal/40 animate-pulse text-sm">
              Loading requests...
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="py-8 text-center text-charcoal/40 text-sm">
              No pending sign-up requests right now.
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map(req => (
                <div 
                  key={req.id} 
                  className="p-5 rounded-2xl border border-charcoal/10 bg-cream/30 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <h4 className="font-bold text-base text-charcoal">{req.name || 'Unnamed Request'}</h4>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-charcoal/60">
                      {req.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" /> {req.email}
                        </span>
                      )}
                      {(req.whatsapp || req.phone) && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp: {req.whatsapp || req.phone}
                        </span>
                      )}
                      <span>Requested: {new Date(req.createdAt || Date.now()).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <select
                      value={assignedRoles[req.id] || 'client'}
                      onChange={e => handleRoleSelectionChange(req.id, e.target.value)}
                      className="px-3 py-2 rounded-xl border border-charcoal/15 bg-white text-xs font-bold text-charcoal outline-none focus:border-ochre"
                    >
                      <option value="client">Client</option>
                      <option value="regular_employee">Regular Employee</option>
                      <option value="elevated_employee">Elevated Employee</option>
                    </select>

                    <button
                      onClick={() => handleApproveRequest(req)}
                      disabled={processingId === req.id}
                      className="px-5 py-2.5 rounded-xl bg-ochre text-white text-xs font-bold shadow-md hover:bg-ochre-dark transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      <UserCheck className="w-4 h-4" />
                      {processingId === req.id ? 'Approving...' : 'Approve & Notify WhatsApp'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Staff & Role Management Section */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-charcoal/10 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-charcoal/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-ochre/10 text-ochre flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-charcoal">Team & Employee Permissions</h3>
              <p className="text-xs text-charcoal/50">Manage active staff roles (Owner, Elevated Employee, Regular Employee).</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {activeStaff.map(member => {
            const isMemberOwner = member.role === 'owner';
            const isElevated = member.role === 'elevated_employee';

            return (
              <div 
                key={member.id}
                className="p-4 rounded-2xl border border-charcoal/10 flex items-center justify-between gap-4 bg-white"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-charcoal">{member.name}</h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isMemberOwner 
                        ? 'bg-purple-100 text-purple-800' 
                        : isElevated 
                          ? 'bg-amber-100 text-amber-800' 
                          : 'bg-blue-100 text-blue-800'
                    }`}>
                      {isMemberOwner ? 'Owner' : isElevated ? 'Elevated Employee' : 'Regular Employee'}
                    </span>
                  </div>
                  <p className="text-xs text-charcoal/50 mt-0.5">{member.email}</p>
                </div>

                {/* Owner controls to promote / demote staff */}
                {isOwner && !isMemberOwner && (
                  <div className="flex items-center gap-2">
                    {isElevated ? (
                      <button
                        onClick={() => handleUpdateEmployeeRole(member.id, 'regular_employee')}
                        className="px-3 py-1.5 rounded-xl border border-charcoal/15 text-xs font-bold text-charcoal/70 hover:bg-cream"
                      >
                        Set to Regular
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateEmployeeRole(member.id, 'elevated_employee')}
                        className="px-3 py-1.5 rounded-xl bg-ochre text-white text-xs font-bold shadow-sm hover:bg-ochre-dark"
                      >
                        Promote to Elevated
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
