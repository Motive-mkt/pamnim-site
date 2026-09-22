export interface TourStep {
  id: string;
  type: 'welcome' | 'hotspot' | 'interactive_demo' | 'completion';
  title: string;
  description: string;
  targetSelector?: string; // CSS selector for hotspot positioning
  highlightTab?: string;
  badge?: string;
  demoData?: {
    type: 'project_approval' | 'cash_flow_preview' | 'worker_log_preview' | 'invoice_preview';
    sampleTitle: string;
    sampleDescription: string;
    sampleDetails: Record<string, string>;
    actionLabel: string;
    successMessage: string;
  };
}

export interface RoleTourConfig {
  role: 'client' | 'worker' | 'employee' | 'elevated_employee';
  roleLabel: string;
  welcomeIntro: string;
  personalizationQuestions?: {
    id: string;
    question: string;
    options: string[];
  }[];
  steps: TourStep[];
}

export const TOURS_CONFIG: Record<string, RoleTourConfig> = {
  client: {
    role: 'client',
    roleLabel: 'Client Portal',
    welcomeIntro: 'Welcome to your private Pamnim Client Portal. Here you can track your handcrafted interior design project, review verified payment receipts, and collaborate directly with our design leads.',
    personalizationQuestions: [
      {
        id: 'primaryInterest',
        question: 'What is your primary design project focus?',
        options: [
          'Full Residential Interior',
          'Modern Kitchen & Joinery',
          'Executive Commercial Space',
          'Bespoke Gypsum & Lighting'
        ]
      }
    ],
    steps: [
      {
        id: 'welcome',
        type: 'welcome',
        title: 'Welcome to Pamnim Interior Designers',
        description: 'Take a 60-second guided tour of your portal. You will see how your 4-stage milestones work, how to monitor your consolidated cash flow, and how to chat with your designers.',
        badge: 'Client Onboarding'
      },
      {
        id: 'step_tracker',
        type: 'hotspot',
        title: '4-Stage Milestone Tracking',
        description: 'Each of your projects is tracked through 4 distinct artisan milestones: Concept & Moodboards, Detailed CAD & Joinery, On-Site Craftsmanship, and Final Handover.',
        targetSelector: '#nav-item-tracker',
        highlightTab: 'tracker',
        badge: 'Stage Tracking'
      },
      {
        id: 'step_cashflow',
        type: 'hotspot',
        title: 'Consolidated Cash Flow Ledger',
        description: 'Under the new Cash Flow tab, review every payment, deposit, and M-Pesa transaction recorded across all your projects and invoices with downloadable statements.',
        targetSelector: '#nav-item-cashflow',
        highlightTab: 'cashflow',
        badge: 'Financial Transparency'
      },
      {
        id: 'step_chat',
        type: 'hotspot',
        title: 'Direct Chat with Design Leads',
        description: 'Send messages directly to the designers handling your home. You can tag specific project milestones for rapid contextual feedback.',
        targetSelector: '#nav-item-chat',
        highlightTab: 'chat',
        badge: 'Direct Messaging'
      },
      {
        id: 'step_interactive_demo',
        type: 'interactive_demo',
        title: 'Try the Interactive Demo Sandbox',
        description: 'Practice reviewing a milestone before touching your real projects. Below is pre-filled sample data for a demo Penthouse renovation.',
        badge: 'Safe Sandbox',
        demoData: {
          type: 'project_approval',
          sampleTitle: 'Demo Project: Kilimani Modern Penthouse',
          sampleDescription: 'Stage 2: Custom Walnut TV Wall & Gypsum Ceiling Detail',
          sampleDetails: {
            'Status': 'Awaiting Client Review',
            'Estimated Budget': 'KES 850,000',
            'Craftsman Lead': 'Chief Joinery Artisan',
            '3D Render Ready': 'Yes (4 High-Res Shots)'
          },
          actionLabel: 'Simulate Stage Approval',
          successMessage: 'Great job! In your real project, approving a stage notifies your design lead and updates your progress bar instantly.'
        }
      },
      {
        id: 'step_completion',
        type: 'completion',
        title: 'You are all set!',
        description: 'Your portal is ready. Whenever you make payments or our craftsmen upload new site progress photos, you will find them right here.',
        badge: 'Ready to Start'
      }
    ]
  },

  worker: {
    role: 'worker',
    roleLabel: 'Site Operations Portal',
    welcomeIntro: 'Welcome to the Pamnim Site Operations Portal. Keep track of your daily attendance, log extra on-site work, and review weekly wage settlements.',
    steps: [
      {
        id: 'welcome',
        type: 'welcome',
        title: 'Welcome to Site Operations',
        description: 'Let us guide you through submitting daily logs, tracking site attendance, and reviewing your weekly M-Pesa wage payouts.',
        badge: 'Artisan Onboarding'
      },
      {
        id: 'step_daily_logs',
        type: 'hotspot',
        title: 'Daily Attendance & Work Logs',
        description: 'Submit your daily site attendance and work summaries to ensure accurate records for your daily wage calculations.',
        targetSelector: '#worker-nav-logs',
        badge: 'Attendance'
      },
      {
        id: 'step_settlements',
        type: 'hotspot',
        title: 'Weekly Payout Settlements',
        description: 'Review your total approved days, bonus allowances for extra work, and scheduled weekly payouts.',
        targetSelector: '#worker-nav-settlement',
        badge: 'Wage Ledger'
      },
      {
        id: 'step_interactive_demo',
        type: 'interactive_demo',
        title: 'Try Submitting a Sample Work Log',
        description: 'Practice logging work using pre-filled sample site data to see how approvals work.',
        badge: 'Sample Submission',
        demoData: {
          type: 'worker_log_preview',
          sampleTitle: 'Site: Lavington Residence Villa 4',
          sampleDescription: 'Gypsum board installation & edge sanding (Level 2)',
          sampleDetails: {
            'Date': 'Today',
            'Assigned Skill': 'Gypsum Craftsman',
            'Hours Logged': 'Full Day (8 hrs)',
            'Supervisor': 'Site Foreman'
          },
          actionLabel: 'Submit Sample Log',
          successMessage: 'Log simulated! Once submitted in real life, your site foreman approves it and your wage balance updates automatically.'
        }
      },
      {
        id: 'step_completion',
        type: 'completion',
        title: 'Ready for the Field!',
        description: 'You can now log your real site attendance and submit extra work requests whenever you are on site.',
        badge: 'Ready'
      }
    ]
  },

  employee: {
    role: 'employee',
    roleLabel: 'Staff & Designer Portal',
    welcomeIntro: 'Welcome to the Pamnim Design Team Portal. Manage ongoing customer projects, draft official quotes and invoices, and supervise client milestones.',
    steps: [
      {
        id: 'welcome',
        type: 'welcome',
        title: 'Welcome to Pamnim Design Team',
        description: 'Here is a quick walkthrough of your workflow: tracking projects, updating milestone photos, creating official invoices, and managing HRMS operations.',
        badge: 'Staff Onboarding'
      },
      {
        id: 'step_projects',
        type: 'hotspot',
        title: 'Project Management & Media',
        description: 'Update 4-stage artisan milestones, upload high-resolution site progress photos, and post designer notes for your clients.',
        targetSelector: '#nav-item-projects, #employee-nav-projects',
        badge: 'Project Tracking'
      },
      {
        id: 'step_invoices',
        type: 'hotspot',
        title: 'Unified Invoice Generator',
        description: 'Generate official PDF invoices with a single "Create Invoice" click that automatically archives the document and synchronizes payments.',
        targetSelector: '#nav-item-quick-actions, #employee-nav-invoices',
        badge: 'Billing & Invoices'
      },
      {
        id: 'step_operations',
        type: 'hotspot',
        title: 'Inquiries Filter & HRMS Worker Sign-Up',
        description: 'Quickly filter customer inquiries by date presets (Today, 7D, 30D, Custom) and share the dedicated worker registration link (/signup/worker) with on-site artisans.',
        targetSelector: '#nav-item-hrms, #nav-item-inquiries',
        badge: 'Operations & HRMS'
      },
      {
        id: 'step_interactive_demo',
        type: 'interactive_demo',
        title: 'Try Generating a Sample Milestone',
        description: 'Practice creating a sample milestone update to see how real-time client notifications work.',
        badge: 'Interactive Demo',
        demoData: {
          type: 'invoice_preview',
          sampleTitle: 'Project: Runda Estate Master Suite',
          sampleDescription: 'Stage 3: Joinery Installation & Painting',
          sampleDetails: {
            'Client': 'Dr. Kamau',
            'Stage Progress': '75% Complete',
            'Photos Attached': '3 Site Photos',
            'Next Step': 'Final Electrical Fittings'
          },
          actionLabel: 'Simulate Milestone Update',
          successMessage: 'Milestone updated! In the live dashboard, this updates the client portal instantly and logs your name as the updater.'
        }
      },
      {
        id: 'step_completion',
        type: 'completion',
        title: 'Welcome Aboard!',
        description: 'You are ready to manage client projects, generate invoices, and collaborate with our on-site teams.',
        badge: 'Ready'
      }
    ]
  }
};
