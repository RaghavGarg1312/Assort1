'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/layout/Shell';

interface UserNode {
  id: string;
  name: string;
  designation: string | null;
  role: { id: string, name: string, level: number };
  managerId: string | null;
  children: UserNode[];
}

const OrgTreeNode = ({ node }: { node: UserNode }) => {
  return (
    <div className="flex flex-col items-center">
      <div className="bg-surface-container-low border border-outline-variant p-md rounded-xl shadow-sm text-center min-w-[200px] hover:shadow-md transition-shadow">
        <h4 className="text-h4 font-h4 text-on-surface">{node.name}</h4>
        <p className="text-body-sm text-primary font-semibold mt-xs">{node.role.name}</p>
        {node.designation && <p className="text-body-sm text-on-surface-variant mt-xs">{node.designation}</p>}
      </div>
      
      {node.children && node.children.length > 0 && (
        <div className="flex flex-col items-center mt-sm">
          {/* Vertical line from parent */}
          <div className="w-px h-md bg-outline-variant"></div>
          
          <div className="flex gap-lg relative pt-sm">
            {/* Horizontal connector line for multiple children */}
            {node.children.length > 1 && (
              <div className="absolute top-0 left-0 right-0 h-px bg-outline-variant" style={{
                left: 'calc(50% / ' + node.children.length + ')',
                right: 'calc(50% / ' + node.children.length + ')'
              }}></div>
            )}
            
            {node.children.map(child => (
              <div key={child.id} className="flex flex-col items-center relative">
                {/* Vertical line down to child */}
                <div className="w-px h-sm bg-outline-variant absolute -top-sm"></div>
                <OrgTreeNode node={child} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function DepartmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  
  const [department, setDepartment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'chart'>('list');

  useEffect(() => {
    fetch(`/api/departments/${id}`)
      .then(r => r.json())
      .then(data => setDepartment(data))
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Shell>
        <div className="p-lg space-y-lg animate-pulse">
          <div className="h-12 w-1/3 bg-surface-container-low rounded-xl"></div>
          <div className="h-64 bg-surface-container-low rounded-xl"></div>
        </div>
      </Shell>
    );
  }

  if (!department || department.error) {
    return (
      <Shell>
        <div className="p-lg">
          <p className="text-error">Department not found.</p>
        </div>
      </Shell>
    );
  }

  const users = department.users || [];
  
  // Build tree
  const userMap = new Map<string, UserNode>();
  users.forEach((u: any) => userMap.set(u.id, { ...u, children: [] }));

  const roots: UserNode[] = [];
  users.forEach((u: any) => {
    const node = userMap.get(u.id)!;
    // A node is a root if it has no manager, OR its manager is not in this department
    if (!u.managerId || !userMap.has(u.managerId)) {
      roots.push(node);
    } else {
      const parent = userMap.get(u.managerId);
      if (parent) {
        parent.children.push(node);
      }
    }
  });

  // Sort children recursively by role level
  const sortChildren = (nodes: UserNode[]) => {
    nodes.sort((a, b) => {
      if (a.role.level !== b.role.level) return a.role.level - b.role.level;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach(n => sortChildren(n.children));
  };
  sortChildren(roots);

  const getRoleBadgeColor = (level: number | undefined) => {
    if (level === undefined) return 'bg-surface-container-high text-on-surface';
    if (level <= 1) return 'bg-primary text-white shadow-sm';
    if (level === 2) return 'bg-primary-container text-on-primary-container shadow-sm';
    if (level === 3) return 'bg-secondary-fixed text-on-secondary-fixed';
    return 'bg-secondary-fixed-dim text-on-secondary-fixed';
  };

  return (
    <Shell>
      <div className="p-lg space-y-lg max-w-7xl mx-auto mt-md">
        
        {/* Breadcrumb / Back */}
        <button onClick={() => router.push('/admin/departments')} className="flex items-center gap-xs text-on-surface-variant hover:text-primary font-label-md transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z"/></svg>
          Back to Departments
        </button>

        <div className="flex justify-between items-end pb-md border-b border-outline-variant">
          <div>
            <h2 className="text-h1 font-h1 text-on-surface">{department.name}</h2>
            <p className="text-body-lg text-on-surface-variant mt-xs">
              Head of Department: <span className="font-semibold text-on-surface">{department.head?.name || 'Unassigned'}</span>
            </p>
          </div>
          
          <div className="flex bg-surface-container-low p-1 rounded-lg border border-outline-variant">
            <button 
              onClick={() => setViewMode('list')}
              className={`px-md py-sm rounded-md font-label-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              List View
            </button>
            <button 
              onClick={() => setViewMode('chart')}
              className={`px-md py-sm rounded-md font-label-md transition-all ${viewMode === 'chart' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Org Chart
            </button>
          </div>
        </div>

        {users.length === 0 ? (
          <div className="p-xl text-center text-on-surface-variant bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm mt-lg">
            No members in this department yet.
          </div>
        ) : (
          <div className="mt-lg">
            {viewMode === 'list' ? (
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant">
                      <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant">Name</th>
                      <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant">Designation</th>
                      <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant">Role</th>
                      <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant">Managed By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {users.map((u: any) => (
                      <tr key={u.id} className="hover:bg-surface-container-low transition-colors group">
                        <td className="px-lg py-md font-body-md text-on-surface font-medium">{u.name}</td>
                        <td className="px-lg py-md font-body-md text-on-surface-variant">{u.designation || '-'}</td>
                        <td className="px-lg py-md">
                          <span className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm ${getRoleBadgeColor(u.role?.level)}`}>
                            {u.role?.name || '-'}
                          </span>
                        </td>
                        <td className="px-lg py-md font-body-md text-on-surface-variant">
                          {u.managerId ? userMap.get(u.managerId)?.name || '—' : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-xl overflow-x-auto">
                <div className="flex justify-center min-w-max gap-4xl pb-xl pt-md">
                  {roots.map(root => (
                    <OrgTreeNode key={root.id} node={root} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
      </div>
    </Shell>
  );
}
