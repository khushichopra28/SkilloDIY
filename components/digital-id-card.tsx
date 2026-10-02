'use client';

import { useEffect, useState, type RefObject } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { createClient } from '@/lib/supabase/client';

export type IdCardStatus = 'pending' | 'verified' | 'resubmission_required' | 'rejected' | 'suspended' | 'unavailable';
type Row = Record<string, any>;

export interface DigitalIdCardProps {
  profile: Row;
  record?: Row | null;
  origin?: string;
  photoDataUrl?: string | null;
  frontRef?: RefObject<SVGSVGElement | null>;
  isFlippedControlled?: boolean;
  onFlipChange?: (flipped: boolean) => void;
  showSlotHole?: boolean;
  /** Used only by the existing non-production status preview route. */
  statusOverride?: IdCardStatus;
}

export function resolveCardStatus(profile: Row): IdCardStatus {
  const active = String(profile?.status ?? '').toLowerCase() === 'active';
  const verification = String(profile?.verification_status ?? '').toUpperCase();
  if (!active) return 'suspended';
  if (!verification) return 'unavailable';
  if (verification === 'VERIFIED') return 'verified';
  if (verification === 'PENDING') return 'pending';
  if (verification === 'RESUBMISSION_REQUIRED') return 'resubmission_required';
  if (verification === 'REJECTED') return 'rejected';
  return 'unavailable';
}

function wrapName(value: string, limit = 17) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > limit && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines.length > 3 ? [...lines.slice(0, 2), lines.slice(2).join(' ')] : lines;
}

