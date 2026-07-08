'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Shell from '@/components/layout/Shell';
import { useAuth } from '@/context/AuthContext';

export default function TaskDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { user } = useAuth();
  const [task, setTask] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({ name: '', dueDate: '' });
  const [submittingMilestone, setSubmittingMilestone] = useState(false);
  const [milestoneError, setMilestoneError] = useState('');
  const [submitModal, setSubmitModal] = useState<{ open: boolean, milestoneId: string, milestoneName: string }>({ open: false, milestoneId: '', milestoneName: '' });
  const [submitNote, setSubmitNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ open: boolean, milestoneId: string }>({ open: false, milestoneId: '' });
  const [rejectDeadline, setRejectDeadline] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchTask = () => {
    fetch(`/api/tasks/${id}`)
      .then(r => r.json())
      .then(data => { setTask(data); setLoading(false); })
      .catch(() => { setError('Failed to load task'); setLoading(false); });
  };

  const fetchComments = () => {
    fetch(`/api/tasks/${id}/comments`)
      .then(r => r.json())
      .then(data => setComments(Array.isArray(data) ? data : []));
  };

  useEffect(() => { fetchTask(); fetchComments(); }, [id]);

  const handleComment = async () => {
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      await fetch(`/api/tasks/${id}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment })
      });
      setNewComment('');
      fetchComments();
    } finally { setSubmittingComment(false); }
  };

  const handleAddMilestone = async () => {
    if (!milestoneForm.name || !milestoneForm.dueDate) { setMilestoneError('Name and due date required'); return; }
    setSubmittingMilestone(true); setMilestoneError('');
    try {
      const res = await fetch(`/api/tasks/${id}/milestones`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: milestoneForm.name, dueDate: new Date(milestoneForm.dueDate).toISOString() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setShowAddMilestone(false); setMilestoneForm({ name: '', dueDate: '' }); fetchTask();
    } catch (e: any) { setMilestoneError(e.message); }
    finally { setSubmittingMilestone(false); }
  };

  const handleSubmitMilestone = async () => {
    setSubmittingNote(true);
    try {
      const res = await fetch(`/api/tasks/${id}/milestones/${submitModal.milestoneId}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: submitNote })
      });
      if (res.ok) { setSubmitModal({ open: false, milestoneId: '', milestoneName: '' }); setSubmitNote(''); fetchTask(); }
    } finally { setSubmittingNote(false); }
  };

  const handleMilestoneReview = async (milestoneId: string, action: 'approve' | 'reject', newDeadline?: string, note?: string) => {
    setSubmittingReview(true);
    try {
      const res = await fetch(`/api/tasks/${id}/milestones/${milestoneId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, newDeadline, note })
      });
      if (res.ok) {
        setRejectModal({ open: false, milestoneId: '' });
        setRejectDeadline('');
        setRejectNote('');
        fetchTask();
      }
    } finally { setSubmittingReview(false); }
  };

  const handleArchive = async () => {
    if (!confirm('Are you sure you want to archive this task?')) return;
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    router.push('/tasks');
  };

  const priorityStyle = (p: string) => {
    if (p === 'CRITICAL') return { backgroundColor: '#fecdd3', color: '#e11d48' };
    if (p === 'HIGH') return { backgroundColor: '#ffedd5', color: '#ea580c' };
    if (p === 'MEDIUM') return { backgroundColor: '#dbeafe', color: '#2563eb' };
    return { backgroundColor: '#f1f5f9', color: '#64748b' };
  };

  const milestoneStatusStyle = (s: string) => {
    if (s === 'APPROVED') return { backgroundColor: '#d1fae5', color: '#059669' };
    if (s === 'REJECTED') return { backgroundColor: '#fecdd3', color: '#e11d48' };
    if (s === 'SUBMITTED') return { backgroundColor: '#dbeafe', color: '#2563eb' };
    if (s === 'IN_REVIEW') return { backgroundColor: '#fef9c3', color: '#ca8a04' };
    return { backgroundColor: '#f1f5f9', color: '#64748b' };
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const isManagerOrAdmin = user?.baseLevel === 'MANAGER' || user?.baseLevel === 'ADMIN';
  const isManagerInChain = task?.assignee?.managerId === user?.id;
  const canManageMilestones = task?.createdById === user?.id || user?.baseLevel === 'ADMIN' || isManagerInChain;

  if (loading) return <Shell><div style={{padding:'32px',color:'#434655'}}>Loading...</div></Shell>;
  if (error || !task) return <Shell><div style={{padding:'32px',color:'#e11d48'}}>{error || 'Task not found'}</div></Shell>;

  return (
    <Shell>
      <div style={{padding:'32px',maxWidth:'1200px',margin:'0 auto'}}>
        {/* Breadcrumb */}
        <div style={{marginBottom:'24px',fontSize:'14px',color:'#434655'}}>
          <Link href="/tasks" style={{color:'#2563EB',textDecoration:'none'}}>Tasks</Link>
          <span style={{margin:'0 8px'}}>›</span>
          <span>{task.title}</span>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:'24px',alignItems:'start'}}>
          {/* Left Column */}
          <div style={{display:'flex',flexDirection:'column',gap:'24px'}}>
            {/* Task Header */}
            <div style={{backgroundColor:'white',border:'1px solid #c3c6d7',borderRadius:'12px',padding:'24px',boxShadow:'0 1px 3px rgba(0,0,0,0.08)'}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'16px'}}>
                <h1 style={{fontSize:'24px',fontWeight:700,color:'#131b2e',margin:0,flex:1}}>{task.title}</h1>
                <span style={{...priorityStyle(task.priority),padding:'4px 12px',borderRadius:'999px',fontSize:'12px',fontWeight:600,marginLeft:'12px',whiteSpace:'nowrap'}}>{task.priority}</span>
              </div>
              <div style={{display:'flex',gap:'24px',marginBottom:'16px',flexWrap:'wrap'}}>
                <div style={{fontSize:'13px',color:'#434655'}}>
                  <span style={{fontWeight:600}}>Assignee: </span>{task.assignee?.name || 'Unassigned'}
                </div>
                <div style={{fontSize:'13px',color:'#434655'}}>
                  <span style={{fontWeight:600}}>Deadline: </span>{new Date(task.dueDate).toLocaleDateString('en-US',{month:'short',day:'2-digit',year:'numeric'})}
                </div>
                <div style={{fontSize:'13px',color:'#434655'}}>
                  <span style={{fontWeight:600}}>Status: </span>{task.taskStatus?.name || task.state}
                </div>
              </div>
              {task.description && <p style={{fontSize:'14px',color:'#434655',lineHeight:'1.6',margin:0}}>{task.description}</p>}
            </div>

            {/* Milestones */}
            <div style={{backgroundColor:'white',border:'1px solid #c3c6d7',borderRadius:'12px',padding:'24px',boxShadow:'0 1px 3px rgba(0,0,0,0.08)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
                <h2 style={{fontSize:'18px',fontWeight:600,color:'#131b2e',margin:0}}>Milestones</h2>
                {canManageMilestones && (
                  <button onClick={() => setShowAddMilestone(!showAddMilestone)}
                    style={{padding:'6px 14px',backgroundColor:'#2563EB',color:'white',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:500,cursor:'pointer'}}>
                    + Add Milestone
                  </button>
                )}
              </div>

              {showAddMilestone && (
                <div style={{backgroundColor:'#f2f3ff',border:'1px solid #c3c6d7',borderRadius:'8px',padding:'16px',marginBottom:'16px',display:'flex',flexDirection:'column',gap:'12px'}}>
                  {milestoneError && <div style={{color:'#e11d48',fontSize:'13px'}}>{milestoneError}</div>}
                  <input type="text" placeholder="Milestone name" value={milestoneForm.name}
                    onChange={e => setMilestoneForm({...milestoneForm, name: e.target.value})}
                    style={{padding:'8px 12px',border:'1px solid #c3c6d7',borderRadius:'8px',fontSize:'14px',outline:'none'}} />
                  <input type="date" value={milestoneForm.dueDate}
                    onChange={e => setMilestoneForm({...milestoneForm, dueDate: e.target.value})}
                    style={{padding:'8px 12px',border:'1px solid #c3c6d7',borderRadius:'8px',fontSize:'14px',outline:'none'}} />
                  <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
                    <button onClick={() => setShowAddMilestone(false)}
                      style={{padding:'8px 16px',border:'1px solid #c3c6d7',borderRadius:'8px',backgroundColor:'white',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
                    <button onClick={handleAddMilestone} disabled={submittingMilestone}
                      style={{padding:'8px 16px',backgroundColor:'#2563EB',color:'white',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>
                      {submittingMilestone ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </div>
              )}

              {task.milestones?.length === 0 ? (
                <p style={{color:'#434655',fontSize:'14px'}}>No milestones added yet.</p>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                  {task.milestones?.map((m: any) => (
                    <div key={m.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',backgroundColor:'#f2f3ff',borderRadius:'8px',border:'1px solid #c3c6d7'}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:'14px',fontWeight:500,color:'#131b2e'}}>{m.name}</div>
                        <div style={{fontSize:'12px',color:'#434655',marginTop:'2px'}}>
                          Due: {new Date(m.dueDate).toLocaleDateString()}
                          {m.isOverdue && <span style={{color:'#e11d48',marginLeft:'8px',fontWeight:600}}>Overdue</span>}
                        </div>
                        {m.submissions?.[0]?.note && (
                          <div style={{fontSize:'12px',color:'#434655',marginTop:'8px',padding:'8px',backgroundColor:'white',borderRadius:'4px',border:'1px solid #e2e8f0'}}>
                            <strong>Submission Note:</strong> {m.submissions[0].note}
                          </div>
                        )}
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                        <span style={{...milestoneStatusStyle(m.status),padding:'3px 10px',borderRadius:'999px',fontSize:'11px',fontWeight:600}}>{m.status}</span>
                        {m.status === 'NOT_STARTED' && task.assigneeId === user?.id && (
                          <button onClick={() => setSubmitModal({ open: true, milestoneId: m.id, milestoneName: m.name })}
                            style={{padding:'6px 14px',backgroundColor:'#2563EB',color:'white',border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>
                            Submit
                          </button>
                        )}
                        {m.status === 'SUBMITTED' && canManageMilestones && (
                          <div style={{display:'flex',gap:'8px'}}>
                            <button onClick={() => handleMilestoneReview(m.id, 'approve')}
                              style={{padding:'6px 14px',backgroundColor:'#059669',color:'white',border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>
                              Approve
                            </button>
                            <button onClick={() => setRejectModal({ open: true, milestoneId: m.id })}
                              style={{padding:'6px 14px',backgroundColor:'#dc2626',color:'white',border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comments */}
            <div style={{backgroundColor:'white',border:'1px solid #c3c6d7',borderRadius:'12px',padding:'24px',boxShadow:'0 1px 3px rgba(0,0,0,0.08)'}}>
              <h2 style={{fontSize:'18px',fontWeight:600,color:'#131b2e',marginBottom:'16px',marginTop:0}}>Activity & Comments</h2>
              <div style={{display:'flex',flexDirection:'column',gap:'16px',marginBottom:'20px'}}>
                {comments.length === 0 && <p style={{color:'#434655',fontSize:'14px'}}>No comments yet.</p>}
                {comments.map((c: any) => (
                  <div key={c.id} style={{display:'flex',gap:'12px'}}>
                    <div style={{width:'32px',height:'32px',borderRadius:'50%',backgroundColor:'#eef2ff',color:'#2563EB',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:700,flexShrink:0}}>
                      {c.user?.name?.slice(0,2).toUpperCase()}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',gap:'8px',alignItems:'baseline',marginBottom:'4px'}}>
                        <span style={{fontSize:'13px',fontWeight:600,color:'#131b2e'}}>{c.user?.name}</span>
                        <span style={{fontSize:'11px',color:'#434655'}}>{timeAgo(c.createdAt)}</span>
                      </div>
                      <p style={{margin:0,fontSize:'14px',color:'#434655',lineHeight:'1.5'}}>{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',gap:'12px',alignItems:'flex-end'}}>
                <textarea value={newComment} onChange={e => setNewComment(e.target.value)}
                  placeholder="Write a comment..." rows={2}
                  style={{flex:1,padding:'8px 12px',border:'1px solid #c3c6d7',borderRadius:'8px',fontSize:'14px',outline:'none',resize:'none'}} />
                <button onClick={handleComment} disabled={submittingComment || !newComment.trim()}
                  style={{padding:'8px 20px',backgroundColor:'#2563EB',color:'white',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:500,cursor:'pointer',opacity:(!newComment.trim()||submittingComment)?0.6:1}}>
                  Send
                </button>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div style={{display:'flex',flexDirection:'column',gap:'24px'}}>
            {/* Task Stats */}
            <div style={{backgroundColor:'white',border:'1px solid #c3c6d7',borderRadius:'12px',padding:'24px',boxShadow:'0 1px 3px rgba(0,0,0,0.08)'}}>
              <h2 style={{fontSize:'16px',fontWeight:600,color:'#131b2e',marginBottom:'16px',marginTop:0}}>Task Stats</h2>
              <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                <div>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                    <span style={{fontSize:'13px',color:'#434655'}}>Progress</span>
                    <span style={{fontSize:'13px',fontWeight:600,color:'#131b2e'}}>{Math.round((task.milestoneProgress||0)*100)}%</span>
                  </div>
                  <div style={{backgroundColor:'#f2f3ff',borderRadius:'999px',height:'8px',overflow:'hidden'}}>
                    <div style={{backgroundColor:'#2563EB',height:'100%',width:`${Math.round((task.milestoneProgress||0)*100)}%`,transition:'width 0.3s'}}></div>
                  </div>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'13px'}}>
                  <span style={{color:'#434655'}}>Created By</span>
                  <span style={{fontWeight:500,color:'#131b2e'}}>{task.createdBy?.name}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'13px'}}>
                  <span style={{color:'#434655'}}>State</span>
                  <span style={{fontWeight:500,color:'#131b2e'}}>{task.state}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'13px'}}>
                  <span style={{color:'#434655'}}>Due Date</span>
                  <span style={{fontWeight:500,color:'#131b2e'}}>{new Date(task.dueDate).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            {canManageMilestones && (
              <div style={{backgroundColor:'white',border:'1px solid #c3c6d7',borderRadius:'12px',padding:'24px',boxShadow:'0 1px 3px rgba(0,0,0,0.08)'}}>
                <h2 style={{fontSize:'16px',fontWeight:600,color:'#131b2e',marginBottom:'16px',marginTop:0}}>Actions</h2>
                <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                  <button onClick={handleArchive}
                    style={{padding:'10px 16px',backgroundColor:'#dc2626',color:'white',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:500,cursor:'pointer',width:'100%'}}>
                    Archive Task
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Milestone Submit Modal */}
      {submitModal.open && (
        <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
          <div style={{backgroundColor:'white',borderRadius:'12px',boxShadow:'0 20px 60px rgba(0,0,0,0.3)',width:'100%',maxWidth:'480px',margin:'0 16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 24px',borderBottom:'1px solid #c3c6d7'}}>
              <div>
                <h3 style={{fontSize:'18px',fontWeight:700,color:'#131b2e',margin:0}}>Submit Milestone</h3>
                <p style={{fontSize:'13px',color:'#434655',margin:'4px 0 0'}}>{submitModal.milestoneName}</p>
              </div>
              <button onClick={() => setSubmitModal({ open:false, milestoneId:'', milestoneName:'' })}
                style={{background:'none',border:'none',cursor:'pointer',color:'#434655'}}>
                <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
              </button>
            </div>
            <div style={{padding:'24px',display:'flex',flexDirection:'column',gap:'16px'}}>
              <div>
                <label style={{display:'block',fontSize:'14px',fontWeight:600,color:'#131b2e',marginBottom:'4px'}}>Submission Note <span style={{color:'#434655',fontWeight:400}}>(Optional)</span></label>
                <textarea value={submitNote} onChange={e => setSubmitNote(e.target.value)} rows={4}
                  placeholder="Add details about your submission, challenges faced, or key changes made..."
                  style={{width:'100%',padding:'8px 12px',border:'1px solid #c3c6d7',borderRadius:'8px',fontSize:'14px',outline:'none',resize:'vertical',boxSizing:'border-box'}} />
              </div>
              <div style={{display:'flex',justifyContent:'flex-end',gap:'12px'}}>
                <button onClick={() => setSubmitModal({ open:false, milestoneId:'', milestoneName:'' })}
                  style={{padding:'10px 16px',borderRadius:'8px',border:'1px solid #c3c6d7',backgroundColor:'white',color:'#131b2e',fontSize:'14px',fontWeight:500,cursor:'pointer'}}>
                  Cancel
                </button>
                <button onClick={handleSubmitMilestone} disabled={submittingNote}
                  style={{padding:'10px 16px',borderRadius:'8px',border:'none',backgroundColor:'#2563EB',color:'white',fontSize:'14px',fontWeight:500,cursor:'pointer'}}>
                  {submittingNote ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {rejectModal.open && (
        <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
          <div style={{backgroundColor:'white',borderRadius:'12px',boxShadow:'0 20px 60px rgba(0,0,0,0.3)',width:'100%',maxWidth:'440px',margin:'0 16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 24px',borderBottom:'1px solid #c3c6d7'}}>
              <h3 style={{fontSize:'18px',fontWeight:700,color:'#131b2e',margin:0}}>Reject Milestone</h3>
              <button onClick={() => setRejectModal({ open: false, milestoneId: '' })} style={{background:'none',border:'none',cursor:'pointer',color:'#434655'}}>
                <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
              </button>
            </div>
            <div style={{padding:'24px',display:'flex',flexDirection:'column',gap:'16px'}}>
              <div>
                <label style={{display:'block',fontSize:'14px',fontWeight:600,color:'#131b2e',marginBottom:'4px'}}>New Deadline *</label>
                <input type="date" value={rejectDeadline} onChange={e => setRejectDeadline(e.target.value)}
                  style={{width:'100%',padding:'8px 12px',border:'1px solid #c3c6d7',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box'}} />
              </div>
              <div>
                <label style={{display:'block',fontSize:'14px',fontWeight:600,color:'#131b2e',marginBottom:'4px'}}>Rejection Note (Optional)</label>
                <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={3}
                  placeholder="Explain why this milestone is being rejected..."
                  style={{width:'100%',padding:'8px 12px',border:'1px solid #c3c6d7',borderRadius:'8px',fontSize:'14px',outline:'none',resize:'vertical',boxSizing:'border-box'}} />
              </div>
              <div style={{display:'flex',justifyContent:'flex-end',gap:'12px'}}>
                <button onClick={() => setRejectModal({ open: false, milestoneId: '' })}
                  style={{padding:'10px 16px',borderRadius:'8px',border:'1px solid #c3c6d7',backgroundColor:'white',color:'#131b2e',fontSize:'14px',fontWeight:500,cursor:'pointer'}}>
                  Cancel
                </button>
                <button onClick={() => handleMilestoneReview(rejectModal.milestoneId, 'reject', rejectDeadline, rejectNote)}
                  disabled={!rejectDeadline || submittingReview}
                  style={{padding:'10px 16px',borderRadius:'8px',border:'none',backgroundColor:'#dc2626',color:'white',fontSize:'14px',fontWeight:500,cursor:'pointer',opacity:(!rejectDeadline||submittingReview)?0.6:1}}>
                  {submittingReview ? 'Rejecting...' : 'Reject Milestone'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
