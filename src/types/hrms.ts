export type WorkerSkill = 
  | 'Carpenter' 
  | 'Gypsum & Ceiling Installer' 
  | 'Painter & Finisher' 
  | 'Electrician' 
  | 'Plumber' 
  | 'Mason & Tiler' 
  | 'Welder & Fabricator' 
  | 'Upholsterer' 
  | 'Casual & Helper' 
  | 'Site Supervisor';

export type WorkerStatus = 'active' | 'on_leave' | 'inactive';

export interface Worker {
  id?: string;
  name: string;
  phone: string;
  idNumber?: string;
  skill: WorkerSkill;
  dailyRate: number; // KES
  status: WorkerStatus;
  notes?: string;
  assignedProjectId?: string;
  assignedProjectName?: string;
  createdAt: string;
  updatedAt?: string;
}

export type WorkDuration = 'full_day' | 'half_day' | 'overtime';

export interface WorkLog {
  id?: string;
  workerId: string;
  workerName: string;
  workerSkill?: string;
  projectId?: string;
  projectName?: string;
  date: string;
  duration: WorkDuration; // full_day = 1, half_day = 0.5, overtime = 1.5
  wageDue: number; // calculated from dailyRate * multiplier
  tasksDone: string;
  status: 'logged' | 'approved' | 'paid';
  recordedBy: string;
  createdAt: string;
}

export interface WorkerPayment {
  id?: string;
  workerId: string;
  workerName: string;
  projectId?: string;
  projectName?: string;
  amount: number; // KES
  paymentMethod: 'M-Pesa' | 'Cash' | 'Bank Transfer';
  referenceCode?: string;
  date: string;
  notes?: string;
  recordedBy: string;
  createdAt: string;
}
