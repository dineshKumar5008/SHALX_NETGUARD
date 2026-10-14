import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { User, UserRole, RegistrationRequest } from '../types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { 
  Users as UsersIcon, Plus, RefreshCw, UserCheck, Shield, Key, Trash2, Edit, 
  AlertCircle, Clock, CheckCircle2, XCircle, FileText, UserPlus, Check, X, ShieldAlert
} from 'lucide-react';

export const Users: React.FC = () => {
  const { user: currentUser, canReviewRegistrations } = useAuth();
  
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'users' | 'pending' | 'history'>('users');

  // Users State
  const [users, setUsers] = useState<User[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState<boolean>(true);

  // Registration Requests State
  const [pendingRequests, setPendingRequests] = useState<RegistrationRequest[]>([]);
  const [allRequests, setAllRequests] = useState<RegistrationRequest[]>([]);
  const [isRequestsLoading, setIsRequestsLoading] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);

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

  // Review Registration Request Modal state
  const [isReviewOpen, setIsReviewOpen] = useState<boolean>(false);
  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequest | null>(null);
  const [assignedRole, setAssignedRole] = useState<UserRole>('VIEWER');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isRejectingStep, setIsRejectingStep] = useState<boolean>(false);
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);
  const [reviewError, setReviewError] = useState<string>('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string>('');

  const fetchUsers = async () => {
    setIsUsersLoading(true);
    try {
      const res = await apiClient.get('/users');
      setUsers(res.data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsUsersLoading(false);
    }
  };

  const fetchRegistrationRequests = async () => {
    if (!canReviewRegistrations) return;
    setIsRequestsLoading(true);
    try {
      const [pendingRes, allRes, countRes] = await Promise.all([
        apiClient.get('/users/registration-requests?status=PENDING'),
        apiClient.get('/users/registration-requests'),
        apiClient.get('/users/registration-requests/count'),
      ]);
      setPendingRequests(pendingRes.data || []);
      setAllRequests(allRes.data || []);
      setPendingCount(countRes.data?.pending_count || 0);
    } catch (err) {
      console.error('Failed to load registration requests:', err);
    } finally {
      setIsRequestsLoading(false);
    }
  };

  const refreshAll = () => {
    fetchUsers();
    if (canReviewRegistrations) {
      fetchRegistrationRequests();
    }
  };

  useEffect(() => {
    refreshAll();
  }, [canReviewRegistrations]);

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

  const handleOpenReview = (req: RegistrationRequest) => {
    setSelectedRequest(req);
    setAssignedRole((req.requested_role as UserRole) || 'VIEWER');
    setRejectionReason('');
    setIsRejectingStep(false);
    setReviewError('');
    setIsReviewOpen(true);
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

  const handleApproveRequest = async () => {
    if (!selectedRequest) return;
    setReviewError('');
    setIsProcessingAction(true);
    try {
      await apiClient.post(`/users/registration-requests/${selectedRequest.id}/approve`, {
        role: assignedRole,
      });
      setIsReviewOpen(false);
      setActionSuccessMsg(`Registration for ${selectedRequest.username} approved with role ${assignedRole}.`);
      setTimeout(() => setActionSuccessMsg(''), 5000);
      refreshAll();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setReviewError(typeof detail === 'string' ? detail : 'Failed to approve registration request.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRejectRequest = async () => {
    if (!selectedRequest) return;
    if (!rejectionReason.trim()) {
      setReviewError('A non-empty rejection reason is required.');
      return;
    }
    setReviewError('');
    setIsProcessingAction(true);
    try {
      await apiClient.post(`/users/registration-requests/${selectedRequest.id}/reject`, {
        rejection_reason: rejectionReason.trim(),
      });
      setIsReviewOpen(false);
      setActionSuccessMsg(`Registration request for ${selectedRequest.username} has been rejected.`);
      setTimeout(() => setActionSuccessMsg(''), 5000);
      refreshAll();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setReviewError(typeof detail === 'string' ? detail : 'Failed to reject registration request.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight flex items-center gap-2.5">
            <UsersIcon className="w-5 h-5 text-blue-600" />
            <span>Role-Based Access Control & Operators</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Operator identities and self-registration request approval pipeline (ADMIN, SENIOR_ANALYST, ANALYST, VIEWER)
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {currentUser?.role === 'ADMIN' && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenCreate}
              icon={<Plus size={13} />}
            >
              Create Operator Account
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={refreshAll} icon={<RefreshCw size={13} />}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {actionSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2.5 text-xs text-emerald-800 shadow-xs">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
            activeTab === 'users'
              ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <UserCheck size={14} />
          <span>Active Operators ({users.length})</span>
        </button>

        {canReviewRegistrations && (
          <>
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition relative ${
                activeTab === 'pending'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Clock size={14} />
              <span>Pending Requests</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-mono font-bold rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'history'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText size={14} />
              <span>Request History ({allRequests.length})</span>
            </button>
          </>
        )}
      </div>

      {/* TAB 1: Active Operators Table */}
      {activeTab === 'users' && (
        <Card title="Registered SOC Operators & Roles" subtitle="Active analyst profiles and permission tiers">
          {isUsersLoading ? (
            <LoadingSpinner message="Querying operator accounts..." />
          ) : (
            <div className="overflow-x-auto">
              <table className="soc-table w-full text-left text-xs">
                <thead>
                  <tr>
                    <th>Operator Name</th>
                    <th>Username</th>
                    <th>Registered MFA Email</th>
                    <th>Assigned Role</th>
                    <th>Account Status</th>
                    <th>Last Login (UTC)</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 font-semibold text-slate-800 font-sans">{u.full_name}</td>
                      <td className="py-3 text-blue-600 font-bold font-mono">{u.username}</td>
                      <td className="py-3 text-slate-600 font-mono">
                        {u.email ? (
                          <span>{u.email}</span>
                        ) : (
                          <span className="text-amber-600 italic font-sans">Unconfigured</span>
                        )}
                      </td>
                      <td className="py-3">
                        <Badge variant={
                          u.role === 'ADMIN' ? 'critical' : 
                          u.role === 'SENIOR_ANALYST' ? 'warning' :
                          u.role === 'ANALYST' ? 'medium' : 'cyan'
                        }>
                          {u.role}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <Badge variant={u.is_active ? 'online' : 'offline'}>
                          {u.is_active ? 'ACTIVE' : 'SUSPENDED'}
                        </Badge>
                      </td>
                      <td className="py-3 text-slate-500 font-mono">
                        {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never logged in'}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {currentUser?.role === 'ADMIN' && (
                            <button
                              onClick={() => handleOpenEdit(u)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
                              title="Edit User / MFA Email"
                            >
                              <Edit size={14} />
                            </button>
                          )}
                          {currentUser?.role === 'ADMIN' && u.id !== currentUser?.id && (
                            <button
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                              title="Delete User"
                            >
                              <Trash2 size={14} />
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
      )}

      {/* TAB 2: Pending Registration Requests */}
      {activeTab === 'pending' && canReviewRegistrations && (
        <Card title="Pending Registration Requests" subtitle="Access applications requiring authorization">
          {isRequestsLoading ? (
            <LoadingSpinner message="Loading pending registration requests..." />
          ) : pendingRequests.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs font-sans">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2 opacity-80" />
              <p className="font-semibold text-slate-800">No Pending Requests</p>
              <p className="text-[11px] text-slate-500 mt-1">All applicant self-registration requests have been processed.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="soc-table w-full text-left text-xs">
                <thead>
                  <tr>
                    <th>Applicant Name</th>
                    <th>Username</th>
                    <th>Email Address</th>
                    <th>Department</th>
                    <th>Reason for Access</th>
                    <th>Submitted (UTC)</th>
                    <th>Status</th>
                    <th className="text-right">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 font-semibold text-slate-800 font-sans">{req.full_name}</td>
                      <td className="py-3 text-blue-600 font-bold font-mono">{req.username}</td>
                      <td className="py-3 text-slate-600 font-mono">{req.email}</td>
                      <td className="py-3 text-slate-700 font-sans">{req.department}</td>
                      <td className="py-3 text-slate-600 max-w-xs truncate font-sans" title={req.reason}>
                        {req.reason}
                      </td>
                      <td className="py-3 text-slate-500 font-mono">
                        {new Date(req.created_at).toLocaleString()}
                      </td>
                      <td className="py-3">
                        <Badge variant="warning">PENDING</Badge>
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenReview(req)}
                          icon={<Shield size={13} />}
                        >
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: Request History */}
      {activeTab === 'history' && canReviewRegistrations && (
        <Card title="Registration Requests Audit History" subtitle="Archive of evaluated access requests">
          {isRequestsLoading ? (
            <LoadingSpinner message="Loading registration request history..." />
          ) : allRequests.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs font-sans">
              <p>No registration requests recorded.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="soc-table w-full text-left text-xs">
                <thead>
                  <tr>
                    <th>Applicant Name</th>
                    <th>Username</th>
                    <th>Email Address</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Assigned Role</th>
                    <th>Reviewed By</th>
                    <th className="text-right">Review Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 font-semibold text-slate-800 font-sans">{req.full_name}</td>
                      <td className="py-3 text-blue-600 font-bold font-mono">{req.username}</td>
                      <td className="py-3 text-slate-600 font-mono">{req.email}</td>
                      <td className="py-3 text-slate-600 font-sans">{req.department}</td>
                      <td className="py-3">
                        <Badge variant={
                          req.status === 'APPROVED' ? 'online' : 
                          req.status === 'REJECTED' ? 'critical' : 'warning'
                        }>
                          {req.status}
                        </Badge>
                      </td>
                      <td className="py-3 text-slate-700 font-mono">
                        {req.status === 'APPROVED' ? req.requested_role : '—'}
                      </td>
                      <td className="py-3 text-slate-500 font-mono">
                        {req.reviewed_by || '—'}
                      </td>
                      <td className="py-3 text-right text-slate-500 font-mono">
                        {req.reviewed_at ? new Date(req.reviewed_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Review Request Modal (Approve / Reject) */}
      <Modal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        title={`Review Registration Request #${selectedRequest?.id} (${selectedRequest?.username})`}
      >
        {selectedRequest && (
          <div className="space-y-4 text-xs font-mono">
            {reviewError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{reviewError}</span>
              </div>
            )}

            {/* Applicant Details */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase block font-semibold">Applicant Name</span>
                  <span className="text-slate-800 font-sans font-medium">{selectedRequest.full_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase block font-semibold">Username</span>
                  <span className="text-blue-600 font-bold">{selectedRequest.username}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase block font-semibold">Registered Email</span>
                  <span className="text-slate-700">{selectedRequest.email}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase block font-semibold">Department</span>
                  <span className="text-slate-700 font-sans">{selectedRequest.department}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-500 text-[10px] uppercase block mb-1 font-semibold">Reason for Access</span>
                <p className="text-slate-700 font-sans leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200">
                  {selectedRequest.reason}
                </p>
              </div>

              <div className="pt-1 text-[11px] text-slate-500 flex justify-between">
                <span>Submitted: {new Date(selectedRequest.created_at).toLocaleString()} UTC</span>
                <span>Current Status: <b className="text-amber-600">{selectedRequest.status}</b></span>
              </div>
            </div>

            {/* Step 1: Default Review View (Approve or Reject Choice) */}
            {!isRejectingStep ? (
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-slate-700 mb-1.5 uppercase font-semibold text-[11px]">
                    Assign RBAC Role Upon Approval
                  </label>
                  <select
                    value={assignedRole}
                    onChange={(e) => setAssignedRole(e.target.value as UserRole)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-xs"
                  >
                    <option value="VIEWER">VIEWER (Read-Only SOC Access - Recommended Default)</option>
                    <option value="ANALYST">ANALYST (Triage, Alerts, &amp; IP Blocking)</option>
                    <option value="SENIOR_ANALYST">SENIOR_ANALYST (Review Requests, Policy &amp; Incidents)</option>
                    {currentUser?.role === 'ADMIN' && (
                      <option value="ADMIN">ADMIN (Full Administrative Control)</option>
                    )}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    The approved user will receive an activation email and must verify with dynamic MFA OTP on login.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => setIsRejectingStep(true)}
                    disabled={isProcessingAction}
                    icon={<X size={14} />}
                  >
                    Reject Request...
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsReviewOpen(false)}
                      disabled={isProcessingAction}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleApproveRequest}
                      isLoading={isProcessingAction}
                      icon={<Check size={14} />}
                    >
                      Approve &amp; Activate
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              /* Step 2: Rejection Reason Input */
              <div className="space-y-3 pt-2 bg-rose-50/60 p-3.5 rounded-xl border border-rose-200">
                <label className="block text-rose-800 font-bold uppercase text-[11px]">
                  Reason for Rejection <span className="text-rose-600">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Provide an explanation for rejecting this request (this will be emailed to the applicant)..."
                  className="w-full bg-white border border-rose-300 rounded-lg p-2.5 text-slate-800 outline-none placeholder-slate-400 resize-none font-sans text-xs focus:ring-2 focus:ring-rose-400/20 focus:border-rose-600 shadow-xs"
                />

                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRejectingStep(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 transition"
                  >
                    &larr; Back to Approval
                  </button>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsReviewOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={handleRejectRequest}
                      isLoading={isProcessingAction}
                    >
                      Confirm Rejection
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Create User Modal (Manual admin creation) */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Operator Account"
      >
        <form onSubmit={handleCreateUser} className="space-y-4 text-xs font-mono">
          {createError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-rose-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
              <span>{createError}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-700 mb-1 uppercase font-semibold text-[11px]">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Alex Rivera"
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 font-sans shadow-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 mb-1 uppercase font-semibold text-[11px]">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. arivera"
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-xs"
              />
            </div>
            <div>
              <label className="block text-slate-700 mb-1 uppercase font-semibold text-[11px]">Registered MFA Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@company.com"
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-xs"
              />
              <p className="text-[10px] text-slate-500 mt-1 font-sans">MFA OTPs will be delivered to this inbox.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 mb-1 uppercase font-semibold text-[11px]">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-xs"
              />
            </div>
            <div>
              <label className="block text-slate-700 mb-1 uppercase font-semibold text-[11px]">RBAC Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-xs"
              >
                <option value="VIEWER">VIEWER (Read-Only)</option>
                <option value="ANALYST">ANALYST (Triage &amp; Block)</option>
                <option value="SENIOR_ANALYST">SENIOR_ANALYST (Review Requests)</option>
                <option value="ADMIN">ADMIN (Full Control)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
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
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-rose-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
              <span>{editError}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-700 mb-1 uppercase font-semibold text-[11px]">Full Name</label>
            <input
              type="text"
              required
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 font-sans shadow-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 mb-1 uppercase font-semibold text-[11px]">Registered MFA Email</label>
              <input
                type="email"
                required
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="operator@company.com"
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-xs"
              />
              <p className="text-[10px] text-slate-500 mt-1 font-sans">Updates the destination address for login OTPs.</p>
            </div>
            <div>
              <label className="block text-slate-700 mb-1 uppercase font-semibold text-[11px]">RBAC Role</label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-xs"
              >
                <option value="VIEWER">VIEWER (Read-Only)</option>
                <option value="ANALYST">ANALYST (Triage &amp; Block)</option>
                <option value="SENIOR_ANALYST">SENIOR_ANALYST (Review Requests)</option>
                <option value="ADMIN">ADMIN (Full Control)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 mb-1 uppercase font-semibold text-[11px]">New Password (Optional)</label>
              <input
                type="password"
                minLength={8}
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Leave blank to preserve current"
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-xs"
              />
            </div>
            <div>
              <label className="block text-slate-700 mb-1 uppercase font-semibold text-[11px]">Account Status</label>
              <select
                value={editActive ? 'active' : 'suspended'}
                onChange={(e) => setEditActive(e.target.value === 'active')}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-xs"
              >
                <option value="active">Active (Can Login)</option>
                <option value="suspended">Suspended (Deactivated)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
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
