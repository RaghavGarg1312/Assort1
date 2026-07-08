'use client';
import { useState, useEffect } from 'react';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  editingUser?: any;
}

export default function InviteUserModal({ onClose, onSuccess, editingUser }: Props) {
  const [form, setForm] = useState({ 
    email: editingUser?.email || '', 
    name: editingUser?.name || '', 
    roleId: editingUser?.role?.id || editingUser?.roleId || '', 
    departmentId: editingUser?.department?.id || editingUser?.departmentId || '', 
    managerId: editingUser?.manager?.id || editingUser?.managerId || '', 
    customManagerName: editingUser?.customManagerName || '' 
  });
  const [departments, setDepartments] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Re-sync form state once reference data is fully loaded
  useEffect(() => {
    if (editingUser) {
      setForm(prev => {
        let newRoleId = prev.roleId;
        if (!newRoleId && editingUser.role?.name) {
          const matchedRole = roles.find(r => r.name === editingUser.role.name);
          if (matchedRole) newRoleId = matchedRole.id;
        }

        let newDeptId = prev.departmentId;
        if (!newDeptId && editingUser.department?.name) {
          const matchedDept = departments.find(d => d.name === editingUser.department.name);
          if (matchedDept) newDeptId = matchedDept.id;
        }

        let newManagerId = prev.managerId;
        if (editingUser.customManagerName) {
          newManagerId = 'OTHER';
        } else if (!newManagerId && editingUser.manager?.name) {
          const matchedManager = managers.find(m => m.name === editingUser.manager.name);
          if (matchedManager) newManagerId = matchedManager.id;
        }

        return {
          ...prev,
          roleId: newRoleId || prev.roleId,
          departmentId: newDeptId || prev.departmentId,
          managerId: newManagerId || prev.managerId,
          customManagerName: editingUser.customManagerName || prev.customManagerName
        };
      });
    }
  }, [editingUser, roles, departments, managers]);

  useEffect(() => {
    fetch('/api/departments').then(r => r.json()).then(data => {
      setDepartments(Array.isArray(data) ? data : (data?.departments || []));
    }).catch(() => setDepartments([]));
    
    fetch('/api/roles').then(r => r.json()).then(data => {
       const fetchedRoles = Array.isArray(data) ? data : [];
       setRoles(fetchedRoles);
    }).catch(() => setRoles([]));

    fetch('/api/users').then(r => r.json()).then(data => {
      const fetchedUsers = Array.isArray(data) ? data : (data?.users || []);
      setManagers(fetchedUsers);
    }).catch(() => setManagers([]));
  }, []);

  const handleInvite = async () => {
    if (!form.email || !form.name) { setError('Name and email are required'); return; }
    if (!form.roleId) { setError('Role is required'); return; }
    setLoading(true);
    setError('');
    try {
      const body: any = {
        email: form.email,
        name: form.name,
        roleId: form.roleId,
      };
      if (form.departmentId) body.departmentId = form.departmentId;
      if (form.managerId && form.managerId !== 'OTHER') body.managerId = form.managerId;
      if (form.managerId === 'OTHER' && form.customManagerName) body.customManagerName = form.customManagerName;
      const method = editingUser ? 'PATCH' : 'POST';
      const endpoint = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${editingUser ? 'update' : 'add'} user`);
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedRole = Array.isArray(roles) ? roles.find(r => r.id === form.roleId) : undefined;
  const availableManagers = Array.isArray(managers) && selectedRole && form.departmentId 
    ? managers.filter(u => 
        u.departmentId === form.departmentId && 
        u.role && u.role.level < selectedRole.level && 
        u.baseLevel !== 'ADMIN'
      ) 
    : [];

  return (
    <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
      <div style={{backgroundColor:'white',borderRadius:'12px',boxShadow:'0 20px 60px rgba(0,0,0,0.3)',width:'100%',maxWidth:'480px',margin:'0 16px',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 24px',borderBottom:'1px solid #c3c6d7'}}>
          <h3 style={{fontSize:'18px',fontWeight:700,color:'#131b2e',margin:0}}>{editingUser ? 'Edit User' : 'Add User'}</h3>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'#434655'}}>
            <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
          </button>
        </div>
        <div style={{padding:'24px',display:'flex',flexDirection:'column',gap:'16px'}}>
          {error && (
            <div style={{padding:'12px',backgroundColor:'#fef2f2',color:'#b91c1c',fontSize:'14px',borderRadius:'8px',border:'1px solid #fecaca'}}>{error}</div>
          )}
          <div>
            <label style={{display:'block',fontSize:'14px',fontWeight:600,color:'#131b2e',marginBottom:'4px'}}>Full Name *</label>
            <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Rahul Sharma"
              style={{width:'100%',padding:'8px 12px',backgroundColor:'#f2f3ff',border:'1px solid #c3c6d7',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box'}} />
          </div>
          <div>
            <label style={{display:'block',fontSize:'14px',fontWeight:600,color:'#131b2e',marginBottom:'4px'}}>Email Address *</label>
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="rahul@company.com"
              style={{width:'100%',padding:'8px 12px',backgroundColor:'#f2f3ff',border:'1px solid #c3c6d7',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box'}} />
          </div>
          <div>
            <label style={{display:'block',fontSize:'14px',fontWeight:600,color:'#131b2e',marginBottom:'4px'}}>Role *</label>
            <select value={form.roleId} onChange={e => setForm({...form, roleId: e.target.value})}
              style={{width:'100%',padding:'8px 12px',backgroundColor:'#f2f3ff',border:'1px solid #c3c6d7',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box',cursor:'pointer'}}>
              <option value="" disabled>Select a role...</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name} (Level: {r.level})</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{display:'block',fontSize:'14px',fontWeight:600,color:'#131b2e',marginBottom:'4px'}}>Department</label>
            <select value={form.departmentId} onChange={e => setForm({...form, departmentId: e.target.value})}
              style={{width:'100%',padding:'8px 12px',backgroundColor:'#f2f3ff',border:'1px solid #c3c6d7',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box',cursor:'pointer'}}>
              <option value="">No Department</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{display:'block',fontSize:'14px',fontWeight:600,color:'#131b2e',marginBottom:'4px'}}>Managed By</label>
            {form.managerId === 'OTHER' ? (
              <div style={{display:'flex',gap:'8px'}}>
                <input type="text" value={form.customManagerName} onChange={e => setForm({...form, customManagerName: e.target.value})} placeholder="Type manager name..."
                  style={{flex:1,padding:'8px 12px',backgroundColor:'#f2f3ff',border:'1px solid #c3c6d7',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box'}} />
                <button onClick={() => setForm({...form, managerId: '', customManagerName: ''})}
                  style={{padding:'0 12px',backgroundColor:'#fef2f2',border:'1px solid #fecaca',color:'#b91c1c',borderRadius:'8px',cursor:'pointer',fontSize:'14px',fontWeight:600}}>
                  ✕
                </button>
              </div>
            ) : (
              <select value={form.managerId} onChange={e => setForm({...form, managerId: e.target.value, customManagerName: e.target.value === 'OTHER' ? form.customManagerName : ''})}
                style={{width:'100%',padding:'8px 12px',backgroundColor:'#f2f3ff',border:'1px solid #c3c6d7',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box',cursor:'pointer'}}>
                {!form.departmentId ? (
                  <option value="">Select a department first...</option>
                ) : (
                  <>
                    <option value="">No Manager</option>
                    {availableManagers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role?.name})</option>)}
                    <option value="OTHER">Other (type manually)...</option>
                  </>
                )}
              </select>
            )}
          </div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:'12px',paddingTop:'8px'}}>
            <button onClick={onClose} disabled={loading} style={{padding:'10px 16px',borderRadius:'8px',border:'1px solid #c3c6d7',backgroundColor:'white',color:'#131b2e',fontSize:'14px',fontWeight:500,cursor:'pointer'}}>
              Cancel
            </button>
            <button onClick={handleInvite} disabled={loading || !form.email || !form.name || !form.roleId} style={{padding:'10px 16px',borderRadius:'8px',border:'none',backgroundColor:'#2563EB',color:'white',fontSize:'14px',fontWeight:500,cursor:'pointer',opacity:(loading||!form.email||!form.name||!form.roleId)?0.6:1}}>
              {loading ? (editingUser ? 'Saving...' : 'Sending...') : (editingUser ? 'Save Changes' : 'Add User')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
