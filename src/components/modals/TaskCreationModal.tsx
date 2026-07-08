'use client';
import { useState, useEffect } from 'react';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function TaskCreationModal({ onClose, onSuccess }: Props) {
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', dueDate: '', assigneeId: '', statusId: '', departmentId: '' });
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/users').then(r => r.json()),
      fetch('/api/departments').then(r => r.json()),
      fetch('/api/task-statuses').then(r => r.json()),
      fetch('/api/auth/me').then(r => r.json())
    ]).then(([usersData, deptsData, statusData, authData]) => {
      setAllUsers(usersData.users || usersData || []);
      setDepartments(deptsData.departments || deptsData || []);
      
      const list = statusData.statuses || statusData || [];
      setStatuses(list);

      const me = authData.user;
      if (me) setCurrentUser(me);

      setForm(f => ({ 
        ...f, 
        statusId: list.length > 0 ? list[0].id : '',
        departmentId: me?.departmentId || ''
      }));
    }).catch(e => console.error(e));
  }, []);

  const filteredAssignees = allUsers.filter(u => {
    if (form.departmentId && u.departmentId !== form.departmentId) return false;
    if (currentUser && currentUser.id === u.id) return false;
    if (currentUser && currentUser.role?.level !== undefined && u.role?.level !== undefined) {
      // Lower level number = more senior. Assigner cannot assign to someone more senior.
      if (u.role.level < currentUser.role.level) return false;
    }
    return true;
  });

  const handleSubmit = async () => {
    if (!form.title || !form.dueDate || !form.assigneeId) { setError('Title, due date and assignee are required'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          priority: form.priority,
          dueDate: new Date(form.dueDate).toISOString(),
          assigneeId: form.assigneeId,
          taskStatusId: form.statusId,

        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create task');
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
      <div style={{backgroundColor:'white',borderRadius:'12px',boxShadow:'0 20px 60px rgba(0,0,0,0.3)',width:'100%',maxWidth:'560px',margin:'0 16px',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 24px',borderBottom:'1px solid #c3c6d7'}}>
          <h3 style={{fontSize:'18px',fontWeight:700,color:'#131b2e',margin:0}}>Create New Task</h3>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'#434655'}}>
            <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
          </button>
        </div>
        <div style={{padding:'24px',display:'flex',flexDirection:'column',gap:'16px'}}>
          {error && <div style={{padding:'12px',backgroundColor:'#fef2f2',color:'#b91c1c',fontSize:'14px',borderRadius:'8px',border:'1px solid #fecaca'}}>{error}</div>}
          <div>
            <label style={{display:'block',fontSize:'14px',fontWeight:600,color:'#131b2e',marginBottom:'4px'}}>Task Title *</label>
            <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Prepare Q3 Report"
              style={{width:'100%',padding:'8px 12px',backgroundColor:'#f2f3ff',border:'1px solid #c3c6d7',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box'}} />
          </div>
          <div>
            <label style={{display:'block',fontSize:'14px',fontWeight:600,color:'#131b2e',marginBottom:'4px'}}>Description</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} placeholder="What needs to be done?"
              style={{width:'100%',padding:'8px 12px',backgroundColor:'#f2f3ff',border:'1px solid #c3c6d7',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box',resize:'vertical'}} />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
            <div>
              <label style={{display:'block',fontSize:'14px',fontWeight:600,color:'#131b2e',marginBottom:'4px'}}>Priority</label>
              <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}
                style={{width:'100%',padding:'8px 12px',backgroundColor:'#f2f3ff',border:'1px solid #c3c6d7',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box',cursor:'pointer'}}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div>
              <label style={{display:'block',fontSize:'14px',fontWeight:600,color:'#131b2e',marginBottom:'4px'}}>Due Date *</label>
              <input type="date" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})}
                style={{width:'100%',padding:'8px 12px',backgroundColor:'#f2f3ff',border:'1px solid #c3c6d7',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box'}} />
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
            <div>
              <label style={{display:'block',fontSize:'14px',fontWeight:600,color:'#131b2e',marginBottom:'4px'}}>Department *</label>
              <select value={form.departmentId} onChange={e => setForm({...form, departmentId: e.target.value, assigneeId: ''})}
                style={{width:'100%',padding:'8px 12px',backgroundColor:'#f2f3ff',border:'1px solid #c3c6d7',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box',cursor:'pointer'}}>
                <option value="">Select Department...</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{display:'block',fontSize:'14px',fontWeight:600,color:'#131b2e',marginBottom:'4px'}}>Assign To *</label>
              <select value={form.assigneeId} onChange={e => setForm({...form, assigneeId: e.target.value})} disabled={!form.departmentId}
                style={{width:'100%',padding:'8px 12px',backgroundColor:form.departmentId?'#f2f3ff':'#e2e4ef',border:'1px solid #c3c6d7',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box',cursor:form.departmentId?'pointer':'not-allowed'}}>
                <option value="">{form.departmentId ? 'Select a member...' : 'Select dept first'}</option>
                {filteredAssignees.map(a => <option key={a.id} value={a.id}>{a.name} — {a.role?.name || a.baseLevel}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{display:'block',fontSize:'14px',fontWeight:600,color:'#131b2e',marginBottom:'4px'}}>Initial Status</label>
            <select value={form.statusId} onChange={e => setForm({...form, statusId: e.target.value})}
              style={{width:'100%',padding:'8px 12px',backgroundColor:'#f2f3ff',border:'1px solid #c3c6d7',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box',cursor:'pointer'}}>
              {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:'12px',paddingTop:'8px'}}>
            <button onClick={onClose} disabled={loading} style={{padding:'10px 16px',borderRadius:'8px',border:'1px solid #c3c6d7',backgroundColor:'white',color:'#131b2e',fontSize:'14px',fontWeight:500,cursor:'pointer'}}>Cancel</button>
            <button onClick={handleSubmit} disabled={loading||!form.title||!form.dueDate||!form.assigneeId}
              style={{padding:'10px 16px',borderRadius:'8px',border:'none',backgroundColor:'#2563EB',color:'white',fontSize:'14px',fontWeight:500,cursor:'pointer',opacity:(loading||!form.title||!form.dueDate||!form.assigneeId)?0.6:1}}>
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
