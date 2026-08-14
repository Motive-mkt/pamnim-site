import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, getDocs, doc, setDoc, deleteDoc, onSnapshot, where, updateDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { 
  Users, UserPlus, CheckCircle2, Copy, Shield, Phone, Mail, 
  ExternalLink, Sparkles, Check, Clock, UserCheck, AlertCircle, ArrowUpRight, Trash2, XCircle
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

    if (targetRole === 'owner') {
      if (!isOwner) {
        alert('Only the current Owner can approve a request as Owner.');
        return;
      }
      const confirmed = window.confirm(
        `Are you sure you want to approve "${req.name || req.email}" as an Owner? This will grant full system ownership.`
      );
      if (!confirmed) return;
    }

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
      const readableRoleName = targetRole === 'owner' ? 'Owner' : targetRole === 'client' ? 'Client' : targetRole === 'elevated_employee' ? 'Elevated Employee' : 'Regular Employee';
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

  const handleUpdateEmployeeRole = async (
    staffUid: string, 
    newRole: 'owner' | 'elevated_employee' | 'regular_employee' | 'client',
    memberName?: string
  ) => {
    if (newRole === 'owner') {
      if (!isOwner) {
        alert('Only the current Owner can promote someone else to Owner.');
        return;
      }
      const confirmed = window.confirm(
        `This will make "${memberName || 'this user'}" an Owner with full administrative control. Continue?`
      );
      if (!confirmed) return;
    } else if (!isOwner && !canApproveSignups) {
      alert('Only the Owner or Elevated Employees can modify user access levels.');
      return;
    }

    try {
      await updateDoc(doc(db, 'profiles', staffUid), {
        role: newRole,
        updatedAt: new Date().toISOString()
      });
      const roleLabel = newRole === 'owner' ? 'Owner' : newRole === 'elevated_employee' ? 'Elevated Employee' : newRole === 'regular_employee' ? 'Regular Employee' : 'Client';
      alert(`User role updated to ${roleLabel}.`);
    } catch (err: any) {
      console.error('Error updating user role:', err);
      alert('Failed to update user role: ' + (err.message || 'Unknown error'));
    }
  };

  // Deleting a member now calls the backend Express endpoint using Firebase Admin SDK
  // to permanently delete the Firebase Auth user record as well as the Firestore profile documents.
  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!isOwner && !canApproveSignups) {
      alert('Only the Owner or Elevated Employees can remove team members.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to permanently remove "${memberName}"? This will delete their authentication credentials and revoke all system access immediately.`
    );
    if (!confirmed) return;

    setProcessingId(memberId);

    try {
      // 1. Get current user's Firebase ID token for secure backend verification
      let token = '';
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken();
      }

      // 2. Call backend Admin endpoint to delete from Firebase Auth and Firestore
      const res = await fetch(`/api/admin/users/${encodeURIComponent(memberId)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error || `Server returned HTTP ${res.status}`);
      }

      const result = await res.json();

      // Direct fallback deletion on client in case of local cache sync
      try {
        await deleteDoc(doc(db, 'profiles', memberId));
      } catch (e) {}
      try {
        await deleteDoc(doc(db, 'pending_signups', memberId));
      } catch (e) {}

      alert(`"${memberName}" has been permanently removed from Firebase Authentication and the system.`);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Error removing member:', err);
      // Fallback direct delete from Firestore if backend reported an error
      try {
        await deleteDoc(doc(db, 'profiles', memberId));
        alert(`User profile was deleted from Firestore, with notice: ${err.message}`);
        if (onRefreshData) onRefreshData();
      } catch (fallbackErr: any) {
        alert('Failed to remove user: ' + (err.message || fallbackErr.message || 'Unknown error'));
      }
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Share Link Banner */}
      <div className="bg-ochre text-white p-5 sm:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 flex-wrap">
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
        <div className="bg-white p-5 sm:p-8 rounded-3xl border border-charcoal/10 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 border-b border-charcoal/10 pb-4 flex-wrap">
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
                  className="p-4 sm:p-5 rounded-2xl border border-charcoal/10 bg-cream/30 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <h4 className="font-bold text-base text-charcoal truncate">{req.name || 'Unnamed Request'}</h4>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-charcoal/60">
                      {req.email && (
                        <span className="flex items-center gap-1 min-w-0 break-all">
                          <Mail className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{req.email}</span>
                        </span>
                      )}
                      {(req.whatsapp || req.phone) && (
                        <span className="flex items-center gap-1 shrink-0">
                          <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> WhatsApp: {req.whatsapp || req.phone}
                        </span>
                      )}
                      <span className="shrink-0">Requested: {new Date(req.createdAt || Date.now()).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-charcoal/5">
                    <select
                      value={assignedRoles[req.id] || 'client'}
                      onChange={e => handleRoleSelectionChange(req.id, e.target.value)}
                      className="px-3 py-2.5 rounded-xl border border-charcoal/15 bg-white text-xs font-bold text-charcoal outline-none focus:border-ochre cursor-pointer"
                    >
                      <option value="client">Client</option>
                      <option value="regular_employee">Regular Employee</option>
                      <option value="elevated_employee">Elevated Employee</option>
                      {isOwner && <option value="owner">Owner</option>}
                    </select>

                    <button
                      onClick={() => handleApproveRequest(req)}
                      disabled={processingId === req.id}
                      className="px-4 py-2.5 rounded-xl bg-ochre text-white text-xs font-bold shadow-md hover:bg-ochre-dark transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-h-[42px]"
                    >
                      <UserCheck className="w-4 h-4 shrink-0" />
                      <span>{processingId === req.id ? 'Approving...' : 'Approve & Notify WhatsApp'}</span>
                    </button>

                    <button
                      onClick={() => handleRemoveMember(req.id, req.name || req.email || 'Request')}
                      disabled={processingId === req.id}
                      className="px-3 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 min-h-[42px]"
                      title="Decline and delete request"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Decline</span>
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
            const isSelf = member.id === profile?.uid;

            return (
              <div 
                key={member.id}
                className="p-4 rounded-2xl border border-charcoal/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
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
                    {isSelf && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-charcoal/10 text-charcoal">
                        You
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-charcoal/50 mt-0.5 truncate">{member.email}</p>
                </div>

                {/* Owner & Elevated Staff controls to promote / demote staff & remove staff */}
                {(isOwner || canApproveSignups) && !isSelf && (
                  <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-charcoal/5">
                    {isElevated ? (
                      <button
                        onClick={() => handleUpdateEmployeeRole(member.id, 'regular_employee')}
                        className="px-3 py-1.5 rounded-xl border border-charcoal/15 text-xs font-bold text-charcoal/70 hover:bg-cream cursor-pointer"
                      >
                        Set to Regular
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateEmployeeRole(member.id, 'elevated_employee')}
                        className="px-3 py-1.5 rounded-xl bg-ochre text-white text-xs font-bold shadow-sm hover:bg-ochre-dark cursor-pointer"
                      >
                        Promote to Elevated
                      </button>
                    )}

                    <button
                      onClick={() => handleUpdateEmployeeRole(member.id, 'client')}
                      className="px-3 py-1.5 rounded-xl border border-charcoal/15 text-xs font-bold text-charcoal/70 hover:bg-cream cursor-pointer"
                    >
                      Make Client
                    </button>

                    {isOwner && !isMemberOwner && (
                      <button
                        onClick={() => handleUpdateEmployeeRole(member.id, 'owner', member.name)}
                        className="px-3 py-1.5 rounded-xl border border-purple-200 text-purple-700 hover:bg-purple-50 text-xs font-bold transition-all cursor-pointer"
                      >
                        Make Owner
                      </button>
                    )}

                    <button
                      onClick={() => handleRemoveMember(member.id, member.name || member.email)}
                      className="px-3 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title="Remove Member"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Clients Section */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-charcoal/10 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-charcoal/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-charcoal">Active Clients</h3>
              <p className="text-xs text-charcoal/50">Manage registered client accounts and access.</p>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-800 rounded-full">
            {activeClients.length} Clients
          </span>
        </div>

        <div className="space-y-3">
          {activeClients.length === 0 ? (
            <div className="py-6 text-center text-charcoal/40 text-sm">
              No active clients registered yet.
            </div>
          ) : (
            activeClients.map(client => (
              <div 
                key={client.id}
                className="p-4 rounded-2xl border border-charcoal/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-charcoal">{client.name || 'Unnamed Client'}</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Client
                    </span>
                  </div>
                  <p className="text-xs text-charcoal/50 mt-0.5">{client.email || 'No email provided'}</p>
                </div>

                {/* Owner & Elevated Staff controls to manage client */}
                {(isOwner || canApproveSignups) && client.role !== 'owner' && (
                  <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-charcoal/5">
                    {isOwner && (
                      <button
                        onClick={() => handleUpdateEmployeeRole(client.id, 'owner', client.name)}
                        className="px-3 py-1.5 rounded-xl border border-purple-200 text-purple-700 hover:bg-purple-50 text-xs font-bold transition-all cursor-pointer"
                      >
                        Make Owner
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveMember(client.id, client.name || client.email)}
                      className="px-3 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title="Remove Client"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
