export default function AdminSectionLoading() {
  return (
    <main className="data-page" aria-busy="true" aria-label="Loading section">
      <header className="data-page-heading">
        <div>
          <div className="skeleton-pill" style={{ width: '130px', height: '11px', marginBottom: '8px' }} />
          <div className="skeleton-block" style={{ width: '220px', height: '28px', marginBottom: '8px' }} />
          <div className="skeleton-pill" style={{ width: '340px', height: '11px' }} />
        </div>
      </header>

      <div className="admin-data-table">
        <div className="admin-table-head">
          <div className="skeleton-pill" style={{ width: '80px', height: '10px' }} />
          <div className="skeleton-pill" style={{ width: '70px', height: '10px' }} />
          <div className="skeleton-pill" style={{ width: '70px', height: '10px' }} />
          <div className="skeleton-pill" style={{ width: '60px', height: '10px' }} />
        </div>
        {[1, 2, 3, 4, 5, 6, 7].map(i => (
          <div className="admin-table-row" key={i}>
            <span>
              <div className="skeleton-block" style={{ width: '80%', height: '12px', marginBottom: '6px' }} />
              <div className="skeleton-pill" style={{ width: '50%', height: '9px' }} />
            </span>
            <span><div className="skeleton-pill" style={{ width: '70%', height: '10px' }} /></span>
            <span><div className="skeleton-pill" style={{ width: '60%', height: '10px' }} /></span>
            <span><div className="skeleton-pill" style={{ width: '50px', height: '18px' }} /></span>
          </div>
        ))}
      </div>
    </main>
  );
}

