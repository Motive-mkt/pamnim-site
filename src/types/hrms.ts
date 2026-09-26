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
  userId?: string; // Links to auth UID if self-signed up
  name: string;
  mpesaName?: string; // M-Pesa Registered Name (FULL CAPS)
  phone: string; // Registered on M-Pesa
  idNumber?: string;
  email?: string;
  skill: WorkerSkill;
  payFrequency?: 'daily' | 'weekly'; // Daily rate or fixed weekly wage budget
  dailyRate: number; // KES per day worked (for daily pay frequency)
  weeklyBudget?: number; // KES fixed weekly budget (for weekly pay frequency)
  payoutMethod?: 'M-Pesa' | 'Bank Transfer';
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
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
  duration: WorkDuration;
  wageDue: number;
  tasksDone: string;
  status: 'logged' | 'approved' | 'paid';
  recordedBy: string;
  createdAt: string;
}

export type AttendanceStatus = 
  | 'present_full' 
  | 'present_half' 
  | 'absent' 
  | 'approved_leave' 
  | 'holiday' 
  | 'present' 
  | 'leave';

export interface AttendanceRecord {
  id?: string;
  workerId: string;
  workerName: string;
  workerSkill?: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  dayMultiplier?: number; // 1.0 for full/leave/holiday, 0.5 for half, 0 for absent
  dailyRate: number; // Saved snapshot of rate at the time of attendance
  wageDue: number; // calculated day earnings
  weekId: string; // e.g. "2026-W38"
  projectId?: string;
  projectName?: string;
  notes?: string;
  recordedBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface WorkerPayment {
  id?: string;
  workerId: string;
  workerName: string;
  projectId?: string;
  projectName?: string;
  amount: number; // KES
  paymentMethod: 'M-Pesa' | 'Cash' | 'Bank Transfer';
  type?: 'extra' | 'settlement' | 'wage' | 'advance'; // extra = advance (deducted from week wage); settlement = payment of net due
  referenceCode?: string; // OPTIONAL - never block saving without one
  date: string; // YYYY-MM-DD
  weekId?: string; // e.g. "2026-W38"
  notes?: string;
  recordedBy: string;
  createdAt: string;
}

export interface LeaveRequest {
  id?: string;
  workerId: string;
  workerName: string;
  workerPhone?: string;
  dates: string[]; // List of YYYY-MM-DD strings
  reason: string;
  status: 'pending' | 'approved' | 'declined';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
}

export interface ExtraRequest {
  id?: string;
  workerId: string;
  workerName: string;
  workerPhone?: string;
  amount: number; // Requested amount (KES)
  approvedAmount?: number; // Owner can adjust the approved amount
  reason: string;
  date: string; // YYYY-MM-DD
  weekId?: string;
  status: 'pending' | 'approved' | 'declined';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
}

export interface PublicHoliday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  isCustom?: boolean; // true if added by owner
}

export interface HRMSSettings {
  workDays: string[]; // e.g. ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  customHolidays: PublicHoliday[];
  removedHolidays?: string[]; // holiday IDs that owner removed
}

