import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Link, useSearchParams } from 'react-router-dom';
import { Sparkle, Mail, Lock, User, Phone, MessageSquare, CheckCircle2, ArrowLeft, HardHat, CreditCard } from 'lucide-react';
import { cn } from '../lib/utils';

export default function SignupPage() {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('role') === 'worker' ? 'worker' : 'general';

  const [signupType, setSignupType] = useState<'general' | 'worker'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Common fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // General fields
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  // Worker-only fields
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');

  useEffect(() => {
    if (searchParams.get('role') === 'worker') {
      setSignupType('worker');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!name.trim()) {
      setError('Please enter your full name.');
      setLoading(false);
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email address.');
      setLoading(false);
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    if (signupType === 'worker') {
      if (!mpesaPhone.trim()) {
        setError('Please enter your M-Pesa phone number.');
        setLoading(false);
        return;
      }
      if (!idNumber.trim()) {
        setError('Please enter your National ID number.');
        setLoading(false);
        return;
      }
    } else {
      if (!whatsapp.trim()) {
        setError('Please enter your WhatsApp number.');
        setLoading(false);
        return;
      }
    }

    try {
      // Create account in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: name.trim() });

      if (signupType === 'worker') {
        // Site Worker self-registration: Submits strictly as pending worker
        const workerRequestData = {
          uid: user.uid,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: mpesaPhone.trim(),
          idNumber: idNumber.trim(),
          role: 'worker' as const,
          status: 'pending' as const,
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'profiles', user.uid), workerRequestData);
        await setDoc(doc(db, 'pending_signups', user.uid), workerRequestData);
      } else {
        // Check if an owner profile document exists in profiles collection
        let isFirstOwner = false;
        try {
          const ownerQuery = query(collection(db, 'profiles'), where('role', '==', 'owner'));
          const ownerSnap = await getDocs(ownerQuery);
          isFirstOwner = ownerSnap.empty;
        } catch (err) {
          isFirstOwner = false;
        }

        if (isFirstOwner) {
          const ownerData = {
            uid: user.uid,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim() || whatsapp.trim(),
            whatsapp: whatsapp.trim(),
            role: 'owner' as const,
            status: 'active' as const,
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'profiles', user.uid), ownerData);
          await setDoc(doc(db, 'siteContent', 'metadata'), { initialized: true });
        } else {
          const requestData = {
            uid: user.uid,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim() || whatsapp.trim(),
            whatsapp: whatsapp.trim(),
            role: 'pending' as const,
            status: 'pending' as const,
            createdAt: new Date().toISOString()
          };

          // Save pending profile document
          await setDoc(doc(db, 'profiles', user.uid), requestData);

          // Save to pending_signups collection for easy admin querying
          await setDoc(doc(db, 'pending_signups', user.uid), requestData);
        }
      }

      setSubmittedSuccess(true);
    } catch (err: any) {
      console.error('Sign up error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email address already exists. Please log in.');
      } else {
        setError(err.message || 'Failed to submit registration request.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Subtle Background Elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-ochre/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-charcoal/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-sm font-semibold text-charcoal/60 hover:text-ochre mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Pamnim Interiors
        </Link>

        <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 shadow-xl border border-charcoal/10">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-ochre/10 text-ochre rounded-2xl flex items-center justify-center mx-auto mb-4">
              {signupType === 'worker' ? <HardHat className="w-7 h-7" /> : <Sparkle className="w-7 h-7" />}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-charcoal">
              {signupType === 'worker' ? 'Site Worker Registration' : 'Request Account Access'}
            </h1>
            <p className="text-xs sm:text-sm text-charcoal/60 mt-2">
              {signupType === 'worker' 
                ? 'Register as a skilled site worker. Your account will be activated upon owner approval.'
                : 'Submit your registration details to request access to Pamnim Interiors.'}
            </p>
          </div>

          {/* Registration Type Tabs */}
          {!submittedSuccess && (
            <div className="grid grid-cols-2 p-1 bg-cream/60 rounded-2xl mb-6 border border-charcoal/5">
              <button
                type="button"
                onClick={() => { setSignupType('general'); setError(null); }}
                className={cn(
                  "py-2 text-xs font-bold rounded-xl transition-all cursor-pointer text-center",
                  signupType === 'general'
                    ? "bg-white text-charcoal shadow-xs"
                    : "text-charcoal/60 hover:text-charcoal"
                )}
              >
                Client / Team
              </button>
              <button
                type="button"
                onClick={() => { setSignupType('worker'); setError(null); }}
                className={cn(
                  "py-2 text-xs font-bold rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1.5",
                  signupType === 'worker'
                    ? "bg-white text-ochre shadow-xs"
                    : "text-charcoal/60 hover:text-charcoal"
                )}
              >
                <HardHat className="w-3.5 h-3.5" />
                <span>Site Worker</span>
              </button>
            </div>
          )}

          {submittedSuccess ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-charcoal">Request sent</h2>
              <p className="text-sm text-charcoal/70 leading-relaxed">
                {signupType === 'worker'
                  ? 'Your worker registration has been submitted as pending. You cannot log in until the site owner approves and sets up your site profile.'
                  : 'An administrator will review your details and send your approved access notification.'}
              </p>
              <div className="pt-4">
                <Link
                  to="/login"
                  className="inline-block px-8 py-3 bg-ochre text-white font-bold text-sm rounded-2xl shadow-lg shadow-ochre/20 hover:bg-ochre-dark transition-all"
                >
                  Go to Login Page
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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

              {/* Worker Specific: Phone (M-Pesa) */}
              {signupType === 'worker' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                      Phone (M-Pesa)
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
                    <span className="text-[10px] text-charcoal/40 mt-1 block">Used for daily site wage settlements and SMS notifications.</span>
                  </div>

                  {/* National ID */}
                  <div>
                    <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                      National ID Number
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
                </>
              ) : (
                <>
                  {/* General: Phone */}
                  <div>
                    <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="w-5 h-5 text-charcoal/40 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        placeholder="e.g. 0725 668710"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-charcoal/15 focus:border-ochre outline-none text-sm bg-cream/30 font-medium"
                      />
                    </div>
                  </div>

                  {/* WhatsApp Number (Required for Client/Staff) */}
                  <div>
                    <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                      WhatsApp Number (Required for Approval Link)
                    </label>
                    <div className="relative">
                      <MessageSquare className="w-5 h-5 text-emerald-600 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        required
                        placeholder="e.g. +254 725 668710"
                        value={whatsapp}
                        onChange={e => setWhatsapp(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-charcoal/15 focus:border-ochre outline-none text-sm bg-cream/30 font-medium"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-charcoal/40 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-charcoal/15 focus:border-ochre outline-none text-sm bg-cream/30 font-medium"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                  Create Password
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-charcoal/40 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-charcoal/15 focus:border-ochre outline-none text-sm bg-cream/30 font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-ochre text-white font-bold text-sm shadow-xl shadow-ochre/20 hover:bg-ochre-dark transition-all disabled:opacity-50 mt-4 cursor-pointer"
              >
                {loading ? 'Submitting Request...' : signupType === 'worker' ? 'Submit Worker Request' : 'Submit Request'}
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
      </div>
    </div>
  );
}

