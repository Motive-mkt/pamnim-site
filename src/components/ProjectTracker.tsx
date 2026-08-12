import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, updateDoc, addDoc, onSnapshot, query, orderBy, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { uploadMediaToProxy } from '../services/cloudinaryService';
import { 
  CheckCircle2, Circle, Clock, Camera, Image as ImageIcon, X, Plus, 
  AlertCircle, ChevronRight, Lock, MessageSquare, Play, Trash2, Edit3, ArrowRight, Upload
} from 'lucide-react';
import { cn } from '../lib/utils';

export const STAGES = ['Started', 'In Progress', 'Almost Done', 'Complete'] as const;
export type StageType = typeof STAGES[number];

interface ProjectTrackerProps {
  project: {
    id: string;
    name: string;
    clientId: string;
    clientName: string;
    categoryTitle?: string;
    serviceName?: string;
    selectedServices?: Array<{
      id: string;
      type: 'category' | 'service';
      title: string;
      categoryTitle?: string;
      categoryId?: string;
      slug?: string;
    }>;
    currentStageIndex: number;
    currentStageName: string;
    isFinished?: boolean;
  };
  isReadOnly?: boolean;
  onOpenChatWithTag?: (taggedContext: string) => void;
  onProjectUpdated?: () => void;
}

interface UpdateItem {
  id: string;
  stageIndex: number;
  stageName: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  note?: string;
  uploadedBy?: string;
  createdAt: string;
}

