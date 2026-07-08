'use client';

import { useState, useEffect } from 'react';
import Shell from '@/components/layout/Shell';

export default function RolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [rows, setRows] = useState<{ id: string, name: string, baseLevel: string }[]>([{ id: '0', name: '', baseLevel: 'MEMBER' }]);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean, id: string, name: string }>({ open: false, id: '', name: '' });

  const fetchRoles = () => {
    setLoading(true)
    fetch('/api/roles')
      .then(r => r.json())
      .then(data => setRoles(Array.isArray(data) ? data : []))
      .catch(e => { console.error(e); setRoles([]); })
      .finally(() => setLoading(false))
  }
  useEffect(() => { fetchRoles() }, [])

  const handleSubmit = async () => {
    // Validate rows locally
    for (const [i, row] of rows.entries()) {
      if (!row.name.trim()) { setModalError(`Row ${i + 1} is missing a name`); return }
    }
    
    setSubmitting(true)
    setModalError('')
    try {
      const payload = rows.map((r, i) => ({
        name: r.name.trim(),
        level: i + 1,
        baseLevel: r.baseLevel
      }));

      const res = await fetch('/api/roles/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create roles')
      setShowCreateModal(false)
      fetchRoles()
    } catch (err: any) {
      setModalError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const addRow = () => {
    setRows(prev => [...prev, { id: Math.random().toString(36).slice(2), name: '', baseLevel: 'MEMBER' }]);
  }

  const removeRow = (index: number) => {
    if (rows.length === 1) return;
    setRows(prev => prev.filter((_, i) => i !== index));
  }

  const updateRow = (index: number, field: 'name' | 'baseLevel', value: string) => {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  }

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/roles/${confirmDelete.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete')
      setConfirmDelete({ open: false, id: '', name: '' })
      fetchRoles()
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <Shell>
      <div className="p-lg space-y-lg">
        <div className="flex justify-between items-end">
           <div>
             <h2 className="text-h1 font-h1 text-on-surface">Roles</h2>
             <p className="text-body-lg text-on-surface-variant">Manage custom roles and permission levels.</p>
           </div>
          <button
            onClick={() => { setRows([{ id: '0', name: '', baseLevel: 'MEMBER' }]); setModalError(''); setShowCreateModal(true) }}
            className="px-lg py-sm bg-primary-container text-white rounded-lg font-label-md flex items-center gap-xs hover:shadow-lg active:scale-95 transition-all"
          >
             <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor" className="text-[20px]"><path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z"/></svg> Create Roles
          </button>
        </div>
        
        {loading ? (
          <div className="animate-pulse grid grid-cols-1 md:grid-cols-3 gap-lg">
             <div className="h-40 bg-surface-container-low rounded-xl"></div>
             <div className="h-40 bg-surface-container-low rounded-xl"></div>
             <div className="h-40 bg-surface-container-low rounded-xl"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
            {roles.length === 0 ? (
               <div className="col-span-3 p-xl text-center text-on-surface-variant bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm">
                  No roles found.
               </div>
            ) : roles.map(r => (
               <div key={r.id} className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm flex flex-col hover:shadow-md transition-shadow">
                  <h3 className="text-h3 font-h3 text-on-surface flex items-center justify-between">
                     {r.name}
                     <span className="text-body-sm px-2 py-1 bg-surface-container rounded-md text-on-surface-variant font-medium border border-outline-variant">
                        Lvl {r.level}
                     </span>
                  </h3>
                  <p className="text-on-surface-variant font-body-sm mt-md flex items-center gap-xs">
                     Base Level: <span className="font-semibold text-primary">{r.baseLevel}</span>
                  </p>
                  <p className="text-on-surface-variant font-body-sm mt-xs flex items-center gap-xs">
                     Users: {r._count?.users || 0}
                  </p>
                  <div className="mt-auto pt-lg flex gap-sm justify-end border-t border-outline-variant mt-md">
                     <button
                       onClick={() => setConfirmDelete({ open: true, id: r.id, name: r.name })}
                       className="px-sm py-1 border border-error text-error rounded hover:bg-error-container font-label-sm transition-colors"
                     >
                       Delete
                     </button>
                  </div>
               </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
          <div style={{backgroundColor:'white',borderRadius:'12px',boxShadow:'0 20px 60px rgba(0,0,0,0.3)',width:'100%',maxWidth:'600px',margin:'0 16px',maxHeight:'90vh',display:'flex',flexDirection:'column'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 24px',borderBottom:'1px solid #c3c6d7'}}>
              <h3 style={{fontSize:'18px',fontWeight:700,color:'#131b2e',margin:0}}>Create Role Hierarchy</h3>
              <button onClick={() => setShowCreateModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#434655'}}>
                <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
              </button>
            </div>
            
            <div style={{padding:'24px',overflowY:'auto',flex:1}}>
              {modalError && (
                <div style={{padding:'12px',backgroundColor:'#fef2f2',color:'#b91c1c',fontSize:'14px',borderRadius:'8px',border:'1px solid #fecaca',marginBottom:'16px'}}>{modalError}</div>
              )}
              
              <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                {rows.map((row, idx) => (
                  <div key={row.id} style={{display:'flex',alignItems:'flex-end',gap:'12px'}}>
                    <div style={{flexShrink:0,width:'60px',paddingBottom:'8px'}}>
                      <span style={{fontSize:'14px',fontWeight:600,color:'#434655'}}>Lvl {idx + 1}</span>
                    </div>
                    <div style={{flex:1}}>
                      <label style={{display:'block',fontSize:'12px',fontWeight:600,color:'#131b2e',marginBottom:'4px'}}>Role Name</label>
                      <input
                        type="text" value={row.name} onChange={e => updateRow(idx, 'name', e.target.value)}
                        placeholder="e.g. Senior Engineer"
                        style={{width:'100%',padding:'8px 12px',backgroundColor:'#f2f3ff',border:'1px solid #c3c6d7',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box'}}
                      />
                    </div>
                    <div style={{flex:1}}>
                      <label style={{display:'block',fontSize:'12px',fontWeight:600,color:'#131b2e',marginBottom:'4px'}}>Base Permissions</label>
                      <select
                        value={row.baseLevel} onChange={e => updateRow(idx, 'baseLevel', e.target.value)}
                        style={{width:'100%',padding:'8px 12px',backgroundColor:'#f2f3ff',border:'1px solid #c3c6d7',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box'}}
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="MANAGER">Manager</option>
                        <option value="MEMBER">Member</option>
                        <option value="VIEWER">Viewer</option>
                      </select>
                    </div>
                    <button
                      onClick={() => removeRow(idx)}
                      disabled={rows.length === 1}
                      style={{padding:'8px',border:'1px solid #c3c6d7',borderRadius:'8px',backgroundColor:'white',cursor:rows.length===1?'not-allowed':'pointer',color:rows.length===1?'#c3c6d7':'#dc2626',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}
                      title="Remove Row"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
                    </button>
                  </div>
                ))}
                
                <button
                  onClick={addRow}
                  style={{padding:'10px',border:'1px dashed #c3c6d7',borderRadius:'8px',backgroundColor:'transparent',color:'#434655',fontSize:'14px',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',marginTop:'8px'}}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z"/></svg> Add Role Row
                </button>
              </div>
            </div>
            
            <div style={{display:'flex',justifyContent:'flex-end',gap:'12px',padding:'20px 24px',borderTop:'1px solid #c3c6d7',backgroundColor:'#f9fafb',borderBottomLeftRadius:'12px',borderBottomRightRadius:'12px'}}>
              <button onClick={() => setShowCreateModal(false)} style={{padding:'10px 16px',borderRadius:'8px',border:'1px solid #c3c6d7',backgroundColor:'white',color:'#131b2e',fontSize:'14px',fontWeight:500,cursor:'pointer'}}>
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={submitting} style={{padding:'10px 16px',borderRadius:'8px',border:'none',backgroundColor:'#2563EB',color:'white',fontSize:'14px',fontWeight:500,cursor:'pointer',opacity:submitting?0.6:1}}>
                {submitting ? 'Saving...' : 'Save Hierarchy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete.open && (
        <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
          <div style={{backgroundColor:'white',borderRadius:'12px',boxShadow:'0 20px 60px rgba(0,0,0,0.3)',width:'100%',maxWidth:'400px',margin:'0 16px',padding:'24px'}}>
            <h3 style={{fontSize:'18px',fontWeight:700,color:'#131b2e',marginBottom:'8px'}}>Delete Role</h3>
            <p style={{fontSize:'14px',color:'#434655',marginBottom:'24px'}}>Are you sure you want to delete <strong>{confirmDelete.name}</strong>? This cannot be undone.</p>
            <div style={{display:'flex',justifyContent:'flex-end',gap:'12px'}}>
              <button onClick={() => setConfirmDelete({ open: false, id: '', name: '' })} style={{padding:'10px 16px',borderRadius:'8px',border:'1px solid #c3c6d7',backgroundColor:'white',color:'#131b2e',fontSize:'14px',fontWeight:500,cursor:'pointer'}}>
                Cancel
              </button>
              <button onClick={handleDelete} style={{padding:'10px 16px',borderRadius:'8px',border:'none',backgroundColor:'#dc2626',color:'white',fontSize:'14px',fontWeight:500,cursor:'pointer'}}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
