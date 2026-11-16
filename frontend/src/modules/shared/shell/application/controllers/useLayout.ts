import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../../application/context';
import { errorMessage } from '../../../application/error-message';
export function useLayout() {
  const { user, setUser, api, catalogue, showSuccessToast, showErrorToast } = useApp();
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, hash]);
  const [error, setError] = useState('');
  async function logout() {
    try {
      await api.logout();
      setUser(null);
      showSuccessToast('Déconnexion effectuée.');
      navigate('/');
    } catch (e) {
      const message = errorMessage(e);
      setError(message);
      showErrorToast(message);
    }
  }
  return { user, catalogue, error, logout };
}
