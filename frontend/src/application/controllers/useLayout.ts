import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context';
import { errorMessage } from '../error-message';
export function useLayout() {
  const { user, setUser, api, catalogue } = useApp();
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
      navigate('/');
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return { user, catalogue, error, logout };
}
