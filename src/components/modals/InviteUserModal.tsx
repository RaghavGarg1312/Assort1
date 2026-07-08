'use client';
import { useState, useEffect } from 'react';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function InviteUserModal({ onClose, onSuccess }: Props) {
  const [form, setForm] = useState({ email: '', name: '', roleId: '', departmentId: '', managerId: '', designation: '' });
  const [departments, setDepartments] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/departments').then(r => r.json()).then(data => {
      setDepartments(Array.isArray(data) ? data : (data?.departments || []));
    }).catch(() => setDepartments([]));
    
    fetch('/api/roles').then(r => r.json()).then(data => {
       const fetchedRoles = Array.isArray(data) ? data : [];
       setRoles(fetchedRoles);
       if (fetchedRoles.length > 0) {
          setForm(f => ({ ...f, roleId: fetchedRoles[0].id }));
       }
    }).catch(() => setRoles([]));

    fetch('/api/users?baseLevel=MANAGER').then(r => r.json()).then(data => {
      setManagers(Array.isArray(data) ? data : (data?.users || []));
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
      if (form.managerId) body.managerId = form.managerId;
      if (form.designation) body.designation = form.designation;
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add user');
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedRole = Array.isArray(roles) ? roles.find(r => r.id === form.roleId) : undefined;

  return (
    <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
      <div style={{backgroundColor:'white',borderRadius:'12px',boxShadow:'0 20px 60px rgba(0,0,0,0.3)',width:'100%',maxWidth:'480px',margin:'0 16px',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 24px',borderBottom:'1px solid #c3c6d7'}}>
          <h3 style={{fontSize:'18px',fontWeight:700,color:'#131b2e',margin:0}}>Add User</h3>
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
            <label style={{display:'block',fontSize:'14px',fontWeight:600,color:'#131b2e',marginBottom:'4px'}}>Designation <span style={{color:'#434655',fontWeight:400}}>(Optional)</span></label>
            <input type="text" value={form.designation || ''} onChange={e => setForm({...form, designation: e.target.value})} placeholder="e.g. Senior Engineer, Team Lead, Analyst"
              style={{width:'100%',padding:'8px 12px',backgroundColor:'#f2f3ff',border:'1px solid #c3c6d7',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box'}} />
          </div>
          <div>
            <label style={{display:'block',fontSize:'14px',fontWeight:600,color:'#131b2e',marginBottom:'4px'}}>Department</label>
            <select value={form.departmentId} onChange={e => setForm({...form, departmentId: e.target.value})}
              style={{width:'100%',padding:'8px 12px',backgroundColor:'#f2f3ff',border:'1px solid #c3c6d7',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box',cursor:'pointer'}}>
              <option value="">No Department</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          {selectedRole?.baseLevel === 'MEMBER' && (
            <div>
              <label style={{display:'block',fontSize:'14px',fontWeight:600,color:'#131b2e',marginBottom:'4px'}}>Manager</label>
              <select value={form.managerId} onChange={e => setForm({...form, managerId: e.target.value})}
                style={{width:'100%',padding:'8px 12px',backgroundColor:'#f2f3ff',border:'1px solid #c3c6d7',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box',cursor:'pointer'}}>
                <option value="">No Manager</option>
                {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}
          <div style={{display:'flex',justifyContent:'flex-end',gap:'12px',paddingTop:'8px'}}>
            <button onClick={onClose} disabled={loading} style={{padding:'10px 16px',borderRadius:'8px',border:'1px solid #c3c6d7',backgroundColor:'white',color:'#131b2e',fontSize:'14px',fontWeight:500,cursor:'pointer'}}>
              Cancel
            </button>
            <button onClick={handleInvite} disabled={loading || !form.email || !form.name || !form.roleId} style={{padding:'10px 16px',borderRadius:'8px',border:'none',backgroundColor:'#2563EB',color:'white',fontSize:'14px',fontWeight:500,cursor:'pointer',opacity:(loading||!form.email||!form.name||!form.roleId)?0.6:1}}>
              {loading ? 'Sending...' : 'Add User'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
