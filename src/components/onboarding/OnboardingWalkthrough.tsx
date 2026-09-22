import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { 
  TOURS_CONFIG, RoleTourConfig, TourStep 
} from './tourConfig';
import { 
  Sparkles, CheckCircle2, ArrowRight, ArrowLeft, X, 
  HelpCircle, Compass, Layers, Check, Play, ShieldCheck 
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface OnboardingWalkthroughProps {
  role?: 'client' | 'worker' | 'employee' | 'elevated_employee';
  forceOpen?: boolean;
  onClose?: () => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function OnboardingWalkthrough({
  role = 'client',
  forceOpen = false,
  onClose,
  onNavigateTab
}: OnboardingWalkthroughProps) {
  const { profile } = useAuth();
  const normalizedRole = role === 'elevated_employee' ? 'employee' : role;
  const tourConfig: RoleTourConfig = TOURS_CONFIG[normalizedRole] || TOURS_CONFIG.client;

  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [personalizationAnswer, setPersonalizationAnswer] = useState<string>('');
  const [demoActionCompleted, setDemoActionCompleted] = useState(false);

  // Check if user has already completed tour
  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      setCurrentStepIndex(0);
      setDemoActionCompleted(false);
      return;
    }

    if (!profile?.uid) return;

    const storageKey = `pamnim_tour_completed_${profile.uid}_${normalizedRole}`;
    const localCompleted = localStorage.getItem(storageKey);
    const profileCompleted = (profile as any)?.onboardingCompleted === true;

    if (!localCompleted && !profileCompleted) {
      // First time user! Trigger tour automatically
      const timer = setTimeout(() => {
        setIsOpen(true);
        setCurrentStepIndex(0);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [profile?.uid, forceOpen, normalizedRole, (profile as any)?.onboardingCompleted]);

  // Mark completion
  const handleCompleteTour = async () => {
    setIsOpen(false);
    if (onClose) onClose();

    if (!profile?.uid) return;
    const storageKey = `pamnim_tour_completed_${profile.uid}_${normalizedRole}`;
    localStorage.setItem(storageKey, 'true');

    try {
      await updateDoc(doc(db, 'profiles', profile.uid), {
        onboardingCompleted: true,
        lastTourCompletedAt: new Date().toISOString(),
        ...(personalizationAnswer ? { onboardingPreference: personalizationAnswer } : {})
      });
    } catch (err) {
      console.warn('Could not update onboarding profile status in Firestore:', err);
    }
  };

  const handleSkipTour = () => {
    handleCompleteTour();
  };

  const currentStep: TourStep | undefined = tourConfig.steps[currentStepIndex];

  // When step changes, optionally highlight/switch the tab in caller UI
  useEffect(() => {
    if (currentStep?.highlightTab && onNavigateTab) {
      onNavigateTab(currentStep.highlightTab);
    }
  }, [currentStepIndex, currentStep?.highlightTab, onNavigateTab]);

  const handleNext = () => {
    if (currentStepIndex < tourConfig.steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
      setDemoActionCompleted(false);
    } else {
      handleCompleteTour();
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
      setDemoActionCompleted(false);
    }
  };

  if (!isOpen || !currentStep) {
    return null;
  }

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === tourConfig.steps.length - 1;
  const progressPercent = Math.round(((currentStepIndex + 1) / tourConfig.steps.length) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-sm animate-fade-in">
      <div 
        className={cn(
          "w-full max-w-xl bg-white rounded-3xl sm:rounded-[2.5rem] border border-charcoal/10 shadow-2xl overflow-hidden transition-all duration-300 relative flex flex-col max-h-[90vh]"
        )}
      >
        {/* Top Header with Progress Bar */}
        <div className="p-6 sm:p-7 border-b border-charcoal/10 bg-cream/40 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-ochre/15 text-ochre flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-ochre">
                  {currentStep.badge || tourConfig.roleLabel}
                </span>
                <span className="text-[10px] text-charcoal/40 font-mono">
                  • Step {currentStepIndex + 1} of {tourConfig.steps.length}
                </span>
              </div>
              <h3 className="text-lg font-bold text-charcoal leading-tight">
                {currentStep.title}
              </h3>
            </div>
          </div>

          {/* Visible Skip button on every step */}
          <button
            onClick={handleSkipTour}
            className="text-xs font-bold text-charcoal/50 hover:text-charcoal px-3 py-1.5 rounded-xl hover:bg-charcoal/5 transition-colors cursor-pointer shrink-0"
          >
            Skip Tour
          </button>
        </div>

        {/* Progress bar line */}
        <div className="w-full h-1 bg-charcoal/5">
          <div 
            className="h-full bg-ochre transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
          <p className="text-sm text-charcoal/70 leading-relaxed">
            {currentStep.description}
          </p>

          {/* Optional Personalization on Step 0 */}
          {currentStep.type === 'welcome' && tourConfig.personalizationQuestions && (
            <div className="space-y-3 pt-2">
              {tourConfig.personalizationQuestions.map(pq => (
                <div key={pq.id} className="p-4 rounded-2xl bg-cream/50 border border-charcoal/5 space-y-2.5">
                  <label className="block text-xs font-bold text-charcoal">
                    {pq.question}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {pq.options.map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setPersonalizationAnswer(opt)}
                        className={cn(
                          "px-3.5 py-2.5 rounded-xl text-xs font-semibold text-left transition-all border",
                          personalizationAnswer === opt
                            ? "bg-ochre text-white border-ochre shadow-sm"
                            : "bg-white text-charcoal/80 border-charcoal/10 hover:border-ochre/40"
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Hotspot Visual Explainer */}
          {currentStep.type === 'hotspot' && (
            <div className="p-5 rounded-2xl bg-cream/40 border border-charcoal/10 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-ochre uppercase tracking-wider">
                <Compass className="w-4 h-4" />
                <span>Feature Spotlight</span>
              </div>
              <p className="text-xs text-charcoal/60 leading-relaxed">
                Clicking on the highlighted section from your navigation gives you full control. All updates are synced live across mobile and desktop.
              </p>
            </div>
          )}

          {/* Action-Driven Interactive Demo Step */}
          {currentStep.type === 'interactive_demo' && currentStep.demoData && (
            <div className="p-5 sm:p-6 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-200/60 px-2.5 py-1 rounded-full">
                  Sample Sandbox Data
                </span>
                <span className="text-[11px] text-amber-800/70 font-medium">Safe to test</span>
              </div>

              <div>
                <h4 className="font-bold text-sm text-charcoal">{currentStep.demoData.sampleTitle}</h4>
                <p className="text-xs text-charcoal/60 mt-0.5">{currentStep.demoData.sampleDescription}</p>
              </div>

              {/* Sample detail pills */}
              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                {Object.entries(currentStep.demoData.sampleDetails).map(([key, val]) => (
                  <div key={key} className="bg-white/90 p-2.5 rounded-xl border border-amber-100">
                    <span className="text-[10px] text-charcoal/40 font-bold block uppercase">{key}</span>
                    <span className="font-semibold text-charcoal">{val}</span>
                  </div>
                ))}
              </div>

              {/* Action Button */}
              {demoActionCompleted ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 animate-fade-in">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Action Simulated Successfully!</span>
                  </div>
                  <p className="text-[11px] text-emerald-700/80">
                    {currentStep.demoData.successMessage}
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setDemoActionCompleted(true)}
                  className="w-full py-3 px-4 rounded-xl bg-charcoal hover:bg-ochre text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{currentStep.demoData.actionLabel}</span>
                </button>
              )}
            </div>
          )}

          {/* Completion Celebration Card */}
          {currentStep.type === 'completion' && (
            <div className="p-6 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center font-bold">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <h4 className="font-bold text-base text-emerald-950">You are ready to get started!</h4>
              <p className="text-xs text-emerald-800/80 max-w-sm mx-auto">
                Feel free to revisit this walkthrough anytime by clicking the Help Guide icon in the navigation bar.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 sm:p-7 border-t border-charcoal/10 bg-cream/30 flex items-center justify-between gap-3">
          {!isFirstStep ? (
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2.5 rounded-xl border border-charcoal/20 text-xs font-bold text-charcoal hover:bg-white transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 rounded-xl bg-ochre text-white hover:bg-ochre-dark text-xs font-bold transition-all flex items-center gap-2 shadow-md shadow-ochre/20 cursor-pointer"
            >
              <span>{isLastStep ? 'Get Started' : 'Next Step'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
