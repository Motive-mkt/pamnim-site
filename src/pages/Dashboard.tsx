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

  switch (profile.role) {
    case 'owner':
      return <OwnerDashboard />;
    case 'client':
      return <ClientPortal />;
    default:
      return <EmployeeDashboard />;
  }
}
