import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { 
  Lock, Mail, User, MapPin, CheckCircle2, AlertCircle, 
  ArrowRight, Loader2, Sparkles, ShieldCheck 
} from 'lucide-react';
import { createNotification } from '../services/notificationService';

export default function ClientSetupPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const clientId = searchParams.get('id') || searchParams.get('clientId') || searchParams.get('token');

  const [loadingInvite, setLoadingInvite] = useState(true);
  const [inviteData, setInviteData] = useState<any | null>(null);

  // Form Fields (Pre-filled from owner invitation, but editable!)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Geolocation state (Client-side)
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function fetchInvitation() {
      if (!clientId) {
        setLoadingInvite(false);
        return;
      }

      try {
        // First try client_invitations
        let snap = await getDoc(doc(db, 'client_invitations', clientId));
        if (snap.exists()) {
          const data = snap.data();
          setInviteData(data);
          setName(data.name || '');
          setEmail(data.email || '');
          setUsername(data.username || '');
          setAddress(data.address || '');
          setLoadingInvite(false);
          return;
        }

        // Fallback to profiles
        snap = await getDoc(doc(db, 'profiles', clientId));
        if (snap.exists()) {
          const data = snap.data();
          setInviteData(data);
          setName(data.name || '');
          setEmail(data.email || '');
          setUsername(data.username || '');
          setAddress(data.address || '');
        }
      } catch (err) {
        console.error('Error fetching client invitation:', err);
      } finally {
        setLoadingInvite(false);
      }
    }

    fetchInvitation();
  }, [clientId]);

  // Geolocation handler (Client-side)
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationNotice('Geolocation is not supported by your browser.');
      return;
    }

    setDetectingLocation(true);
    setLocationNotice(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.display_name || `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`;
            setAddress(addr);
            setLocationNotice('Current location captured! You can refine the details.');
          } else {
            setAddress(`Nairobi (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
          }
        } catch {
          setAddress(`Nairobi (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
        } finally {
          setDetectingLocation(false);
        }
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setLocationNotice('Could not retrieve GPS coordinates. Please enter manually.');
        setDetectingLocation(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleActivateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide your name.');
      return;
    }
    if (!email.trim()) {
      setError('Please provide your email address.');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify your password.');
      return;
    }

    setSubmitting(true);
    try {
      let user: any = null;

      try {
        // Create new Firebase Auth user
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        user = userCredential.user;
        await updateProfile(user, { displayName: name.trim() });
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use') {
          // If already in auth (e.g. client returning), try signing in
          try {
            const signedIn = await signInWithEmailAndPassword(auth, email.trim(), password);
            user = signedIn.user;
          } catch (signInErr: any) {
            throw new Error('An account with this email already exists. If this is you, please log in with your existing password at /login.');
          }
        } else {
          throw authErr;
        }
      }

      if (!user) throw new Error('Could not initialize account.');

      // Prepare active client profile data
      const profileData: Record<string, any> = {
        uid: user.uid,
        id: user.uid,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        username: username.trim().toLowerCase() || name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        address: address.trim(),
        role: 'client',
        status: 'active',
        activatedAt: new Date().toISOString()
      };

      if (inviteData?.phone) profileData.phone = inviteData.phone;

      // 1. Write the active client profile document under user.uid
      await setDoc(doc(db, 'profiles', user.uid), profileData, { merge: true });

      // 2. If the initial invitation placeholder had a different ID, migrate quotes/invoices to user.uid
      if (clientId && clientId !== user.uid) {
        try {
          // Update quotes linked to placeholder clientId
          const quotesSnap = await getDocs(query(collection(db, 'quotes'), where('clientId', '==', clientId)));
          for (const qDoc of quotesSnap.docs) {
            await updateDoc(doc(db, 'quotes', qDoc.id), { clientId: user.uid });
          }

          // Update invoices linked to placeholder clientId
          const invoicesSnap = await getDocs(query(collection(db, 'invoices'), where('clientId', '==', clientId)));
          for (const iDoc of invoicesSnap.docs) {
            await updateDoc(doc(db, 'invoices', iDoc.id), { clientId: user.uid });
          }

          // Mark invitation as activated
          await setDoc(doc(db, 'client_invitations', clientId), {
            status: 'activated',
            activatedUid: user.uid,
            activatedAt: new Date().toISOString()
          }, { merge: true });

          // Remove the temporary placeholder profile document so duplicate client rows don't show
          await deleteDoc(doc(db, 'profiles', clientId));
        } catch (migrationErr) {
          console.warn('Note: Non-critical migration cleanup notice:', migrationErr);
        }
      }

      // Notify owner & staff about account activation
      createNotification({
        userId: 'all_owners',
        role: 'owner',
        title: 'Client Account Activated',
        body: `${name.trim()} has completed password setup and activated their client portal.`,
        link: '/admin?tab=users',
        type: 'project'
      }).catch(() => {});

      setSuccess(true);
      setTimeout(() => {
        navigate('/client-portal', { replace: true });
      }, 1500);
    } catch (err: any) {
      console.error('Account activation error:', err);
      setError(err?.message || 'Could not activate your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInvite) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-ochre mx-auto" />
          <p className="text-sm font-bold text-charcoal/60">Loading your account details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-ochre/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-charcoal/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 shadow-xl border border-charcoal/10 space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 bg-ochre/10 text-ochre rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-7 h-7" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-charcoal">
              Welcome to Pamnim Interiors
            </h1>
            <p className="text-xs sm:text-sm text-charcoal/60 mt-1.5 leading-relaxed">
              Your client portal account has been prepared by our lead design team. Please verify your details and set your password to activate your account.
            </p>
          </div>

          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-medium flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3 animate-fade-in">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <h3 className="font-bold text-base text-emerald-900">Account Activated!</h3>
              <p className="text-xs text-emerald-700">Redirecting to your client portal now...</p>
            </div>
          ) : (
            <form onSubmit={handleActivateAccount} className="space-y-4">
              {/* Name (Pre-filled, but editable in case owner mistyped) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-ochre" />
                  <span>Full Name</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-cream/20 border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:border-ochre focus:bg-white text-charcoal outline-none transition-colors"
                />
              </div>

              {/* Email (Pre-filled, but editable) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-ochre" />
                  <span>Email Address</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-cream/20 border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:border-ochre focus:bg-white text-charcoal outline-none transition-colors"
                />
              </div>

              {/* Address (Editable + Geolocation Button) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-bold uppercase tracking-wider text-charcoal/70 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-ochre" />
                    <span>Project Property Address</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={detectingLocation}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-ochre hover:text-ochre-dark transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {detectingLocation ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Detecting...</span>
                      </>
                    ) : (
                      <>
                        <MapPin className="w-3 h-3" />
                        <span>Use My Current Location</span>
                      </>
                    )}
                  </button>
                </div>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Apartment 4B, Riverside Park, Nairobi"
                  className="w-full px-4 py-2.5 bg-cream/20 border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:border-ochre focus:bg-white text-charcoal outline-none transition-colors"
                />
                {locationNotice && (
                  <p className="text-[11px] text-ochre-dark font-medium">{locationNotice}</p>
                )}
              </div>

              {/* Setting Password (Client's only required action) */}
              <div className="pt-2 border-t border-charcoal/10 space-y-3">
                <div className="bg-ochre/10 p-3 rounded-xl border border-ochre/20 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-ochre shrink-0" />
                  <span className="text-[11px] font-semibold text-charcoal">
                    Set a secure password for your portal login.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-1 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-ochre" />
                    <span>Create Password <span className="text-ochre">*</span></span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:border-ochre text-charcoal outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-1 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-ochre" />
                    <span>Confirm Password <span className="text-ochre">*</span></span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-medium focus:border-ochre text-charcoal outline-none transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-6 rounded-2xl bg-ochre hover:bg-ochre-dark text-white text-sm font-bold shadow-lg shadow-ochre/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 mt-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Activating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Activate Account & Enter Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="text-center pt-2">
            <Link to="/login" className="text-xs font-semibold text-charcoal/50 hover:text-ochre transition-colors">
              Already have an activated password? Log in here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
