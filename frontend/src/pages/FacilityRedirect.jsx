import { Navigate, useParams } from 'react-router-dom';

export default function FacilityRedirect() {
  const { id } = useParams();
  return <Navigate to={`/map/${id}`} replace />;
}
