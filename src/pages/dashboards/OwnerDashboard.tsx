import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { collection, query, getDocs, doc, setDoc, addDoc, updateDoc, deleteDoc, getDoc, orderBy, where } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { cn } from '../../lib/utils';
import { 
  Plus, Users, Briefcase, Edit2, Trash2, CheckCircle2, Clock, Globe, UserPlus, Mail,
  Home, Palette, LayoutGrid, PaintBucket, RefreshCcw, MessageSquare, HelpCircle, Film
} from 'lucide-react';
import { useCMS } from '../../hooks/useCMS';
import { refineDraftCopy } from '../../services/geminiService';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'services' | 'staff' | 'content' | 'media' | 'inquiries'>('overview');
  const [projects, setProjects] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [gallery, setGallery] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { content } = useCMS();

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
  const [uploadProgress, setUploadProgress] = useState<Record<string, { status: 'pending' | 'uploading' | 'completed' | 'failed'; progress: number; error?: string }>>({});
  const [isUploading, setIsUploading] = useState(false);

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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
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
    const initialProgress: typeof uploadProgress = {};
    selectedFiles.forEach(f => {
      initialProgress[f.name] = { status: 'pending', progress: 0 };
    });
    setUploadProgress(initialProgress);

    try {
      let cloudName = ((import.meta as any).env?.VITE_CLOUDINARY_CLOUD_NAME as string) || 'djwrpottl';
      let preset = ((import.meta as any).env?.VITE_CLOUDINARY_UPLOAD_PRESET as string) || 'pamnim_preset';

      if (cloudName === 'undefined' || !cloudName || preset === 'undefined' || !preset) {
        try {
          const configRes = await fetch('/api/config/cloudinary');
          if (configRes.ok) {
            const configData = await configRes.json();
            if (configData.cloudName && configData.cloudName !== 'undefined') cloudName = configData.cloudName;
            if (configData.uploadPreset && configData.uploadPreset !== 'undefined') preset = configData.uploadPreset;
          }
        } catch (configErr) {
          console.warn("Failed to fetch runtime backend configuration:", configErr);
        }
      }

      // Final fallback if still somehow unresolved
      if (!cloudName || cloudName === 'undefined') cloudName = 'djwrpottl';
      if (!preset || preset === 'undefined') preset = 'pamnim_preset';

      // Seq upload loop to guarantee order and avoid parallel overloading
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const isVideo = file.type.startsWith('video/');

        setUploadProgress(prev => ({
          ...prev,
          [file.name]: { status: 'uploading', progress: 20 }
        }));

        // Convert selected file to base64 data URL
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(file);
        });

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
          throw new Error(`Media upload proxy responded with status ${response.status}: ${await response.text()}`);
        }

        const resData = await response.json();
        let secureUrl = resData.url;
        if (!secureUrl) {
          throw new Error("Media upload proxy failed to return a secure URL");
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
          [file.name]: { status: 'uploading', progress: 90 }
        }));

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
      }

      // Cleanup
      setSelectedFiles([]);
      setNewMedia({ title: '', category: '', image: '' });
      setTimeout(() => {
        setShowMediaModal(false);
        setIsUploading(false);
        setUploadProgress({});
        fetchMedia();
      }, 800);

    } catch (err: any) {
      console.error("Bulk upload error details:", err);
      setIsUploading(false);
      handleFirestoreError(err, OperationType.WRITE, mediaType);
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
      services: cmsServices
    });
    alert('Homepage and contact info updated!');
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
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'services', label: 'Services', icon: LayoutGrid },
    { id: 'staff', label: 'Team', icon: Users },
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
        <div className="space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-charcoal/5">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold">Project Management</h2>
            <button 
              onClick={() => setShowProjectModal(true)}
              className="flex items-center gap-2 bg-ochre text-white px-6 py-2.5 rounded-xl font-bold hover:bg-ochre/90 transition-all"
            >
              <Plus className="w-5 h-5" />
              New Project
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-charcoal/5 text-xs font-bold text-charcoal/40 uppercase tracking-widest">
                  <th className="pb-4 px-4">Project Name</th>
                  <th className="pb-4 px-4">Client</th>
                  <th className="pb-4 px-4">Staff Assigned</th>
                  <th className="pb-4 px-4">Status</th>
                  <th className="pb-4 px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/5">
                {projects.map((project) => (
                  <tr key={project.id} className="group hover:bg-cream transition-colors">
                    <td className="py-5 px-4 font-bold">{project.name}</td>
                    <td className="py-5 px-4 text-sm text-charcoal/60">
                      {clients.find(c => c.uid === project.clientId)?.name || 'N/A'}
                    </td>
                    <td className="py-5 px-4">
                      <div className="flex -space-x-2">
                        {project.employeeIds?.map((eid: string) => (
                          <div key={eid} className="w-8 h-8 rounded-full bg-ochre/10 border-2 border-white flex items-center justify-center text-[10px] font-bold text-ochre tooltip" title={staff.find(s => s.uid === eid)?.name}>
                            {staff.find(s => s.uid === eid)?.name?.charAt(0)}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-5 px-4">
                       <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 font-bold text-xs uppercase">
                        {project.status || 'Active'}
                      </span>
                    </td>
                    <td className="py-5 px-4">
                      <button className="p-2 bg-slate-50 rounded-lg hover:bg-ochre/10 hover:text-ochre">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

      {activeTab === 'staff' && (
        <div className="bg-white rounded-3xl p-8 border border-charcoal/5 shadow-sm">
           <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold">Team Members</h2>
              <button 
                onClick={() => setShowStaffModal(true)}
                className="flex items-center gap-2 bg-charcoal text-white px-6 py-2.5 rounded-xl font-bold hover:bg-black transition-all"
              >
                <UserPlus className="w-5 h-5" />
                Add Member
              </button>
           </div>
           <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {staff.map(member => (
                <div key={member.id} className="p-6 rounded-2xl bg-cream/50 border border-charcoal/5 flex items-center gap-4">
                   <div className="w-12 h-12 bg-ochre/20 rounded-full flex items-center justify-center font-bold text-ochre">
                      {member.name?.charAt(0)}
                   </div>
                   <div>
                      <p className="font-bold">{member.name}</p>
                      <p className="text-xs text-charcoal/40 font-medium uppercase tracking-tight">{member.role.replace('_', ' ')}</p>
                   </div>
                </div>
              ))}
           </div>
        </div>
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
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (isUploading) return;
                      if (e.dataTransfer.files) {
                        const files = Array.from(e.dataTransfer.files) as File[];
                        // Filter out videos if collection is Home Gallery as per media policy
                        const filtered = mediaType === 'gallery' 
                          ? files.filter(f => f.type.startsWith('image/'))
                          : files;
                        setSelectedFiles(prev => [...prev, ...filtered]);
                      }
                    }}
                    className="border-2 border-dashed border-charcoal/15 hover:border-ochre/50 rounded-[2rem] p-8 text-center bg-cream/10 hover:bg-cream/20 transition-all cursor-pointer relative"
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
                          setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                        }
                      }}
                      disabled={isUploading}
                    />
                    <div className="flex flex-col items-center gap-2 select-none">
                      <div className="w-14 h-14 bg-ochre/10 rounded-full flex items-center justify-center text-ochre mb-2">
                        <Plus className="w-7 h-7" />
                      </div>
                      <h4 className="font-bold text-charcoal">Drag & drop files here, or click to browse</h4>
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
