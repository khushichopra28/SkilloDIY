import Link from 'next/link';
import DigitalIdCard from '@/components/digital-id-card';

export const metadata = {
  title: 'Temporary ID Preview · Dev',
  robots: { index: false, follow: false },
};

export default function DevIdPreviewPage() {
  const mockVerified = {
    full_name: 'ANANYA SHARMA',
    handler_id: 'SKL-00104',
    job_title: 'Senior Event Lead',
    team: 'Workshop Operations',
    status: 'active',
    verification_status: 'VERIFIED',
    joined_at: '2025-08-15',
    cities: { name: 'Bengaluru' },
  };

  const mockPending = {
    full_name: 'ROHIT VERMA',
    handler_id: 'SKL-00219',
    job_title: 'Event Facilitator',
    team: 'Craft Logistics',
    status: 'pending',
    verification_status: 'PENDING',
    joined_at: '2026-03-01',
    cities: { name: 'Mumbai' },
  };

  const mockResubmit = {
    full_name: 'PRIYA NAIR',
    handler_id: 'SKL-00188',
    job_title: 'Studio Associate',
    team: 'Event Prep',
    status: 'resubmission_required',
    verification_status: 'RESUBMISSION_REQUIRED',
    joined_at: '2026-02-12',
    cities: { name: 'Delhi NCR' },
  };

  const mockSuspended = {
    full_name: 'VIKRAM SEN',
    handler_id: 'SKL-00082',
    job_title: 'Field Coordinator',
    team: 'Setup Crew',
    status: 'suspended',
    verification_status: 'VERIFIED',
    joined_at: '2024-11-20',
    cities: { name: 'Hyderabad' },
  };

  const mockRecord = {
    verification_token: '7f9c2d18-3a45-42a1-b657-e9a184f0012c',
    valid_until: '2027-12-31',
    created_at: '2025-08-15T10:00:00Z',
  };

  return (
    <main className="dev-preview-page">
      <div className="dev-preview-notice">
        <div className="dev-notice-badge">DEVELOPER PREVIEW</div>
        <h1>Digital ID Acrylic Badge — 4 System States</h1>
        <p>
          Temporary preview showing all four database status states side by side.
          <strong> Please delete this route (/dev/id-preview) before production launch.</strong>
        </p>
        <Link href="/handler/id-card" className="dev-notice-link">
          ← Return to Live Handler ID Page
        </Link>
      </div>

      <div className="dev-preview-grid">
        {/* 1. VERIFIED */}
        <section className="dev-card-column">
          <div className="dev-column-label">
            <span className="dev-badge-dot verified" />
            <b>1. VERIFIED STATE</b>
            <small>status=active, verification=VERIFIED</small>
          </div>
          <DigitalIdCard
            profile={mockVerified}
            record={mockRecord}
            statusOverride="verified"
            origin="https://portal.skillodiy.com"
          />
        </section>

        {/* 2. PENDING */}
        <section className="dev-card-column">
          <div className="dev-column-label">
            <span className="dev-badge-dot pending" />
            <b>2. PENDING STATE</b>
            <small>status=pending, verification=PENDING</small>
          </div>
          <DigitalIdCard
            profile={mockPending}
            record={null}
            statusOverride="pending"
            origin="https://portal.skillodiy.com"
          />
        </section>

        {/* 3. RESUBMISSION REQUIRED */}
        <section className="dev-card-column">
          <div className="dev-column-label">
            <span className="dev-badge-dot resubmit" />
            <b>3. RESUBMISSION REQUIRED</b>
            <small>Provides button to onboarding step</small>
          </div>
          <DigitalIdCard
            profile={mockResubmit}
            record={null}
            statusOverride="resubmission_required"
            origin="https://portal.skillodiy.com"
          />
        </section>

        {/* 4. SUSPENDED */}
        <section className="dev-card-column">
          <div className="dev-column-label">
            <span className="dev-badge-dot suspended" />
            <b>4. SUSPENDED / INACTIVE</b>
            <small>Muted, desaturated styling</small>
          </div>
          <DigitalIdCard
            profile={mockSuspended}
            record={null}
            statusOverride="suspended"
            origin="https://portal.skillodiy.com"
          />
        </section>
      </div>
    </main>
  );
}
