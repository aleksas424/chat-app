import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

const AddMemberModal = ({ chatId, onClose, onAdded, existingMembers = [] }) => {
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/api/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(res.data);
      } catch {
        setUsers([]);
      }
    };
    fetchUsers();
  }, []);

  const handleAdd = async () => {
    if (selectedUsers.length === 0) {
      setError('Pasirinkite bent vieną narį');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      let atLeastOne = false;
      for (const u of selectedUsers) {
        try {
          await axios.post(
            `${API_URL}/api/group/${chatId}/members`,
            { userId: u.id },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          atLeastOne = true;
        } catch (err) {
          if (err.response && err.response.data && err.response.data.message) {
            setError(err.response.data.message);
          } else {
            setError('Nepavyko pridėti narių.');
          }
        }
      }
      if (atLeastOne) {
        onAdded && onAdded();
        onClose();
        return;
      }
      setError('Nepavyko pridėti narių.');
    } finally {
      setLoading(false);
    }
  };

  const existingIds = existingMembers.map(m => m.id);
  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) &&
    !selectedUsers.some(su => su.id === u.id) &&
    !existingIds.includes(u.id)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="relative bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6 w-full max-w-sm">
        <button
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl font-bold focus:outline-none"
          onClick={onClose}
          aria-label="Uždaryti"
        >
          ×
        </button>
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Pridėti narius</h3>
        <input
          type="text"
          className="w-full mb-2 px-4 py-2 rounded bg-white/60 dark:bg-slate-800/80 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Ieškoti narių..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Ieškoti narių"
        />
        {selectedUsers.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedUsers.map(u => (
              <span key={u.id} className="flex items-center gap-1 px-2 py-1 bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 rounded-full text-xs">
                {u.name}
                <button onClick={() => setSelectedUsers(selectedUsers.filter(su => su.id !== u.id))} className="ml-1 text-xs" aria-label={`Pašalinti narį ${u.name}`}>×</button>
              </span>
            ))}
          </div>
        )}
        <div className="max-h-32 overflow-y-auto mb-2">
          {filteredUsers.map(u => (
            <div
              key={u.id}
              className="flex items-center gap-2 px-2 py-1 hover:bg-blue-100 dark:hover:bg-slate-700 rounded cursor-pointer"
              onClick={() => setSelectedUsers([...selectedUsers, u])}
              tabIndex={0}
              aria-label={`Pridėti narį ${u.name}`}
            >
              <span className="w-8 h-8 flex items-center justify-center rounded-full bg-primary-400 text-white font-bold">
                {u.name[0].toUpperCase()}
              </span>
              <span className="text-gray-900 dark:text-white">{u.name}</span>
            </div>
          ))}
        </div>
        {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
        <button
          className="w-full py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          onClick={handleAdd}
          disabled={loading || selectedUsers.length === 0}
          aria-disabled={loading || selectedUsers.length === 0}
        >
          {loading ? 'Pridedama...' : 'Pridėti'}
        </button>
        <button
          className="mt-3 w-full py-2 rounded bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium hover:bg-gray-400 dark:hover:bg-gray-600"
          onClick={onClose}
        >
          Atšaukti
        </button>
      </div>
    </div>
  );
};

export default AddMemberModal; 