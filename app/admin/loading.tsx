export default function AdminRootLoading() {
  return (
    <main className="real-dashboard" aria-busy="true" aria-label="Loading workspace">
      <header className="real-dashboard-heading">
        <div>
          <div className="skeleton-pill" style={{ width: '140px', height: '12px', marginBottom: '10px' }} />
          <div className="skeleton-block" style={{ width: '260px', height: '32px', marginBottom: '8px' }} />
          <div className="skeleton-pill" style={{ width: '200px', height: '12px' }} />
        </div>
        <div className="skeleton-btn" style={{ width: '110px', height: '36px' }} />
      </header>

      {/* Metric Cards Skeleton */}
      <section className="real-metric-grid">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="real-metric skeleton-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div className="skeleton-pill" style={{ width: '80px', height: '11px' }} />
              <div className="skeleton-circle" style={{ width: '24px', height: '24px' }} />
            </div>
            <div className="skeleton-block" style={{ width: '60px', height: '28px', marginBottom: '6px' }} />
            <div className="skeleton-pill" style={{ width: '120px', height: '10px' }} />
          </div>
        ))}
      </section>

      {/* Panels Skeleton */}
      <div className="real-dashboard-columns">
        <section className="real-panel skeleton-panel">
          <header style={{ padding: '16px 18px', borderBottom: '1px solid #edf2f2' }}>
            <div className="skeleton-block" style={{ width: '130px', height: '16px', marginBottom: '6px' }} />
            <div className="skeleton-pill" style={{ width: '220px', height: '11px' }} />
          </header>
          <div style={{ padding: '18px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <div className="skeleton-block" style={{ width: '65%', height: '14px', marginBottom: '6px' }} />
                  <div className="skeleton-pill" style={{ width: '45%', height: '10px' }} />
                </div>
                <div className="skeleton-pill" style={{ width: '70px', height: '22px' }} />
              </div>
            ))}
          </div>
        </section>

        <section className="real-panel skeleton-panel">
          <header style={{ padding: '16px 18px', borderBottom: '1px solid #edf2f2' }}>
            <div className="skeleton-block" style={{ width: '120px', height: '16px', marginBottom: '6px' }} />
            <div className="skeleton-pill" style={{ width: '180px', height: '11px' }} />
          </header>
          <div style={{ padding: '18px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <div className="skeleton-block" style={{ width: '140px', height: '13px', marginBottom: '6px' }} />
                  <div className="skeleton-pill" style={{ width: '90px', height: '10px' }} />
                </div>
                <div className="skeleton-block" style={{ width: '50px', height: '15px' }} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
