'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Shell from '@/components/layout/Shell';
import InviteUserModal from '@/components/modals/InviteUserModal';

interface UserItem {
  id: string;
  name: string;
  email: string;
  designation: string;
  department: { name: string } | null;
  baseLevel: string;
  status: string;
  manager: { name: string } | null;
  role: { name: string } | null;
  avatarUrl: string | null;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);

  const openInviteModal = () => {
    setEditingUser(null);
    setIsInviteOpen(true);
  };

  const openEditModal = (u: UserItem) => {
    setEditingUser(u);
    setIsInviteOpen(true);
  };

  const fetchUsers = () => {
    setLoading(true);
    fetch('/api/users')
      .then(r => r.json())
      .then(data => setUsers(data.users || data || []))
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <Shell>
      <div className="px-lg py-xl">
        <div className="flex justify-between items-end mb-xl">
          <div>
            <h2 className="font-h1 text-h1 text-on-surface">User Management</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">Manage employee access, roles, and organizational hierarchy.</p>
          </div>
          <div className="flex gap-md">
            <Link href="/admin/users/bulk-upload" className="flex items-center gap-sm px-md py-2.5 bg-surface-container-lowest border border-outline-variant text-primary font-semibold rounded-lg hover:bg-surface-container-low transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor" className="text-[20px]"><path d="M440-320v-326L336-542l-56-58 200-200 200 200-56 58-104-104v326h-80ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/></svg>
              <span className="font-label-md text-label-md">Bulk Upload</span>
            </Link>
            <button onClick={openInviteModal} className="flex items-center gap-sm px-lg py-2.5 bg-primary-container text-white font-semibold rounded-lg hover:shadow-lg active:scale-95 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor" className="text-[20px]"><path d="M720-400v-120H600v-80h120v-120h80v120h120v80H800v120h-80ZM247-527q-47-47-47-113t47-113q47-47 113-47t113 47q47 47 47 113t-47 113q-47 47-113 47t-113-47ZM40-160v-112q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v112H40Zm80-80h480v-32q0-11-5.5-20T580-306q-54-27-109-40.5T360-360q-56 0-111 13.5T140-306q-9 5-14.5 14t-5.5 20v32Zm296.5-343.5Q440-607 440-640t-23.5-56.5Q393-720 360-720t-56.5 23.5Q280-673 280-640t23.5 56.5Q327-560 360-560t56.5-23.5ZM360-640Zm0 400Z"/></svg>
              <span className="font-label-md text-label-md">Invite User</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-md mb-lg">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex flex-col gap-xs shadow-sm">
            <label className="font-label-sm text-label-sm text-on-surface-variant px-1 uppercase tracking-wider">Department</label>
            <select className="bg-transparent border-none focus:ring-0 text-on-surface font-body-md cursor-pointer">
              <option>All Departments</option>
            </select>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex flex-col gap-xs shadow-sm">
            <label className="font-label-sm text-label-sm text-on-surface-variant px-1 uppercase tracking-wider">Role</label>
            <select className="bg-transparent border-none focus:ring-0 text-on-surface font-body-md cursor-pointer">
              <option>All Levels</option>
            </select>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex flex-col gap-xs shadow-sm">
            <label className="font-label-sm text-label-sm text-on-surface-variant px-1 uppercase tracking-wider">Status</label>
            <select className="bg-transparent border-none focus:ring-0 text-on-surface font-body-md cursor-pointer">
              <option>All Statuses</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="w-full flex items-center justify-center gap-sm px-md py-3.5 text-on-surface-variant font-label-md hover:bg-surface-container-high rounded-xl transition-all border border-transparent hover:border-outline-variant">
              <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M400-240v-80h160v80H400ZM240-440v-80h480v80H240ZM120-640v-80h720v80H120Z"/></svg>
              Clear All Filters
            </button>
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse h-64 bg-surface-container-low rounded-xl"></div>
        ) : (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant">Name</th>
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant">Designation</th>
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant">Department</th>
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant">Role</th>
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant">Status</th>
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant">Manager</th>
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-surface-container-low transition-colors group">
                      <td className="px-lg py-md">
                        <div className="flex items-center gap-md">
                          {u.avatarUrl ? (
                             <img src={u.avatarUrl} alt="Avatar" className="w-10 h-10 rounded-full border border-outline-variant shadow-sm object-cover" />
                          ) : (
                             <div className="w-10 h-10 rounded-full bg-surface-container-high border border-outline-variant shadow-sm flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M367-527q-47-47-47-113t47-113q47-47 113-47t113 47q47 47 47 113t-47 113q-47 47-113 47t-113-47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Zm80-80h480v-32q0-11-5.5-20T700-306q-54-27-109-40.5T480-360q-56 0-111 13.5T260-306q-9 5-14.5 14t-5.5 20v32Zm296.5-343.5Q560-607 560-640t-23.5-56.5Q513-720 480-720t-56.5 23.5Q400-673 400-640t23.5 56.5Q447-560 480-560t56.5-23.5ZM480-640Zm0 400Z"/></svg>
                             </div>
                          )}
                          <div>
                            <div className="font-label-md text-label-md text-on-surface">{u.name}</div>
                            <div className="font-body-sm text-body-sm text-on-surface-variant">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-lg py-md font-body-md text-body-md text-on-surface">{u.designation || '-'}</td>
                      <td className="px-lg py-md font-body-md text-body-md text-on-surface">{u.department?.name || '-'}</td>
                      <td className="px-lg py-md">
                        <span className="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm">{u.role?.name || u.baseLevel || '-'}</span>
                      </td>
                      <td className="px-lg py-md">
                        <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm w-fit ${
                           u.status === 'ACTIVE' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : 'bg-error-container text-on-error-container'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'ACTIVE' ? 'bg-tertiary' : 'bg-error'}`}></span>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-lg py-md font-body-md text-body-md text-on-surface">{u.manager?.name || 'Self'}</td>
                      <td className="px-lg py-md text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEditModal(u)} className="p-2 text-outline hover:text-primary hover:bg-primary-fixed rounded-lg transition-all">
                            <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor" className="text-[20px]"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>
                          </button>
                          <button className="p-2 text-outline hover:text-error hover:bg-error-container rounded-lg transition-all">
                            <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor" className="text-[20px]"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                     <tr>
                       <td colSpan={7} className="px-lg py-xl text-center text-on-surface-variant">No users found.</td>
                     </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="bg-surface px-lg py-md border-t border-outline-variant flex items-center justify-between">
              <span className="font-body-sm text-body-sm text-on-surface-variant">Showing all {users.length} employees</span>
            </div>
          </div>
        )}
      </div>
      
      {isInviteOpen && (
        <InviteUserModal onClose={() => setIsInviteOpen(false)} onSuccess={() => { setIsInviteOpen(false); fetchUsers(); }} editingUser={editingUser} />
      )}
    </Shell>
  );
}
