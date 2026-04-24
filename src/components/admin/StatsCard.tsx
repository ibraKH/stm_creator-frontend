interface StatsCardProps {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  loading?: boolean;
}

export function StatsCard({ icon, value, label, loading = false }: StatsCardProps) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #eaecf0',
      borderRadius: 8,
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      boxShadow: '0 1px 2px 0 rgba(16, 24, 40, 0.05)',
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>{icon}</div>
      {loading ? (
        <div style={{
          height: 34,
          width: '55%',
          background: '#eaecf0',
          borderRadius: 6,
          animation: 'skeletonPulse 1.4s ease-in-out infinite',
        }} />
      ) : (
        <div style={{
          fontSize: 30,
          fontWeight: 700,
          color: '#101828',
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}>
          {value}
        </div>
      )}
      <div style={{ fontSize: 13, color: '#475467', fontWeight: 500 }}>{label}</div>
    </div>
  );
}
