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

      {/* Metric Cards Skeleton — 7 metrics */}
      <section className="real-metric-grid">
        {[1, 2, 3, 4, 5, 6, 7].map(i => (
          <div key={i} className="real-metric">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div className="skeleton-pill" style={{ width: '80px', height: '11px' }} />
              <div className="skeleton-circle" style={{ width: '27px', height: '27px' }} />
            </div>
            <div className="skeleton-block" style={{ width: '60px', height: '26px', marginBottom: '7px' }} />
            <div className="skeleton-pill" style={{ width: '120px', height: '10px' }} />
          </div>
        ))}
      </section>

      {/* Panels Skeleton Upper */}
      <div className="real-dashboard-columns">
        <section className="real-panel">
          <header>
            <div>
              <div className="skeleton-block" style={{ width: '130px', height: '14px', marginBottom: '7px' }} />
              <div className="skeleton-pill" style={{ width: '220px', height: '10px' }} />
            </div>
          </header>
          <div style={{ padding: '18px 17px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center', paddingBottom: '14px', marginBottom: '14px', borderBottom: '1px solid #eff3f3' }}>
                <div style={{ flex: 1 }}>
                  <div className="skeleton-block" style={{ width: '65%', height: '12px', marginBottom: '7px' }} />
                  <div className="skeleton-pill" style={{ width: '45%', height: '9px' }} />
                </div>
                <div className="skeleton-pill" style={{ width: '70px', height: '20px' }} />
              </div>
            ))}
          </div>
        </section>

        <section className="real-panel">
          <header>
            <div>
              <div className="skeleton-block" style={{ width: '120px', height: '14px', marginBottom: '7px' }} />
              <div className="skeleton-pill" style={{ width: '180px', height: '10px' }} />
            </div>
          </header>
          <div style={{ padding: '18px 17px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '14px', marginBottom: '14px', borderBottom: '1px solid #eff3f3' }}>
                <div>
                  <div className="skeleton-block" style={{ width: '140px', height: '12px', marginBottom: '7px' }} />
                  <div className="skeleton-pill" style={{ width: '90px', height: '9px' }} />
                </div>
                <div className="skeleton-block" style={{ width: '50px', height: '14px' }} />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Panels Skeleton Lower */}
      <div className="real-dashboard-columns lower">
        <section className="real-panel">
          <header>
            <div>
              <div className="skeleton-block" style={{ width: '130px', height: '14px', marginBottom: '7px' }} />
              <div className="skeleton-pill" style={{ width: '200px', height: '10px' }} />
            </div>
          </header>
          <div style={{ padding: '18px 17px' }}>
            {[1, 2].map(i => (
              <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'center', paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid #eff3f3' }}>
                <div className="skeleton-block" style={{ width: '50px', height: '30px' }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton-block" style={{ width: '60%', height: '12px', marginBottom: '6px' }} />
                  <div className="skeleton-pill" style={{ width: '40%', height: '9px' }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="real-panel">
          <header>
            <div>
              <div className="skeleton-block" style={{ width: '120px', height: '14px', marginBottom: '7px' }} />
              <div className="skeleton-pill" style={{ width: '180px', height: '10px' }} />
            </div>
          </header>
          <div style={{ padding: '18px 17px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center', paddingBottom: '10px', marginBottom: '10px', borderBottom: '1px solid #eff3f3' }}>
                <div className="skeleton-circle" style={{ width: '8px', height: '8px' }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton-block" style={{ width: '50%', height: '11px', marginBottom: '4px' }} />
                  <div className="skeleton-pill" style={{ width: '35%', height: '8px' }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
