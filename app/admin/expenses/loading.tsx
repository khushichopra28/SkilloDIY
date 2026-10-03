export default function ExpensesLoading() {
  return (
    <main className="data-page" aria-busy="true" aria-label="Loading expenses">
      <header className="data-heading">
        <div>
          <div className="skeleton-pill" style={{ width: '150px', height: '11px', marginBottom: '8px' }} />
          <div className="skeleton-block" style={{ width: '180px', height: '28px', marginBottom: '8px' }} />
          <div className="skeleton-pill" style={{ width: '280px', height: '11px' }} />
        </div>
      </header>

      <div className="data-panel">
        <div className="data-toolbar">
          <div className="data-search" style={{ background: '#f5f7f7' }}>
            <div className="skeleton-pill" style={{ width: '180px', height: '13px' }} />
          </div>
        </div>
        <div style={{ padding: '0 0 8px' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #eff3f3' }}>
              <div style={{ width: '25%' }}>
                <div className="skeleton-block" style={{ width: '80%', height: '13px', marginBottom: '7px' }} />
                <div className="skeleton-pill" style={{ width: '60%', height: '9px' }} />
              </div>
              <div className="skeleton-pill" style={{ width: '12%', height: '11px' }} />
              <div className="skeleton-pill" style={{ width: '12%', height: '11px' }} />
              <div className="skeleton-block" style={{ width: '10%', height: '13px' }} />
              <div className="skeleton-pill" style={{ width: '70px', height: '20px' }} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
