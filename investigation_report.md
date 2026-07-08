# Investigation Report: Milestone Submission Note

I have traced the milestone submission note end to end as requested. Here is the evidence.

## 1. Frontend Payload (Working)
The submit handler in `src/app/tasks/[id]/page.tsx` correctly sends the note in the body:
```tsx
// src/app/tasks/[id]/page.tsx (lines 73-82)
const handleSubmitMilestone = async () => {
  setSubmittingNote(true);
  try {
    const res = await fetch(`/api/tasks/${id}/milestones/${submitModal.milestoneId}/submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: submitNote })
    });
    // ...
```

## 2 & 3. Backend Parsing & Database Saving (Working)
The submission route correctly parses the note and writes it to the database via Prisma:
```typescript
// src/app/api/tasks/[id]/milestones/[milestoneId]/submit/route.ts (lines 58-64)
await tx.milestoneSubmission.create({
  data: {
    milestoneId,
    submittedById: userId,
    note: note || null,
  },
});
```

**Database Verification (Evidence)**
I queried the database directly using Prisma to fetch the latest `MilestoneSubmission` records. The note is absolutely being saved correctly:
```json
[
  {
    "id": "cmrccxfr5000m5omxlcxqd82r",
    "note": "hello task, is done",
    "milestoneId": "cmrccw4px000j5omx2ns1xscw",
    "submittedById": "cmrcaquuv000a5omxlwg3607y"
  }
]
```

## 4. The Display Side Bug

The backend `GET /api/tasks/[id]/route.ts` is correctly including the submission:
```typescript
milestones: {
  orderBy: { position: 'asc' },
  include: { submissions: { orderBy: { createdAt: 'desc' }, take: 1 } },
}
```

The frontend component in `src/app/tasks/[id]/page.tsx` (lines 215-219) is correctly using `milestone.submissions[0].note`:
```tsx
{m.status === 'SUBMITTED' && m.submissions?.[0]?.note && (
  <div style={{fontSize:'12px',color:'#434655',marginTop:'8px',padding:'8px',backgroundColor:'white',borderRadius:'4px',border:'1px solid #e2e8f0'}}>
    <strong>Note:</strong> {m.submissions[0].note}
  </div>
)}
```

**Conclusion:** The failure point is **(4) The display side**.
While the UI *does* read the correct path (`m.submissions[0].note`), the strict condition `m.status === 'SUBMITTED'` causes the note to immediately disappear from the UI if the approver clicks "Approve" or "Reject". 
Additionally, the UI currently has no mechanism to render milestone submissions directly into the "Activity & Comments" feed (it only maps over `task.comments`).

**How would you like to fix this?**
1. **Milestone Card:** Remove the `m.status === 'SUBMITTED'` gate so the latest submission note remains visible on the milestone card even after it's approved/rejected.
2. **Activity & Comments Feed:** On the backend, we can optionally have the submit route create a `TaskComment` mirroring the submission note so it naturally appears in the task activity feed.
