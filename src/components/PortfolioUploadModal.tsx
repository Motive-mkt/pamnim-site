import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  X, Plus, Film, AlertCircle, CheckCircle2, Loader2, Image as ImageIcon 
} from 'lucide-react';
import { checkPortfolioDuplicates } from '../services/portfolioDuplicateService';

interface PortfolioUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PortfolioUploadModal({ isOpen, onClose, onSuccess }: PortfolioUploadModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, { status: 'pending' | 'uploading' | 'completed' | 'failed'; progress: number; error?: string }>>({});

  if (!isOpen) return null;

  const isImageFile = (f: File) => f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|avif|heic)$/i.test(f.name);
  const isVideoFile = (f: File) => f.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(f.name);

  const handleFilesSelected = async (incomingFiles: File[]) => {
    const validFiles = incomingFiles.filter(f => isImageFile(f) || isVideoFile(f));
    if (validFiles.length === 0) return;

    // PART 2: Duplicate Upload Detection (Portfolio Only)
    const dupCheck = await checkPortfolioDuplicates(validFiles);
    if (dupCheck.hasDuplicate) {
      setUploadError(dupCheck.message || 'This file has already been uploaded to the Portfolio.');
      const nonDuplicates = validFiles.filter(f => !dupCheck.duplicateFiles.includes(f.name));
      if (nonDuplicates.length > 0) {
        setSelectedFiles(prev => [...prev, ...nonDuplicates]);
      }
      return;
    }

    setUploadError(null);
    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setUploadError("Please select or drop at least one image or video to upload.");
      return;
    }

    // Secondary duplicate verification before initiating network transfer
    const dupCheck = await checkPortfolioDuplicates(selectedFiles);
    if (dupCheck.hasDuplicate) {
      setUploadError(dupCheck.message || 'Duplicate file detected: This file has already been uploaded to the Portfolio.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const initialProgress: typeof uploadProgress = {};
    selectedFiles.forEach(f => {
      initialProgress[f.name] = { status: 'pending', progress: 0 };
    });
    setUploadProgress(initialProgress);

    let cloudName = ((import.meta as any).env?.VITE_CLOUDINARY_CLOUD_NAME as string);
    let preset = ((import.meta as any).env?.VITE_CLOUDINARY_UPLOAD_PRESET as string);

    try {
      const configRes = await fetch('/api/config/cloudinary');
      if (configRes.ok) {
        const configData = await configRes.json();
        if (configData.cloudName && configData.cloudName !== 'undefined') {
          cloudName = configData.cloudName;
        }
        if (configData.uploadPreset && configData.uploadPreset !== 'undefined') {
          preset = configData.uploadPreset;
        }
      }
    } catch {
      // ignore
    }

    if (!cloudName || cloudName === 'undefined') cloudName = 'djwrpottl';
    if (!preset || preset === 'undefined') preset = 'pamnim_preset';

    let errorCount = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const isVideo = isVideoFile(file);

      setUploadProgress(prev => ({
        ...prev,
        [file.name]: { status: 'uploading', progress: 20 }
      }));

      let secureUrl = "";

      // 1. Direct Cloudinary upload attempt
      try {
        if (!preset || preset === "undefined" || (cloudName && cloudName !== "djwrpottl" && preset === "pamnim_preset")) {
          throw new Error("Use backend upload");
        }

        secureUrl = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/${isVideo ? 'video' : 'image'}/upload`);

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const pct = 15 + Math.round((event.loaded / event.total) * 75);
              setUploadProgress(prev => ({
                ...prev,
                [file.name]: { status: 'uploading', progress: pct }
              }));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const resData = JSON.parse(xhr.responseText);
                resolve(resData.secure_url || resData.url);
              } catch {
                reject(new Error("Malformed response"));
              }
            } else {
              reject(new Error(`Status ${xhr.status}`));
            }
          };

          xhr.onerror = () => reject(new Error("Network error"));

          const formData = new FormData();
          formData.append('file', file);
          formData.append('upload_preset', preset);
          xhr.send(formData);
        });
      } catch {
        // Fallback to Base64 proxy
        try {
          const base64Data = await new Promise<string>((res, rej) => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result as string);
            reader.onerror = rej;
            reader.readAsDataURL(file);
          });

          setUploadProgress(prev => ({
            ...prev,
            [file.name]: { status: 'uploading', progress: 60 }
          }));

          const response = await fetch('/api/media/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file: base64Data,
              type: isVideo ? 'video' : 'image',
              uploadPreset: preset
            })
          });

          if (!response.ok) throw new Error("Upload proxy error");
          const resData = await response.json();
          secureUrl = resData.url;
        } catch (err: any) {
          console.error(`Failed to upload ${file.name}:`, err);
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: { status: 'failed', progress: 0, error: err.message || 'Upload failed' }
          }));
          errorCount++;
          continue;
        }
      }

      if (secureUrl.includes('cloudinary.com') && !secureUrl.includes('/q_auto')) {
        const assetSection = isVideo ? '/video/upload/' : '/image/upload/';
        if (secureUrl.includes(assetSection)) {
          secureUrl = secureUrl.replace(assetSection, `${assetSection}q_auto:best,f_auto/`);
        }
      }

      // Record to Firestore portfolio_assets collection
      try {
        await addDoc(collection(db, 'portfolio_assets'), {
          title: '', // No titles or captions as requested in Part 1
          category: 'Portfolio',
          image: secureUrl,
          fileName: file.name,
          originalFilename: file.name,
          type: isVideo ? 'video' : 'image',
          createdAt: new Date().toISOString()
        });

        setUploadProgress(prev => ({
          ...prev,
          [file.name]: { status: 'completed', progress: 100 }
        }));
      } catch (dbErr: any) {
        console.error(`Failed to record portfolio document:`, dbErr);
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: { status: 'failed', progress: 0, error: dbErr.message || 'Database save error' }
        }));
        errorCount++;
      }
    }

    if (errorCount === 0) {
      setUploadSuccess(`Successfully uploaded ${selectedFiles.length} item(s) to the Portfolio!`);
      setSelectedFiles([]);
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress({});
        if (onSuccess) onSuccess();
        onClose();
      }, 1200);
    } else {
      setIsUploading(false);
      setUploadError(`Completed with ${errorCount} error(s). Please review failed files.`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-charcoal/50 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-xl p-6 sm:p-10 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button 
          onClick={() => {
            if (!isUploading) {
              onClose();
              setSelectedFiles([]);
              setUploadError(null);
            }
          }}
          disabled={isUploading}
          className="absolute top-6 right-6 p-2 rounded-full text-charcoal/60 hover:text-charcoal hover:bg-cream transition-colors cursor-pointer"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="mb-6">
          <span className="text-[11px] font-bold uppercase tracking-widest text-ochre block mb-1">PORTFOLIO ASSETS</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-charcoal">Upload to Portfolio</h2>
          <p className="text-xs text-charcoal/60 mt-1 font-medium">
            Upload photographs or cinematic walkthrough videos. Displays raw media with duplicate upload detection.
          </p>
        </div>

        {uploadError && (
          <div className="mb-5 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex items-start gap-2.5 animate-shake">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="block text-red-800 font-bold mb-0.5">Duplicate File Blocked</strong>
              <span>{uploadError}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setUploadError(null)}
              className="text-red-400 hover:text-red-700 ml-2"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {uploadSuccess && (
          <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold">{uploadSuccess}</span>
          </div>
        )}

        <form onSubmit={handleUploadSubmit} className="space-y-5">
          {/* Drag & Drop Area */}
          <div 
            onDragOver={(e) => { 
              e.preventDefault(); 
              if (!isUploading) setDragActive(true);
            }}
            onDragEnter={(e) => { 
              e.preventDefault(); 
              if (!isUploading) setDragActive(true);
            }}
            onDragLeave={(e) => { 
              e.preventDefault(); 
              setDragActive(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (isUploading) return;
              if (e.dataTransfer.files) {
                handleFilesSelected(Array.from(e.dataTransfer.files));
              }
            }}
            onClick={() => {
              if (!isUploading) {
                document.getElementById('portfolio-file-picker')?.click();
              }
            }}
            className={`border-2 border-dashed rounded-3xl p-6 sm:p-10 text-center transition-all cursor-pointer relative ${
              dragActive 
                ? 'border-ochre bg-ochre/5 scale-[1.01] shadow-lg ring-4 ring-ochre/15' 
                : 'border-charcoal/15 hover:border-ochre/50 bg-cream/20 hover:bg-cream/40'
            }`}
          >
            <input 
              id="portfolio-file-picker"
              type="file" 
              multiple 
              accept="image/*,video/*"
              className="hidden" 
              onChange={(e) => {
                if (e.target.files) {
                  handleFilesSelected(Array.from(e.target.files));
                  e.target.value = '';
                }
              }}
              disabled={isUploading}
            />
            <div className="flex flex-col items-center gap-2 select-none">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-2 transition-all duration-300 ${
                dragActive ? 'bg-ochre text-white scale-110 animate-pulse' : 'bg-ochre/10 text-ochre'
              }`}>
                <Plus className="w-7 h-7" />
              </div>
              <h4 className="font-bold text-sm text-charcoal">
                {dragActive ? "Drop files now!" : "Drag & drop photos or videos, or click to browse"}
              </h4>
              <p className="text-[11px] text-charcoal/65">
                Supports JPG, PNG, WEBP and MP4 cinematic walks
              </p>
            </div>
          </div>

          {/* Queued files */}
          {selectedFiles.length > 0 && (
            <div className="bg-cream/40 border border-charcoal/5 rounded-2xl p-4 max-h-[180px] overflow-y-auto space-y-2.5">
              <div className="flex justify-between items-center text-[11px] font-bold text-charcoal/65 uppercase tracking-wider pb-1 border-b border-charcoal/5">
                <span>Selected Files ({selectedFiles.length})</span>
                {!isUploading && (
                  <button 
                    type="button" 
                    onClick={() => setSelectedFiles([])}
                    className="text-red-500 hover:text-red-700 cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {selectedFiles.map((file, idx) => {
                const isVid = file.type.startsWith('video/') || /\.(mp4|mov)$/i.test(file.name);
                const prog = uploadProgress[file.name] || { status: 'pending', progress: 0 };
                const sizeMb = (file.size / (1024 * 1024)).toFixed(1);

                return (
                  <div key={idx} className="flex items-center justify-between text-xs bg-white p-3 rounded-xl border border-charcoal/5 shadow-2xs">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {isVid ? <Film className="w-4 h-4 text-ochre shrink-0" /> : <ImageIcon className="w-4 h-4 text-zinc-400 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-charcoal truncate">{file.name}</p>
                        <span className="text-[11px] text-charcoal/60 font-semibold">{sizeMb} MB</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {prog.status === 'uploading' && (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 text-ochre animate-spin" />
                          <span className="text-[11px] font-bold text-ochre">{prog.progress}%</span>
                        </div>
                      )}
                      {prog.status === 'completed' && (
                        <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Uploaded</span>
                      )}
                      {prog.status === 'failed' && (
                        <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">Failed</span>
                      )}
                      {prog.status === 'pending' && !isUploading && (
                        <button 
                          type="button" 
                          onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                          className="text-charcoal/60 hover:text-red-500 font-bold cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="submit"
            disabled={isUploading || selectedFiles.length === 0}
            className="w-full bg-ochre hover:bg-ochre-dark text-white font-bold py-4 rounded-2xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading to Portfolio...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Upload {selectedFiles.length > 0 ? `(${selectedFiles.length}) Items` : 'to Portfolio'}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
