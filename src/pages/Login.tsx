import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkle, Mail, Lock, ArrowRight, ArrowLeft } from 'lucide-react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = result.user;

      // Ensure profile doc exists, fallback to creating pending or first owner if missing
      const profilePath = `profiles/${user.uid}`;
      const docRef = doc(db, 'profiles', user.uid);

      let docSnap: any;
      try {
        docSnap = await getDoc(docRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, profilePath);
      }

      if (!docSnap || !docSnap.exists()) {
        try {
          const ownerQuery = query(collection(db, 'profiles'), where('role', '==', 'owner'));
          const ownerSnap = await getDocs(ownerQuery);
          const isFirstOwner = ownerSnap.empty;

          const newProfileData = {
            uid: user.uid,
            email: user.email?.trim().toLowerCase() || email.trim().toLowerCase(),
            name: user.displayName || (isFirstOwner ? 'Owner' : 'User'),
            role: isFirstOwner ? 'owner' : 'pending',
            status: isFirstOwner ? 'active' : 'pending',
            createdAt: new Date().toISOString()
          };
          await setDoc(docRef, newProfileData);
          if (!isFirstOwner) {
            try {
              await setDoc(doc(db, 'pending_signups', user.uid), newProfileData);
            } catch (e) {
              // ignore
            }
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, profilePath);
        }
      }
      
      // Determine navigation based on profile role in Firestore
      let userRole = 'client';
      try {
        const userProfileSnap = await getDoc(docRef);
        if (userProfileSnap.exists()) {
          userRole = userProfileSnap.data().role;
        }
      } catch (e) {
        console.warn("Could not check user role for navigation:", e);
      }
      
      if (userRole === 'owner') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      console.error(err);
      let errorMessage = err.message;
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error) errorMessage = parsed.error;
      } catch (e) {
        // Not a JSON error
      }

      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid email or password.';
      }
      if (err.code === 'auth/email-already-in-use') errorMessage = 'This email is already registered.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage('Password reset email sent! Please check your inbox.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8">
        <Link to="/" className="flex flex-col items-center text-center mb-8 group cursor-pointer">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkle className="w-8 h-8 text-ochre transition-transform group-hover:rotate-12" />
            <span className="font-serif text-3xl font-bold tracking-tight text-charcoal">Pamnim Interiors</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {isForgotPassword ? 'Reset Password' : 'Welcome Back'}
          </h1>
          <p className="text-charcoal/60">
            {isForgotPassword ? 'Enter your email to receive a reset link' : 'Access your personalized design portal'}
          </p>
        </Link>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm border border-red-100 italic">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-green-50 text-green-600 p-4 rounded-xl mb-6 text-sm border border-green-100 italic">
            {message}
          </div>
        )}

        {isForgotPassword ? (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-charcoal/30" />
              <input
                type="email"
                placeholder="Email Address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-cream/30 border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-charcoal hover:bg-black text-white py-4 rounded-xl font-bold transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <button 
              type="button"
              onClick={() => {
                setIsForgotPassword(false);
                setError(null);
                setMessage(null);
              }}
              className="w-full flex items-center justify-center gap-2 text-sm text-charcoal/60 hover:text-charcoal font-medium transition-colors p-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </button>
          </form>
        ) : (
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-charcoal/30" />
              <input
                type="email"
                placeholder="Email Address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-cream/30 border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre transition-all"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-charcoal/30" />
              <input
                type="password"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-cream/30 border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre transition-all"
              />
            </div>

            <div className="flex justify-end">
              <button 
                type="button" 
                onClick={() => {
                  setIsForgotPassword(true);
                  setError(null);
                  setMessage(null);
                }}
                className="text-xs text-ochre font-medium hover:underline"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-charcoal hover:bg-black text-white py-4 rounded-xl font-bold transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 group"
            >
              {loading ? 'Processing...' : 'Sign In'}
              {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>
        )}

        <div className="mt-8 pt-8 border-t border-charcoal/5 text-center">
          <p className="text-sm text-charcoal/60">
            New to Pamnim Interiors?{' '}
            <Link 
              to="/signup"
              className="ml-1 text-ochre font-bold hover:underline"
            >
              Request Access
            </Link>
          </p>
        </div>
        
        <p className="mt-8 text-[10px] text-charcoal/40 text-center leading-relaxed">
          By signing in, you agree to our Terms of Service and Privacy Policy.
          Secure access managed by Pamnim Interiors.
        </p>
      </div>
    </div>
  );
}
