import { useAuth } from '../hooks/useAuth';
import OwnerDashboard from './dashboards/OwnerDashboard';
import EmployeeDashboard from './dashboards/EmployeeDashboard';
import ClientPortal from './dashboards/ClientPortal';
import { Navigate } from 'react-router-dom';

export default function Dashboard() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-ochre/20 rounded-full mb-4"></div>
          <div className="h-4 w-32 bg-ochre/20 rounded"></div>
        </div>
      </div>
    );
  }

  if (!profile) return <Navigate to="/login" />;

  if (profile.role === 'pending') {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-6">
        <div className="bg-white max-w-md w-full p-8 rounded-3xl border border-charcoal/10 shadow-xl text-center space-y-4">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <span className="text-2xl font-bold">⏳</span>
          </div>
          <h2 className="text-2xl font-bold text-charcoal">Request Pending Review</h2>
          <p className="text-sm text-charcoal/70 leading-relaxed">
            Your account request is currently under review by our team. Once approved, you will receive an access notification via WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  switch (profile.role) {
    case 'owner':
      return <OwnerDashboard />;
    case 'client':
      return <ClientPortal />;
    default:
      return <EmployeeDashboard />;
  }
}
