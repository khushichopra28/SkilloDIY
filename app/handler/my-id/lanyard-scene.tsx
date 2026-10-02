'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BadgeCheck, Check, Download, LoaderCircle, Share2 } from 'lucide-react';
import DigitalIdCard from '@/components/digital-id-card';
import { downloadIdCard } from '@/lib/id-card-export';

type Profile = {
  id: string;
  full_name: string;
  email: string;
  handler_id: string | null;
  job_title: string | null;
  team: string | null;
  status: string;
  verification_status: string | null;
  joined_at: string | null;
  photo_path: string | null;
  cities: { name: string } | null;
};
type DigitalId = { verification_token: string; valid_until: string | null; created_at: string } | null;

const SPRING = 0.018;
const DAMPING = 0.925;
const DRAG_THRESHOLD = 5;

export default function LanyardScene({ profile, record, origin, photoDataUrl, photoUnavailable, verificationUnavailable, digitalIdUnavailable }: {
  profile: Profile;
  record: DigitalId;
  origin: string;
  photoDataUrl: string | null;
  photoUnavailable: boolean;
  verificationUnavailable: boolean;
  digitalIdUnavailable: boolean;
}) {
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState<'' | 'png' | 'pdf'>('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const strapLeftRef = useRef<SVGPathElement>(null);
  const strapRightRef = useRef<SVGPathElement>(null);
  const claspRef = useRef<SVGGElement>(null);
  const frontRef = useRef<SVGSVGElement>(null);
  const rafRef = useRef<number | null>(null);
  const hintTimerRef = useRef<number | null>(null);
  const position = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const drag = useRef({ pointerId: -1, startX: 0, startY: 0, lastX: 0, lastY: 0, moved: false });
  const idleStarted = useRef(0);
  const [hint, setHint] = useState(true);

  useEffect(() => {
    let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionChange = (event: MediaQueryListEvent) => { reducedMotion = event.matches; };
    motionQuery.addEventListener('change', onMotionChange);
    hintTimerRef.current = window.setTimeout(() => setHint(false), 5200);
    let lastFrame = 0;
    const frame = (now: number) => {
      if (now - lastFrame >= 1000 / 60) {
        lastFrame = now;
        const p = position.current;
        const wrap = wrapRef.current;
        if (wrap) {
          if (!reducedMotion && drag.current.pointerId < 0) {
            p.vx = (p.vx - p.x * SPRING) * DAMPING;
            p.vy = (p.vy - p.y * SPRING) * DAMPING;
            p.x += p.vx;
            p.y += p.vy;
            if (Math.abs(p.vx) < 0.025 && Math.abs(p.vy) < 0.025 && Math.abs(p.x) < 0.4 && Math.abs(p.y) < 0.4) {
              p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
            }
          }
          const idle = !reducedMotion && drag.current.pointerId < 0 && Math.abs(p.x) < 2 && Math.abs(p.y) < 2
            ? Math.sin((now - idleStarted.current) / 2100 * Math.PI * 2) * 1.5
            : 0;
          const angle = Math.max(-11, Math.min(11, p.x * 0.045 + idle));
          const tiltX = Math.max(-2.5, Math.min(2.5, p.y * 0.025));
          const tiltY = Math.max(-3, Math.min(3, p.x * 0.025));
          wrap.style.transform = `translate3d(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px, 0) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) rotate(${angle.toFixed(2)}deg)`;

          const artWidth = sceneRef.current?.querySelector<SVGSVGElement>('.lanyard-strap-art')?.getBoundingClientRect().width ?? 430;
          const scale = 430 / Math.max(1, artWidth);
          const dx = p.x * scale * 0.34;
          const dy = p.y * scale * 0.24;
          const endX = 215 + dx;
          const endY = 287 + dy;
          strapLeftRef.current?.setAttribute('d', `M174 -20 C166 86 172 180 195 241 Q202 266 ${endX} ${endY}`);
          strapRightRef.current?.setAttribute('d', `M256 -20 C264 86 258 180 235 241 Q228 266 ${endX} ${endY}`);
          claspRef.current?.setAttribute('transform', `translate(${dx} ${dy})`);
        }
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    idleStarted.current = performance.now();
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (hintTimerRef.current !== null) window.clearTimeout(hintTimerRef.current);
      motionQuery.removeEventListener('change', onMotionChange);
    };
  }, []);

  const hideHint = useCallback(() => {
    setHint(false);
    if (hintTimerRef.current !== null) window.clearTimeout(hintTimerRef.current);
  }, []);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.closest('button')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (d.pointerId !== event.pointerId) return;
    const totalX = event.clientX - d.startX;
    const totalY = event.clientY - d.startY;
    if (!d.moved && Math.hypot(totalX, totalY) < DRAG_THRESHOLD) return;
    d.moved = true;
    hideHint();
    const p = position.current;
    p.x = Math.max(-105, Math.min(105, p.x + event.clientX - d.lastX));
    p.y = Math.max(-30, Math.min(54, p.y + event.clientY - d.lastY));
    p.vx = event.clientX - d.lastX;
    p.vy = event.clientY - d.lastY;
    d.lastX = event.clientX;
    d.lastY = event.clientY;
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (drag.current.pointerId !== event.pointerId) return;
    const wasDrag = drag.current.moved;
    drag.current.pointerId = -1;
    if (!wasDrag) setFlipped((value) => !value);
    idleStarted.current = performance.now();
  }

  async function exportCard(format: 'png' | 'pdf') {
    if (busy || !frontRef.current) return;
    setBusy(format);
    setError('');
    setNotice('');
    try {
      await downloadIdCard(frontRef.current, profile.handler_id ?? '', format);
      setNotice(`${format.toUpperCase()} ID card downloaded.`);
    } catch {
      setError(`The ${format.toUpperCase()} could not be created. Check that this browser supports image export and try again.`);
    } finally {
      setBusy('');
    }
  }

  async function shareId() {
    if (!record?.verification_token) return;
    const url = `${(origin || window.location.origin).replace(/\/$/, '')}/verify/${record.verification_token}`;
    try {
      if (navigator.share) await navigator.share({ title: 'EventOps Digital ID', text: `Verify ${profile.full_name}'s EventOps handler status.`, url });
      else { await navigator.clipboard.writeText(url); setNotice('Secure verification link copied.'); }
    } catch { /* Sharing may be dismissed by the user. */ }
  }

  const status = String(profile.verification_status ?? '').toUpperCase();
  return (
    <main className="lanyard-page">
      <header className="my-id-page-heading">
        <div className="my-id-title-group">
          <Link href="/handler" className="my-id-back"><ArrowLeft size={15}/> Handler workspace</Link>
          <div className="my-id-title-row"><span className="my-id-title-icon"><BadgeCheck size={17}/></span><div><span className="my-id-eyebrow">PERSONAL CREDENTIAL</span><h1>My Digital ID</h1></div></div>
          <p>Your EventOps identity for in-person event operations.</p>
        </div>
        <div className="my-id-actions">
          <span className="my-id-download-label">DOWNLOAD ID CARD</span>
          <button type="button" className="my-id-button my-id-button-primary" onClick={() => exportCard('png')} disabled={!!busy} aria-label="Download ID card as high-resolution PNG">
            {busy === 'png' ? <LoaderCircle size={15} className="id-export-spinner"/> : <Download size={15}/>} PNG
          </button>
          <button type="button" className="my-id-button my-id-button-secondary" onClick={() => exportCard('pdf')} disabled={!!busy} aria-label="Download print-ready ID card PDF">
            {busy === 'pdf' ? <LoaderCircle size={15} className="id-export-spinner"/> : <Download size={15}/>} PDF
          </button>
          {record?.verification_token && status === 'VERIFIED' && <button type="button" className="my-id-icon-button" onClick={shareId} aria-label="Share secure handler verification link"><Share2 size={16}/></button>}
        </div>
      </header>
      <section className="my-id-stage" aria-label="Interactive EventOps staff ID">
        <div className="lanyard-scene" ref={sceneRef}>
          <svg className="lanyard-strap-art" viewBox="0 0 430 420" preserveAspectRatio="xMidYMin meet" aria-hidden="true">
            <defs>
              <linearGradient id="strap-fabric" x1="0" y1="0" x2="1" y2=".1"><stop stopColor="#123e3d"/><stop offset=".2" stopColor="#266e6c"/><stop offset=".48" stopColor="#358987"/><stop offset=".68" stopColor="#1e5f5d"/><stop offset="1" stopColor="#103634"/></linearGradient>
              <pattern id="strap-weave" width="8" height="9" patternUnits="userSpaceOnUse"><path d="M0 1h8M0 5h8" stroke="#d1eeee" strokeOpacity=".25" strokeWidth="1.1"/><path d="M1 0v9M5 0v9" stroke="#092d2c" strokeOpacity=".18" strokeWidth="1.2"/></pattern>
              <linearGradient id="strap-gloss" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#fff" stopOpacity="0"/><stop offset=".47" stopColor="#d9ffff" stopOpacity=".44"/><stop offset=".56" stopColor="#fff" stopOpacity=".08"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></linearGradient>
              <linearGradient id="clasp-metal" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#76888a"/><stop offset=".19" stopColor="#f8ffff"/><stop offset=".39" stopColor="#97a9ab"/><stop offset=".63" stopColor="#fff"/><stop offset=".82" stopColor="#87999b"/><stop offset="1" stopColor="#eaf1f1"/></linearGradient>
              <filter id="hardware-shadow" x="-60%" y="-40%" width="220%" height="200%"><feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#061c1b" floodOpacity=".45"/></filter>
            </defs>
            <path d="M174 -20 C166 86 172 180 195 241 Q202 266 215 287" fill="none" stroke="#071e1d" strokeOpacity=".55" strokeWidth="70" strokeLinecap="round"/>
            <path ref={strapLeftRef} d="M174 -20 C166 86 172 180 195 241 Q202 266 215 287" fill="none" stroke="url(#strap-fabric)" strokeWidth="58" strokeLinecap="round"/>
            <path d="M174 -20 C166 86 172 180 195 241 Q202 266 215 287" fill="none" stroke="url(#strap-weave)" strokeWidth="52" strokeLinecap="round"/>
            <path d="M174 -20 C166 86 172 180 195 241 Q202 266 215 287" fill="none" stroke="url(#strap-gloss)" strokeWidth="47" strokeLinecap="round"/>
            <path d="M256 -20 C264 86 258 180 235 241 Q228 266 215 287" fill="none" stroke="#071e1d" strokeOpacity=".55" strokeWidth="70" strokeLinecap="round"/>
            <path ref={strapRightRef} d="M256 -20 C264 86 258 180 235 241 Q228 266 215 287" fill="none" stroke="url(#strap-fabric)" strokeWidth="58" strokeLinecap="round"/>
            <path d="M256 -20 C264 86 258 180 235 241 Q228 266 215 287" fill="none" stroke="url(#strap-weave)" strokeWidth="52" strokeLinecap="round"/>
            <path d="M256 -20 C264 86 258 180 235 241 Q228 266 215 287" fill="none" stroke="url(#strap-gloss)" strokeWidth="47" strokeLinecap="round"/>
            <g ref={claspRef} filter="url(#hardware-shadow)">
              <path d="M201 255h28v27c0 8-6 14-14 14s-14-6-14-14z" fill="url(#clasp-metal)" stroke="#718184" strokeWidth="2"/>
              <path d="M207 260h16v19c0 5-3.5 9-8 9s-8-4-8-9z" fill="#254d4b" stroke="#edf5f4" strokeWidth="2"/>
              <circle cx="215" cy="286" r="9" fill="url(#clasp-metal)" stroke="#65787a" strokeWidth="2"/>
              <path d="M215 295v16q0 14 13 14h8q11 0 11 10v6q0 11-10 11h-8" fill="none" stroke="url(#clasp-metal)" strokeWidth="9" strokeLinecap="round"/>
              <path d="M215 295v16q0 14 13 14h8q11 0 11 10v6q0 11-10 11h-8" fill="none" stroke="#fff" strokeOpacity=".64" strokeWidth="2" strokeLinecap="round"/>
            </g>
          </svg>
          <div className="lanyard-badge-holder" aria-hidden="true"><i/><i/></div>
          <div
            ref={wrapRef}
            className="lanyard-card-wrap"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            role="group"
            tabIndex={-1}
            aria-label={`${flipped ? 'Back' : 'Front'} of ${profile.full_name}'s EventOps ID. Drag to swing, tap to turn over.`}
            style={{ touchAction: 'none' }}
          >
            <DigitalIdCard profile={profile} record={record} origin={origin} photoDataUrl={photoDataUrl} frontRef={frontRef} isFlippedControlled={flipped} onFlipChange={setFlipped}/>
          </div>
          {hint && <div className="lanyard-interaction-hint" aria-hidden="true">Drag the badge to interact <span>·</span> Tap to turn over</div>}
        </div>
      </section>
      <div className="my-id-feedback" aria-live="polite">
        {photoUnavailable && <p className="my-id-inline-note">The saved profile photo could not be loaded. The card uses your initials instead.</p>}
        {verificationUnavailable && <p className="my-id-inline-note">Verification status could not be read. The card will not show a verified status or verification QR.</p>}
        {digitalIdUnavailable && <p className="my-id-inline-note">The secure verification record could not be loaded. The card will not display a verification QR until it is available.</p>}
        {error && <p className="my-id-inline-error" role="alert">{error}</p>}
        {notice && <p className="my-id-inline-success" role="status"><Check size={14}/>{notice}</p>}
      </div>
      {status === 'RESUBMISSION_REQUIRED' && <div className="my-id-resubmission">Your identity details need updating before verification is complete. <Link href="/handler/onboarding">Continue onboarding</Link></div>}
    </main>
  );
}
