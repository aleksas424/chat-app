import { useState, useEffect } from 'react';
import axios from 'axios';
import { getApiUrl } from '../config';
import { useAuth } from '../contexts/AuthContext';

export default function AddMemberModal({ isOpen, onClose, onAddMember, existingMembers }) {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get(`${getApiUrl()}api/users`);
        // Filter out current user and existing members
        const filteredUsers = response.data.filter(u => 
          u.id !== user.id && !existingMembers.some(m => m.id === u.id)
        );
        setUsers(filteredUsers);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen, user.id, existingMembers]);

  const handleAddMember = async (userId) => {
    setIsLoading(true);
    try {
      await onAddMember(userId);
      onClose();
    } catch (error) {
      console.error('Error adding member:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Add Member</h2>

        {/* Search input */}
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-2 border rounded mb-4"
        />

        {/* User list */}
        <div className="max-h-60 overflow-y-auto mb-4">
          {filteredUsers.map(user => (
            <div
              key={user.id}
              className="flex items-center p-2 hover:bg-gray-100 cursor-pointer"
              onClick={() => handleAddMember(user.id)}
            >
              <div>
                <div className="font-semibold">{user.name}</div>
                <div className="text-sm text-gray-500">{user.email}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
} 