function statusLabel(status: IdCardStatus) {
  return status === 'verified' ? 'VERIFIED' : status === 'pending' ? 'PENDING REVIEW' : status === 'resubmission_required' ? 'UPDATE REQUIRED' : status === 'rejected' ? 'NOT APPROVED' : status === 'unavailable' ? 'STATUS UNAVAILABLE' : 'INACTIVE';
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'ID';
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DigitalIdCard({ profile, record, origin = '', photoDataUrl, frontRef, isFlippedControlled, onFlipChange, showSlotHole = true, statusOverride }: DigitalIdCardProps) {
  const [internalFlipped, setInternalFlipped] = useState(false);
  const flipped = isFlippedControlled ?? internalFlipped;
  const [loadedPhoto, setLoadedPhoto] = useState<string | null>(photoDataUrl ?? null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const status = statusOverride ?? resolveCardStatus(profile);
  const isVerified = status === 'verified';
  const siteUrl = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  const token = typeof record?.verification_token === 'string' ? record.verification_token : '';
  const verificationUrl = isVerified && token && siteUrl ? `${siteUrl.replace(/\/$/, '')}/verify/${token}` : '';
  const fullName = String(profile?.full_name ?? '').trim();
  const nameLines = wrapName(fullName || 'Handler');
  const location = typeof profile?.cities?.name === 'string' ? profile.cities.name : '';
  const role = typeof profile?.job_title === 'string' && profile.job_title.trim() ? profile.job_title.trim() : 'Event Handler';
  const team = typeof profile?.team === 'string' ? profile.team.trim() : '';
  const email = typeof profile?.email === 'string' ? profile.email.trim() : '';
  const handlerId = typeof profile?.handler_id === 'string' ? profile.handler_id : '';
  const validUntil = formatDate(record?.valid_until);

  useEffect(() => {
    if (photoDataUrl !== undefined) {
      setLoadedPhoto(photoDataUrl);
      setPhotoFailed(Boolean(profile?.photo_path && !photoDataUrl));
      return;
    }
    if (!profile?.photo_path) {
      setLoadedPhoto(null);
      setPhotoFailed(false);
      return;
    }
    let current = true;
    setLoadedPhoto(null);
    setPhotoFailed(false);
    // The project stores handler profile photographs in the private documents bucket.
    createClient().storage.from('documents').createSignedUrl(profile.photo_path, 900).then(({ data, error }) => {
      if (!current) return;
      if (error || !data?.signedUrl) setPhotoFailed(true);
      else setLoadedPhoto(data.signedUrl);
    }).catch(() => { if (current) setPhotoFailed(true); });
    return () => { current = false; };
  }, [photoDataUrl, profile?.photo_path]);

  function toggleFlip() {
    const next = !flipped;
    setInternalFlipped(next);
    onFlipChange?.(next);
  }

  const nameFontSize = nameLines.length > 2 ? 24 : nameLines.length === 2 ? 27 : 31;
  const idText = handlerId || 'ID NOT ASSIGNED';
  const city = location || 'Location not set';
  const issued = formatDate(profile?.joined_at) ?? formatDate(record?.created_at);

  return (
    <div className={`acrylic-id-wrap ${status === 'suspended' ? 'is-suspended' : ''}`}>
      <div
        className={`digital-id-card-3d-wrapper ${flipped ? 'is-flipped' : ''}`}
        onClick={toggleFlip}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleFlip();
          }
        }}
        tabIndex={0}
        role="button"
        aria-label={flipped ? 'Show front of digital ID card' : 'Turn digital ID card over'}
      >
        <svg
          ref={frontRef}
          className="digital-id-card digital-id-card-front"
          viewBox="0 0 430 680"
          role="img"
          aria-label={`EventOps staff identity card for ${fullName || 'handler'}`}
          xmlns="http://www.w3.org/2000/svg"
          data-id-card-export="front"
        >
          <defs>
            <linearGradient id="id-top" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#dff3f1"/><stop offset="1" stopColor="#9ad4d3"/></linearGradient>
            <linearGradient id="id-body" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff"/><stop offset="1" stopColor="#eef7f6"/></linearGradient>
            <linearGradient id="id-band" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#195c5a"/><stop offset="1" stopColor="#0c302f"/></linearGradient>
            <linearGradient id="id-laminate" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff" stopOpacity=".43"/><stop offset=".38" stopColor="#fff" stopOpacity="0"/><stop offset=".72" stopColor="#fff" stopOpacity=".11"/><stop offset="1" stopColor="#fff" stopOpacity=".27"/></linearGradient>
            <linearGradient id="id-metal" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff"/><stop offset=".25" stopColor="#9caeb1"/><stop offset=".48" stopColor="#f6fbfb"/><stop offset=".73" stopColor="#87999b"/><stop offset="1" stopColor="#e6eeee"/></linearGradient>
            <pattern id="id-weave" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 0h8M0 4h8" stroke="#fff" strokeOpacity=".08"/><path d="M0 0v8M4 0v8" stroke="#0c302f" strokeOpacity=".1"/></pattern>
            <filter id="photo-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="7" stdDeviation="8" floodColor="#123e3d" floodOpacity=".22"/></filter>
            <clipPath id="photo-clip"><rect x="36" y="174" width="150" height="184" rx="12"/></clipPath>
            <clipPath id="card-clip"><rect x="6" y="6" width="418" height="668" rx="28"/></clipPath>
          </defs>
          <g clipPath="url(#card-clip)">
            <rect x="6" y="6" width="418" height="668" rx="28" fill="url(#id-body)"/>
            <path d="M6 34Q6 6 34 6h362q28 0 28 28v116H6z" fill="url(#id-top)"/>
            <path d="M6 6h418v146H6z" fill="url(#id-weave)" opacity=".5"/>
            <path d="M6 137h418v8H6z" fill="#147b79" opacity=".75"/>
            <rect x="34" y="36" width="44" height="44" rx="12" fill="#123e3d"/>
            <text x="56" y="67" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="27" fontWeight="800" fill="#b8e5e2">E</text>
            <text x="91" y="52" fontFamily="Arial,sans-serif" fontSize="23" fontWeight="800" letterSpacing="2.2" fill="#123e3d">EVENTOPS</text>
            <text x="92" y="72" fontFamily="Arial,sans-serif" fontSize="9.5" fontWeight="700" letterSpacing="2.3" fill="#467472">EVENT WORKFORCE</text>
            <text x="36" y="111" fontFamily="Arial,sans-serif" fontSize="10" fontWeight="700" letterSpacing="2.3" fill="#397471">STAFF IDENTITY CREDENTIAL</text>

            {showSlotHole && <g aria-hidden="true"><ellipse cx="215" cy="20" rx="21" ry="7" fill="#637776" opacity=".55"/><rect x="191" y="7" width="48" height="22" rx="10" fill="url(#id-metal)" opacity=".85"/><ellipse cx="215" cy="18" rx="9" ry="3.8" fill="#294746"/><ellipse cx="215" cy="18" rx="5.3" ry="2" fill="#0c302f"/></g>}

            <g filter="url(#photo-shadow)">
              <rect x="31" y="169" width="160" height="194" rx="16" fill="#fff"/>
              <rect x="36" y="174" width="150" height="184" rx="12" fill="#dceceb"/>
              {loadedPhoto ? <image href={loadedPhoto} x="36" y="174" width="150" height="184" preserveAspectRatio="xMidYMid slice" clipPath="url(#photo-clip)"/> : <g><rect x="36" y="174" width="150" height="184" rx="12" fill="#dceceb"/><circle cx="111" cy="239" r="37" fill="#b0d6d3"/><path d="M48 345c7-49 32-72 63-72s56 23 63 72" fill="#80b7b3"/><text x="111" y="253" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="30" fontWeight="700" fill="#fff">{initials(fullName)}</text></g>}
              <rect x="36" y="174" width="150" height="184" rx="12" fill="url(#id-laminate)" stroke="#fff" strokeOpacity=".8" strokeWidth="1.5"/>
            </g>

            <text x="214" y="184" fontFamily="Arial,sans-serif" fontSize="9" fontWeight="700" letterSpacing="2" fill="#718887">FULL NAME</text>
            {nameLines.map((line, i) => <text key={`${line}-${i}`} x="212" y={220 + i * 36} fontFamily="Arial,sans-serif" fontSize={nameFontSize} fontWeight="800" letterSpacing="-.7" textLength={Math.min(184, line.length * nameFontSize * 0.58)} lengthAdjust="spacingAndGlyphs" fill="#163f3e">{line}</text>)}
            <text x="214" y={Math.max(294, 236 + nameLines.length * 34)} fontFamily="Arial,sans-serif" fontSize="9" fontWeight="700" letterSpacing="1.8" fill="#718887">ROLE / DESIGNATION</text>
            <text x="214" y={Math.max(318, 261 + nameLines.length * 34)} fontFamily="Arial,sans-serif" fontSize="15" fontWeight="700" fill="#284d4c">{role.length > 20 ? `${role.slice(0, 19)}…` : role}</text>
            {team && <text x="214" y={Math.max(340, 283 + nameLines.length * 34)} fontFamily="Arial,sans-serif" fontSize="11" fontWeight="600" fill="#718887">{team.length > 24 ? `${team.slice(0, 23)}…` : team}</text>}
            <g transform="translate(35 382)"><path d="M7 1a6 6 0 0 0-6 6c0 4.4 6 11 6 11s6-6.6 6-11a6 6 0 0 0-6-6Zm0 8.2A2.2 2.2 0 1 1 7 4.8a2.2 2.2 0 0 1 0 4.4Z" fill="#287c7a"/><text x="23" y="13" fontFamily="Arial,sans-serif" fontSize="11" fontWeight="700" fill="#476664">{city.length > 33 ? `${city.slice(0, 32)}…` : city}</text></g>
            <text x="36" y="426" fontFamily="Arial,sans-serif" fontSize="9" fontWeight="700" letterSpacing="1.7" fill="#78908e">HANDLER ID</text>
            <rect x="30" y="439" width="370" height="102" rx="17" fill="url(#id-band)"/>
            <path d="M30 456q0-17 17-17h336q17 0 17 17v4H30z" fill="url(#id-weave)" opacity=".75"/>
            <text x="50" y="489" fontFamily="Courier New,monospace" fontSize={handlerId.length > 13 ? 19 : 24} fontWeight="700" letterSpacing="1.2" fill="#fff">{idText}</text>
            <text x="51" y="516" fontFamily="Arial,sans-serif" fontSize="8" fontWeight="700" letterSpacing="1.8" fill="#a9d9d6">EVENT OPERATIONS TEAM</text>
            {verificationUrl ? <g transform="translate(306 451)"><rect x="-5" y="-5" width="82" height="82" rx="7" fill="#fff"/><QRCodeSVG value={verificationUrl} size={72} level="M" bgColor="#ffffff" fgColor="#123e3d"/></g> : <g><rect x="307" y="453" width="68" height="68" rx="7" fill="#244b49" stroke="#5d8683"/><text x="341" y="484" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="7" fontWeight="700" fill="#d5ecea">{isVerified ? 'QR UNAVAILABLE' : 'NOT VERIFIED'}</text><text x="341" y="496" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="6" fill="#b1d4d1">STATUS ONLY</text></g>}

            <path d="M36 559h358" stroke="#d7e5e3"/>
            <text x="36" y="581" fontFamily="Arial,sans-serif" fontSize="8" fontWeight="700" letterSpacing="1.4" fill="#718887">EMAIL</text>
            <text x="36" y="600" fontFamily="Arial,sans-serif" fontSize="11" fontWeight="600" fill="#284d4c">{email.length > 43 ? `${email.slice(0, 42)}…` : email || 'Not provided'}</text>
            <text x="36" y="632" fontFamily="Arial,sans-serif" fontSize="8" fontWeight="700" letterSpacing="1.2" fill="#718887">{validUntil ? 'VALID THROUGH' : issued ? 'ISSUED' : 'STATUS'}</text>
            <text x="36" y="651" fontFamily="Arial,sans-serif" fontSize="10" fontWeight="700" fill="#284d4c">{validUntil ?? issued ?? statusLabel(status)}</text>
            <text x="394" y="651" textAnchor="end" fontFamily="Arial,sans-serif" fontSize="8" fontWeight="700" letterSpacing="1.2" fill="#718887">EVENTOPS</text>

            <rect x="7" y="7" width="416" height="666" rx="27" fill="url(#id-laminate)" pointerEvents="none"/>
          </g>
          <rect x="6.5" y="6.5" width="417" height="667" rx="28" fill="none" stroke="url(#id-metal)" strokeWidth="3"/>
          <rect x="11" y="11" width="408" height="658" rx="24" fill="none" stroke="#fff" strokeOpacity=".68"/>
        </svg>

        <svg className="digital-id-card digital-id-card-back" viewBox="0 0 430 680" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="back-band" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#1a5c5a"/><stop offset="1" stopColor="#0b302f"/></linearGradient><linearGradient id="back-metal"><stop stopColor="#fff"/><stop offset=".5" stopColor="#8ea4a3"/><stop offset="1" stopColor="#e8f0ef"/></linearGradient></defs>
          <rect x="6" y="6" width="418" height="668" rx="28" fill="#f6fbfa"/><path d="M6 34Q6 6 34 6h362q28 0 28 28v108H6z" fill="#dcefed"/><rect x="6.5" y="6.5" width="417" height="667" rx="28" fill="none" stroke="url(#back-metal)" strokeWidth="3"/>
          <text x="215" y="71" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="24" fontWeight="800" letterSpacing="2" fill="#123e3d">EVENTOPS</text><text x="215" y="96" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="9" fontWeight="700" letterSpacing="2" fill="#547a78">STAFF IDENTITY CREDENTIAL</text>
          {verificationUrl ? <g transform="translate(115 174)"><rect width="200" height="200" rx="14" fill="#fff" stroke="#cfdfdd"/><g transform="translate(22 22)"><QRCodeSVG value={verificationUrl} size={156} level="H" bgColor="#ffffff" fgColor="#123e3d"/></g></g> : <g><rect x="115" y="174" width="200" height="200" rx="14" fill="#eef5f4" stroke="#d3e1df"/><text x="215" y="272" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="12" fontWeight="700" fill="#587573">VERIFICATION LINK</text><text x="215" y="294" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="12" fontWeight="700" fill="#587573">UNAVAILABLE</text></g>}
          <text x="215" y="410" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="11" fontWeight="800" letterSpacing="2" fill="#123e3d">VERIFY HANDLER STATUS</text><text x="215" y="435" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="10" fill="#6c8583">Scan the secure QR code to confirm current status.</text>
          <path d="M49 476h332" stroke="#d8e5e3"/><text x="215" y="514" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="10" fontWeight="700" letterSpacing="1.2" fill="#708886">HANDLER ID</text><text x="215" y="550" textAnchor="middle" fontFamily="Courier New,monospace" fontSize="20" fontWeight="700" fill="#163f3e">{idText}</text>
          <text x="215" y="604" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="10" fontWeight="700" fill="#4e706e">{statusLabel(status)} · {validUntil ? `VALID THROUGH ${validUntil}` : 'STATUS IS VERIFIED ONLINE'}</text><text x="215" y="635" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="9" fill="#819592">EventOps · Event Workforce Operations</text>
        </svg>
      </div>
      <div className="id-card-flip-row"><button type="button" className="my-id-button my-id-button-quiet" onClick={toggleFlip} aria-label={flipped ? 'Show front of digital ID' : 'Show back of digital ID'}>{flipped ? 'Show front' : 'Turn card over'}</button>{photoFailed && <span className="id-card-photo-note" role="status">Profile photo unavailable · initials shown</span>}</div>
    </div>
  );
}
