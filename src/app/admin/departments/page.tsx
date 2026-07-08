'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/layout/Shell';

export default function DepartmentsPage() {
  const router = useRouter();
  const [depts, setDepts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDept, setEditingDept] = useState<any | null>(null);
  const [formName, setFormName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean, id: string, name: string }>({ open: false, id: '', name: '' });

  const fetchDepts = () => {
    setLoading(true)
    fetch('/api/departments')
      .then(r => r.json())
      .then(data => setDepts(data.departments || data || []))
      .catch(e => console.error(e))
      .finally(() => setLoading(false))
  }
  useEffect(() => { fetchDepts() }, [])

  const handleSubmit = async () => {
    if (!formName.trim()) { setModalError('Department name is required'); return }
    setSubmitting(true)
    setModalError('')
    try {
      const res = await fetch(
        editingDept ? `/api/departments/${editingDept.id}` : '/api/departments',
        {
          method: editingDept ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName.trim() })
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setShowCreateModal(false)
      setEditingDept(null)
      fetchDepts()
    } catch (err: any) {
      setModalError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/departments/${confirmDelete.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setConfirmDelete({ open: false, id: '', name: '' })
      fetchDepts()
    } catch (err: any) {
      console.error(err)
    }
  }

  return (
    <Shell>
      <div className="p-lg space-y-lg">
        <div className="flex justify-between items-end">
           <div>
             <h2 className="text-h1 font-h1 text-on-surface">Departments</h2>
             <p className="text-body-lg text-on-surface-variant">Manage organizational units and assign department heads.</p>
           </div>
          <button
            onClick={() => { setFormName(''); setModalError(''); setEditingDept(null); setShowCreateModal(true) }}
            className="px-lg py-sm bg-primary-container text-white rounded-lg font-label-md flex items-center gap-xs hover:shadow-lg active:scale-95 transition-all"
          >
             <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor" className="text-[20px]"><path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z"/></svg> Create Department
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
            {depts.length === 0 ? (
               <div className="col-span-3 p-xl text-center text-on-surface-variant bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm">
                  No departments found.
               </div>
            ) : depts.map(d => (
               <div key={d.id} 
                    onClick={() => router.push(`/admin/departments/${d.id}`)}
                    className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm flex flex-col hover:shadow-md transition-shadow cursor-pointer">
                  <h3 className="text-h3 font-h3 text-on-surface flex items-center justify-between">
                     {d.name}
                     <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor" className="text-outline"><path d="M80-120v-720h400v160h400v560H80Zm80-80h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm160 480h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm160 480h320v-400H480v80h80v80h-80v80h80v80h-80v80Zm160-240v-80h80v80h-80Zm0 160v-80h80v80h-80Z"/></svg>
                  </h3>
                  <p className="text-on-surface-variant font-body-sm mt-md flex items-center gap-xs">
                     <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor" className="text-[16px]"><path d="M367-527q-47-47-47-113t47-113q47-47 113-47t113 47q47 47 47 113t-47 113q-47 47-113 47t-113-47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Zm80-80h480v-32q0-11-5.5-20T700-306q-54-27-109-40.5T480-360q-56 0-111 13.5T260-306q-9 5-14.5 14t-5.5 20v32Zm296.5-343.5Q560-607 560-640t-23.5-56.5Q513-720 480-720t-56.5 23.5Q400-673 400-640t23.5 56.5Q447-560 480-560t56.5-23.5ZM480-640Zm0 400Z"/></svg>
                     Head: {d.head?.name || 'Unassigned'}
                  </p>
                  <p className="text-on-surface-variant font-body-sm mt-xs flex items-center gap-xs">
                     <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor" className="text-[16px]"><path d="M40-160v-112q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v112H40Zm720 0v-120q0-44-24.5-84.5T666-434q51 6 96 20.5t84 35.5q36 20 55 44.5t19 53.5v120H760ZM247-527q-47-47-47-113t47-113q47-47 113-47t113 47q47 47 47 113t-47 113q-47 47-113 47t-113-47Zm466 0q-47 47-113 47-11 0-28-2.5t-28-5.5q27-32 41.5-71t14.5-81q0-42-14.5-81T544-792q14-5 28-6.5t28-1.5q66 0 113 47t47 113q0 66-47 113ZM120-240h480v-32q0-11-5.5-20T580-306q-54-27-109-40.5T360-360q-56 0-111 13.5T140-306q-9 5-14.5 14t-5.5 20v32Zm296.5-343.5Q440-607 440-640t-23.5-56.5Q393-720 360-720t-56.5 23.5Q280-673 280-640t23.5 56.5Q327-560 360-560t56.5-23.5ZM360-240Zm0-400Z"/></svg>
                     Users: {d._count?.users || 0}
                  </p>
                  <div className="mt-auto pt-lg flex gap-sm justify-end border-t border-outline-variant mt-md">
                     <button
                       onClick={(e) => { e.stopPropagation(); setEditingDept(d); setFormName(d.name); setModalError(''); setShowCreateModal(true) }}
                       className="px-sm py-1 border border-outline-variant rounded text-on-surface hover:bg-surface-container-low font-label-sm transition-colors"
                     >
                       Edit
                     </button>
                     <button
                       onClick={(e) => { e.stopPropagation(); setConfirmDelete({ open: true, id: d.id, name: d.name }) }}
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
          <div style={{backgroundColor:'white',borderRadius:'12px',boxShadow:'0 20px 60px rgba(0,0,0,0.3)',width:'100%',maxWidth:'420px',margin:'0 16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 24px',borderBottom:'1px solid #c3c6d7'}}>
              <h3 style={{fontSize:'18px',fontWeight:700,color:'#131b2e',margin:0}}>{editingDept ? 'Edit Department' : 'Create Department'}</h3>
              <button onClick={() => setShowCreateModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#434655'}}>
                <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
              </button>
            </div>
            <div style={{padding:'24px',display:'flex',flexDirection:'column',gap:'16px'}}>
              {modalError && (
                <div style={{padding:'12px',backgroundColor:'#fef2f2',color:'#b91c1c',fontSize:'14px',borderRadius:'8px',border:'1px solid #fecaca'}}>{modalError}</div>
              )}
              <div>
                <label style={{display:'block',fontSize:'14px',fontWeight:600,color:'#131b2e',marginBottom:'4px'}}>Department Name *</label>
                <input
                  type="text" value={formName} onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Engineering, Sales, HR"
                  style={{width:'100%',padding:'8px 12px',backgroundColor:'#f2f3ff',border:'1px solid #c3c6d7',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box'}}
                />
              </div>
              <div style={{display:'flex',justifyContent:'flex-end',gap:'12px',paddingTop:'8px'}}>
                <button onClick={() => setShowCreateModal(false)} style={{padding:'10px 16px',borderRadius:'8px',border:'1px solid #c3c6d7',backgroundColor:'white',color:'#131b2e',fontSize:'14px',fontWeight:500,cursor:'pointer'}}>
                  Cancel
                </button>
                <button onClick={handleSubmit} disabled={submitting} style={{padding:'10px 16px',borderRadius:'8px',border:'none',backgroundColor:'#2563EB',color:'white',fontSize:'14px',fontWeight:500,cursor:'pointer',opacity:submitting?0.6:1}}>
                  {submitting ? 'Saving...' : editingDept ? 'Save Changes' : 'Create Department'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete.open && (
        <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
          <div style={{backgroundColor:'white',borderRadius:'12px',boxShadow:'0 20px 60px rgba(0,0,0,0.3)',width:'100%',maxWidth:'400px',margin:'0 16px',padding:'24px'}}>
            <h3 style={{fontSize:'18px',fontWeight:700,color:'#131b2e',marginBottom:'8px'}}>Delete Department</h3>
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
