import { Navigate } from 'react-router-dom';
import { authStorage } from '../../app/auth/api';

interface Props {
  children: React.ReactNode;
}

export default function ProtectedAdminRoute({ children }: Props) {
  const token = authStorage.getToken();
  const user = authStorage.getUser();

  if (!token || !user || user.role !== 'Admin') {
    return <Navigate to="/editor" replace />;
  }

  return <>{children}</>;
}
