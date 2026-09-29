import React, { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Link, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { 
  Lock, User, Phone, CheckCircle2, ArrowLeft, HardHat, 
  CreditCard, Sparkles, ArrowRight, ShieldCheck 
} from 'lucide-react';

interface SignupPageProps {
  mode?: 'general' | 'worker';
}

export default function SignupPage({ mode }: SignupPageProps = {}) {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const isWorkerRoute = mode === 'worker' || location.pathname.includes('/worker') || searchParams.get('role') === 'worker';
  const signupType: 'general' | 'worker' = isWorkerRoute ? 'worker' : 'general';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Invite ID lookup for general visitors who have an invitation
  const [invitationInput, setInvitationInput] = useState('');

  // Worker registration steps
  const [workerStep, setWorkerStep] = useState<'signup' | 'profile'>('signup');

  // Common worker credentials
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Worker-only fields (HRMS)
  const [mpesaName, setMpesaName] = useState('');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [appliedSkill, setAppliedSkill] = useState('Masonry');
  const [payoutMethod, setPayoutMethod] = useState<'M-Pesa' | 'Bank Transfer'>('M-Pesa');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [workerNotes, setWorkerNotes] = useState('');

  // Handle worker Step 1 -> Step 2
  const handleProceedToWorkerProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!mpesaName.trim()) {
      setError('Please enter your M-Pesa registered name.');
      return;
    }
    if (!mpesaPhone.trim()) {
      setError('Please enter your M-Pesa phone number.');
      return;
    }
    if (!idNumber.trim()) {
      setError('Please enter your National ID number.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setWorkerStep('profile');
  };

  // Submit site worker registration
  const handleWorkerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: name.trim() });

      const workerRequestData: Record<string, any> = {
        uid: user.uid,
        name: name.trim(),
        mpesaName: mpesaName.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        phone: mpesaPhone.trim(),
        idNumber: idNumber.trim(),
        appliedSkill,
        payoutMethod,
        emergencyContact: emergencyContact.trim(),
        notes: workerNotes.trim(),
        role: 'worker' as const,
        status: 'pending' as const,
        createdAt: new Date().toISOString()
      };

      if (payoutMethod === 'Bank Transfer') {
        if (bankName.trim()) workerRequestData.bankName = bankName.trim();
        if (accountName.trim()) workerRequestData.accountName = accountName.trim();
        if (accountNumber.trim()) workerRequestData.accountNumber = accountNumber.trim();
      }

      await setDoc(doc(db, 'profiles', user.uid), workerRequestData);
      await setDoc(doc(db, 'pending_signups', user.uid), workerRequestData);

      const workerDocData: Record<string, any> = {
        id: user.uid,
        userId: user.uid,
        name: name.trim(),
        mpesaName: mpesaName.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        phone: mpesaPhone.trim(),
        idNumber: idNumber.trim(),
        skill: appliedSkill,
        payFrequency: 'daily',
        payoutMethod,
        emergencyContact: emergencyContact.trim(),
        notes: workerNotes.trim(),
        dailyRate: 0,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      if (payoutMethod === 'Bank Transfer') {
        if (bankName.trim()) workerDocData.bankName = bankName.trim();
        if (accountName.trim()) workerDocData.accountName = accountName.trim();
        if (accountNumber.trim()) workerDocData.accountNumber = accountNumber.trim();
      }

      await setDoc(doc(db, 'workers', user.uid), workerDocData);

      // Sign out pending worker
      await auth.signOut();
      setSubmittedSuccess(true);
    } catch (err: any) {
      console.error('Worker registration error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email address already exists. Please log in.');
      } else {
        setError(err.message || 'Failed to submit registration request.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInvitationLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitationInput.trim()) return;
    const cleanId = invitationInput.trim().replace(/^.*[?&]id=/, '');
    navigate(`/client-setup?id=${encodeURIComponent(cleanId)}`);
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-ochre/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-charcoal/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-sm font-semibold text-charcoal/60 hover:text-ochre mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Pamnim Interiors
        </Link>

        <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 shadow-xl border border-charcoal/10">
          {/* ======================================================== */}
          {/* PART 3: CLIENT SELF-SIGNUP REMOVED                       */}
          {/* Owner creates client accounts; clients use sign-in link  */}
          {/* ======================================================== */}
          {signupType === 'general' ? (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-14 h-14 bg-ochre/10 text-ochre rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-charcoal">
                  Client Accounts are by Invitation
                </h1>
                <p className="text-xs sm:text-sm text-charcoal/60 mt-2 leading-relaxed">
                  To provide our signature bespoke experience, client accounts are created directly by our lead interior designers. This ensures your project, quotes, and space plans are pre-configured.
                </p>
              </div>

              <div className="space-y-4 pt-2">
                {/* Option 1: Prospective clients wanting to start a project */}
                <div className="p-4 bg-cream/40 rounded-2xl border border-charcoal/10 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ochre block">
                    Starting a New Project?
                  </span>
                  <p className="text-xs text-charcoal/70 leading-relaxed">
                    Book a consultation or site inspection with our lead designers. We will prepare your scope, estimate, and client portal.
                  </p>
                  <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-xs font-bold text-ochre hover:text-ochre-dark pt-1"
                  >
                    <span>Book a Consultation on Homepage</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {/* Option 2: Client received invitation link or ID */}
                <div className="p-4 bg-white rounded-2xl border border-charcoal/15 space-y-3 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-ochre" />
                    <span className="text-xs font-bold text-charcoal">
                      Have an Invitation Link from your Designer?
                    </span>
                  </div>
                  <p className="text-xs text-charcoal/60">
                    If our team sent you a personalized sign-in link via WhatsApp or email, open it directly, or paste your Invitation link/ID below:
                  </p>

                  <form onSubmit={handleOpenInvitationLink} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Paste link or invitation ID here..."
                      value={invitationInput}
                      onChange={(e) => setInvitationInput(e.target.value)}
                      className="flex-1 px-3 py-2 bg-cream/20 border border-charcoal/15 rounded-xl text-xs font-mono text-charcoal focus:border-ochre focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!invitationInput.trim()}
                      className="px-4 py-2 bg-ochre hover:bg-ochre-dark text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      Set Password
                    </button>
                  </form>
                </div>

                {/* Option 3: Already active */}
                <div className="pt-2 text-center space-y-3">
                  <Link
                    to="/login"
                    className="w-full py-3.5 px-6 rounded-2xl bg-charcoal text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-charcoal/90 transition-all cursor-pointer shadow-md"
                  >
                    <span>Already Have an Activated Password? Log In</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  <p className="text-xs text-charcoal/50 pt-2 border-t border-charcoal/10">
                    Are you a craftsman, technician, or fundi?{' '}
                    <Link to="/signup?role=worker" className="font-bold text-ochre hover:underline inline-flex items-center gap-1">
                      <HardHat className="w-3.5 h-3.5 inline text-ochre" />
                      <span>Site Worker Registration</span>
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* ======================================================== */
            /* SITE WORKER REGISTRATION (HRMS) — KEPT FULLY AS-IS       */
            /* ======================================================== */
            <div>
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-ochre/10 text-ochre rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <HardHat className="w-7 h-7" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-charcoal">
                  Site Worker Registration
                </h1>
                <p className="text-xs sm:text-sm text-charcoal/60 mt-2">
                  Register for on-site artisan operations, daily attendance, and weekly M-Pesa wage payouts. Your account will be activated upon owner approval.
                </p>
              </div>

              {submittedSuccess ? (
                <div className="text-center py-6 space-y-4 animate-fade-in">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold text-charcoal">Request sent, pending approval</h2>
                  <p className="text-sm text-charcoal/70 leading-relaxed">
                    Your worker registration has been submitted and is pending owner approval. You cannot log in yet. The site owner will review your details, set your trade and daily wage rate, and activate your account.
                  </p>
                  <div className="pt-4 space-y-2">
                    <Link
                      to="/login"
                      className="inline-block px-8 py-3 bg-ochre text-white font-bold text-sm rounded-2xl shadow-lg shadow-ochre/20 hover:bg-ochre-dark transition-all"
                    >
                      Back to Login
                    </Link>
                    <p className="text-xs text-charcoal/50">
                      You will receive notification once your profile is activated.
                    </p>
                  </div>
                </div>
              ) : workerStep === 'profile' ? (
                /* WORKER STEP 2: PROFILE & PAYOUT DETAILS */
                <form onSubmit={handleWorkerSubmit} className="space-y-4 animate-fade-in">
                  <div className="p-3 bg-ochre/10 rounded-2xl border border-ochre/20 text-xs text-charcoal flex items-center justify-between">
                    <span className="font-bold text-ochre">Step 2 of 2: Payout & Emergency Details</span>
                    <button
                      type="button"
                      onClick={() => setWorkerStep('signup')}
                      className="text-ochre hover:underline font-bold cursor-pointer"
                    >
                      Edit Step 1
                    </button>
                  </div>

                  {error && (
                    <div className="p-4 rounded-2xl bg-red-50 text-red-700 text-xs font-medium border border-red-200">
                      {error}
                    </div>
                  )}

                  {/* Summary of credentials */}
                  <div className="p-4 bg-cream/40 rounded-2xl border border-charcoal/10 space-y-2 text-xs">
                    <div className="font-bold text-charcoal uppercase tracking-wider text-[10px]">Pre-filled Registration Details</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-charcoal/50 block">Name:</span>
                        <span className="font-bold text-charcoal">{name}</span>
                      </div>
                      <div>
                        <span className="text-charcoal/50 block">Phone (M-Pesa):</span>
                        <span className="font-bold text-charcoal">{mpesaPhone}</span>
                      </div>
                      <div>
                        <span className="text-charcoal/50 block">National ID:</span>
                        <span className="font-bold text-charcoal">{idNumber}</span>
                      </div>
                      <div>
                        <span className="text-charcoal/50 block">Email:</span>
                        <span className="font-bold text-charcoal truncate block">{email}</span>
                      </div>
                    </div>
                  </div>

                  {/* Trade / Skill */}
                  <div>
                    <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                      Primary Trade / Artisan Skill <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={appliedSkill}
                      onChange={e => setAppliedSkill(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-charcoal/15 bg-white focus:border-ochre outline-none text-xs font-semibold text-charcoal"
                    >
                      <option value="Masonry">Masonry & Tiling</option>
                      <option value="Carpentry">Carpentry & Joinery</option>
                      <option value="Painting">Painting & Special Finishes</option>
                      <option value="Electrical">Electrical Works</option>
                      <option value="Plumbing">Plumbing & Sanitary</option>
                      <option value="Welding">Welding & Metal Fabrication</option>
                      <option value="Gypsum">Gypsum & Ceilings</option>
                      <option value="Casual Labor">Casual / General Site Support</option>
                    </select>
                  </div>

                  {/* Payout Method */}
                  <div>
                    <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                      Preferred Payout Method
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPayoutMethod('M-Pesa')}
                        className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          payoutMethod === 'M-Pesa'
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                            : 'border-charcoal/15 hover:bg-cream text-charcoal/70'
                        }`}
                      >
                        <Phone className="w-4 h-4 text-emerald-600" />
                        <span>M-Pesa</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPayoutMethod('Bank Transfer')}
                        className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          payoutMethod === 'Bank Transfer'
                            ? 'border-blue-600 bg-blue-50 text-blue-800'
                            : 'border-charcoal/15 hover:bg-cream text-charcoal/70'
                        }`}
                      >
                        <CreditCard className="w-4 h-4 text-blue-600" />
                        <span>Bank Transfer</span>
                      </button>
                    </div>
                  </div>

                  {/* Bank Fields */}
                  {payoutMethod === 'Bank Transfer' && (
                    <div className="space-y-3 p-4 bg-cream/30 rounded-2xl border border-charcoal/10 animate-fade-in">
                      <div>
                        <label className="block text-[10px] font-bold text-charcoal/60 uppercase tracking-wider mb-1">
                          Bank Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Equity Bank, KCB, NCBA"
                          value={bankName}
                          onChange={e => setBankName(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-charcoal/15 bg-white text-xs font-medium focus:border-ochre outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-charcoal/60 uppercase tracking-wider mb-1">
                          Account Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Name as it appears on bank statement"
                          value={accountName}
                          onChange={e => setAccountName(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-charcoal/15 bg-white text-xs font-medium focus:border-ochre outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-charcoal/60 uppercase tracking-wider mb-1">
                          Account Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 0123456789"
                          value={accountNumber}
                          onChange={e => setAccountNumber(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-charcoal/15 bg-white text-xs font-medium focus:border-ochre outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Emergency Contact */}
                  <div>
                    <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                      Emergency Contact Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 0722 000000 (Spouse/Next of Kin)"
                      value={emergencyContact}
                      onChange={e => setEmergencyContact(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-charcoal/15 focus:border-ochre outline-none text-xs bg-cream/30 font-medium"
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                      Certificates or Past Projects (Optional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. NITA certified, 5 years experience in residential carpentry..."
                      value={workerNotes}
                      onChange={e => setWorkerNotes(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-charcoal/15 focus:border-ochre outline-none text-xs bg-cream/30 font-medium resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setWorkerStep('signup')}
                      className="w-1/3 py-3.5 rounded-2xl border border-charcoal/20 text-charcoal font-bold text-xs hover:bg-cream transition-all cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-2/3 py-3.5 rounded-2xl bg-ochre text-white font-bold text-sm shadow-xl shadow-ochre/20 hover:bg-ochre-dark transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? 'Submitting...' : 'Submit Profile Request'}
                    </button>
                  </div>

                  <p className="text-[11px] text-center text-charcoal/50 pt-1">
                    Submitting creates your pending profile. You cannot log in yet until owner approval.
                  </p>
                </form>
              ) : (
                /* WORKER STEP 1: CREDENTIALS */
                <form onSubmit={handleProceedToWorkerProfile} className="space-y-4 animate-fade-in">
                  <div className="p-3 bg-ochre/10 rounded-2xl border border-ochre/20 text-xs text-charcoal font-bold">
                    Step 1 of 2: Worker Account & Credentials
                  </div>

                  {error && (
                    <div className="p-4 rounded-2xl bg-red-50 text-red-700 text-xs font-medium border border-red-200">
                      {error}
                    </div>
                  )}

                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-5 h-5 text-charcoal/40 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. John Mwangi"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-charcoal/15 focus:border-ochre outline-none text-sm bg-cream/30 font-medium"
                      />
                    </div>
                  </div>

                  {/* M-Pesa Registered Name */}
                  <div>
                    <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                      M-Pesa Registered Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-5 h-5 text-charcoal/40 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. JOHN MWANGI KAMAU"
                        value={mpesaName}
                        onChange={e => setMpesaName(e.target.value.toUpperCase())}
                        className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-charcoal/15 focus:border-ochre outline-none text-sm bg-cream/30 font-bold uppercase tracking-wider"
                      />
                    </div>
                  </div>

                  {/* Phone (M-Pesa) */}
                  <div>
                    <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                      Phone (M-Pesa) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-5 h-5 text-emerald-600 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 0712 345678"
                        value={mpesaPhone}
                        onChange={e => setMpesaPhone(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-charcoal/15 focus:border-ochre outline-none text-sm bg-cream/30 font-medium"
                      />
                    </div>
                  </div>

                  {/* National ID */}
                  <div>
                    <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                      National ID Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <CreditCard className="w-5 h-5 text-charcoal/40 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. 12345678"
                        value={idNumber}
                        onChange={e => setIdNumber(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-charcoal/15 focus:border-ochre outline-none text-sm bg-cream/30 font-medium"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        placeholder="john@example.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full px-4 py-3.5 rounded-2xl border border-charcoal/15 focus:border-ochre outline-none text-sm bg-cream/30 font-medium"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                      Create Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-5 h-5 text-charcoal/40 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-charcoal/15 focus:border-ochre outline-none text-sm bg-cream/30 font-medium"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 rounded-2xl bg-ochre text-white font-bold text-sm shadow-xl shadow-ochre/20 hover:bg-ochre-dark transition-all mt-4 cursor-pointer"
                  >
                    Continue: Complete Your Profile
                  </button>

                  <div className="text-center pt-4 border-t border-charcoal/10">
                    <p className="text-xs text-charcoal/60">
                      Already have an approved account?{' '}
                      <Link to="/login" className="font-bold text-ochre hover:underline">
                        Log In
                      </Link>
                    </p>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
