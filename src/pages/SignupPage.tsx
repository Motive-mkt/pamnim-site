import React, { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { Sparkle, Mail, Lock, User, Phone, MessageSquare, CheckCircle2, ArrowLeft } from 'lucide-react';

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');

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
    if (!whatsapp.trim()) {
      setError('Please enter your WhatsApp number.');
      setLoading(false);
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    try {
      // Create account in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: name.trim() });

      const requestData = {
        uid: user.uid,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || whatsapp.trim(),
        whatsapp: whatsapp.trim(),
        role: 'pending',
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      // Save pending profile document
      await setDoc(doc(db, 'profiles', user.uid), requestData);

      // Save to pending_signups collection for easy admin querying
      await setDoc(doc(db, 'pending_signups', user.uid), requestData);

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
    <div className="min-h-screen bg-cream flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Subtle Background Elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-ochre/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-charcoal/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-sm font-semibold text-charcoal/60 hover:text-ochre mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Pamnim Interiors
        </Link>

        <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 shadow-xl border border-charcoal/10">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-ochre/10 text-ochre rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkle className="w-7 h-7" />
            </div>
            <h1 className="text-3xl font-bold text-charcoal">Request Account Access</h1>
            <p className="text-sm text-charcoal/60 mt-2">
              Submit your registration details to request access to Pamnim Interiors.
            </p>
          </div>

          {submittedSuccess ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-charcoal">Your request has been sent.</h2>
              <p className="text-sm text-charcoal/70 leading-relaxed">
                An administrator will review your details and send your approved access link via WhatsApp.
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

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-5 h-5 text-charcoal/40 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jane Doe"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-charcoal/15 focus:border-ochre outline-none text-sm bg-cream/30 font-medium"
                  />
                </div>
              </div>

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

              {/* Phone */}
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

              {/* WhatsApp Number (Required) */}
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
                className="w-full py-4 rounded-2xl bg-ochre text-white font-bold text-sm shadow-xl shadow-ochre/20 hover:bg-ochre-dark transition-all disabled:opacity-50 mt-4"
              >
                {loading ? 'Submitting Request...' : 'Submit Request'}
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
