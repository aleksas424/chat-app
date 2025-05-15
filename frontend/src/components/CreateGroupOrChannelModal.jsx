import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

const CreateGroupOrChannelModal = ({ type, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
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

  const toggleUser = (id) => {
    setSelectedUsers(sel => sel.includes(id) ? sel.filter(i => i !== id) : [...sel, id]);
    if (!selectedUsers.includes(id)) setAdmins(admins => admins.filter(a => a !== id));
  };
  const toggleAdmin = (id) => {
    setAdmins(adm => adm.includes(id) ? adm.filter(i => i !== id) : [...adm, id]);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Įveskite pavadinimą');
      return;
    }
    if (selectedUsers.length === 0) {
      setError('Pasirinkite bent vieną narį');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const endpoint = '/api/group';
      const res = await axios.post(
        `${API_URL}${endpoint}`,
        { name, type, members: selectedUsers.map(u => u.id), admins },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onCreated && onCreated(res.data);
      onClose();
    } catch (e) {
      setError('Nepavyko sukurti.');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) &&
    !selectedUsers.some(su => su.id === u.id)
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
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          {type === 'group' ? 'Sukurti grupę' : 'Sukurti kanalą'}
        </h3>
        <input
          type="text"
          className="w-full mb-3 px-4 py-2 rounded bg-white/60 dark:bg-slate-800/80 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Pavadinimas..."
          value={name}
          onChange={e => setName(e.target.value)}
          aria-label="Pavadinimas"
        />
        <input
          type="text"
          className="w-full mb-2 px-4 py-2 rounded bg-white/60 dark:bg-slate-800/80 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Ieškoti narių..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Ieškoti narių"
        />
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
        {selectedUsers.length > 0 && (
          <div className="flex flex-col gap-2 mb-2">
            {selectedUsers.map(u => (
              <div key={u.id} className="flex items-center gap-2 bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 rounded-full px-2 py-1 text-xs">
                {u.name}
                <button onClick={() => setSelectedUsers(selectedUsers.filter(su => su.id !== u.id))} className="ml-1 text-xs" aria-label={`Pašalinti narį ${u.name}`}>×</button>
                <label className="flex items-center gap-1 ml-2">
                  <input
                    type="checkbox"
                    checked={admins.includes(u.id)}
                    onChange={() => toggleAdmin(u.id)}
                    className="accent-blue-600"
                    aria-label={`Padaryti adminu: ${u.name}`}
                  />
                  <span>Administratorius</span>
                </label>
              </div>
            ))}
          </div>
        )}
        {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
        <button
          className="w-full py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          onClick={handleCreate}
          disabled={loading || !name.trim() || selectedUsers.length === 0}
          aria-disabled={loading || !name.trim() || selectedUsers.length === 0}
        >
          {loading ? 'Kuriama...' : (type === 'group' ? 'Sukurti grupę' : 'Sukurti kanalą')}
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

export default CreateGroupOrChannelModal; 