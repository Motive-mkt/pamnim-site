import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Sparkle, Mail, Lock, User, ArrowRight, ArrowLeft } from 'lucide-react';

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

export default function Login({ isSignUpDefault = false }: { isSignUpDefault?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(isSignUpDefault);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    
    try {
      let user;
      if (isSignUp) {
        if (!name) throw new Error('Please enter your name');
        const result = await createUserWithEmailAndPassword(auth, email, password);
        user = result.user;
        await updateProfile(user, { displayName: name });
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        user = result.user;
      }

      const profilePath = `profiles/${user.uid}`;
      const docRef = doc(db, 'profiles', user.uid);
      let docSnap;
      try {
        docSnap = await getDoc(docRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, profilePath);
      }

      if (!docSnap || !docSnap.exists()) {
        const metadataPath = 'siteContent/metadata';
        let isFirstUser = false;
        try {
          isFirstUser = (await getDoc(doc(db, 'siteContent', 'metadata'))).exists() === false;
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, metadataPath);
        }

        const role = isFirstUser ? 'owner' : 'client';
        
        try {
          await setDoc(docRef, {
            uid: user.uid,
            email: user.email,
            name: name || user.displayName || 'Client',
            role: role,
            createdAt: new Date().toISOString()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, profilePath);
        }
        
        if (isFirstUser) {
          try {
            await setDoc(doc(db, 'siteContent', 'metadata'), { initialized: true });
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, metadataPath);
          }
        }
      }
      
      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      let errorMessage = err.message;
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error) errorMessage = parsed.error;
      } catch (e) {
        // Not a JSON error
      }

      if (err.code === 'auth/user-not-found') errorMessage = 'No account found with this email.';
      if (err.code === 'auth/wrong-password') errorMessage = 'Incorrect password.';
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
      await sendPasswordResetEmail(auth, email);
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
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkle className="w-8 h-8 text-ochre" />
            <span className="font-serif text-3xl font-bold tracking-tight text-charcoal">Pamnim Interiors</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {isForgotPassword ? 'Reset Password' : (isSignUp ? 'Create Account' : 'Welcome Back')}
          </h1>
          <p className="text-charcoal/60">
            {isForgotPassword ? 'Enter your email to receive a reset link' : 'Access your personalized design portal'}
          </p>
        </div>
        
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
            {isSignUp && (
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-charcoal/30" />
                <input
                  type="text"
                  placeholder="Full Name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-cream/30 border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre transition-all"
                />
              </div>
            )}
            
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

            {!isSignUp && (
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
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-charcoal hover:bg-black text-white py-4 rounded-xl font-bold transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 group"
            >
              {loading ? 'Processing...' : (isSignUp ? 'Register Account' : 'Sign In')}
              {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>
        )}

        <div className="mt-8 pt-8 border-t border-charcoal/5 text-center">
          <p className="text-sm text-charcoal/60">
            {isSignUp ? (
              <>
                Already have an account?
                <button 
                  onClick={() => {
                    setIsSignUp(false);
                    setIsForgotPassword(false);
                    setError(null);
                    setMessage(null);
                  }}
                  className="ml-2 text-ochre font-bold hover:underline"
                >
                  Sign In
                </button>
              </>
            ) : null}
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
