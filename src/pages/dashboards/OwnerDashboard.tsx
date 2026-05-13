import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { collection, query, getDocs, doc, setDoc, addDoc, updateDoc, deleteDoc, getDoc, orderBy, where } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { cn } from '../../lib/utils';
import { Plus, Users, Briefcase, Edit2, Trash2, CheckCircle2, Clock, Globe, UserPlus, Mail } from 'lucide-react';
import { useCMS } from '../../hooks/useCMS';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'staff' | 'content' | 'media' | 'inquiries'>('overview');
  const [projects, setProjects] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [gallery, setGallery] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { content } = useCMS();

  // Media state
  const [mediaType, setMediaType] = useState<'gallery' | 'portfolio'>('gallery');
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [newMedia, setNewMedia] = useState({ title: '', category: '', image: '' });

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

  const fetchMedia = async () => {
    const gallerySnap = await getDocs(query(collection(db, 'gallery'), orderBy('createdAt', 'desc')));
    setGallery(gallerySnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    const portfolioSnap = await getDocs(query(collection(db, 'portfolio'), orderBy('createdAt', 'desc')));
    setPortfolio(portfolioSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const handleAddMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, mediaType), {
        ...newMedia,
        createdAt: new Date().toISOString()
      });
      setNewMedia({ title: '', category: '', image: '' });
      setShowMediaModal(false);
      fetchMedia();
    } catch (err) {
      console.error(err);
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
      contact: cmsContact
    });
    alert('Homepage and contact info updated!');
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
                    onClick={() => setMediaType('portfolio')}
                    className={cn("px-4 py-1.5 rounded-lg text-sm font-bold transition-all", mediaType === 'portfolio' ? "bg-ochre text-white" : "bg-cream text-charcoal/40")}
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
              {(mediaType === 'gallery' ? gallery : portfolio).map(item => (
                <div key={item.id} className="group relative aspect-square rounded-2xl overflow-hidden bg-cream border border-charcoal/5">
                   <img src={item.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                   <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-4">
                      <div className="flex justify-end">
                        <button 
                          onClick={() => handleDeleteMedia(item.id, mediaType)}
                          className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-white">
                        <p className="text-xs font-bold uppercase text-ochre tracking-widest">{item.category}</p>
                        <p className="font-bold truncate text-sm">{item.title}</p>
                      </div>
                   </div>
                </div>
              ))}
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
                   <label className="block text-xs font-bold uppercase text-charcoal/40 mb-2">Main Headline</label>
                   <textarea 
                     rows={3}
                     value={cmsHero.title}
                     onChange={(e) => setCmsHero({...cmsHero, title: e.target.value})}
                     className="w-full p-4 bg-cream border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre"
                   />
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
                   <label className="block text-xs font-bold uppercase text-charcoal/40 mb-2">Sub-headline Description</label>
                   <textarea 
                     rows={4}
                     value={cmsHero.subheadline}
                     onChange={(e) => setCmsHero({...cmsHero, subheadline: e.target.value})}
                     className="w-full p-4 bg-cream border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre"
                   />
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

      {/* Media Modal */}
      {showMediaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-charcoal/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl relative">
            <button onClick={() => setShowMediaModal(false)} className="absolute top-8 right-8 text-charcoal/20 hover:text-charcoal transition-colors">
               <Plus className="w-8 h-8 rotate-45" />
            </button>
            <h2 className="text-3xl font-bold mb-8">Add to {mediaType}</h2>
            <form onSubmit={handleAddMedia} className="space-y-4">
               <div>
                  <label className="block text-xs font-bold uppercase text-charcoal/40 mb-1">Title</label>
                  <input 
                    type="text" required
                    placeholder="E.g. Modern Living Room"
                    value={newMedia.title}
                    onChange={(e) => setNewMedia({...newMedia, title: e.target.value})}
                    className="w-full p-4 bg-cream border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre"
                  />
               </div>
               <div>
                  <label className="block text-xs font-bold uppercase text-charcoal/40 mb-1">Category</label>
                  <input 
                    type="text" required
                    placeholder="E.g. Interior Design"
                    value={newMedia.category}
                    onChange={(e) => setNewMedia({...newMedia, category: e.target.value})}
                    className="w-full p-4 bg-cream border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre"
                  />
               </div>
               <div>
                  <label className="block text-xs font-bold uppercase text-charcoal/40 mb-1">Image URL</label>
                  <input 
                    type="url" required
                    placeholder="https://..."
                    value={newMedia.image}
                    onChange={(e) => setNewMedia({...newMedia, image: e.target.value})}
                    className="w-full p-4 bg-cream border border-charcoal/5 rounded-xl focus:outline-none focus:border-ochre"
                  />
                  <p className="text-[10px] text-charcoal/40 mt-1 uppercase font-bold tracking-tight">Upload your image to a service and paste the direct link here.</p>
               </div>
               <button 
                 type="submit"
                 className="w-full bg-ochre text-white font-bold py-5 rounded-2xl hover:bg-ochre/90 transition-all shadow-xl shadow-ochre/20 mt-4"
               >
                 Add to Library
               </button>
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
                    placeholder="jane@pamnim.com"
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
