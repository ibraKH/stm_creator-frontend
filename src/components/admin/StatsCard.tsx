interface StatsCardProps {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  loading?: boolean;
}

export function StatsCard({ icon, value, label, loading = false }: StatsCardProps) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E0EDE6',
      borderRadius: 12,
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{ color: '#B8860B', display: 'flex', alignItems: 'center' }}>{icon}</div>
      {loading ? (
        <div style={{
          height: 36,
          width: '60%',
          background: '#E0EDE6',
          borderRadius: 8,
          animation: 'skeletonPulse 1.4s ease-in-out infinite',
        }} />
      ) : (
        <div style={{ fontSize: 32, fontWeight: 700, color: '#1A3C2E', lineHeight: 1 }}>
          {value}
        </div>
      )}
      <div style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>{label}</div>
    </div>
  );
}
