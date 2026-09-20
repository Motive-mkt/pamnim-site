import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, getDocs, doc, setDoc, deleteDoc, onSnapshot, where, updateDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { 
  Users, UserPlus, CheckCircle2, Copy, Shield, Phone, Mail, 
  ExternalLink, Sparkles, Check, Clock, UserCheck, AlertCircle, ArrowUpRight, Trash2, XCircle,
  HardHat, DollarSign, X, Briefcase
} from 'lucide-react';
import DeleteClientModal from './DeleteClientModal';
import { WorkerSkill } from '../types/hrms';

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

interface UserManagementViewProps {
  onRefreshData?: () => void;
}

export default function UserManagementView({ onRefreshData }: UserManagementViewProps) {
  const { profile, isOwner, canApproveSignups } = useAuth();
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [activeStaff, setActiveStaff] = useState<any[]>([]);
  const [activeClients, setActiveClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWorkerLink, setCopiedWorkerLink] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<any | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Selected role mapping for pending requests approval
  const [assignedRoles, setAssignedRoles] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Worker Approval Modal State (for Owner-only fields)
  const [showWorkerApprovalModal, setShowWorkerApprovalModal] = useState(false);
  const [workerApprovalReq, setWorkerApprovalReq] = useState<any | null>(null);
  const [workerApprovalForm, setWorkerApprovalForm] = useState<{
    skill: WorkerSkill;
    dailyRate: number | '';
    status: 'active' | 'on_leave' | 'inactive';
    assignedProjectId: string;
    notes: string;
  }>({
    skill: 'Carpenter',
    dailyRate: 1500,
    status: 'active',
    assignedProjectId: '',
    notes: ''
  });

  useEffect(() => {
    fetchUsers();
    // Load projects for worker assignment
    const unsubProjects = onSnapshot(query(collection(db, 'projects')), (snap) => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.warn('Could not load projects for user manager:', err));

    return () => unsubProjects();
  }, []);

  const fetchUsers = () => {
    setLoading(true);

    // Listen to profiles
    const profilesQuery = query(collection(db, 'profiles'));
    const unsub = onSnapshot(profilesQuery, (snap) => {
      const allProfiles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const pending = allProfiles.filter((p: any) => p.status === 'pending' || p.role === 'pending');
      const staff = allProfiles.filter((p: any) => p.status !== 'pending' && p.role !== 'client' && p.role !== 'pending' && p.role !== 'worker');
      const clients = allProfiles.filter((p: any) => p.status !== 'pending' && p.role === 'client');

      setPendingRequests(pending);
      setActiveStaff(staff);
      setActiveClients(clients);

      // Initialize default role selection for pending requests
      const initialRoles: Record<string, string> = {};
      pending.forEach((p: any) => {
        initialRoles[p.id] = p.role === 'worker' ? 'worker' : 'client';
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

  const handleCopyWorkerSignupLink = () => {
    const link = `${window.location.origin}/signup?role=worker`;
    navigator.clipboard.writeText(link);
    setCopiedWorkerLink(true);
    setTimeout(() => setCopiedWorkerLink(false), 3000);
  };

  const handleRoleSelectionChange = (reqId: string, role: string) => {
    setAssignedRoles(prev => ({ ...prev, [reqId]: role }));
  };

  const handleApproveRequest = async (req: any) => {
    if (!canApproveSignups) {
      alert('You do not have permission to approve sign-up requests.');
      return;
    }

    const targetRole = assignedRoles[req.id] || (req.role === 'worker' ? 'worker' : 'client');

    // Worker approval requires owner-only fields form
    if (targetRole === 'worker') {
      setWorkerApprovalReq(req);
      setWorkerApprovalForm({
        skill: 'Carpenter',
        dailyRate: 1500,
        status: 'active',
        assignedProjectId: '',
        notes: req.notes || ''
      });
      setShowWorkerApprovalModal(true);
      return;
    }

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

  const handleConfirmWorkerApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerApprovalReq) return;

    setProcessingId(workerApprovalReq.id);
    try {
      const selectedProject = projects.find(p => p.id === workerApprovalForm.assignedProjectId);

      // 1. Create / update the worker document with owner-only fields
      const workerDoc = {
        id: workerApprovalReq.id,
        userId: workerApprovalReq.uid || workerApprovalReq.id,
        name: workerApprovalReq.name || 'Worker',
        phone: workerApprovalReq.phone || '',
        idNumber: workerApprovalReq.idNumber || '',
        email: workerApprovalReq.email || '',
        skill: workerApprovalForm.skill,
        dailyRate: Number(workerApprovalForm.dailyRate) || 0,
        status: workerApprovalForm.status,
        assignedProjectId: workerApprovalForm.assignedProjectId || undefined,
        assignedProjectName: selectedProject ? selectedProject.name : undefined,
        notes: workerApprovalForm.notes.trim() || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'workers', workerApprovalReq.id), workerDoc, { merge: true });

      // 2. Activate profile with 'worker' role
      await setDoc(doc(db, 'profiles', workerApprovalReq.id), {
        uid: workerApprovalReq.uid || workerApprovalReq.id,
        name: workerApprovalReq.name || 'Worker',
        email: workerApprovalReq.email || '',
        phone: workerApprovalReq.phone || '',
        idNumber: workerApprovalReq.idNumber || '',
        role: 'worker',
        status: 'active',
        approvedBy: profile?.name || 'Admin',
        approvedAt: new Date().toISOString()
      }, { merge: true });

      // 3. Clean up pending signups
      try {
        await deleteDoc(doc(db, 'pending_signups', workerApprovalReq.id));
      } catch (e) {}

      // 4. WhatsApp notification
      const phoneNum = (workerApprovalReq.phone || '').replace(/\D/g, '');
      const loginUrl = `${window.location.origin}/login`;
      const messageText = `Hello ${workerApprovalReq.name}! Your Site Worker registration with Pamnim Interiors has been approved as ${workerApprovalForm.skill}.\n\nYou can log into your worker portal here:\n${loginUrl}`;

      if (phoneNum) {
        const waUrl = `https://wa.me/${phoneNum}?text=${encodeURIComponent(messageText)}`;
        window.open(waUrl, '_blank');
      } else {
        alert(`Worker approved as ${workerApprovalForm.skill}! Please share this login link with the worker:\n${loginUrl}`);
      }

      setShowWorkerApprovalModal(false);
      setWorkerApprovalReq(null);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Error approving worker:', err);
      alert('Failed to approve worker: ' + err.message);
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

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <button
            onClick={handleCopySignupLink}
            className="px-5 py-3 bg-white text-ochre font-bold text-xs sm:text-sm rounded-2xl shadow-lg hover:bg-cream transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {copiedLink ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" /> Link Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> Copy Client/Staff Link
              </>
            )}
          </button>

          <button
            onClick={handleCopyWorkerSignupLink}
            className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm rounded-2xl border border-white/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {copiedWorkerLink ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" /> Worker Link Copied!
              </>
            ) : (
              <>
                <HardHat className="w-4 h-4" /> Copy Worker Sign-Up Link
              </>
            )}
          </button>
        </div>
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
                <p className="text-xs text-charcoal/50">Review registration requests and assign roles. Workers require owner-only wage & trade configuration.</p>
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-base text-charcoal truncate">{req.name || 'Unnamed Request'}</h4>
                      {req.role === 'worker' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-ochre/15 text-ochre flex items-center gap-1">
                          <HardHat className="w-3 h-3" /> Worker Request
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-charcoal/60">
                      {req.email && (
                        <span className="flex items-center gap-1 min-w-0 break-all">
                          <Mail className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{req.email}</span>
                        </span>
                      )}
                      {(req.whatsapp || req.phone) && (
                        <span className="flex items-center gap-1 shrink-0">
                          <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> {req.role === 'worker' ? 'M-Pesa / Phone:' : 'WhatsApp:'} {req.phone || req.whatsapp}
                        </span>
                      )}
                      {req.idNumber && (
                        <span className="shrink-0 font-medium">
                          ID: {req.idNumber}
                        </span>
                      )}
                      <span className="shrink-0">Requested: {new Date(req.createdAt || Date.now()).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-charcoal/5">
                    <select
                      value={assignedRoles[req.id] || (req.role === 'worker' ? 'worker' : 'client')}
                      onChange={e => handleRoleSelectionChange(req.id, e.target.value)}
                      className="px-3 py-2.5 rounded-xl border border-charcoal/15 bg-white text-xs font-bold text-charcoal outline-none focus:border-ochre cursor-pointer"
                    >
                      <option value="client">Client</option>
                      <option value="worker">Site Worker / Fundi</option>
                      <option value="regular_employee">Regular Employee</option>
                      <option value="elevated_employee">Elevated Employee</option>
                      {isOwner && <option value="owner">Owner</option>}
                    </select>

                    <button
                      onClick={() => handleApproveRequest(req)}
                      disabled={processingId === req.id}
                      className="px-4 py-2.5 rounded-xl bg-ochre text-white text-xs font-bold shadow-md hover:bg-ochre-dark transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-h-[42px] cursor-pointer"
                    >
                      {assignedRoles[req.id] === 'worker' || req.role === 'worker' ? (
                        <>
                          <HardHat className="w-4 h-4 shrink-0" />
                          <span>{processingId === req.id ? 'Opening...' : 'Approve & Setup Worker Profile'}</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-4 h-4 shrink-0" />
                          <span>{processingId === req.id ? 'Approving...' : 'Approve & Notify'}</span>
                        </>
                      )}
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

                    {/* Delete Client action - visible strictly to role == 'owner' only */}
                    {isOwner && (
                      <button
                        onClick={() => setClientToDelete(client)}
                        className="px-3.5 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700 hover:bg-red-600 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                        title="Permanently delete client account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Client</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Worker Approval Modal (Owner-Only Fields) */}
      {showWorkerApprovalModal && workerApprovalReq && (
        <div className="fixed inset-0 z-50 bg-charcoal/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-charcoal/10 my-8 space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-charcoal/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-ochre/10 text-ochre flex items-center justify-center">
                  <HardHat className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-charcoal">Approve Site Worker</h3>
                  <p className="text-xs text-charcoal/50">Configure owner-only wage, trade, and project assignments.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowWorkerApprovalModal(false);
                  setWorkerApprovalReq(null);
                }}
                className="p-2 rounded-xl text-charcoal/40 hover:text-charcoal hover:bg-cream/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Worker Submitted Information */}
            <div className="p-4 bg-cream/30 rounded-2xl border border-charcoal/10 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-charcoal/40 block">Worker Submission</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-charcoal/50">Name: </span>
                  <span className="font-bold text-charcoal">{workerApprovalReq.name}</span>
                </div>
                <div>
                  <span className="text-charcoal/50">Phone (M-Pesa): </span>
                  <span className="font-bold text-charcoal">{workerApprovalReq.phone || workerApprovalReq.whatsapp}</span>
                </div>
                <div>
                  <span className="text-charcoal/50">National ID: </span>
                  <span className="font-bold text-charcoal">{workerApprovalReq.idNumber || 'Not provided'}</span>
                </div>
                <div>
                  <span className="text-charcoal/50">Email: </span>
                  <span className="font-bold text-charcoal">{workerApprovalReq.email}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleConfirmWorkerApproval} className="space-y-4">
              {/* Owner-Only Field 1: Trade / Skill */}
              <div>
                <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                  Trade / Skill <span className="text-red-500">*</span>
                </label>
                <select
                  value={workerApprovalForm.skill}
                  onChange={e => setWorkerApprovalForm(prev => ({ ...prev, skill: e.target.value as WorkerSkill }))}
                  required
                  className="w-full px-4 py-3 rounded-2xl border border-charcoal/15 bg-white text-sm font-medium text-charcoal outline-none focus:border-ochre cursor-pointer"
                >
                  {SKILLS_LIST.map(skill => (
                    <option key={skill} value={skill}>{skill}</option>
                  ))}
                </select>
              </div>

              {/* Owner-Only Field 2: Daily Wage Rate (KES) */}
              <div>
                <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                  Daily Wage Rate (KES) <span className="text-red-500">* (Owner-only)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-charcoal/40">KES</span>
                  <input
                    type="number"
                    min={100}
                    step={50}
                    required
                    value={workerApprovalForm.dailyRate}
                    onChange={e => setWorkerApprovalForm(prev => ({ 
                      ...prev, 
                      dailyRate: e.target.value === '' ? '' : Number(e.target.value) 
                    }))}
                    placeholder="e.g. 1500"
                    className="w-full pl-14 pr-4 py-3 rounded-2xl border border-charcoal/15 text-sm font-bold text-charcoal outline-none focus:border-ochre"
                  />
                </div>
                <span className="text-[11px] text-charcoal/40 mt-1 block">Hidden from worker view. Used for daily pay calculations and weekly settlements.</span>
              </div>

              {/* Owner-Only Field 3: Status */}
              <div>
                <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                  Initial Worker Status
                </label>
                <select
                  value={workerApprovalForm.status}
                  onChange={e => setWorkerApprovalForm(prev => ({ 
                    ...prev, 
                    status: e.target.value as 'active' | 'on_leave' | 'inactive' 
                  }))}
                  className="w-full px-4 py-3 rounded-2xl border border-charcoal/15 bg-white text-sm font-medium text-charcoal outline-none focus:border-ochre cursor-pointer"
                >
                  <option value="active">Active (Available for Pay Runs)</option>
                  <option value="on_leave">On Leave</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Owner-Only Field 4: Assigned Project */}
              <div>
                <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                  Assigned Project
                </label>
                <select
                  value={workerApprovalForm.assignedProjectId}
                  onChange={e => setWorkerApprovalForm(prev => ({ ...prev, assignedProjectId: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl border border-charcoal/15 bg-white text-sm font-medium text-charcoal outline-none focus:border-ochre cursor-pointer"
                >
                  <option value="">Unassigned (General Pool)</option>
                  {projects.map(proj => (
                    <option key={proj.id} value={proj.id}>{proj.name || 'Unnamed Project'}</option>
                  ))}
                </select>
              </div>

              {/* Owner-Only Field 5: Notes / Emergency Contact */}
              <div>
                <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                  Notes / Emergency Contact
                </label>
                <textarea
                  rows={2}
                  value={workerApprovalForm.notes}
                  onChange={e => setWorkerApprovalForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Emergency contact name, phone, or special site site notes..."
                  className="w-full p-3 rounded-2xl border border-charcoal/15 text-xs sm:text-sm font-medium text-charcoal outline-none focus:border-ochre resize-none"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4 border-t border-charcoal/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowWorkerApprovalModal(false);
                    setWorkerApprovalReq(null);
                  }}
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl border border-charcoal/15 text-charcoal/70 hover:bg-cream/50 text-xs font-bold transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingId === workerApprovalReq.id}
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-ochre text-white text-xs font-bold shadow-lg shadow-ochre/20 hover:bg-ochre-dark transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{processingId === workerApprovalReq.id ? 'Activating Worker...' : 'Confirm & Activate Worker'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Client Confirmation Modal */}
      <DeleteClientModal
        isOpen={!!clientToDelete}
        client={clientToDelete}
        onClose={() => setClientToDelete(null)}
        onSuccess={() => {
          setClientToDelete(null);
          setToast({
            type: 'success',
            text: 'Client account, authentication credentials, and chat thread successfully deleted.'
          });
          setTimeout(() => setToast(null), 5000);
          if (onRefreshData) onRefreshData();
        }}
      />

      {/* Global Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
          <div className={`p-4 rounded-2xl shadow-xl flex items-center gap-3 border text-xs font-bold ${
            toast.type === 'success' 
              ? 'bg-emerald-900 text-white border-emerald-700' 
              : 'bg-red-900 text-white border-red-700'
          }`}>
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{toast.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}
