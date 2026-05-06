export function LoadingSkeleton() {
  return (
    <div className="space-y-8" style={{ paddingTop: '1rem' }}>
      <div className="skeleton" style={{ height: '60px', width: '60%' }} />
      <div className="skeleton" style={{ height: '20px', width: '40%' }} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginTop: '1.5rem',
        }}
      >
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ height: '120px' }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: '320px', marginTop: '2rem' }} />
    </div>
  );
}
