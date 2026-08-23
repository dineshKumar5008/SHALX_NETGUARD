import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { User, UserRole } from '../types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { 
  Users as UsersIcon, Plus, RefreshCw, UserCheck, Shield, Key, Trash2, Edit, AlertCircle 
} from 'lucide-react';

export const Users: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Create User Modal state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<UserRole>('ANALYST');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string>('');

  // Edit User Modal state
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editUsername, setEditUsername] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editFullName, setEditFullName] = useState<string>('');
  const [editRole, setEditRole] = useState<UserRole>('ANALYST');
  const [editActive, setEditActive] = useState<boolean>(true);
  const [editPassword, setEditPassword] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [editError, setEditError] = useState<string>('');

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenCreate = () => {
    setUsername('');
    setEmail('');
    setFullName('');
    setPassword('');
    setRole('ANALYST');
    setCreateError('');
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUserId(user.id);
    setEditUsername(user.username);
    setEditEmail(user.email || '');
    setEditFullName(user.full_name || '');
    setEditRole(user.role);
    setEditActive(user.is_active);
    setEditPassword('');
    setEditError('');
    setIsEditOpen(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setIsCreating(true);
    try {
      await apiClient.post('/users', {
        username: username.trim(),
        email: email.trim(),
        full_name: fullName.trim(),
        password,
        role,
        is_active: true,
      });
      setIsCreateOpen(false);
      fetchUsers();
    } catch (err: any) {
      console.error('Failed to create user:', err);
      const detail = err.response?.data?.detail;
      setCreateError(typeof detail === 'string' ? detail : 'Please enter a valid email address.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId) return;
    setEditError('');
    setIsUpdating(true);
    try {
      const payload: any = {
        email: editEmail.trim(),
        full_name: editFullName.trim(),
        role: editRole,
        is_active: editActive,
      };
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }
      await apiClient.put(`/users/${editingUserId}`, payload);
      setIsEditOpen(false);
      fetchUsers();
    } catch (err: any) {
      console.error('Failed to update user:', err);
      const detail = err.response?.data?.detail;
      setEditError(typeof detail === 'string' ? detail : 'Please enter a valid email address.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteUser = async (userId: number, uname: string) => {
    if (userId === currentUser?.id) {
      alert('Cannot delete own administrator account.');
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete user ${uname}?`)) return;
    try {
      await apiClient.delete(`/users/${userId}`);
      fetchUsers();
    } catch (err) {
      console.error('Delete user error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2.5">
            <UsersIcon className="w-5 h-5 text-cyan-400" />
            <span>ROLE-BASED USER ACCESS MANAGEMENT</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Operator Accounts & Registered MFA Destination Emails (ADMIN, ANALYST, VIEWER)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreate}
            icon={<Plus size={13} />}
          >
            Create Operator Account
          </Button>
          <Button variant="secondary" size="sm" onClick={fetchUsers} icon={<RefreshCw size={13} />}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <Card title="Registered SOC Operators & Roles">
        {isLoading ? (
          <LoadingSpinner message="Querying Operator Accounts..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-slate-400 border-b border-[#1e293b]">
                <tr>
                  <th className="pb-3">Operator Name</th>
                  <th className="pb-3">Username</th>
                  <th className="pb-3">Registered MFA Email</th>
                  <th className="pb-3">Assigned Role</th>
                  <th className="pb-3">Account Status</th>
                  <th className="pb-3">Last Login (UTC)</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-900/60 transition">
                    <td className="py-3 font-semibold text-slate-100">{u.full_name}</td>
                    <td className="py-3 text-cyan-400 font-bold">{u.username}</td>
                    <td className="py-3 text-slate-300">
                      {u.email ? (
                        <span className="text-sky-300">{u.email}</span>
                      ) : (
                        <span className="text-amber-400/80 italic">Unconfigured</span>
                      )}
                    </td>
                    <td className="py-3">
                      <Badge variant={u.role === 'ADMIN' ? 'critical' : u.role === 'ANALYST' ? 'medium' : 'cyan'}>
                        {u.role}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <Badge variant={u.is_active ? 'online' : 'offline'}>
                        {u.is_active ? 'ACTIVE' : 'SUSPENDED'}
                      </Badge>
                    </td>
                    <td className="py-3 text-slate-400">
                      {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never logged in'}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="p-1 text-slate-400 hover:text-cyan-400 rounded transition"
                          title="Edit User / MFA Email"
                        >
                          <Edit size={15} />
                        </button>
                        {u.id !== currentUser?.id && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.username)}
                            className="p-1 text-slate-400 hover:text-rose-400 rounded transition"
                            title="Delete User"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create User Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Operator Account"
      >
        <form onSubmit={handleCreateUser} className="space-y-4 text-xs font-mono">
          {createError && (
            <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-lg flex items-start gap-2.5 text-rose-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{createError}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-300 mb-1 uppercase font-semibold">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Alex Rivera"
              className="w-full bg-[#0a0d14] border border-[#1e293b] rounded-lg p-2.5 text-slate-100 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 mb-1 uppercase font-semibold">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. arivera"
                className="w-full bg-[#0a0d14] border border-[#1e293b] rounded-lg p-2.5 text-slate-100 outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1 uppercase font-semibold">Registered MFA Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@gmail.com"
                className="w-full bg-[#0a0d14] border border-[#1e293b] rounded-lg p-2.5 text-slate-100 outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">MFA OTPs will be delivered to this real inbox.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 mb-1 uppercase font-semibold">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#0a0d14] border border-[#1e293b] rounded-lg p-2.5 text-slate-100 outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1 uppercase font-semibold">RBAC Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full bg-[#0a0d14] border border-[#1e293b] rounded-lg p-2.5 text-slate-100 outline-none"
              >
                <option value="ANALYST">ANALYST (Triage & Block)</option>
                <option value="VIEWER">VIEWER (Read-Only)</option>
                <option value="ADMIN">ADMIN (Full Control)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isCreating}>
              Create Operator
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Edit Operator Account (${editUsername})`}
      >
        <form onSubmit={handleUpdateUser} className="space-y-4 text-xs font-mono">
          {editError && (
            <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-lg flex items-start gap-2.5 text-rose-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{editError}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-300 mb-1 uppercase font-semibold">Full Name</label>
            <input
              type="text"
              required
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
              className="w-full bg-[#0a0d14] border border-[#1e293b] rounded-lg p-2.5 text-slate-100 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 mb-1 uppercase font-semibold">Registered MFA Email</label>
              <input
                type="email"
                required
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="operator@gmail.com"
                className="w-full bg-[#0a0d14] border border-[#1e293b] rounded-lg p-2.5 text-slate-100 outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">Updates the destination address for login OTPs.</p>
            </div>
            <div>
              <label className="block text-slate-300 mb-1 uppercase font-semibold">RBAC Role</label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
                className="w-full bg-[#0a0d14] border border-[#1e293b] rounded-lg p-2.5 text-slate-100 outline-none"
              >
                <option value="ANALYST">ANALYST (Triage & Block)</option>
                <option value="VIEWER">VIEWER (Read-Only)</option>
                <option value="ADMIN">ADMIN (Full Control)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 mb-1 uppercase font-semibold">New Password (Leave blank to keep current)</label>
              <input
                type="password"
                minLength={8}
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Leave blank to preserve current"
                className="w-full bg-[#0a0d14] border border-[#1e293b] rounded-lg p-2.5 text-slate-100 outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1 uppercase font-semibold">Account Status</label>
              <select
                value={editActive ? 'active' : 'suspended'}
                onChange={(e) => setEditActive(e.target.value === 'active')}
                className="w-full bg-[#0a0d14] border border-[#1e293b] rounded-lg p-2.5 text-slate-100 outline-none"
              >
                <option value="active">Active (Can Login)</option>
                <option value="suspended">Suspended (Deactivated)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isUpdating}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
