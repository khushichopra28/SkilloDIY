import { Clock3 } from 'lucide-react';

export default function PendingVerificationsLoading() {
  return (
    <main className="data-page" aria-busy="true">
      <header className="data-heading">
        <div>
          <div className="eyebrow">PEOPLE & TEAMS</div>
          <h1>Pending verifications</h1>
          <p>Loading handler applications…</p>
        </div>
        <span className="application-queue-count"><Clock3 size={15} /> Loading</span>
      </header>
      <section className="data-panel"><div className="data-state">Loading applications…</div></section>
    </main>
  );
}
