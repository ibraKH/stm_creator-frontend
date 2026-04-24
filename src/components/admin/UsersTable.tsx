import React, { useState, useMemo } from 'react';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'Viewer' | 'Editor' | 'Admin';
  is_verified: boolean;
  created_at: string;
}

interface UsersTableProps {
  users: User[];
  loading: boolean;
  onRoleChange: (userId: number, role: string) => Promise<void>;
  onRevokeSession: (userId: number) => Promise<void>;
  onDeleteUser: (userId: number) => Promise<void>;
}

const PAGE_SIZE = 10;

export function UsersTable({ users, loading, onRoleChange, onRevokeSession, onDeleteUser }: UsersTableProps) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'All' | 'Viewer' | 'Editor' | 'Admin'>('All');
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<Record<number, Record<string, boolean>>>({});

  const setOp = (userId: number, action: string, val: boolean) => {
    setActionLoading(prev => ({
      ...prev,
      [userId]: { ...(prev[userId] ?? {}), [action]: val },
    }));
  };

  const isOp = (userId: number, action: string) => actionLoading[userId]?.[action] ?? false;

  const filtered = useMemo(() => {
    let result = users;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(u =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    }
    if (roleFilter !== 'All') {
      result = result.filter(u => u.role === roleFilter);
    }
    return result;
  }, [users, search, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const pageUsers = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const handleRoleChange = async (userId: number, role: string) => {
    setOp(userId, 'role', true);
    try {
      await onRoleChange(userId, role);
    } finally {
      setOp(userId, 'role', false);
    }
  };

  const handleRevoke = async (userId: number) => {
    setOp(userId, 'revoke', true);
    try {
      await onRevokeSession(userId);
    } finally {
      setOp(userId, 'revoke', false);
    }
  };

  const handleDelete = async (userId: number) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    setOp(userId, 'delete', true);
    try {
      await onDeleteUser(userId);
    } finally {
      setOp(userId, 'delete', false);
    }
  };

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E0EDE6',
      borderRadius: 12,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      overflow: 'hidden',
    }}>
      {/* Controls */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid #E0EDE6',
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <input
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={inputStyle}
        />
        <select
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value as typeof roleFilter); setPage(1); }}
          style={{ ...inputStyle, flex: 'none', width: 'auto', minWidth: 140 }}
        >
          <option value="All">All roles</option>
          <option value="Viewer">Viewer</option>
          <option value="Editor">Editor</option>
          <option value="Admin">Admin</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#F0FAF4', borderBottom: '1px solid #E0EDE6' }}>
              {['Name', 'Email', 'Role', 'Verified', 'Joined', 'Actions'].map(col => (
                <th key={col} style={thStyle}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #E0EDE6' }}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} style={tdStyle}>
                      <div style={{
                        height: 16,
                        background: '#E0EDE6',
                        borderRadius: 4,
                        width: j === 5 ? 160 : '70%',
                        animation: 'skeletonPulse 1.4s ease-in-out infinite',
                        animationDelay: `${i * 0.1}s`,
                      }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : pageUsers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', padding: '40px 20px', color: '#6B7280' }}>
                  No users found.
                </td>
              </tr>
            ) : (
              pageUsers.map(user => (
                <tr key={user.id} style={{ borderBottom: '1px solid #E0EDE6' }}>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{user.name}</td>
                  <td style={{ ...tdStyle, color: '#6B7280' }}>{user.email}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <select
                        value={user.role}
                        onChange={e => handleRoleChange(user.id, e.target.value)}
                        disabled={isOp(user.id, 'role')}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid #E0EDE6',
                          background: '#fff',
                          color: '#1A3C2E',
                          fontSize: 13,
                          cursor: isOp(user.id, 'role') ? 'not-allowed' : 'pointer',
                          opacity: isOp(user.id, 'role') ? 0.6 : 1,
                          fontFamily: 'inherit',
                        }}
                      >
                        <option value="Viewer">Viewer</option>
                        <option value="Editor">Editor</option>
                        <option value="Admin">Admin</option>
                      </select>
                      {isOp(user.id, 'role') && <Spinner dark />}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    {user.is_verified ? (
                      <span style={{ ...badgeStyle, background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>
                        ✓ Verified
                      </span>
                    ) : (
                      <span style={{ ...badgeStyle, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                        ⏳ Pending
                      </span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, color: '#6B7280', whiteSpace: 'nowrap' }}>
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'nowrap' }}>
                      <button
                        onClick={() => handleRevoke(user.id)}
                        disabled={isOp(user.id, 'revoke')}
                        style={revokeBtn(isOp(user.id, 'revoke'))}
                      >
                        {isOp(user.id, 'revoke') ? <><Spinner small /> Revoking…</> : 'Revoke Session'}
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        disabled={isOp(user.id, 'delete')}
                        style={deleteBtn(isOp(user.id, 'delete'))}
                      >
                        {isOp(user.id, 'delete') ? <><Spinner small darkRed /> Deleting…</> : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && filtered.length > 0 && (
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #E0EDE6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 13,
          color: '#6B7280',
          flexWrap: 'wrap',
          gap: 8,
        }}>
          <span>
            Showing {(clampedPage - 1) * PAGE_SIZE + 1}–{Math.min(clampedPage * PAGE_SIZE, filtered.length)} of {filtered.length} users
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={clampedPage <= 1}
              style={paginationBtn(clampedPage <= 1)}
            >
              ← Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={clampedPage >= totalPages}
              style={paginationBtn(clampedPage >= totalPages)}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Spinner({ small, dark, darkRed }: { small?: boolean; dark?: boolean; darkRed?: boolean }) {
  const size = small ? 11 : 14;
  const topColor = darkRed ? '#DC2626' : dark ? '#2D6A4F' : '#B8860B';
  const baseColor = darkRed ? 'rgba(220,38,38,0.2)' : dark ? 'rgba(45,106,79,0.2)' : 'rgba(184,134,11,0.2)';
  return (
    <span style={{
      display: 'inline-block',
      width: size,
      height: size,
      border: `2px solid ${baseColor}`,
      borderTopColor: topColor,
      borderRadius: '50%',
      animation: 'adminSpin 0.6s linear infinite',
      verticalAlign: 'middle',
      flexShrink: 0,
    }} />
  );
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #E0EDE6',
  background: '#fff',
  color: '#1A3C2E',
  fontSize: 14,
  outline: 'none',
  flex: 1,
  minWidth: 180,
  fontFamily: 'inherit',
};

const thStyle: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontWeight: 600,
  color: '#1A3C2E',
  fontSize: 13,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '11px 16px',
  color: '#1A3C2E',
  verticalAlign: 'middle',
};

const badgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '3px 9px',
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 500,
  whiteSpace: 'nowrap',
};

const revokeBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '5px 10px',
  background: disabled ? '#F7FCF9' : '#FFF7E6',
  color: disabled ? '#6B7280' : '#4a3c12',
  border: '1px dashed #E7D2A2',
  borderRadius: 6,
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: 12,
  fontWeight: 500,
  opacity: disabled ? 0.7 : 1,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
});

const deleteBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '5px 10px',
  background: disabled ? '#F7FCF9' : '#FEF2F2',
  color: disabled ? '#6B7280' : '#DC2626',
  border: '1px solid #FECACA',
  borderRadius: 6,
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: 12,
  fontWeight: 500,
  opacity: disabled ? 0.7 : 1,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
});

const paginationBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '6px 14px',
  background: '#fff',
  color: disabled ? '#6B7280' : '#2D6A4F',
  border: '1px solid #E0EDE6',
  borderRadius: 7,
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: 13,
  fontWeight: 500,
  opacity: disabled ? 0.5 : 1,
  fontFamily: 'inherit',
});
