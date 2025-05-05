import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getApiUrl } from '../config';
import { useAuth } from '../contexts/AuthContext';

export default function CreateGroupOrChannelModal({ isOpen, onClose, onCreatePrivate, onCreateGroup }) {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get(`${getApiUrl()}api/users`);
        const filteredUsers = response.data.filter(u => u.id !== user.id);
        setUsers(filteredUsers);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen, user.id]);

  const handleUserSelect = (userId) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      }
      return [...prev, userId];
    });
  };

  const handleCreatePrivate = async (userId) => {
    setIsLoading(true);
    try {
      await onCreatePrivate(userId);
      onClose();
    } catch (error) {
      console.error('Error creating private chat:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;

    setIsLoading(true);
    try {
      await onCreateGroup(groupName.trim(), selectedUsers);
      onClose();
    } catch (error) {
      console.error('Error creating group chat:', error);
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
        <h2 className="text-2xl font-bold mb-4">Create New Chat</h2>

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
              onClick={() => handleUserSelect(user.id)}
            >
              <input
                type="checkbox"
                checked={selectedUsers.includes(user.id)}
                onChange={() => {}}
                className="mr-2"
              />
              <div>
                <div className="font-semibold">{user.name}</div>
                <div className="text-sm text-gray-500">{user.email}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Group name input */}
        <input
          type="text"
          placeholder="Group name (for group chat)"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          className="w-full p-2 border rounded mb-4"
        />

        {/* Action buttons */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
            disabled={isLoading}
          >
            Cancel
          </button>
          {selectedUsers.length === 1 ? (
            <button
              onClick={() => handleCreatePrivate(selectedUsers[0])}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Private Chat'}
            </button>
          ) : (
            <button
              onClick={handleCreateGroup}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              disabled={isLoading || !groupName.trim() || selectedUsers.length === 0}
            >
              {isLoading ? 'Creating...' : 'Create Group Chat'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
} 