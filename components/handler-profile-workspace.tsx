'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BadgeCheck,
  Briefcase,
  Camera,
  Check,
  CreditCard,
  Download,
  LoaderCircle,
  Mail,
  MapPin,
  Pencil,
  Phone,
  RotateCw,
  Save,
  Share2,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import DigitalIdCard from '@/components/digital-id-card';
import { downloadIdCard } from '@/lib/id-card-export';

type ProfileData = {
  id: string;
  role: string;
  full_name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  team: string | null;
  handler_id: string | null;
  status: string;
  joined_at: string | null;
  photo_path: string | null;
  home_city_id: string | null;
  verification_status: string | null;
  cities: { name: string } | null;
};

type DigitalIdRecord = {
  verification_token: string;
  valid_until: string | null;
  created_at: string;
} | null;

type CityOption = {
  id: string;
  name: string;
  code: string;
};

export default function HandlerProfileWorkspace({
  profile,
  record,
  cities = [],
  origin = '',
  photoDataUrl = null,
  photoUnavailable = false,
  verificationUnavailable = false,
  digitalIdUnavailable = false,
}: {
  profile: ProfileData;
  record: DigitalIdRecord;
  cities?: CityOption[];
  origin?: string;
  photoDataUrl?: string | null;
  photoUnavailable?: boolean;
  verificationUnavailable?: boolean;
  digitalIdUnavailable?: boolean;
}) {
  const router = useRouter();
  const frontCardRef = useRef<SVGSVGElement | null>(null);

  // ID Card State
  const [flipped, setFlipped] = useState(false);
  const [busyExport, setBusyExport] = useState<'' | 'png' | 'pdf'>('');
  const [exportNotice, setExportNotice] = useState('');
  const [exportError, setExportError] = useState('');

  // Profile Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [homeCityId, setHomeCityId] = useState(profile.home_city_id || '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(photoDataUrl);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  // Email Change State
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isEmailSaving, setIsEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');

  // Export handlers
  async function handleExport(format: 'png' | 'pdf') {
    if (busyExport || !frontCardRef.current) return;
    setBusyExport(format);
    setExportError('');
    setExportNotice('');
    try {
      await downloadIdCard(frontCardRef.current, profile.handler_id ?? 'staff-id', format);
      setExportNotice(`${format.toUpperCase()} ID card downloaded successfully.`);
    } catch {
      setExportError(`Could not generate ${format.toUpperCase()} export. Please try again.`);
    } finally {
      setBusyExport('');
    }
  }

  async function handleShare() {
    if (!record?.verification_token) return;
    const url = `${(origin || window.location.origin).replace(/\/$/, '')}/verify/${record.verification_token}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'EventOps Staff Credential',
          text: `Verify ${profile.full_name}'s EventOps staff status.`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setExportNotice('Verification link copied to clipboard.');
      }
    } catch {
      // User dismissed share dialog
    }
  }

  // Profile Edit Handlers
  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setSaveError('Please select a JPG, PNG, or WebP photo.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setSaveError('Photo size must be under 5 MB.');
      return;
    }

    setSaveError('');
    setPhotoFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setFullName(profile.full_name || '');
    setPhone(profile.phone || '');
    setHomeCityId(profile.home_city_id || '');
    setPhotoFile(null);
    setPhotoPreview(photoDataUrl);
    setSaveError('');
    setSaveSuccess('');
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;

    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setSaveError('Please enter a valid full name (minimum 2 characters).');
      return;
    }

    const trimmedPhone = phone.trim();
    if (trimmedPhone && trimmedPhone.replace(/[^0-9]/g, '').length < 7) {
      setSaveError('Please enter a valid phone number (at least 7 digits).');
      return;
    }

    setIsSaving(true);
    setSaveError('');
    setSaveSuccess('');

    try {
      const supabase = createClient();
      let newPhotoPath = profile.photo_path;

      // 1. Upload photo if selected
      if (photoFile) {
        const ext = photoFile.type === 'image/png' ? 'png' : photoFile.type === 'image/webp' ? 'webp' : 'jpg';
        const uploadPath = `${profile.id}/profile/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(uploadPath, photoFile, {
            contentType: photoFile.type,
            upsert: false,
          });

        if (uploadError) {
          throw new Error('Photo could not be saved securely. Please try again.');
        }

        newPhotoPath = uploadPath;
      }

      // 2. Update profile table row (enforcing user ownership)
      const updateData: Record<string, any> = {
        full_name: trimmedName,
        phone: trimmedPhone || null,
        home_city_id: homeCityId || null,
      };

      if (newPhotoPath !== profile.photo_path) {
        updateData.photo_path = newPhotoPath;
      }

      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profile.id);

      if (profileUpdateError) {
        throw new Error(profileUpdateError.message || 'Profile details could not be updated.');
      }

      // 3. Keep auth metadata in sync
      try {
        await supabase.auth.updateUser({
          data: { full_name: trimmedName },
        });
      } catch {
        // Non-blocking metadata sync
      }

      setSaveSuccess('Your profile has been successfully updated.');
      setIsEditing(false);
      setPhotoFile(null);
      router.refresh();
    } catch (err: any) {
      setSaveError(err.message || 'An error occurred while saving profile changes.');
    } finally {
      setIsSaving(false);
    }
  }

  // Email Change Handlers
  async function handleSaveEmail(e: React.FormEvent) {
    e.preventDefault();
    if (isEmailSaving) return;

    const trimmedEmail = newEmail.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    if (trimmedEmail === profile.email.toLowerCase()) {
      setEmailError('The new email must be different from your current email.');
      return;
    }

    setIsEmailSaving(true);
    setEmailError('');
    setEmailSuccess('');

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        email: trimmedEmail,
      });

      if (error) {
        throw error;
      }

      setEmailSuccess(`A confirmation link has been sent to ${trimmedEmail}. Please check your inbox and confirm the change.`);
      setNewEmail('');
    } catch (err: any) {
      setEmailError(err.message || 'Could not initiate email change. Please try again.');
    } finally {
      setIsEmailSaving(false);
    }
  }

  // Ensure city list includes current home city if not present in active query
  const availableCities = [...cities];
  if (profile.home_city_id && profile.cities?.name && !availableCities.some((c) => c.id === profile.home_city_id)) {
    availableCities.unshift({
      id: profile.home_city_id,
      name: profile.cities.name,
      code: 'CUR',
    });
  }

  const isVerifiedStatus = String(profile.verification_status ?? '').toUpperCase() === 'VERIFIED';

  return (
    <main className="profile-workspace-page">
      {/* Top Breadcrumb & Page Heading */}
      <header className="profile-page-header">
        <div className="profile-breadcrumb-nav">
          <Link href="/handler" className="profile-breadcrumb-link">
            Handler Workspace
          </Link>
          <span className="profile-breadcrumb-sep">/</span>
          <span className="profile-breadcrumb-current">My Profile</span>
        </div>
        <div className="profile-heading-content">
          <div className="profile-heading-title-row">
            <span className="profile-heading-icon" aria-hidden="true">
              <BadgeCheck size={20} />
            </span>
            <div>
              <span className="profile-heading-eyebrow">EVENTOPS STAFF CREDENTIAL</span>
              <h1>My Profile</h1>
            </div>
          </div>
          <p className="profile-heading-subtitle">
            Manage your personal details and view your EventOps staff identity.
          </p>
        </div>
      </header>

      {/* Main Two-Column Layout */}
      <div className="profile-workspace-grid">
        {/* LEFT COLUMN: Static Digital ID Card + Lanyard */}
        <section className="profile-card-column" aria-label="Digital Staff Identity Card">
          <div className="static-id-card-stage">
            {/* Simple, realistic static fabric lanyard */}
            <div className="static-lanyard-hanger" aria-hidden="true">
              <svg
                className="static-lanyard-svg"
                viewBox="0 0 320 62"
                preserveAspectRatio="xMidYMin meet"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="static-strap-fabric" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#0c3534" />
                    <stop offset="25%" stopColor="#144d4b" />
                    <stop offset="50%" stopColor="#1c6361" />
                    <stop offset="75%" stopColor="#144d4b" />
                    <stop offset="100%" stopColor="#0a2c2b" />
                  </linearGradient>
                  <pattern id="static-strap-weave" width="6" height="6" patternUnits="userSpaceOnUse">
                    <path d="M0 1h6M0 4h6" stroke="#488c89" strokeOpacity="0.22" strokeWidth="0.8" />
                    <path d="M1 0v6M4 0v6" stroke="#051f1e" strokeOpacity="0.25" strokeWidth="0.8" />
                  </pattern>
                  <linearGradient id="static-clasp-metal" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#768789" />
                    <stop offset="25%" stopColor="#f2f7f7" />
                    <stop offset="60%" stopColor="#8c9ea0" />
                    <stop offset="100%" stopColor="#556567" />
                  </linearGradient>
                </defs>

                {/* Left straight fabric strip extending directly from top edge with no gap */}
                <rect x="135" y="0" width="18" height="42" fill="url(#static-strap-fabric)" />
                <rect x="135" y="0" width="18" height="42" fill="url(#static-strap-weave)" />

                {/* Right straight fabric strip extending directly from top edge with no gap */}
                <rect x="167" y="0" width="18" height="42" fill="url(#static-strap-fabric)" />
                <rect x="167" y="0" width="18" height="42" fill="url(#static-strap-weave)" />

                {/* Straight metal clasp connector */}
                <rect x="128" y="38" width="64" height="11" rx="2.5" fill="url(#static-clasp-metal)" stroke="#435254" strokeWidth="0.75" />
                <rect x="131" y="41" width="58" height="1.5" fill="#ffffff" opacity="0.6" />

                {/* Small realistic metal ring / clip joining card slot */}
                <circle cx="160" cy="50" r="4" fill="none" stroke="url(#static-clasp-metal)" strokeWidth="2.5" />
                <path d="M157 51 v7 q0 2 3 2 q3 0 3 -2 v-7" fill="none" stroke="url(#static-clasp-metal)" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </div>

            {/* Static Card Container */}
            <div className="static-id-card-wrapper">
              <DigitalIdCard
                profile={profile}
                record={record}
                origin={origin}
                photoDataUrl={photoPreview || photoDataUrl}
                frontRef={frontCardRef}
                isFlippedControlled={flipped}
                onFlipChange={setFlipped}
                showSlotHole={true}
              />
            </div>

            {/* Download & Card Controls (Neatly below card) */}
            <div className="id-card-actions-bar">
              <button
                type="button"
                className="button button-primary id-action-btn"
                onClick={() => handleExport('png')}
                disabled={!!busyExport}
                aria-label="Download complete ID card as high-resolution PNG"
              >
                {busyExport === 'png' ? (
                  <LoaderCircle size={15} className="auth-spinner" />
                ) : (
                  <Download size={15} />
                )}
                Download PNG
              </button>
              <button
                type="button"
                className="button button-secondary id-action-btn"
                onClick={() => handleExport('pdf')}
                disabled={!!busyExport}
                aria-label="Download print-ready CR80 ID card PDF"
              >
                {busyExport === 'pdf' ? (
                  <LoaderCircle size={15} className="auth-spinner" />
                ) : (
                  <Download size={15} />
                )}
                Download PDF
              </button>
              <button
                type="button"
                className="button button-secondary id-flip-btn"
                onClick={() => setFlipped((v) => !v)}
                aria-label={flipped ? 'Show card front' : 'Turn card over'}
              >
                <RotateCw size={14} />
                {flipped ? 'Front' : 'Back'}
              </button>
              {record?.verification_token && isVerifiedStatus && (
                <button
                  type="button"
                  className="button button-secondary id-share-btn"
                  onClick={handleShare}
                  aria-label="Share secure verification link"
                  title="Share verification link"
                >
                  <Share2 size={15} />
                </button>
              )}
            </div>

            {/* Notifications / Error messages */}
            {(exportNotice || exportError || photoUnavailable || verificationUnavailable || digitalIdUnavailable) && (
              <div className="id-card-feedback-panel" aria-live="polite">
                {exportNotice && (
                  <p className="feedback-item feedback-success">
                    <Check size={14} /> {exportNotice}
                  </p>
                )}
                {exportError && (
                  <p className="feedback-item feedback-error" role="alert">
                    {exportError}
                  </p>
                )}
                {photoUnavailable && (
                  <p className="feedback-item feedback-neutral">
                    Profile photo could not be retrieved from secure storage. Initials are displayed.
                  </p>
                )}
                {verificationUnavailable && (
                  <p className="feedback-item feedback-neutral">
                    Verification status could not be verified in real time.
                  </p>
                )}
                {digitalIdUnavailable && (
                  <p className="feedback-item feedback-neutral">
                    Verification token record is temporarily unavailable.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: Profile Information & Edit Profile */}
        <section className="profile-details-column" aria-label="Profile Details and Management">
          <div className="profile-panel-card">
            <div className="profile-panel-header">
              <div>
                <h2>Your Profile</h2>
                <p>Keep your details up to date.</p>
              </div>
              {!isEditing && (
                <button
                  type="button"
                  className="button button-secondary profile-edit-toggle-btn"
                  onClick={() => {
                    setIsEditing(true);
                    setSaveError('');
                    setSaveSuccess('');
                  }}
                >
                  <Pencil size={14} />
                  Edit Profile
                </button>
              )}
            </div>

            {saveSuccess && (
              <div className="workflow-success profile-banner-notice" role="status">
                <Check size={15} />
                <span>{saveSuccess}</span>
              </div>
            )}

            {!isEditing ? (
              /* VIEW MODE: Clearly separated rows / cards */
              <div className="profile-info-grid">
                <div className="profile-info-row">
                  <div className="profile-info-label">
                    <User size={15} />
                    <span>Full Name</span>
                  </div>
                  <div className="profile-info-val">
                    <b>{profile.full_name}</b>
                  </div>
                </div>

                <div className="profile-info-row">
                  <div className="profile-info-label">
                    <Mail size={15} />
                    <span>Email Address</span>
                  </div>
                  <div className="profile-info-val profile-email-display-val">
                    <div>
                      <b>{profile.email}</b>
                      <span className="profile-auth-badge">Supabase Auth</span>
                    </div>
                    <button
                      type="button"
                      className="profile-link-btn"
                      onClick={() => {
                        setEmailModalOpen(true);
                        setEmailError('');
                        setEmailSuccess('');
                        setNewEmail('');
                      }}
                    >
                      Change email
                    </button>
                  </div>
                </div>

                <div className="profile-info-row">
                  <div className="profile-info-label">
                    <Phone size={15} />
                    <span>Phone Number</span>
                  </div>
                  <div className="profile-info-val">
                    {profile.phone ? (
                      <b>{profile.phone}</b>
                    ) : (
                      <span className="profile-not-added">Not added</span>
                    )}
                  </div>
                </div>

                <div className="profile-info-row">
                  <div className="profile-info-label">
                    <CreditCard size={15} />
                    <span>Handler ID</span>
                  </div>
                  <div className="profile-info-val">
                    <code className="profile-mono-badge">{profile.handler_id || 'Not assigned'}</code>
                  </div>
                </div>

                <div className="profile-info-row">
                  <div className="profile-info-label">
                    <Briefcase size={15} />
                    <span>Role / Designation</span>
                  </div>
                  <div className="profile-info-val">
                    <b>{profile.job_title || (profile.role === 'handler' ? 'Event Handler' : profile.role)}</b>
                  </div>
                </div>

                <div className="profile-info-row">
                  <div className="profile-info-label">
                    <Users size={15} />
                    <span>Team / Department</span>
                  </div>
                  <div className="profile-info-val">
                    {profile.team ? (
                      <b>{profile.team}</b>
                    ) : (
                      <span className="profile-not-added">Not added</span>
                    )}
                  </div>
                </div>

                <div className="profile-info-row">
                  <div className="profile-info-label">
                    <MapPin size={15} />
                    <span>Home City</span>
                  </div>
                  <div className="profile-info-val">
                    {profile.cities?.name ? (
                      <b>{profile.cities.name}</b>
                    ) : (
                      <span className="profile-not-added">Not added</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* EDIT MODE: Inline editing form */
              <form onSubmit={handleSaveProfile} className="profile-edit-form">
                <div className="profile-form-fields">
                  {/* Full Name */}
                  <label className="workflow-field">
                    <span>
                      Full Name <strong className="profile-required">*</strong>
                    </span>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Arjun Menon"
                      disabled={isSaving}
                      maxLength={120}
                    />
                  </label>

                  {/* Phone Number */}
                  <label className="workflow-field">
                    <span>Phone Number</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +91 98400 00000"
                      disabled={isSaving}
                      maxLength={30}
                    />
                  </label>

                  {/* Home City */}
                  <label className="workflow-field">
                    <span>Home City</span>
                    <select
                      value={homeCityId}
                      onChange={(e) => setHomeCityId(e.target.value)}
                      disabled={isSaving}
                    >
                      <option value="">Select home city</option>
                      {availableCities.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.code ? `(${c.code})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>

                  {/* Profile Photograph */}
                  <div className="workflow-field">
                    <span>Profile Photograph</span>
                    <div className="profile-photo-picker-box">
                      <div className="profile-photo-avatar-preview">
                        {photoPreview ? (
                          <img src={photoPreview} alt="Selected profile preview" />
                        ) : (
                          <Camera size={24} className="profile-photo-camera-icon" />
                        )}
                      </div>
                      <div className="profile-photo-picker-action">
                        <input
                          type="file"
                          id="handler-photo-upload"
                          accept="image/jpeg,image/png,image/webp"
                          className="visually-hidden"
                          onChange={handlePhotoSelect}
                          disabled={isSaving}
                        />
                        <label
                          htmlFor="handler-photo-upload"
                          className="button button-secondary profile-upload-label-btn"
                        >
                          <Upload size={14} />
                          {photoFile ? 'Choose another photo' : 'Select photo'}
                        </label>
                        <small className="profile-field-hint">
                          JPG, PNG, or WebP up to 5 MB. Updates your Digital ID badge.
                        </small>
                      </div>
                    </div>
                  </div>

                  {/* Administrative Fields Info Notice */}
                  <div className="profile-admin-notice">
                    <small>
                      Handler ID (<code>{profile.handler_id}</code>), Role (
                      <b>{profile.job_title || profile.role}</b>), and Department (
                      <b>{profile.team || 'Event Operations'}</b>) are assigned by organization administrators.
                    </small>
                  </div>
                </div>

                {saveError && (
                  <div className="workflow-error" role="alert">
                    {saveError}
                  </div>
                )}

                <div className="profile-edit-actions-footer">
                  <button
                    type="submit"
                    className="button button-primary profile-save-btn"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <LoaderCircle size={15} className="auth-spinner" />
                    ) : (
                      <Save size={15} />
                    )}
                    Save Changes
                  </button>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>

      {/* SEPARATE EMAIL UPDATE MODAL FLOW */}
      {emailModalOpen && (
        <div
          className="profile-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="email-modal-title"
        >
          <div className="profile-modal-dialog">
            <div className="profile-modal-header">
              <div className="profile-modal-title-wrap">
                <span className="profile-modal-icon">
                  <Mail size={16} />
                </span>
                <h3 id="email-modal-title">Change Email Address</h3>
              </div>
              <button
                type="button"
                className="profile-modal-close-btn"
                onClick={() => setEmailModalOpen(false)}
                aria-label="Close dialog"
                disabled={isEmailSaving}
              >
                <X size={16} />
              </button>
            </div>

            <p className="profile-modal-description">
              Your email is managed securely via Supabase Authentication. Changing your address requires
              email verification. A confirmation link will be delivered to your new address.
            </p>

            <form onSubmit={handleSaveEmail}>
              <div className="profile-modal-body">
                <label className="workflow-field">
                  <span>Current Email</span>
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    className="profile-input-readonly"
                  />
                </label>

                <label className="workflow-field">
                  <span>
                    New Email Address <strong className="profile-required">*</strong>
                  </span>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="e.g. arjun.work@example.com"
                    disabled={isEmailSaving}
                  />
                </label>

                {emailError && (
                  <div className="workflow-error" role="alert">
                    {emailError}
                  </div>
                )}
                {emailSuccess && (
                  <div className="workflow-success" role="status">
                    <Check size={14} />
                    <span>{emailSuccess}</span>
                  </div>
                )}
              </div>

              <div className="profile-modal-footer">
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={isEmailSaving}
                >
                  {isEmailSaving ? (
                    <LoaderCircle size={14} className="auth-spinner" />
                  ) : (
                    <Mail size={14} />
                  )}
                  Send Verification
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setEmailModalOpen(false)}
                  disabled={isEmailSaving}
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