export default function ProjectTracker({ 
  project, 
  isReadOnly = false, 
  onOpenChatWithTag,
  onProjectUpdated 
}: ProjectTrackerProps) {
  const { profile, isStaff } = useAuth();
  const [updates, setUpdates] = useState<UpdateItem[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(true);

  // Stage change confirmation state
  const [pendingStageIndex, setPendingStageIndex] = useState<number | null>(null);
  const [showStageConfirmModal, setShowStageConfirmModal] = useState(false);
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);

  // Upload initiation modal state (3 options)
  const [showUploadPromptModal, setShowUploadPromptModal] = useState(false);
  const [uploadMode, setUploadMode] = useState<'camera' | 'gallery' | null>(null);

  // Upload modal state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [noteText, setNoteText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Hidden inputs for file selection
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!project?.id) return;
    setLoadingUpdates(true);

    const updatesRef = collection(db, 'projects', project.id, 'updates');
    const q = query(updatesRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UpdateItem[];
      setUpdates(list);
      setLoadingUpdates(false);
    }, (error) => {
      console.error('Error fetching project updates:', error);
      setLoadingUpdates(false);
    });

    return () => unsubscribe();
  }, [project?.id]);

  // Handle stage change request
  const requestStageChange = (targetIndex: number) => {
    if (targetIndex === project.currentStageIndex) return;
    setPendingStageIndex(targetIndex);
    setShowStageConfirmModal(true);
  };

  const confirmStageChange = async () => {
    if (pendingStageIndex === null || !project?.id) return;
    setIsUpdatingStage(true);
    try {
      const newStageName = STAGES[pendingStageIndex];
      await updateDoc(doc(db, 'projects', project.id), {
        currentStageIndex: pendingStageIndex,
        currentStageName: newStageName,
        updatedAt: new Date().toISOString()
      });
      setShowStageConfirmModal(false);
      setPendingStageIndex(null);
      if (onProjectUpdated) onProjectUpdated();
    } catch (err) {
      console.error('Error updating stage:', err);
      alert('Failed to change stage. Please try again.');
    } finally {
      setIsUpdatingStage(false);
    }
  };

  // Check complete stage rule: only 1 upload allowed at Complete stage
  const completeStageUpdates = updates.filter(u => u.stageIndex === 3 || u.stageName === 'Complete');
  const isCompleteStageLocked = project.currentStageIndex === 3 && (completeStageUpdates.length >= 1 || project.isFinished);

  // Initiate upload prompt modal
  const handleInitiateUpload = () => {
    if (isCompleteStageLocked) {
      alert('The final completion update has already been submitted for this project.');
      return;
    }
    setShowUploadPromptModal(true);
  };

  const handleSelectOption = (option: 'camera' | 'gallery' | 'later') => {
    setShowUploadPromptModal(false);
    if (option === 'later') {
      return;
    }
    setUploadMode(option);
    if (option === 'camera') {
      cameraInputRef.current?.click();
    } else if (option === 'gallery') {
      galleryInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const isVideo = file.type.startsWith('video/');
    setMediaType(isVideo ? 'video' : 'image');

    const reader = new FileReader();
    reader.onloadend = () => {
      setMediaPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const resetUploadState = () => {
    setSelectedFile(null);
    setMediaPreview(null);
    setNoteText('');
    setUploadError('');
    setUploadMode(null);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !mediaPreview || !project?.id) return;

    setIsUploading(true);
    setUploadError('');

    try {
      const uploadRes = await uploadMediaToProxy(mediaPreview, mediaType);
      if (!uploadRes.success) {
        throw new Error(uploadRes.error || 'Failed to upload media asset.');
      }

      const updatesRef = collection(db, 'projects', project.id, 'updates');
      await addDoc(updatesRef, {
        stageIndex: project.currentStageIndex,
        stageName: project.currentStageName,
        mediaUrl: uploadRes.url,
        mediaType: mediaType,
        note: noteText.trim(),
        uploadedBy: profile?.name || 'Staff',
        uploadedByUid: profile?.uid,
        createdAt: new Date().toISOString()
      });

      // If uploading at Stage 3 (Complete), mark project as finished
      if (project.currentStageIndex === 3) {
        await updateDoc(doc(db, 'projects', project.id), {
          isFinished: true,
          updatedAt: new Date().toISOString()
        });
      }

      resetUploadState();
      if (onProjectUpdated) onProjectUpdated();
    } catch (err: any) {
      console.error('Error submitting update:', err);
      setUploadError(err.message || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteUpdate = async (updateId: string) => {
    if (isReadOnly || !isStaff) return;
    if (!confirm('Are you sure you want to remove this update?')) return;
    try {
      await deleteDoc(doc(db, 'projects', project.id, 'updates', updateId));
    } catch (err) {
      console.error('Error deleting update:', err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Hidden inputs for camera capture & gallery choice */}
      <input 
        ref={cameraInputRef} 
        type="file" 
        accept="image/*,video/*" 
        capture="environment" 
        onChange={handleFileChange} 
        className="hidden" 
      />
      <input 
        ref={galleryInputRef} 
        type="file" 
        accept="image/*,video/*" 
        onChange={handleFileChange} 
        className="hidden" 
      />

      {/* Progress Header Card */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-charcoal/10 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {project.selectedServices && project.selectedServices.length > 0 ? (
                project.selectedServices.map(svc => (
                  <span 
                    key={svc.id || svc.title} 
                    className="text-xs font-bold px-3 py-1 rounded-full bg-cream border border-charcoal/15 text-charcoal flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-ochre" />
                    {svc.type === 'category' ? `📁 ${svc.title} (Whole Category)` : `🛠️ ${svc.title}`}
                  </span>
                ))
              ) : (
                <span className="text-xs font-bold text-ochre uppercase tracking-widest bg-ochre/10 px-3 py-1 rounded-full">
                  {project.serviceName || project.categoryTitle || 'Project Tracker'}
                </span>
              )}
              {project.isFinished && (
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full">
                  Completed
                </span>
              )}
            </div>
            <h3 className="text-2xl font-bold text-charcoal">{project.name}</h3>
            <p className="text-sm text-charcoal/60">
              Client: <span className="font-semibold text-charcoal">{project.clientName}</span>
            </p>
          </div>

          {!isReadOnly && isStaff && (
            <div className="flex flex-wrap items-center gap-3">
              {project.currentStageIndex < 3 && (
                <button
                  onClick={() => requestStageChange(project.currentStageIndex + 1)}
                  className="px-5 py-2.5 rounded-2xl bg-ochre text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-ochre/20 hover:bg-ochre-dark transition-all"
                >
                  Advance Stage <ChevronRight className="w-4 h-4" />
                </button>
              )}
              
              <button
                onClick={handleInitiateUpload}
                disabled={isCompleteStageLocked}
                className={`px-5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 border transition-all ${
                  isCompleteStageLocked
                    ? 'bg-charcoal/5 text-charcoal/40 border-charcoal/10 cursor-not-allowed'
                    : 'bg-cream text-charcoal border-charcoal/20 hover:border-ochre hover:bg-white'
                }`}
              >
                <Plus className="w-4 h-4 text-ochre" /> Add Stage Media / Update
              </button>
            </div>
          )}
        </div>

        {/* 4-Stage Horizontal Progress Tracker */}
        <div className="relative pt-2 pb-6">
          <div className="hidden sm:block absolute top-1/2 left-0 w-full h-1 bg-charcoal/10 -translate-y-1/2 z-0" />
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 relative z-10">
            {STAGES.map((stageName, idx) => {
              const isCurrent = idx === project.currentStageIndex;
              const isPassed = idx < project.currentStageIndex;
              const isFuture = idx > project.currentStageIndex;

              return (
                <div 
                  key={stageName}
                  className={cn(
                    "p-4 rounded-2xl border transition-all flex flex-col items-center text-center relative bg-white",
                    isCurrent && "border-ochre ring-2 ring-ochre/20 shadow-md",
                    isPassed && "border-ochre/40 bg-ochre/5",
                    isFuture && "border-charcoal/10 opacity-70"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm mb-2 transition-all",
                    isCurrent && "bg-ochre text-white shadow-md shadow-ochre/30 scale-110",
                    isPassed && "bg-ochre/20 text-ochre",
                    isFuture && "bg-cream text-charcoal/40"
                  )}>
                    {isPassed ? <CheckCircle2 className="w-5 h-5 text-ochre" /> : idx + 1}
                  </div>

                  <span className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    isCurrent ? "text-ochre" : isPassed ? "text-charcoal" : "text-charcoal/40"
                  )}>
                    {stageName}
                  </span>

                  {/* Staff override button */}
                  {!isReadOnly && isStaff && (
                    <button
                      onClick={() => requestStageChange(idx)}
                      disabled={isCurrent}
                      className={cn(
                        "mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all",
                        isCurrent 
                          ? "bg-ochre/10 text-ochre border-ochre/20 cursor-default" 
                          : "bg-cream text-charcoal/60 border-charcoal/10 hover:border-ochre hover:text-ochre"
                      )}
                    >
                      {isCurrent ? 'Current' : 'Switch To'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Upload Prompt Options Modal (Camera / Gallery / Upload Later) */}
      {showUploadPromptModal && (
        <div className="fixed inset-0 z-50 bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl relative border border-charcoal/10">
            <button 
              onClick={() => setShowUploadPromptModal(false)}
              className="absolute top-5 right-5 text-charcoal/40 hover:text-charcoal"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-charcoal mb-2">Upload Stage Media</h3>
            <p className="text-sm text-charcoal/60 mb-6">
              Current Stage: <span className="font-bold text-ochre">{project.currentStageName}</span>. Choose how you would like to attach photo or video updates.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handleSelectOption('camera')}
                className="w-full p-4 rounded-2xl border border-charcoal/15 bg-white hover:bg-cream hover:border-ochre flex items-center gap-4 text-left transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl bg-ochre/10 text-ochre flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-charcoal">Take Photo / Video</h4>
                  <p className="text-xs text-charcoal/50">Capture live using device camera</p>
                </div>
              </button>

              <button
                onClick={() => handleSelectOption('gallery')}
                className="w-full p-4 rounded-2xl border border-charcoal/15 bg-white hover:bg-cream hover:border-ochre flex items-center gap-4 text-left transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl bg-ochre/10 text-ochre flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-charcoal">Choose from Gallery</h4>
                  <p className="text-xs text-charcoal/50">Select stored file from device</p>
                </div>
              </button>

              <button
                onClick={() => handleSelectOption('later')}
                className="w-full p-4 rounded-2xl border border-charcoal/10 bg-cream hover:bg-charcoal/5 flex items-center gap-4 text-left transition-all"
              >
                <div className="w-12 h-12 rounded-2xl bg-charcoal/10 text-charcoal/60 flex items-center justify-center">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-charcoal">Upload Later</h4>
                  <p className="text-xs text-charcoal/50">Skip for now; return to add media anytime</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected File Details & Optional Note Modal */}
      {selectedFile && mediaPreview && (
        <div className="fixed inset-0 z-50 bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl relative border border-charcoal/10 my-8">
            <button 
              onClick={resetUploadState}
              className="absolute top-5 right-5 text-charcoal/40 hover:text-charcoal"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-charcoal mb-2">Submit Stage Update</h3>
            <p className="text-xs text-charcoal/60 mb-4">
              Attaching media to stage <span className="font-bold text-ochre">{project.currentStageName}</span>
            </p>

            {uploadError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-xs font-medium">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden bg-black/5 max-h-64 flex items-center justify-center border">
                {mediaType === 'video' ? (
                  <video src={mediaPreview} controls className="max-h-64 w-full object-contain" />
                ) : (
                  <img src={mediaPreview} alt="Preview" className="max-h-64 w-full object-contain" />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1">
                  Optional Text Note
                </label>
                <textarea
                  rows={3}
                  placeholder="Add a detailed note about progress, materials used, or client updates..."
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-charcoal/15 focus:border-ochre outline-none text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetUploadState}
                  className="px-5 py-2.5 rounded-xl border border-charcoal/15 text-charcoal text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-6 py-2.5 rounded-xl bg-ochre text-white text-xs font-bold shadow-md hover:bg-ochre-dark transition-all disabled:opacity-50"
                >
                  {isUploading ? 'Uploading...' : 'Submit Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stage Confirmation Prompt Modal */}
      {showStageConfirmModal && pendingStageIndex !== null && (
        <div className="fixed inset-0 z-50 bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl relative border border-charcoal/10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-bold text-charcoal mb-2">Confirm Stage Change</h3>
            <p className="text-sm text-charcoal/70 mb-6">
              Are you sure you want to move this project to <span className="font-bold text-ochre">"{STAGES[pendingStageIndex]}"</span>?
            </p>

            <div className="flex justify-center gap-3">
              <button
                onClick={() => {
                  setShowStageConfirmModal(false);
                  setPendingStageIndex(null);
                }}
                className="px-6 py-2.5 rounded-2xl border border-charcoal/15 text-charcoal font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={confirmStageChange}
                disabled={isUpdatingStage}
                className="px-6 py-2.5 rounded-2xl bg-ochre text-white font-bold text-xs shadow-md shadow-ochre/20 hover:bg-ochre-dark transition-all"
              >
                {isUpdatingStage ? 'Updating...' : 'Yes, Change Stage'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage Media & Updates Section */}
      <div className="space-y-6">
        <h4 className="text-sm font-bold text-charcoal/40 uppercase tracking-widest px-1">
          Stage Uploads & Activity History
        </h4>

        {loadingUpdates ? (
          <div className="p-8 text-center text-charcoal/40 animate-pulse bg-white rounded-3xl border">
            Loading stage updates...
          </div>
        ) : updates.length === 0 ? (
          <div className="p-8 text-center text-charcoal/40 bg-white rounded-3xl border border-charcoal/10">
            No media or notes uploaded for this project yet.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {updates.map(item => (
              <div 
                key={item.id}
                className="bg-white rounded-3xl border border-charcoal/10 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col"
              >
                {/* Media Container */}
                <div className="relative aspect-video bg-charcoal/5 flex items-center justify-center overflow-hidden">
                  {item.mediaType === 'video' ? (
                    <video src={item.mediaUrl} controls className="w-full h-full object-cover" />
                  ) : (
                    <img src={item.mediaUrl} alt={item.note || 'Stage update'} className="w-full h-full object-cover" />
                  )}

                  <span className="absolute top-3 left-3 bg-black/60 text-white text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-sm">
                    {item.stageName}
                  </span>

                  {!isReadOnly && isStaff && (
                    <button
                      onClick={() => handleDeleteUpdate(item.id)}
                      className="absolute top-3 right-3 bg-white/80 hover:bg-red-600 hover:text-white text-charcoal/70 p-1.5 rounded-full transition-colors"
                      title="Delete Update"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Info Container */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    {item.note ? (
                      <p className="text-sm text-charcoal font-medium mb-3">{item.note}</p>
                    ) : (
                      <p className="text-xs text-charcoal/40 italic mb-3">No note attached</p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-charcoal/5 flex items-center justify-between text-xs text-charcoal/50">
                    <span>By {item.uploadedBy || 'Staff'}</span>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>

                  {/* Comment on stage button (for Client & Staff) */}
                  {onOpenChatWithTag && (
                    <button
                      onClick={() => onOpenChatWithTag(`📌 Project: ${project.name} | Stage: ${item.stageName}${item.note ? ` ("${item.note}")` : ''}`)}
                      className="mt-3 w-full py-2 px-3 rounded-xl bg-ochre/10 text-ochre hover:bg-ochre hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-2"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Comment in Chat
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
