export default function CitiesLoading() {
  return (
    <main className="city-selection-page" aria-busy="true" aria-label="Loading cities">
      <header className="city-selection-header">
        <div className="city-heading-text">
          <div className="skeleton-pill" style={{ width: '160px', height: '12px', marginBottom: '8px' }} />
          <div className="skeleton-block" style={{ width: '220px', height: '32px', marginBottom: '8px' }} />
          <div className="skeleton-pill" style={{ width: '380px', height: '12px' }} />
        </div>
      </header>

      {/* Rollup skeleton */}
      <div className="city-selection-rollup" style={{ minHeight: '74px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="rollup-stat">
            <div className="skeleton-pill" style={{ width: '70px', height: '10px', marginBottom: '8px' }} />
            <div className="skeleton-block" style={{ width: '50px', height: '22px' }} />
          </div>
        ))}
      </div>

      {/* Search skeleton */}
      <div className="city-search-container">
        <div className="city-search-bar" style={{ background: '#f5f7f7' }}>
          <div className="skeleton-pill" style={{ width: '200px', height: '14px' }} />
        </div>
      </div>

      {/* 8 Card Grid Skeleton */}
      <section className="city-cards-grid">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div key={i} className="city-picker-card" style={{ background: '#ffffff', borderColor: '#e8efef', minHeight: '260px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div className="skeleton-pill" style={{ width: '40px', height: '18px' }} />
              <div className="skeleton-pill" style={{ width: '70px', height: '14px' }} />
            </div>
            <div style={{ height: '95px', display: 'grid', placeItems: 'center', marginBottom: '14px' }}>
              <div className="skeleton-circle" style={{ width: '68px', height: '68px' }} />
            </div>
            <div className="skeleton-block" style={{ width: '110px', height: '20px', marginBottom: '6px' }} />
            <div className="skeleton-pill" style={{ width: '160px', height: '11px', marginBottom: '16px' }} />
            <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
              <div className="skeleton-pill" style={{ flex: 1, height: '24px' }} />
              <div className="skeleton-pill" style={{ flex: 1, height: '24px' }} />
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
