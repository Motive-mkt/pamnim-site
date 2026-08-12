import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { collection, query, getDocs, doc, setDoc, addDoc, updateDoc, deleteDoc, getDoc, orderBy, where } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { cn } from '../../lib/utils';
import { 
  Plus, Users, Briefcase, Edit2, Trash2, CheckCircle2, Clock, Globe, UserPlus, Mail,
  Home, Palette, LayoutGrid, PaintBucket, RefreshCcw, MessageSquare, HelpCircle, Film, Sparkles,
  Image as ImageIcon, Copy, Check
} from 'lucide-react';
import { useCMS } from '../../hooks/useCMS';
import { refineDraftCopy } from '../../services/geminiService';
import { serviceCategories } from '../../data/servicesData';
import ProjectTracker from '../../components/ProjectTracker';
import ProjectChat from '../../components/ProjectChat';
import StartProjectModal from '../../components/StartProjectModal';
import UserManagementView from '../../components/UserManagementView';

const iconMap: Record<string, any> = {
  Home,
  Palette,
  LayoutGrid,
  PaintBucket,
  RefreshCcw,
  MessageSquare,
  HelpCircle
};

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

export default function OwnerDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'services' | 'staff' | 'content' | 'media' | 'inquiries' | 'detailed-services' | 'chat'>('overview');
  const [projects, setProjects] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [selectedChatClient, setSelectedChatClient] = useState<any | null>(null);
  const [showStartProjectModal, setShowStartProjectModal] = useState(false);
  const [chatTaggedContext, setChatTaggedContext] = useState<string | undefined>();
  const [copiedSignupOverview, setCopiedSignupOverview] = useState(false);

  const handleCopySignupLink = () => {
    const signupUrl = `${window.location.origin}/signup`;
    navigator.clipboard.writeText(signupUrl);
    setCopiedSignupOverview(true);
    setTimeout(() => setCopiedSignupOverview(false), 3000);
  };
  const [gallery, setGallery] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { content } = useCMS();

  // Sub-services state
  const [detailedServices, setDetailedServices] = useState<any[]>([]);
  const [selectedSubService, setSelectedSubService] = useState<any | null>(null);
  const [isSavingSubService, setIsSavingSubService] = useState(false);
  const [subServiceForm, setSubServiceForm] = useState({
    name: '',
    desc: '',
    heroImage: '',
    images: ['', '', '']
  });

  // Services state
  const [cmsServices, setCmsServices] = useState<any[]>([]);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState({
    title: '',
    description: '',
    iconName: 'Home'
  });

  // Media state
  const [mediaType, setMediaType] = useState<'gallery' | 'portfolio_assets'>('gallery');
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [newMedia, setNewMedia] = useState({ title: '', category: '', image: '' });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [useManualUrl, setUseManualUrl] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, { status: 'pending' | 'uploading' | 'completed' | 'failed'; progress: number; error?: string }>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Create Project Modal State
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    clientId: '',
    employeeIds: [] as string[]
  });
  const [newStaff, setNewStaff] = useState({
    name: '',
    email: '',
    role: 'designer'
  });

  // CMS Edit State
  const [cmsHero, setCmsHero] = useState(content.hero);
  const [cmsContact, setCmsContact] = useState(content.contact);
  const [cmsLuxuryCategories, setCmsLuxuryCategories] = useState<any[]>([]);

  // Gemini Copywriter Assistant State
  const [refinement, setRefinement] = useState<{
    field: string | null;
    originalText: string;
    refinedText: string;
    loading: boolean;
    error: string | null;
  }>({
    field: null,
    originalText: '',
    refinedText: '',
    loading: false,
    error: null,
  });

  const handleRefineText = async (fieldName: string, text: string, contextDescription: string) => {
    if (!text || !text.trim()) {
      alert("Provide some draft text first to run AI Lookbook revision.");
      return;
    }
    setRefinement({
      field: fieldName,
      originalText: text,
      refinedText: '',
      loading: true,
      error: null,
    });

    try {
      const res = await refineDraftCopy(text, contextDescription);
      if (res.success) {
        setRefinement(prev => ({
          ...prev,
          refinedText: res.text,
          loading: false,
        }));
      } else {
        setRefinement(prev => ({
          ...prev,
          loading: false,
          error: res.error || 'Failed to refine copy',
        }));
      }
    } catch (err: any) {
      setRefinement(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Error executing AI refinement',
      }));
    }
  };

  const handleApplyRefinement = () => {
    if (!refinement.field || !refinement.refinedText) return;

    if (refinement.field === 'heroTitle') {
      setCmsHero(prev => ({ ...prev, title: refinement.refinedText }));
    } else if (refinement.field === 'heroSub') {
      setCmsHero(prev => ({ ...prev, subheadline: refinement.refinedText }));
    } else if (refinement.field === 'serviceDesc') {
      setServiceForm(prev => ({ ...prev, description: refinement.refinedText }));
    }

    setRefinement({
      field: null,
      originalText: '',
      refinedText: '',
      loading: false,
      error: null,
    });
  };

  const [stats, setStats] = useState({
    activeProjects: 0,
    totalClients: 0
  });

  useEffect(() => {
    fetchData();
    fetchMedia();
  }, []);

  useEffect(() => {
    setCmsHero(content.hero);
    setCmsContact(content.contact);
    if (content.services) {
      setCmsServices(content.services);
    }
    if (content.luxuryCategories) {
      setCmsLuxuryCategories(content.luxuryCategories);
    }
  }, [content]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const projectsSnap = await getDocs(query(collection(db, 'projects'), orderBy('createdAt', 'desc')));
      const projectsList: any[] = projectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProjects(projectsList);

      const profilesSnap = await getDocs(collection(db, 'profiles'));
      const profilesList: any[] = profilesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      setStaff(profilesList.filter(p => p.role !== 'client'));
      setClients(profilesList.filter(p => p.role === 'client'));

      setStats({
        activeProjects: projectsList.filter(p => p.status === 'active').length,
        totalClients: profilesList.filter(p => p.role === 'client').length
      });

      const inquiriesSnap = await getDocs(query(collection(db, 'inquiries'), orderBy('createdAt', 'desc')));
      setInquiries(inquiriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const detailedSnap = await getDocs(collection(db, 'detailedServices'));
      setDetailedServices(detailedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isImageFile = (file: File): boolean => {
    if (file.type && file.type.startsWith('image/')) return true;
    const ext = file.name.split('.').pop()?.toLowerCase();
    return !!ext && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'tiff'].includes(ext);
  };

  const isVideoFile = (file: File): boolean => {
    if (file.type && file.type.startsWith('video/')) return true;
    const ext = file.name.split('.').pop()?.toLowerCase();
    return !!ext && ['mp4', 'mov', 'avi', 'mkv', 'webm', 'ogg', 'm4v'].includes(ext);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const compressImageToMax500KB = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const fallbackToRawBase64 = () => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      };

      if (!isImageFile(file)) {
        fallbackToRawBase64();
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;

              // Limit dimensions to 1200px max for swift local storage / lightweight transit
              const MAX_SIZE = 1200;
              if (width > MAX_SIZE || height > MAX_SIZE) {
                if (width > height) {
                  height = Math.round((height * MAX_SIZE) / width);
                  width = MAX_SIZE;
                } else {
                  width = Math.round((width * MAX_SIZE) / height);
                  height = MAX_SIZE;
                }
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                // High-Performance JPEG compression at 0.75 quality fits perfectly within 500KB
                const compressed = canvas.toDataURL('image/jpeg', 0.75);
                resolve(compressed);
              } else {
                resolve(event.target?.result as string);
              }
            } catch (canvasErr) {
              console.warn("Canvas compression failed, falling back to raw data.", canvasErr);
              resolve(event.target?.result as string);
            }
          };
          img.onerror = () => resolve(event.target?.result as string);
        } catch (loadErr) {
          console.warn("Image load failed inside compress, falling back to raw data.", loadErr);
          fallbackToRawBase64();
        }
      };
      reader.onerror = () => fallbackToRawBase64();
      reader.readAsDataURL(file);
    });
  };

  const fetchMedia = async () => {
    const gallerySnap = await getDocs(query(collection(db, 'gallery'), orderBy('createdAt', 'desc')));
    setGallery(gallerySnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    const portfolioSnap = await getDocs(query(collection(db, 'portfolio_assets'), orderBy('createdAt', 'desc')));
    setPortfolio(portfolioSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const handleAddMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Option A: Manual URL entry
    if (useManualUrl) {
      if (!newMedia.image) return;
      try {
        const isVideo = newMedia.image.endsWith('.mp4') || newMedia.image.includes('video');
        await addDoc(collection(db, mediaType), {
          title: newMedia.title.trim() || "",
          category: newMedia.category.trim() || "",
          image: newMedia.image,
          type: isVideo ? 'video' : 'image',
          createdAt: new Date().toISOString()
        });
        setNewMedia({ title: '', category: '', image: '' });
        setUploadError(null);
        setShowMediaModal(false);
        fetchMedia();
      } catch (err) {
        console.error(err);
        handleFirestoreError(err, OperationType.WRITE, mediaType);
      }
      return;
    }

    // Option B: Multiple Files Upload to Cloudinary via Direct Endpoint
    if (selectedFiles.length === 0) {
      alert("Please select or drop at least one file to upload.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    const initialProgress: typeof uploadProgress = {};
    selectedFiles.forEach(f => {
      initialProgress[f.name] = { status: 'pending', progress: 0 };
    });
    setUploadProgress(initialProgress);

    let cloudName = ((import.meta as any).env?.VITE_CLOUDINARY_CLOUD_NAME as string);
    let preset = ((import.meta as any).env?.VITE_CLOUDINARY_UPLOAD_PRESET as string);

    // Retrieve fresh configuration from the API if possible, since actual Cloudinary credentials might be set on the server-side
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
    } catch (configErr) {
      console.warn("Failed to fetch runtime backend configuration:", configErr);
    }

    // Final fallback if still unresolved
    if (!cloudName || cloudName === 'undefined') {
      cloudName = 'djwrpottl';
    }
    if (!preset || preset === 'undefined') {
      preset = 'pamnim_preset';
    }

    let errorCount = 0;

    // Seq upload loop to guarantee order and avoid parallel overloading
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const isVideo = isVideoFile(file);

      setUploadProgress(prev => ({
        ...prev,
        [file.name]: { status: 'uploading', progress: 10 }
      }));

      let secureUrl = "";

      try {
        // Unsigned direct uploading is only possible with a specialized preset on that specific account.
        // If the user is using custom credentials with the default template preset, we bypass direct client uploading
        // and fall back to the secure signed backend proxy immediately to prevent failing and provide a fast, robust upload.
        if (!preset || preset === "undefined" || (cloudName && cloudName !== "djwrpottl" && preset === "pamnim_preset")) {
          throw new Error("Custom Cloudinary configuration set up, bypassing direct unsigned upload for secure backend signed upload.");
        }

        // Attempt High-Performance Direct Streaming Client-to-Cloudinary uploading
        // This avoids Base64 CPU/RAM bottlenecks, skips double-hop server routing,
        // and establishes a real-time progress bar.
        secureUrl = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/${isVideo ? 'video' : 'image'}/upload`);

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              // Map the XML upload progress from 10% up to 85% dynamically
              const percentComplete = 10 + Math.round((event.loaded / event.total) * 75);
              setUploadProgress(prev => ({
                ...prev,
                [file.name]: { status: 'uploading', progress: percentComplete }
              }));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const resData = JSON.parse(xhr.responseText);
                resolve(resData.secure_url || resData.url);
              } catch (e) {
                reject(new Error("Failed to parse Cloudinary response"));
              }
            } else {
              reject(new Error(`Direct upload responded with status ${xhr.status}`));
            }
          };

          xhr.onerror = () => reject(new Error("Network connection error during direct upload"));

          const formData = new FormData();
          formData.append('file', file);
          formData.append('upload_preset', preset);
          xhr.send(formData);
        });
      } catch (directUploadErr: any) {
        console.warn(`Direct upload failed/bypassed for ${file.name}, trying proxy...`, directUploadErr);

        setUploadProgress(prev => ({
          ...prev,
          [file.name]: { status: 'uploading', progress: 20 }
        }));

        try {
          // Convert with beautiful client-side image compression
          const base64Data = await compressImageToMax500KB(file);
          
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: { status: 'uploading', progress: 50 }
          }));

          const response = await fetch('/api/media/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              file: base64Data,
              type: isVideo ? 'video' : 'image',
              uploadPreset: preset
            })
          });

          if (!response.ok) {
            const text = await response.text();
            throw new Error(`Proxy replied with ${response.status}: ${text}`);
          }

          const resData = await response.json();
          secureUrl = resData.url;
          if (!secureUrl) {
            throw new Error("Proxy response is missing URL");
          }
        } catch (proxyErr: any) {
          console.error(`Media upload proxy also failed for ${file.name}:`, proxyErr);
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: { status: 'failed', progress: 0, error: proxyErr.message || String(proxyErr) }
          }));
          errorCount++;
          continue; // Move on to next file in loop! Dont crash!
        }
      }

      // Apply automatic luxury formatting optimization transformations from our standards
      if (secureUrl.includes('cloudinary.com') && !secureUrl.includes('/q_auto')) {
        const assetSection = isVideo ? '/video/upload/' : '/image/upload/';
        if (secureUrl.includes(assetSection)) {
          secureUrl = secureUrl.replace(assetSection, `${assetSection}q_auto:good,f_auto/`);
        }
      }

      setUploadProgress(prev => ({
        ...prev,
        [file.name]: { status: 'uploading', progress: 95 }
      }));

      try {
        // Determine title
        const itemTitle = newMedia.title.trim()
          ? (selectedFiles.length > 1 ? `${newMedia.title.trim()} ${i + 1}` : newMedia.title.trim())
          : "";

        await addDoc(collection(db, mediaType), {
          title: itemTitle,
          category: newMedia.category.trim() || "",
          image: secureUrl,
          type: isVideo ? 'video' : 'image',
          createdAt: new Date().toISOString()
        });

        setUploadProgress(prev => ({
          ...prev,
          [file.name]: { status: 'completed', progress: 100 }
        }));
      } catch (dbErr: any) {
        console.error(`Failed to record database entry for ${file.name}:`, dbErr);
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: { status: 'failed', progress: 0, error: `Database Save Error: ${dbErr.message || String(dbErr)}` }
        }));
        errorCount++;
      }
    }

    // Cleanup & Final UI refresh
    if (errorCount === 0) {
      setSelectedFiles([]);
      setNewMedia({ title: '', category: '', image: '' });
      setUploadError(null);
      setTimeout(() => {
        setShowMediaModal(false);
        setIsUploading(false);
        setUploadProgress({});
        fetchMedia();
      }, 1200);
    } else {
      setIsUploading(false);
      setUploadError(`Completed with ${errorCount} error(s). Please review failed files below.`);
      fetchMedia(); // Refresh whatever succeeded
    }
  };

  const handleDeleteMedia = async (id: string, type: string) => {
    if (window.confirm('Delete this image?')) {
      await deleteDoc(doc(db, type, id));
      fetchMedia();
    }
  };

  const handleDeleteInquiry = async (id: string) => {
    if (window.confirm('Delete this inquiry?')) {
      await deleteDoc(doc(db, 'inquiries', id));
      const snap = await getDocs(query(collection(db, 'inquiries'), orderBy('createdAt', 'desc')));
      setInquiries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
  };

  const handleUpdateInquiryStatus = async (id: string, status: string) => {
    await updateDoc(doc(db, 'inquiries', id), { status });
    const snap = await getDocs(query(collection(db, 'inquiries'), orderBy('createdAt', 'desc')));
    setInquiries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const phases = [
        { name: 'Discovery', status: 'active', description: 'Exploring vision and project scope.', date: new Date().toLocaleDateString() },
        { name: 'Concept', status: 'pending', description: 'Moodboards and initial 3D layouts.', date: '' },
        { name: 'Development', status: 'pending', description: 'Technical drawings and material selection.', date: '' },
        { name: 'Procurement', status: 'pending', description: 'Sourcing furniture and finishes.', date: '' },
        { name: 'Installation', status: 'pending', description: 'On-site execution and styling.', date: '' },
        { name: 'Handover', status: 'pending', description: 'Final touches and project reveal.', date: '' }
      ];

      await addDoc(collection(db, 'projects'), {
        ...newProject,
        status: 'active',
        phases,
        createdAt: new Date().toISOString()
      });
      setShowProjectModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveCMS = async () => {
    await setDoc(doc(db, 'siteContent', 'homepage'), {
      ...content,
      hero: cmsHero,
      contact: cmsContact,
      services: cmsServices,
      luxuryCategories: cmsLuxuryCategories
    });
    alert('Homepage, contact info and luxury categories updated!');
  };

  const handleSaveServices = async (updatedServicesList?: any[]) => {
    const listToSave = updatedServicesList || cmsServices;
    try {
      await setDoc(doc(db, 'siteContent', 'homepage'), {
        ...content,
        services: listToSave
      });
    } catch (err) {
      console.error('Error saving services:', err);
      alert('Failed to save service changes to the database.');
    }
  };

  const uploadFileToCloudinary = async (file: File): Promise<string> => {
    let cloudName = ((import.meta as any).env?.VITE_CLOUDINARY_CLOUD_NAME as string);
    let preset = ((import.meta as any).env?.VITE_CLOUDINARY_UPLOAD_PRESET as string);

    try {
      const configRes = await fetch('/api/config/cloudinary');
      if (configRes.ok) {
        const configData = await configRes.json();
        if (configData.cloudName && configData.cloudName !== 'undefined') cloudName = configData.cloudName;
        if (configData.uploadPreset && configData.uploadPreset !== 'undefined') preset = configData.uploadPreset;
      }
    } catch (err) {
      console.warn("Failed to fetch runtime backend configuration:", err);
    }

    if (!cloudName || cloudName === 'undefined') cloudName = 'djwrpottl';
    if (!preset || preset === 'undefined') preset = 'pamnim_preset';

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', preset);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        return data.secure_url || data.url;
      }
      throw new Error(`Direct upload failed with status ${res.status}`);
    } catch (directErr) {
      console.warn("Direct upload failed, trying proxy...", directErr);
      const base64Data = await compressImageToMax500KB(file);
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: base64Data, type: 'image', uploadPreset: preset })
      });
      if (res.ok) {
        const data = await res.json();
        return data.url;
      }
      throw new Error("Failed to upload image via both direct and proxy methods.");
    }
  };

  const handleUploadDetailedImage = async (file: File, type: 'hero' | 'img0' | 'img1' | 'img2') => {
    try {
      setIsSavingSubService(true);
      const url = await uploadFileToCloudinary(file);
      setSubServiceForm(prev => {
        if (type === 'hero') {
          return { ...prev, heroImage: url };
        } else {
          const index = parseInt(type.replace('img', ''));
          const newImgs = [...prev.images];
          newImgs[index] = url;
          return { ...prev, images: newImgs };
        }
      });
    } catch (err: any) {
      alert(`Upload failed: ${err.message || err}`);
    } finally {
      setIsSavingSubService(false);
    }
  };

  const handleSaveSubService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubService) return;
    try {
      setIsSavingSubService(true);
      const docId = `${selectedSubService.categoryId}_${selectedSubService.slug}`;
      await setDoc(doc(db, 'detailedServices', docId), {
        slug: selectedSubService.slug,
        categoryId: selectedSubService.categoryId,
        name: subServiceForm.name,
        desc: subServiceForm.desc,
        heroImage: subServiceForm.heroImage,
        images: subServiceForm.images
      });
      alert('Sub-Service updated successfully!');
      setSelectedSubService(null);
      
      const detailedSnap = await getDocs(collection(db, 'detailedServices'));
      setDetailedServices(detailedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err: any) {
      console.error(err);
      alert(`Failed to save sub-service: ${err.message || err}`);
    } finally {
      setIsSavingSubService(false);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // In a real app we'd use Firebase Admin to create the user.
      // Here we create the profile, and when the user signs up with this email,
      // the app should ideally link them or we can manually link via UI later.
      // For now, we just create the profile so they show up in lists.
      const staffRef = doc(collection(db, 'profiles'));
      await setDoc(staffRef, {
        ...newStaff,
        uid: staffRef.id, // placeholder until they actually sign in
        createdAt: new Date().toISOString()
      });
      setShowStaffModal(false);
      setNewStaff({ name: '', email: '', role: 'designer' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const navItems = [
    { id: 'overview', label: 'Dashboard', icon: Briefcase },
    { id: 'projects', label: 'Projects & Tracking', icon: Briefcase },
    { id: 'chat', label: 'Client Chat', icon: MessageSquare },
    { id: 'staff', label: 'Team & Approvals', icon: Users },
    { id: 'services', label: 'Services', icon: LayoutGrid },
    { id: 'detailed-services', label: 'Sub-Services CMS', icon: Sparkles },
    { id: 'inquiries', label: 'Inquiries', icon: Mail },
    { id: 'media', label: 'Media Library', icon: Globe },
    { id: 'content', label: 'Homepage Editor', icon: Globe },
  ];

  return (
    <AdminLayout activeTab={activeTab}>
      {/* Tab Navigation */}
      <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl font-bold whitespace-nowrap transition-all",
              activeTab === item.id ? "bg-ochre text-white shadow-lg shadow-ochre/20" : "bg-white border border-charcoal/5 hover:bg-cream"
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Quick Sign-Up Link Banner */}
          <div className="bg-ochre text-white p-6 sm:p-8 rounded-3xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-white/80" />
                <span className="text-xs font-bold uppercase tracking-widest text-white/90">Portal Onboarding</span>
              </div>
              <h3 className="text-2xl font-bold">Copy Client & Employee Sign-Up Link</h3>
              <p className="text-white/80 text-sm mt-1 max-w-xl">
                Send this link to clients or team members to register. You can approve their requests & assign roles under the "Team & Approvals" tab.
              </p>
            </div>

            <button
              onClick={handleCopySignupLink}
              className="px-6 py-3.5 bg-white text-ochre font-bold text-sm rounded-2xl shadow-md hover:bg-cream transition-all flex items-center gap-2 shrink-0 cursor-pointer"
            >
              {copiedSignupOverview ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                  <span>Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Sign-Up Link</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard label="Active Projects" value={stats.activeProjects.toString()} icon={Briefcase} color="bg-blue-50 text-blue-600" />
            <StatCard label="Total Staff" value={staff.length.toString()} icon={Users} color="bg-ochre/10 text-ochre" />
            <StatCard label="New Inquiries" value={inquiries.filter(i => i.status === 'new').length.toString()} icon={Mail} color="bg-green-50 text-green-600" />
          </div>
          
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-charcoal/5">
            <h2 className="text-2xl font-bold mb-8">Project Activity</h2>
            <div className="h-64 bg-cream rounded-2xl flex items-center justify-center text-charcoal/20 font-bold border border-dashed border-charcoal/10">
               Project lifecycle & engagement metrics
            </div>
          </div>
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="space-y-8">
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-charcoal/5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-bold">Project Progress Tracking</h2>
                <p className="text-sm text-charcoal/60 mt-1">Select a project to view or manage its 4-stage tracking progress, media, and notes.</p>
              </div>
              <button 
                onClick={() => setShowStartProjectModal(true)}
                className="flex items-center gap-2 bg-ochre text-white px-6 py-3 rounded-2xl font-bold hover:bg-ochre-dark transition-all shadow-lg shadow-ochre/20"
              >
                <Plus className="w-5 h-5" />
                Start New Project
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="p-12 text-center text-charcoal/40 bg-cream/30 rounded-3xl border border-dashed border-charcoal/15">
                No active projects found. Click "Start New Project" above to create one.
              </div>
            ) : (
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Project Selector List */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-charcoal/40 uppercase tracking-widest px-1">Projects List</h3>
                  {projects.map((proj) => {
                    const isSelected = (selectedProject?.id || projects[0]?.id) === proj.id;
                    return (
                      <button
                        key={proj.id}
                        onClick={() => setSelectedProject(proj)}
                        className={cn(
                          "w-full text-left p-5 rounded-2xl border transition-all text-sm",
                          isSelected 
                            ? "bg-ochre text-white border-ochre shadow-lg shadow-ochre/20"
                            : "bg-white border-charcoal/10 hover:border-ochre/50 hover:bg-cream/50"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase", isSelected ? "bg-white/20 text-white" : "bg-ochre/10 text-ochre")}>
                            {proj.currentStageName || 'Started'}
                          </span>
                          <span className={cn("text-xs font-semibold truncate max-w-[160px]", isSelected ? "text-white/80" : "text-charcoal/50")}>
                            {proj.selectedServices && proj.selectedServices.length > 0
                              ? `${proj.selectedServices.length} Included Scopes`
                              : (proj.serviceName || proj.categoryTitle || 'Service')}
                          </span>
                        </div>
                        <h4 className="font-bold text-base mb-1">{proj.name}</h4>
                        <p className={cn("text-xs", isSelected ? "text-white/80" : "text-charcoal/60")}>
                          Client: {proj.clientName}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Project Tracker Interactive View */}
                <div className="lg:col-span-2">
                  {(() => {
                    const activeProj = selectedProject || projects[0];
                    if (!activeProj) return null;
                    return (
                      <ProjectTracker
                        project={activeProj}
                        isReadOnly={false}
                        onOpenChatWithTag={(taggedCtx) => {
                          setChatTaggedContext(taggedCtx);
                          const clientMatch = clients.find(c => c.uid === activeProj.clientId || c.id === activeProj.clientId);
                          if (clientMatch) setSelectedChatClient(clientMatch);
                          setActiveTab('chat');
                        }}
                        onProjectUpdated={fetchData}
                      />
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          <StartProjectModal
            isOpen={showStartProjectModal}
            onClose={() => setShowStartProjectModal(false)}
            clients={clients}
            onProjectStarted={() => {
              fetchData();
              setShowStartProjectModal(false);
            }}
          />
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-charcoal/10 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Client Chat Threads</h2>
              <p className="text-sm text-charcoal/60">Select a client below to converse in real-time or reply to stage comments.</p>
            </div>

            <div className="w-full md:w-auto">
              <select
                value={selectedChatClient?.uid || selectedChatClient?.id || (clients[0]?.uid || '')}
                onChange={e => {
                  const match = clients.find(c => c.uid === e.target.value || c.id === e.target.value);
                  if (match) setSelectedChatClient(match);
                }}
                className="w-full md:w-72 px-4 py-2.5 rounded-xl border border-charcoal/15 text-sm font-bold bg-white text-charcoal outline-none focus:border-ochre"
              >
                {clients.length === 0 ? (
                  <option value="">No clients available</option>
                ) : (
                  clients.map(c => (
                    <option key={c.uid || c.id} value={c.uid || c.id}>
                      {c.name} ({c.email || c.phone || 'Client'})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {(() => {
            const activeChatUser = selectedChatClient || clients[0];
            if (!activeChatUser) {
              return (
                <div className="p-12 text-center text-charcoal/40 bg-white rounded-3xl border border-charcoal/10">
                  No active clients available for messaging yet.
                </div>
              );
            }
            return (
              <ProjectChat
                clientId={activeChatUser.uid || activeChatUser.id}
                clientName={activeChatUser.name}
                initialTaggedContext={chatTaggedContext}
                onClearTag={() => setChatTaggedContext(undefined)}
              />
            );
          })()}
        </div>
      )}

      {activeTab === 'services' && (
        <div className="bg-white rounded-3xl p-8 border border-charcoal/5 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold">Services Directory</h2>
              <p className="text-sm text-charcoal/60 mt-1">Configure and customize the services listed on the homepage.</p>
            </div>
            <button 
              onClick={() => {
                setEditingServiceId(null);
                setServiceForm({ title: '', description: '', iconName: 'Home' });
                setShowServiceModal(true);
              }}
              className="flex items-center gap-2 bg-ochre text-white px-6 py-2.5 rounded-xl font-bold hover:bg-ochre/90 transition-all shadow-lg shadow-ochre/20"
            >
              <Plus className="w-5 h-5" />
              Add Service
            </button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cmsServices.map((service, index) => {
              const ServiceIcon = iconMap[service.iconName] || HelpCircle;
              return (
                <div key={service.id || index} className="p-6 rounded-2xl bg-cream/30 border border-charcoal/5 flex flex-col justify-between hover:border-ochre/30 transition-all group">
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-ochre/10 flex items-center justify-center mb-6 group-hover:bg-ochre transition-all">
                      <ServiceIcon className="w-6 h-6 text-ochre group-hover:text-white transition-all" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">{service.title}</h3>
                    <p className="text-sm text-charcoal/60 leading-relaxed min-h-[4.5rem]">{service.description}</p>
                    <span className="inline-block text-[10px] uppercase tracking-widest font-bold text-charcoal/30 bg-cream px-2.5 py-1 rounded-lg mt-4">
                      ICON: {service.iconName}
                    </span>
                  </div>
                  <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-charcoal/5">
                    <button 
                      onClick={() => {
                        setEditingServiceId(service.id || index.toString());
                        setServiceForm({
                          title: service.title,
                          description: service.description,
                          iconName: service.iconName || 'Home'
                        });
                        setShowServiceModal(true);
                      }}
                      className="p-2 text-charcoal/60 hover:text-ochre hover:bg-ochre/10 rounded-lg transition-colors"
                      title="Edit Service"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={async () => {
                        if (confirm('Are you sure you want to delete this service?')) {
                          const updated = cmsServices.filter((_, idx) => (service.id ? _.id !== service.id : idx !== index));
                          setCmsServices(updated);
                          await handleSaveServices(updated);
                        }
                      }}
                      className="p-2 text-charcoal/60 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Service"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            {cmsServices.length === 0 && (
              <div className="col-span-full py-20 text-center border-2 border-dashed border-charcoal/10 rounded-3xl">
                <p className="text-charcoal/30 font-bold uppercase text-xs tracking-widest">No services found</p>
                <p className="text-sm text-charcoal/60 mt-2">Add your first custom service using the button above.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'detailed-services' && (
        <div className="bg-white rounded-3xl p-8 border border-charcoal/5 shadow-sm animate-fade-in">
          <div className="mb-8">
            <h2 className="text-2xl font-bold">Detailed Sub-Services CMS</h2>
            <p className="text-sm text-charcoal/60 mt-1">Configure individual dynamic pages for the 12 "Included Solutions" of your luxury categories.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {serviceCategories.flatMap(category => 
              category.items.map(item => {
                const dbItem = detailedServices.find(ds => ds.id === `${category.id}_${item.slug}`);
                const hasHero = !!(dbItem?.heroImage || item.heroImage);
                const galleryCount = (dbItem?.images || item.images || ["", "", ""]).filter(Boolean).length;

                return (
                  <div key={`${category.id}_${item.slug}`} className="p-6 rounded-2xl bg-cream/30 border border-charcoal/5 flex flex-col justify-between hover:border-ochre/30 transition-all group">
                    <div>
                      <span className="inline-block text-[9px] font-mono uppercase tracking-widest font-bold text-ochre bg-ochre/10 px-2.5 py-1 rounded-md mb-3">
                        {category.title}
                      </span>
                      <h3 className="font-bold text-lg mb-2">{item.name}</h3>
                      <p className="text-xs text-charcoal/50 line-clamp-3 mb-6 min-h-[3rem]">{dbItem?.desc || item.desc}</p>
                      
                      <div className="space-y-2 mb-6">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-charcoal/40 font-bold uppercase tracking-wider">Hero Image</span>
                          <span className={hasHero ? "text-green-600 font-bold" : "text-amber-600 font-bold"}>
                            {hasHero ? "Uploaded" : "No Image"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-charcoal/40 font-bold uppercase tracking-wider">Gallery Images</span>
                          <span className="font-bold text-charcoal/70">
                            {galleryCount} / 3 Uploaded
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const currentHero = dbItem?.heroImage || item.heroImage || "";
                        const currentImgs = dbItem?.images || item.images || ["", "", ""];
                        const normalizedImgs = [
                          currentImgs[0] || "",
                          currentImgs[1] || "",
                          currentImgs[2] || ""
                        ];
                        
                        setSelectedSubService({
                          categoryId: category.id,
                          categoryTitle: category.title,
                          slug: item.slug,
                          name: item.name
                        });
                        setSubServiceForm({
                          name: dbItem?.name || item.name,
                          desc: dbItem?.desc || item.desc,
                          heroImage: currentHero,
                          images: normalizedImgs
                        });
                      }}
                      className="w-full bg-charcoal hover:bg-ochre text-white text-xs font-bold py-3 rounded-xl transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit Page Assets
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'staff' && (
        <UserManagementView onRefreshData={fetchData} />
      )}

      {activeTab === 'media' && (
        <div className="bg-white rounded-3xl p-8 border border-charcoal/5 shadow-sm">
           <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold">Media Library</h2>
                <div className="flex gap-4 mt-4">
                  <button 
                    onClick={() => setMediaType('gallery')}
                    className={cn("px-4 py-1.5 rounded-lg text-sm font-bold transition-all", mediaType === 'gallery' ? "bg-ochre text-white" : "bg-cream text-charcoal/40")}
                  >
                    Home Gallery
                  </button>
                  <button 
                    onClick={() => setMediaType('portfolio_assets')}
                    className={cn("px-4 py-1.5 rounded-lg text-sm font-bold transition-all", mediaType === 'portfolio_assets' ? "bg-ochre text-white" : "bg-cream text-charcoal/40")}
                  >
                    Full Portfolio
                  </button>
                </div>
              </div>
              <button 
                onClick={() => setShowMediaModal(true)}
                className="flex items-center gap-2 bg-charcoal text-white px-6 py-2.5 rounded-xl font-bold hover:bg-black transition-all"
              >
                <Plus className="w-5 h-5" />
                Add to {mediaType === 'gallery' ? 'Gallery' : 'Portfolio'}
              </button>
           </div>
           
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {(mediaType === 'gallery' ? gallery : portfolio).map(item => {
                const isVideo = item.type === 'video' || (item.image && item.image.includes('.mp4'));
                return (
                  <div key={item.id} className="group relative aspect-square rounded-2xl overflow-hidden bg-cream border border-charcoal/5">
                     {isVideo ? (
                       <div className="relative w-full h-full bg-black select-none">
                         <video src={item.image} className="w-full h-full object-cover pointer-events-none" muted playsInline />
                         <div className="absolute top-4 left-4 z-10 bg-charcoal/80 text-cream p-1.5 rounded-lg">
                           <Film className="w-4 h-4" />
                         </div>
                       </div>
                     ) : (
                       <img src={item.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                     )}
                     <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-4 z-20">
                        <div className="flex justify-end">
                          <button 
                            onClick={() => handleDeleteMedia(item.id, mediaType)}
                            className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="text-white">
                          <p className="text-xs font-bold uppercase text-ochre tracking-widest">{item.category || "(No Category)"}</p>
                          <p className="font-bold truncate text-sm">{item.title || "(No Title)"}</p>
                        </div>
                     </div>
                  </div>
                );
              })}
              {(mediaType === 'gallery' ? gallery : portfolio).length === 0 && (
                <div className="col-span-full py-20 text-center border-2 border-dashed border-charcoal/10 rounded-3xl">
                  <p className="text-charcoal/30 font-bold uppercase text-xs tracking-widest">Empty {mediaType}</p>
                </div>
              )}
           </div>
        </div>
      )}

      {activeTab === 'inquiries' && (
        <div className="bg-white rounded-3xl p-8 border border-charcoal/5 shadow-sm">
           <h2 className="text-2xl font-bold mb-8">Customer Inquiries</h2>
           <div className="space-y-4">
              {inquiries.map(inquiry => (
                <div key={inquiry.id} className={cn(
                  "p-6 rounded-2xl border transition-all",
                  inquiry.status === 'new' ? "bg-ochre/5 border-ochre/20" : "bg-cream/30 border-charcoal/5"
                )}>
                   <div className="flex justify-between items-start mb-4">
                      <div>
                         <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-bold text-lg">{inquiry.name}</h3>
                            {inquiry.status === 'new' && (
                              <span className="bg-ochre text-white text-[10px] px-2 py-0.5 rounded-full font-black uppercase">New</span>
                            )}
                         </div>
                         <p className="text-sm text-charcoal/60">{inquiry.email} • {inquiry.projectType}</p>
                      </div>
                      <div className="flex items-center gap-2">
                         <select 
                           value={inquiry.status}
                           onChange={(e) => handleUpdateInquiryStatus(inquiry.id, e.target.value)}
                           className="text-xs font-bold uppercase p-2 border-none bg-white rounded-lg focus:ring-0 cursor-pointer"
                         >
                            <option value="new">Mark as New</option>
                            <option value="read">Mark as Read</option>
                            <option value="responded">Responded</option>
                         </select>
                         <button 
                           onClick={() => handleDeleteInquiry(inquiry.id)}
                           className="p-2 text-charcoal/20 hover:text-red-500 transition-colors"
                         >
                            <Trash2 className="w-4 h-4" />
                         </button>
                      </div>
                   </div>
                   <p className="text-charcoal/80 leading-relaxed bg-white/50 p-4 rounded-xl italic">"{inquiry.message}"</p>
                   <p className="text-[10px] text-charcoal/30 mt-4 uppercase font-bold tracking-widest">{new Date(inquiry.createdAt).toLocaleString()}</p>
                </div>
              ))}
              {inquiries.length === 0 && (
                <div className="py-20 text-center border-2 border-dashed border-charcoal/10 rounded-3xl">
                  <p className="text-charcoal/30 font-bold">No inquiries yet.</p>
                </div>
              )}
           </div>
        </div>
      )}

      {activeTab === 'content' && (
        <div className="bg-white rounded-3xl p-8 border border-charcoal/5 shadow-sm">
           <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold">Homepage & Settings</h2>
              <button 
                onClick={handleSaveCMS}
                className="bg-ochre text-white font-bold px-10 py-3 rounded-xl hover:bg-ochre/90 transition-all shadow-lg shadow-ochre/20"
              >
                Save All Changes
              </button>
           </div>

           <div className="grid lg:grid-cols-2 gap-12">
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-charcoal/40 uppercase tracking-widest border-b border-charcoal/5 pb-2">Hero Section</h3>
                <div>
                   <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs font-bold uppercase text-charcoal/40">Main Headline</label>
                      <button
                        type="button"
                        onClick={() => handleRefineText('heroTitle', cmsHero.title, 'Main header of the warm minimalist interior design landing page')}
                        className="text-[10px] font-bold text-ochre hover:text-ochre/80 flex items-center gap-1 bg-ochre/5 hover:bg-ochre/10 px-2.5 py-1 rounded-lg transition-all"
                      >
                        <span>✦ Refine with AI</span>
                      </button>
                   </div>
                   <textarea 
                     rows={3}
                     value={cmsHero.title}
                     onChange={(e) => setCmsHero({...cmsHero, title: e.target.value})}
                     className="w-full p-4 bg-cream border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre"
                   />
                   {refinement.field === 'heroTitle' && (
                     <div className="mt-2 p-4 bg-ochre/5 border border-ochre/20 rounded-xl space-y-3">
                       <span className="text-[10px] uppercase font-bold text-ochre tracking-widest block">✦ Luxury Lookbook Suggestion</span>
                       {refinement.loading ? (
                         <p className="text-xs text-charcoal/50 animate-pulse font-medium">Elevating copywriting aesthetics...</p>
                       ) : refinement.error ? (
                         <p className="text-xs text-red-500 font-medium font-mono">{refinement.error}</p>
                       ) : (
                         <div className="space-y-3">
                           <p className="text-sm italic font-medium text-charcoal">{refinement.refinedText}</p>
                           <div className="flex gap-2">
                             <button
                               onClick={handleApplyRefinement}
                               className="text-xs font-bold px-3 py-1 bg-ochre text-white rounded hover:bg-ochre/90"
                             >
                               Apply Draft
                             </button>
                             <button
                               onClick={() => setRefinement({ field: null, originalText: '', refinedText: '', loading: false, error: null })}
                               className="text-xs font-bold px-3 py-1 bg-charcoal/5 text-charcoal/60 rounded hover:bg-charcoal/10"
                             >
                               Discard
                             </button>
                           </div>
                         </div>
                       )}
                     </div>
                   )}
                </div>
                <div>
                   <label className="block text-xs font-bold uppercase text-charcoal/40 mb-2">Highlight Word (ochre color)</label>
                   <input 
                     type="text"
                     value={cmsHero.highlightWord}
                     onChange={(e) => setCmsHero({...cmsHero, highlightWord: e.target.value})}
                     className="w-full p-4 bg-cream border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre"
                   />
                </div>
                <div>
                   <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs font-bold uppercase text-charcoal/40">Sub-headline Description</label>
                      <button
                        type="button"
                        onClick={() => handleRefineText('heroSub', cmsHero.subheadline, 'Sub-headline / intro copy of high-end interiors firm in Goa')}
                        className="text-[10px] font-bold text-ochre hover:text-ochre/80 flex items-center gap-1 bg-ochre/5 hover:bg-ochre/10 px-2.5 py-1 rounded-lg transition-all"
                      >
                        <span>✦ Refine with AI</span>
                      </button>
                   </div>
                   <textarea 
                     rows={4}
                     value={cmsHero.subheadline}
                     onChange={(e) => setCmsHero({...cmsHero, subheadline: e.target.value})}
                     className="w-full p-4 bg-cream border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre"
                   />
                   {refinement.field === 'heroSub' && (
                     <div className="mt-2 p-4 bg-ochre/5 border border-ochre/20 rounded-xl space-y-3">
                       <span className="text-[10px] uppercase font-bold text-ochre tracking-widest block">✦ Luxury Lookbook Suggestion</span>
                       {refinement.loading ? (
                         <p className="text-xs text-charcoal/50 animate-pulse font-medium">Elevating copywriting aesthetics...</p>
                       ) : refinement.error ? (
                         <p className="text-xs text-red-500 font-medium font-mono">{refinement.error}</p>
                       ) : (
                         <div className="space-y-3">
                           <p className="text-sm italic font-medium text-charcoal">{refinement.refinedText}</p>
                           <div className="flex gap-2">
                             <button
                               onClick={handleApplyRefinement}
                               className="text-xs font-bold px-3 py-1 bg-ochre text-white rounded hover:bg-ochre/90"
                             >
                               Apply Draft
                             </button>
                             <button
                               onClick={() => setRefinement({ field: null, originalText: '', refinedText: '', loading: false, error: null })}
                               className="text-xs font-bold px-3 py-1 bg-charcoal/5 text-charcoal/60 rounded hover:bg-charcoal/10"
                             >
                               Discard
                             </button>
                           </div>
                         </div>
                       )}
                     </div>
                   )}
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-lg font-bold text-charcoal/40 uppercase tracking-widest border-b border-charcoal/5 pb-2">Business Contact Info</h3>
                <div>
                   <label className="block text-xs font-bold uppercase text-charcoal/40 mb-2">Phone Number (Display)</label>
                   <input 
                     type="text"
                     value={cmsContact.phone}
                     onChange={(e) => setCmsContact({...cmsContact, phone: e.target.value})}
                     className="w-full p-4 bg-cream border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre"
                   />
                </div>
                <div>
                   <label className="block text-xs font-bold uppercase text-charcoal/40 mb-2">WhatsApp Number (Digits only, incl. country code)</label>
                   <input 
                     type="text"
                     value={cmsContact.whatsapp}
                     onChange={(e) => setCmsContact({...cmsContact, whatsapp: e.target.value})}
                     className="w-full p-4 bg-cream border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre"
                   />
                </div>
                <div>
                   <label className="block text-xs font-bold uppercase text-charcoal/40 mb-2">Email Address</label>
                   <input 
                     type="email"
                     value={cmsContact.email}
                     onChange={(e) => setCmsContact({...cmsContact, email: e.target.value})}
                     className="w-full p-4 bg-cream border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre"
                   />
                </div>
                <div>
                   <label className="block text-xs font-bold uppercase text-charcoal/40 mb-2">Physical Address/Area</label>
                   <input 
                     type="text"
                     value={cmsContact.address}
                     onChange={(e) => setCmsContact({...cmsContact, address: e.target.value})}
                     className="w-full p-4 bg-cream border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre"
                   />
                </div>
              </div>
           </div>
        </div>
      )}

      {/* Real Project Previews & Category Settings */}
      {activeTab === 'content' && (
        <div className="max-w-6xl mx-auto px-6 lg:px-8 pb-16">
          <div className="bg-white border border-charcoal/5 rounded-[2.5rem] p-8 md:p-12 shadow-sm space-y-8">
            <div>
              <h3 className="text-xl font-bold">Category Project Previews & Settings</h3>
              <p className="text-sm text-charcoal/60 mt-1">
                Customize the starting prices, timelines, and the real-world project preview images displayed when users request quotes on the homepage.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {cmsLuxuryCategories.map((category, catIdx) => (
                <div key={category.id || catIdx} className="p-6 rounded-3xl bg-cream/30 border border-charcoal/5 space-y-6 relative group" id={`category-${category.id}`}>
                  <div className="flex justify-between items-center border-b border-charcoal/5 pb-4">
                    <div>
                      <span className="text-[10px] font-mono tracking-widest text-ochre uppercase font-bold">Category {category.accent || catIdx + 1}</span>
                      <h4 className="font-bold text-lg mt-0.5">{category.title}</h4>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-charcoal/40 mb-1.5">Starting Price</label>
                      <input
                        type="text"
                        value={category.startingPrice || ''}
                        onChange={(e) => {
                          const updated = [...cmsLuxuryCategories];
                          updated[catIdx] = { ...category, startingPrice: e.target.value };
                          setCmsLuxuryCategories(updated);
                        }}
                        className="w-full p-3 bg-white border border-charcoal/5 rounded-xl text-xs focus:outline-none focus:border-ochre font-medium"
                        placeholder="e.g. From KES 50,000"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-charcoal/40 mb-1.5">Timeline</label>
                      <input
                        type="text"
                        value={category.timeline || ''}
                        onChange={(e) => {
                          const updated = [...cmsLuxuryCategories];
                          updated[catIdx] = { ...category, timeline: e.target.value };
                          setCmsLuxuryCategories(updated);
                        }}
                        className="w-full p-3 bg-white border border-charcoal/5 rounded-xl text-xs focus:outline-none focus:border-ochre font-medium"
                        placeholder="e.g. 2 - 3 Weeks"
                      />
                    </div>
                  </div>

                  {/* Previews URLs and small thumb displays */}
                  <div className="space-y-4">
                    <label className="block text-[10px] font-bold uppercase text-charcoal/40">Real Project Previews (Up to 3 Images)</label>
                    
                    {(category.images || []).map((imgUrl: string, imgIdx: number) => (
                      <div key={imgIdx} className="space-y-1.5">
                        <div className="flex gap-3 items-center">
                          {/* Tiny thumbnail preview */}
                          <div className="w-12 h-12 rounded-xl bg-cream border border-charcoal/5 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {imgUrl ? (
                              <img src={imgUrl} className="w-full h-full object-cover" alt="Preview Thumbnail" onError={(e) => { (e.target as any).src = "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&q=80&w=120" }} referrerPolicy="no-referrer" />
                            ) : (
                              <span className="text-[10px] text-charcoal/20">Empty</span>
                            )}
                          </div>
                          
                          {/* Input url */}
                          <div className="flex-1 relative">
                            <input
                              type="text"
                              value={imgUrl}
                              onChange={(e) => {
                                const updated = [...cmsLuxuryCategories];
                                const updatedImages = [...(category.images || [])];
                                updatedImages[imgIdx] = e.target.value;
                                updated[catIdx] = { ...category, images: updatedImages };
                                setCmsLuxuryCategories(updated);
                              }}
                              className="w-full pl-3 pr-20 py-3 bg-white border border-charcoal/5 rounded-xl text-[11px] focus:outline-none focus:border-ochre font-mono truncate"
                              placeholder={`Paste Image URL ${imgIdx + 1}...`}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] uppercase tracking-wider text-charcoal/30 font-bold font-sans">
                              Image {imgIdx + 1}
                            </span>
                          </div>
                        </div>

                        {/* Quick selection from media library */}
                        <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
                          <span className="text-[9px] font-bold text-charcoal/35 whitespace-nowrap">Media Library:</span>
                          {gallery.slice(0, 4).map((mItem, mIdx) => (
                            <button
                              key={mItem.id || mIdx}
                              type="button"
                              onClick={() => {
                                const updated = [...cmsLuxuryCategories];
                                const updatedImages = [...(category.images || [])];
                                updatedImages[imgIdx] = mItem.image;
                                updated[catIdx] = { ...category, images: updatedImages };
                                setCmsLuxuryCategories(updated);
                              }}
                              className="h-6 w-9 rounded-md overflow-hidden border border-charcoal/5 flex-shrink-0 hover:scale-105 active:scale-95 transition-all focus:outline-none cursor-pointer"
                              title="Click to apply this image"
                            >
                              <img src={mItem.image} className="w-full h-full object-cover" alt="Media Asset" referrerPolicy="no-referrer" />
                            </button>
                          ))}
                          {portfolio.slice(0, 4).map((mItem, mIdx) => (
                            <button
                              key={mItem.id || mIdx}
                              type="button"
                              onClick={() => {
                                const updated = [...cmsLuxuryCategories];
                                const updatedImages = [...(category.images || [])];
                                updatedImages[imgIdx] = mItem.image;
                                updated[catIdx] = { ...category, images: updatedImages };
                                setCmsLuxuryCategories(updated);
                              }}
                              className="h-6 w-9 rounded-md overflow-hidden border border-charcoal/5 flex-shrink-0 hover:scale-105 active:scale-95 transition-all focus:outline-none cursor-pointer"
                              title="Click to apply this image"
                            >
                              <img src={mItem.image} className="w-full h-full object-cover" alt="Media Asset" referrerPolicy="no-referrer" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Service Modal */}
      {showServiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-charcoal/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl relative">
            <button 
              onClick={() => setShowServiceModal(false)} 
              className="absolute top-8 right-8 text-charcoal/20 hover:text-charcoal transition-colors hover:rotate-90 duration-300"
            >
               <Plus className="w-8 h-8 rotate-45" />
            </button>
            <h2 className="text-3xl font-bold mb-8">
              {editingServiceId !== null ? 'Edit Service' : 'Add New Service'}
            </h2>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                let updatedList;
                if (editingServiceId !== null) {
                  // Edit existing
                  updatedList = cmsServices.map((srv, idx) => {
                    const lookupId = srv.id || idx.toString();
                    if (lookupId === editingServiceId) {
                      return { ...srv, ...serviceForm };
                    }
                    return srv;
                  });
                } else {
                  // New service
                  const newSrv = {
                    id: Date.now().toString(),
                    ...serviceForm
                  };
                  updatedList = [...cmsServices, newSrv];
                }
                setCmsServices(updatedList);
                setShowServiceModal(false);
                await handleSaveServices(updatedList);
              }} 
              className="space-y-6"
            >
               <div>
                  <label className="block text-xs font-bold uppercase text-charcoal/40 mb-2">Service Title</label>
                  <input 
                    type="text" required
                    placeholder="E.g. Residential Interior Design"
                    value={serviceForm.title}
                    onChange={(e) => setServiceForm({...serviceForm, title: e.target.value})}
                    className="w-full p-4 bg-cream border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre text-sm font-bold"
                  />
               </div>
               <div>
                  <label className="block text-xs font-bold uppercase text-charcoal/40 mb-2">Description</label>
                  <textarea 
                    rows={4} required
                    placeholder="End-to-end design for homes that balance beauty..."
                    value={serviceForm.description}
                    onChange={(e) => setServiceForm({...serviceForm, description: e.target.value})}
                    className="w-full p-4 bg-cream border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre text-sm leading-relaxed"
                  />
               </div>
               <div>
                  <label className="block text-xs font-bold uppercase text-charcoal/40 mb-2">Select Accent Icon</label>
                  <div className="grid grid-cols-4 gap-3 bg-cream/30 p-3 rounded-2xl border border-charcoal/5 max-h-48 overflow-y-auto">
                    {Object.keys(iconMap).map((key) => {
                      const IconOpt = iconMap[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setServiceForm({...serviceForm, iconName: key})}
                          className={cn(
                            "flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-xs font-bold gap-1 aspect-square",
                            serviceForm.iconName === key 
                              ? "bg-ochre text-white border-ochre scale-105 shadow-md shadow-ochre/10 animate-[pulse_1.5s_infinite]" 
                              : "bg-white text-charcoal border-charcoal/5 hover:bg-cream"
                          )}
                        >
                          <IconOpt className="w-5 h-5 mb-1" />
                          <span className="text-[9px] truncate w-full text-center">{key}</span>
                        </button>
                      );
                    })}
                  </div>
               </div>
               <button 
                 type="submit"
                 className="w-full bg-ochre text-white font-bold py-5 rounded-2xl hover:bg-ochre/90 transition-all shadow-xl shadow-ochre/20 mt-4"
               >
                 {editingServiceId !== null ? 'Update Service' : 'Create & Save Service'}
               </button>
            </form>
          </div>
        </div>
      )}

      {/* Media Modal */}
      {showMediaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-charcoal/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl p-10 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => {
                if (!isUploading) {
                  setShowMediaModal(false);
                  setSelectedFiles([]);
                  setUploadProgress({});
                  setIsUploading(false);
                }
              }} 
              disabled={isUploading}
              className="absolute top-8 right-8 text-charcoal/20 hover:text-charcoal transition-colors disabled:opacity-20 cursor-pointer"
            >
               <Plus className="w-8 h-8 rotate-45" />
            </button>
            
            <h2 className="text-3xl font-bold mb-2">Upload to {mediaType === 'gallery' ? 'Home Gallery' : 'Portfolio'}</h2>
            <p className="text-sm text-charcoal/40 mb-8 font-medium">
              {mediaType === 'gallery' 
                ? 'Strict Media Policy: Images only. Automatic high-resolution sizing and web compression matches standards.'
                : 'Cinematic layout. Upload stunning project photographs (Images) or walk-throughs (Videos).'}
            </p>

            <form onSubmit={handleAddMedia} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-charcoal/40 tracking-wider">Asset Title (Optional)</label>
                  <input 
                    type="text"
                    placeholder="e.g. Minimalist Master Bed"
                    value={newMedia.title}
                    onChange={(e) => setNewMedia({...newMedia, title: e.target.value})}
                    disabled={isUploading}
                    className="w-full p-3 bg-cream border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre text-xs font-semibold disabled:opacity-50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-charcoal/40 tracking-wider">Category / Tag (Optional)</label>
                  <input 
                    type="text"
                    placeholder="e.g. Living Space, Kitchen"
                    value={newMedia.category}
                    onChange={(e) => setNewMedia({...newMedia, category: e.target.value})}
                    disabled={isUploading}
                    className="w-full p-3 bg-cream border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre text-xs font-semibold disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Seamless input selection controller toggle */}
              <div className="flex justify-between items-center bg-cream/50 p-2 rounded-xl text-xs font-bold">
                <span className="text-charcoal/50 uppercase tracking-widest pl-2">SELECT SOURCE METHOD</span>
                <button
                  type="button"
                  onClick={() => setUseManualUrl(!useManualUrl)}
                  disabled={isUploading}
                  className="px-3.5 py-1.5 bg-white border border-charcoal/10 rounded-lg hover:border-charcoal transition-all text-charcoal text-[11px]"
                >
                  {useManualUrl ? "Switch to Local File Upload" : "Switch to Manual URL Paste"}
                </button>
              </div>

              {useManualUrl ? (
                /* Manual entry */
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase text-charcoal/40 mb-1">Direct Media URL</label>
                  <input 
                    type="url" required
                    placeholder="https://images.unsplash.com/your-image.jpg"
                    value={newMedia.image}
                    onChange={(e) => setNewMedia({...newMedia, image: e.target.value})}
                    disabled={isUploading}
                    className="w-full p-4 bg-cream border border-charcoal/5 rounded-2xl focus:outline-none focus:border-ochre text-sm disabled:opacity-50"
                  />
                  <p className="text-[10px] text-charcoal/40 uppercase font-bold tracking-tight">
                    Ensure this link resolves directly to a raw image or .mp4 video asset.
                  </p>
                </div>
              ) : (
                /* Drag & Drop Bulk Media Upload Area */
                <div className="space-y-4">
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
                        const files = Array.from(e.dataTransfer.files) as File[];
                        // Robust media extension check secondary fallback to prevent browser MIME mismatch
                        const filtered = mediaType === 'gallery' 
                          ? files.filter(isImageFile)
                          : files.filter(f => isImageFile(f) || isVideoFile(f));
                        setSelectedFiles(prev => [...prev, ...filtered]);
                      }
                    }}
                    className={`border-2 border-dashed rounded-[2rem] p-10 text-center transition-all cursor-pointer relative ${
                      dragActive 
                        ? 'border-ochre bg-ochre/5 scale-[1.01] shadow-lg ring-4 ring-ochre/15' 
                        : 'border-charcoal/15 hover:border-ochre/50 bg-cream/10 hover:bg-cream/20'
                    }`}
                    onClick={() => {
                      if (!isUploading) {
                        document.getElementById('multiple-file-picker')?.click();
                      }
                    }}
                  >
                    <input 
                      id="multiple-file-picker"
                      type="file" 
                      multiple 
                      accept={mediaType === 'gallery' ? "image/*" : "image/*,video/*"}
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files) {
                          const files = Array.from(e.target.files) as File[];
                          const filtered = mediaType === 'gallery'
                            ? files.filter(isImageFile)
                            : files.filter(f => isImageFile(f) || isVideoFile(f));
                          setSelectedFiles(prev => [...prev, ...filtered]);
                        }
                      }}
                      disabled={isUploading}
                    />
                    <div className="flex flex-col items-center gap-2 select-none">
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-2 transition-all duration-300 ${
                        dragActive ? 'bg-ochre text-white scale-110 animate-pulse' : 'bg-ochre/10 text-ochre'
                      }`}>
                        <Plus className={`w-7 h-7 transition-all duration-300 ${dragActive ? 'rotate-90 scale-110' : ''}`} />
                      </div>
                      <h4 className="font-bold text-charcoal">
                        {dragActive ? "Drop your cinematic assets now!" : "Drag & drop files here, or click to browse"}
                      </h4>
                      <p className="text-xs text-charcoal/40 font-medium p-1">
                        {mediaType === 'gallery' 
                          ? 'Supports photography assets (JPG, PNG, WebP) up to 50MB'
                          : 'Supports photographs and cinematic walkthrough MP4 videos up to 50MB'}
                      </p>
                    </div>
                  </div>

                  {/* Queued files list display */}
                  {selectedFiles.length > 0 && (
                    <div className="bg-cream/30 border border-charcoal/5 rounded-2xl p-4 max-h-[180px] overflow-y-auto space-y-3">
                      <div className="flex justify-between items-center text-[10px] font-bold text-charcoal/40 tracking-wider uppercase border-b border-charcoal/5 pb-2">
                        <span>Queued Assets ({selectedFiles.length})</span>
                        {!isUploading && (
                          <button 
                            type="button" 
                            onClick={() => setSelectedFiles([])} 
                            className="text-red-500 hover:underline hover:text-red-600 cursor-pointer"
                          >
                            Clear All
                          </button>
                        )}
                      </div>
                      
                      {selectedFiles.map((file, idx) => {
                        const isVideo = file.type.startsWith('video/');
                        const statusObj = uploadProgress[file.name] || { status: 'pending', progress: 0 };
                        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);

                        return (
                          <div key={idx} className="flex items-center justify-between text-xs bg-white p-3 rounded-xl border border-charcoal/5 shadow-sm">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {isVideo ? <Film className="w-4 h-4 text-ochre shrink-0 animate-pulse" /> : <Plus className="w-4 h-4 text-zinc-400 shrink-0" />}
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-charcoal truncate pr-2">{file.name}</p>
                                <span className="text-[10px] text-charcoal/40 uppercase font-bold">{fileSizeMB} MB</span>
                              </div>
                            </div>

                            {/* Status controls */}
                            <div className="flex items-center gap-3 shrink-0 ml-4">
                              {statusObj.status === 'uploading' && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-ochre font-extrabold animate-pulse">UPLOADING...</span>
                                  <div className="w-12 bg-charcoal/5 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-ochre h-full rounded-full transition-all duration-300" style={{ width: `${statusObj.progress}%` }} />
                                  </div>
                                </div>
                              )}
                              {statusObj.status === 'completed' && (
                                <span className="text-[10px] text-green-600 font-extrabold bg-green-50 px-2 py-0.5 rounded-md">COMPLETED</span>
                              )}
                              {statusObj.status === 'failed' && (
                                <div className="flex flex-col items-end gap-1">
                                  <span className="text-[10px] text-red-600 font-extrabold bg-red-50 px-2 py-0.5 rounded-md">FAILED</span>
                                  {statusObj.error && (
                                    <span className="text-[9px] text-red-500 font-medium max-w-[120px] truncate" title={statusObj.error}>
                                      {statusObj.error}
                                    </span>
                                  )}
                                </div>
                              )}
                              {statusObj.status === 'pending' && !isUploading && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                                  className="text-charcoal/30 hover:text-red-500 text-xs font-bold transition-all cursor-pointer"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 border-t border-charcoal/5">
                {uploadError && (
                  <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-xs font-bold mb-4 leading-relaxed">
                    {uploadError}
                  </div>
                )}
                <button 
                  type="submit"
                  disabled={isUploading || (!useManualUrl && selectedFiles.length === 0)}
                  className="w-full bg-ochre disabled:bg-charcoal/10 disabled:text-charcoal/30 text-white font-bold py-5 rounded-3xl hover:bg-ochre/90 transition-all shadow-xl disabled:shadow-none hover:shadow-ochre/15 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isUploading ? (
                    <>
                      <Film className="w-5 h-5 animate-spin mr-1" />
                      Uploading Queue Library...
                    </>
                  ) : (
                    <>
                      Add to Collection Library
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-charcoal/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl relative">
            <button onClick={() => setShowStaffModal(false)} className="absolute top-8 right-8 text-charcoal/20 hover:text-charcoal transition-colors">
               <Plus className="w-8 h-8 rotate-45" />
            </button>
            <h2 className="text-3xl font-bold mb-8">Add Team Member</h2>
            <form onSubmit={handleAddStaff} className="space-y-4">
               <div>
                  <label className="block text-xs font-bold uppercase text-charcoal/40 mb-1">Full Name</label>
                  <input 
                    type="text" required
                    placeholder="Jane Smith"
                    value={newStaff.name}
                    onChange={(e) => setNewStaff({...newStaff, name: e.target.value})}
                    className="w-full p-4 bg-cream border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre"
                  />
               </div>
               <div>
                  <label className="block text-xs font-bold uppercase text-charcoal/40 mb-1">Email Address</label>
                  <input 
                    type="email" required
                    placeholder="jane@pamniminteriors.com"
                    value={newStaff.email}
                    onChange={(e) => setNewStaff({...newStaff, email: e.target.value})}
                    className="w-full p-4 bg-cream border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre"
                  />
               </div>
               <div>
                  <label className="block text-xs font-bold uppercase text-charcoal/40 mb-1">Role Type</label>
                  <select 
                    required
                    value={newStaff.role}
                    onChange={(e) => setNewStaff({...newStaff, role: e.target.value})}
                    className="w-full p-4 bg-cream border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre"
                  >
                    <option value="senior_designer">Senior Designer</option>
                    <option value="designer">Designer</option>
                    <option value="project_manager">Project Manager</option>
                  </select>
               </div>
               <button 
                 type="submit"
                 className="w-full bg-ochre text-white font-bold py-5 rounded-2xl hover:bg-ochre/90 transition-all shadow-xl shadow-ochre/20 mt-4"
               >
                 Create Profile
               </button>
            </form>
          </div>
        </div>
      )}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-charcoal/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl relative">
            <button onClick={() => setShowProjectModal(false)} className="absolute top-8 right-8 text-charcoal/20 hover:text-charcoal transition-colors">
               <Plus className="w-8 h-8 rotate-45" />
            </button>
            <h2 className="text-3xl font-bold mb-8">Start New Project</h2>
            <form onSubmit={handleCreateProject} className="space-y-4">
               <div>
                  <label className="block text-xs font-bold uppercase text-charcoal/40 mb-1">Project Name</label>
                  <input 
                    type="text" required
                    placeholder="E.g. Modern Minimalist Villa"
                    value={newProject.name}
                    onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                    className="w-full p-4 bg-cream border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre"
                  />
               </div>
               <div>
                  <label className="block text-xs font-bold uppercase text-charcoal/40 mb-1">Select Client</label>
                  <select 
                    required
                    value={newProject.clientId}
                    onChange={(e) => setNewProject({...newProject, clientId: e.target.value})}
                    className="w-full p-4 bg-cream border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre"
                  >
                    <option value="">-- Choose Client --</option>
                    {clients.map(c => <option key={c.uid} value={c.uid}>{c.name} ({c.email})</option>)}
                  </select>
               </div>
               <div>
                  <label className="block text-xs font-bold uppercase text-charcoal/40 mb-1">Assign Service Team</label>
                  <div className="grid grid-cols-1 gap-2 mt-2 max-h-40 overflow-y-auto pr-2">
                    {staff.map(s => (
                       <label key={s.uid} className="flex items-center gap-3 p-3 bg-cream rounded-xl cursor-pointer hover:bg-ochre/10 transition-colors">
                          <input 
                            type="checkbox"
                            checked={newProject.employeeIds.includes(s.uid)}
                            onChange={(e) => {
                               const ids = e.target.checked 
                                ? [...newProject.employeeIds, s.uid]
                                : newProject.employeeIds.filter(id => id !== s.uid);
                               setNewProject({...newProject, employeeIds: ids});
                            }}
                            className="w-5 h-5 rounded border-charcoal/10 accent-ochre"
                          />
                          <span className="text-sm font-bold">{s.name} <span className="text-xs font-normal opacity-40">({s.role.replace('_', ' ')})</span></span>
                       </label>
                    ))}
                  </div>
               </div>
               <button 
                 type="submit"
                 className="w-full bg-ochre text-white font-bold py-5 rounded-2xl hover:bg-ochre/90 transition-all shadow-xl shadow-ochre/20 mt-4"
               >
                 Create & Notify Team
               </button>
            </form>
          </div>
        </div>
      )}

      {/* Sub-Service Edit Modal */}
      {selectedSubService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-charcoal/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-10 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setSelectedSubService(null)} 
              className="absolute top-8 right-8 text-charcoal/20 hover:text-charcoal transition-colors cursor-pointer"
            >
              <Plus className="w-8 h-8 rotate-45" />
            </button>
            
            <div className="mb-6">
              <span className="text-[10px] font-bold tracking-[0.2em] text-ochre uppercase block">
                {selectedSubService.categoryTitle}
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-charcoal mt-1">
                Edit {selectedSubService.name} Page
              </h2>
            </div>

            <form onSubmit={handleSaveSubService} className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase text-charcoal/40 mb-2">Service Title</label>
                <input 
                  type="text" 
                  required
                  value={subServiceForm.name}
                  onChange={(e) => setSubServiceForm({ ...subServiceForm, name: e.target.value })}
                  className="w-full p-4 bg-cream border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-charcoal/40 mb-2">Service Description</label>
                <textarea 
                  required
                  rows={3}
                  value={subServiceForm.desc}
                  onChange={(e) => setSubServiceForm({ ...subServiceForm, desc: e.target.value })}
                  className="w-full p-4 bg-cream border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre text-sm leading-relaxed"
                />
              </div>

              {/* Hero Image Section */}
              <div className="border-t border-charcoal/5 pt-6">
                <label className="block text-xs font-bold uppercase text-charcoal/40 mb-3">Hero Image (Full-Width Aspect 21:9)</label>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  {subServiceForm.heroImage ? (
                    <div className="w-40 aspect-[21/9] rounded-xl overflow-hidden border border-charcoal/5 bg-cream relative group">
                      <img src={subServiceForm.heroImage} alt="Hero Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button 
                        type="button"
                        onClick={() => setSubServiceForm({ ...subServiceForm, heroImage: "" })}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="w-40 aspect-[21/9] rounded-xl border border-dashed border-charcoal/10 bg-cream/40 flex items-center justify-center text-charcoal/30">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  )}
                  <input 
                    type="file"
                    accept="image/*"
                    id="hero-image-upload"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadDetailedImage(file, 'hero');
                    }}
                  />
                  <label 
                    htmlFor="hero-image-upload"
                    className="bg-cream hover:bg-ochre/10 hover:text-ochre text-charcoal/70 border border-charcoal/5 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all"
                  >
                    Choose Image File
                  </label>
                </div>
              </div>

              {/* Gallery Images (3 slots) */}
              <div className="border-t border-charcoal/5 pt-6">
                <label className="block text-xs font-bold uppercase text-charcoal/40 mb-3">Project Lookbook Gallery (Max 3 Images)</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {[0, 1, 2].map((idx) => {
                    const imgUrl = subServiceForm.images[idx];
                    return (
                      <div key={idx} className="space-y-2">
                        <span className="text-[10px] font-bold text-charcoal/30 uppercase">Slot {idx + 1}</span>
                        <div className="flex flex-col gap-3 items-start">
                          {imgUrl ? (
                            <div className="w-full aspect-[4/3] rounded-xl overflow-hidden border border-charcoal/5 bg-cream relative group">
                              <img src={imgUrl} alt={`Slot ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              <button 
                                type="button"
                                onClick={() => {
                                  const newImgs = [...subServiceForm.images];
                                  newImgs[idx] = "";
                                  setSubServiceForm({ ...subServiceForm, images: newImgs });
                                }}
                                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <div className="w-full aspect-[4/3] rounded-xl border border-dashed border-charcoal/10 bg-cream/40 flex items-center justify-center text-charcoal/30">
                              <ImageIcon className="w-5 h-5" />
                            </div>
                          )}
                          <input 
                            type="file"
                            accept="image/*"
                            id={`gallery-upload-${idx}`}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadDetailedImage(file, `img${idx}` as any);
                            }}
                          />
                          <label 
                            htmlFor={`gallery-upload-${idx}`}
                            className="w-full text-center bg-cream hover:bg-ochre/10 hover:text-ochre text-charcoal/70 border border-charcoal/5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all"
                          >
                            Upload Photo
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-charcoal/5 pt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedSubService(null)}
                  className="px-6 py-3 border border-charcoal/5 hover:bg-cream text-charcoal text-xs font-bold rounded-xl transition-all uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSubService}
                  className="bg-ochre hover:bg-ochre/90 disabled:bg-charcoal/10 disabled:text-charcoal/30 text-white text-xs font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-ochre/20 uppercase tracking-wider flex items-center gap-2 cursor-pointer"
                >
                  {isSavingSubService ? "Saving Changes..." : "Save Page Assets"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-charcoal/5 flex items-center justify-between">
      <div>
        <p className="text-xs font-bold text-charcoal/40 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-3xl font-bold">{value}</p>
      </div>
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", color)}>
        <Icon className="w-8 h-8" />
      </div>
    </div>
  );
}
