import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ArrowLeft, ArrowRight, Scissors, ShieldCheck } from 'lucide-react';
import MagicBento from '../components/reactbits/MagicBento/MagicBento';
import TechText from '../components/reactbits/TechText/TechText';
import { BUILT_IN_PACKAGES, describePackage } from '../lib/packages';

gsap.registerPlugin(ScrollTrigger, CustomEase, useGSAP);

// The app's --ease-out token, so the page moves like the tool.
const EASE_OUT = CustomEase.create('sylvi-out', '0.2, 0, 0, 1');
// Icons beside 600-weight button text.
const STROKE = 2.25;

const APP_URL = '/app/';
type Portrait = 1 | 2 | 3 | 4 | 5 | 6;
const photo = (n: Portrait) => `/landing/portrait-${n}.jpg`;

export default function Landing() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add({ motion: '(prefers-reduced-motion: no-preference)', wide: '(min-width: 900px)' }, ctx => {
        const { motion, wide } = ctx.conditions as { motion: boolean; wide: boolean };
        if (!motion) {
          // Reduced motion: the hero still arrives, as a plain cross-fade. Nothing moves, scrubs or pins.
          gsap.from('.hero-title, .hero-lede, .hero-actions, .hero-visual', { opacity: 0, duration: 0.3, ease: EASE_OUT, stagger: 0.1 });
          return;
        }

        // The headline draws itself (TechText); the description and actions follow it,
        // 100ms apart, each rising 12px out of a 4px blur.
        gsap.from('.hero-lede, .hero-actions', { opacity: 0, y: 12, filter: 'blur(4px)', duration: 0.3, ease: EASE_OUT, stagger: 0.1, delay: 0.5 });
        // The sheet's measurements arrive once its photos have landed.
        gsap.from('.dim, .sheet-tag', { opacity: 0, duration: 0.3, ease: EASE_OUT, stagger: 0.1, delay: 1 });
        // Opacity only: tweening its transform would freeze the CSS offset in pixels and break resizing.
        gsap.from('.hero-sheet--back', { opacity: 0, duration: 0.6, ease: EASE_OUT, delay: 0.2 });
        // The photos land on the sheet one by one, the way the app fills it.
        gsap.from('.hero-sheet--front .cell', { opacity: 0, scale: 0.96, duration: 0.3, ease: EASE_OUT, stagger: 0.04, delay: 0.3 });

        // Each word of the statement lights up as it scrolls past.
        gsap.fromTo(
          '.scrub-word',
          { opacity: 0.12 },
          { opacity: 1, ease: 'none', stagger: 0.1, scrollTrigger: { trigger: '.scrub', start: 'top 80%', end: 'bottom 45%', scrub: true } }
        );

        // The "how it works" title holds still while the steps scroll past it.
        if (wide) {
          const pin = root.current!.querySelector<HTMLElement>('.how-pin')!;
          const steps = root.current!.querySelector<HTMLElement>('.how-steps')!;
          ScrollTrigger.create({
            trigger: steps,
            start: 'top top+=128',
            end: () => `+=${Math.max(0, steps.offsetHeight - pin.offsetHeight)}`,
            pin,
            pinSpacing: false,
            invalidateOnRefresh: true
          });
        }
      });
    },
    { scope: root }
  );

  return (
    <div ref={root} className="landing">
      <Nav />
      <main className="landing-main">
        <Hero />
        <Marquee />
        <Features />
        <Statement />
        <HowItWorks />
        <Requests />
        <CallToAction />
      </main>
      <Footer />
    </div>
  );
}

function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#24443b" />
      <g transform="translate(4 4)" fill="none" stroke="#f06a9b" strokeWidth="2.4" strokeLinecap="round">
        <path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5" />
        <rect x="8" y="8" width="8" height="8" rx="1.5" fill="#f06a9b" stroke="none" />
      </g>
    </svg>
  );
}

function Nav() {
  return (
    <nav className="nav" aria-label="Main">
      <a className="nav-brand" href="#top">
        <Mark />
        <span>Sylvi</span>
      </a>
      <div className="nav-links">
        <a href="#features">Features</a>
        <a href="#how">How it works</a>
        <a href="#requests">Packages</a>
      </div>
      <a className="btn btn-primary btn-sm" href={APP_URL}>
        Open Sylvi
      </a>
    </nav>
  );
}

/** A 4R sheet as Sylvi prints it: borderless, with crop marks where each cut starts. */
function Sheet({ sample, layout, className = '', children }: { sample: Portrait; layout: 'b' | 'fill'; className?: string; children?: ReactNode }) {
  const cells = layout === 'b' ? [2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1] : Array<number>(24).fill(1);
  // Cut positions in sheet units (the sheet is 40 × 60, one inch = 10).
  const cutsX = layout === 'b' ? [{ x: 20, top: true }, { x: 10, top: false }, { x: 30, top: false }] : [10, 20, 30].map(x => ({ x, top: true }));
  const cutsY = layout === 'b' ? [20, 40, 50] : [10, 20, 30, 40, 50];
  return (
    <div className={`sheet ${className}`}>
      {cells.map((span, i) => (
        <div key={i} className={`cell${span === 2 ? ' cell--2' : ''}`} style={{ backgroundImage: `url(${photo(sample)})` }} />
      ))}
      <svg className="sheet-marks" viewBox="0 0 40 60" preserveAspectRatio="none" aria-hidden="true">
        {cutsX.map(({ x, top }) => (
          <g key={`x${x}`}>
            {top ? <line x1={x} y1={0} x2={x} y2={1.6} /> : null}
            <line x1={x} y1={58.4} x2={x} y2={60} />
          </g>
        ))}
        {cutsY.map(y => (
          <g key={`y${y}`}>
            <line x1={0} y1={y} x2={1.1} y2={y} />
            <line x1={38.9} y1={y} x2={40} y2={y} />
          </g>
        ))}
      </svg>
      {children}
    </div>
  );
}

// Non-breaking hyphen so "cut-ready" never splits.
const HEADLINE = ['One photo in.', 'A cut‑ready', 'sheet out.'];
const HEADLINE_FONT = "'Outfit Variable', ui-sans-serif, system-ui, sans-serif";
const HEADLINE_TRACK = -0.03;
// TechText fits a line's ink inside 90% of its box's width and 66% of its height,
// inset 5% from the left. Boxes are 1.6em tall and overlap to a 1.1em line pitch.
const LINE_BOX = 1.6;
const LINE_PITCH = 1.1;

/**
 * The h1 drawn with TechText, one canvas per line. TechText only does single
 * lines and shrinks each to fit on its own, so every line gets the same size
 * here (set by the widest) and a box big enough that TechText never shrinks it.
 * The real text stays in the h1 for screen readers and search.
 */
function HeroHeadline() {
  const ref = useRef<HTMLHeadingElement>(null);
  const [fit, setFit] = useState<{ size: number; box: number; shifts: number[] } | null>(null);
  const [lines, setLines] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current!;
    const ctx = document.createElement('canvas').getContext('2d')!;
    const measure = () => {
      const max = parseFloat(getComputedStyle(el).fontSize);
      ctx.font = `600 100px ${HEADLINE_FONT}`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${HEADLINE_TRACK * 100}px`;
      const metrics = HEADLINE.map(line => ctx.measureText(line));
      const widest = Math.max(...metrics.map(m => m.actualBoundingBoxLeft + m.actualBoundingBoxRight));
      const box = el.clientWidth / 0.95;
      const size = Math.min(max, ((0.9 * box * 100) / widest) * 0.98);
      // TechText centres each line's ink vertically, so a line without descenders
      // sits lower. Shift each box so the baselines keep an even pitch.
      const skew = metrics.map(m => ((m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 200) * size);
      const shifts = skew.map(s => skew[0] - s);
      setFit(prev => (prev && prev.size === size && prev.box === box ? prev : { size, box, shifts }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    document.fonts?.load(`600 100px ${HEADLINE_FONT}`).then(measure, () => {});
    return () => observer.disconnect();
  }, []);

  // Lines start drawing one after another, like the photos landing on the sheet.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setLines(HEADLINE.length);
    const timers = [1, 2].map(n => window.setTimeout(() => setLines(n + 1), n * 220));
    return () => timers.forEach(window.clearTimeout);
  }, []);

  return (
    <h1 ref={ref} className="hero-title">
      <span className="sr-only">One photo in. A cut-ready sheet out.</span>
      <span className="hero-title-art" aria-hidden="true">
        {fit
          ? HEADLINE.map((line, i) => (
              <span
                key={line}
                className="hero-title-line"
                style={{
                  width: fit.box,
                  height: LINE_BOX * fit.size,
                  marginLeft: -0.05 * fit.box,
                  marginTop: (i ? LINE_PITCH - LINE_BOX : (LINE_PITCH - LINE_BOX) / 2) * fit.size,
                  translate: `0 ${fit.shifts[i].toFixed(1)}px`
                }}
              >
                {i < lines ? (
                  <TechText
                    text={line}
                    fontFamily={HEADLINE_FONT}
                    fontWeight={600}
                    fontSize={fit.size}
                    letterSpacing={HEADLINE_TRACK}
                    align="left"
                    color="#ffffff"
                    accentColor="#f06a9b"
                    reveal="letter"
                    reach={Math.round(fit.size * 1.2)}
                    dashLength={3}
                    dashGap={2}
                    strokeWidth={1.25}
                    specks={8}
                    selection={false}
                    labels={false}
                    draggable={false}
                    guides={false}
                    sweep={false}
                    intro="metrics"
                    introDuration={1.3}
                  />
                ) : null}
              </span>
            ))
          : null}
      </span>
    </h1>
  );
}

function Hero() {
  return (
    <header className="hero mat" id="top">
      <div className="hero-copy">
        <HeroHeadline />
        <p className="hero-lede">
          Sylvi lays out 1x1, 2x2 and passport photos for print shops. It finds the face, packs every size onto the paper you load and marks
          each cut. No Word, no ruler, no guessing margins.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary btn-lg" href={APP_URL}>
            Open Sylvi <ArrowRight size={18} strokeWidth={STROKE} aria-hidden="true" />
          </a>
          <a className="btn btn-on-mat btn-lg" href="#how">
            See how it works
          </a>
        </div>
      </div>
      <figure className="hero-visual" aria-label="Two finished 4R sheets: one with four 2x2 and eight 1x1 photos, one filled with 1x1 photos">
        <Sheet sample={5} layout="fill" className="hero-sheet hero-sheet--back" />
        <Sheet sample={1} layout="b" className="hero-sheet hero-sheet--front">
          {/* Measured like a print on the cutting mat: the sheet is true 4R. */}
          <span className="dim dim--w" aria-hidden="true">
            <span>4 in</span>
          </span>
          <span className="dim dim--h" aria-hidden="true">
            <span>6 in</span>
          </span>
          <span className="sheet-tag" aria-hidden="true">
            <b>Package B</b>
            <span>12 photos, one sheet</span>
          </span>
        </Sheet>
      </figure>
    </header>
  );
}

const USES = ['Board exam', 'Passport renewal', 'School ID', 'NBI clearance', 'Job application', 'Visa application', 'Postal ID', 'Scholarship forms', 'Company ID', 'PRC license'];

function Marquee() {
  return (
    <section className="marquee" aria-label="Photos for every form that asks for one">
      <div className="marquee-track">
        {[...USES, ...USES].map((use, i) => (
          <span key={i} className="marquee-item" aria-hidden={i >= USES.length ? true : undefined}>
            {use}
          </span>
        ))}
      </div>
    </section>
  );
}

const PAPERS = [
  { name: '3R', w: 3.5, h: 5 },
  { name: '4R', w: 4, h: 6 },
  { name: '5R', w: 5, h: 7 },
  { name: 'A4', w: 8.27, h: 11.69 },
  { name: 'Short bond', w: 8.5, h: 11 },
  { name: 'Long bond', w: 8.5, h: 13 }
];

const subscribe = (query: string) => (onChange: () => void) => {
  const list = window.matchMedia(query);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
};
const useMedia = (query: string) => useSyncExternalStore(subscribe(query), () => window.matchMedia(query).matches, () => false);

function Features() {
  const dark = useMedia('(prefers-color-scheme: dark)');
  const wide = useMedia('(min-width: 1000px)');
  const narrow = useMedia('(max-width: 599px)');
  // The grid's own breakpoints switch at 150px cells, too small for this copy.
  const columns = wide ? 4 : narrow ? 1 : 2;

  const items = [
    { id: 'face', colSpan: 2, rowSpan: 2, content: <FaceCard /> },
    { id: 'cuts', colSpan: 2, content: <CutsCard /> },
    { id: 'size', content: <SizeCard /> },
    { id: 'private', content: <PrivateCard /> },
    { id: 'paper', colSpan: 4, content: <PaperCard /> }
  ];

  return (
    <section className="section features" id="features">
      <h2 className="section-title">Everything between the photo and the trimmer.</h2>
      <MagicBento
        className="features-bento"
        items={items}
        columns={columns}
        rowHeight={260}
        gap={16}
        radius={24}
        theme={dark ? 'dark' : 'light'}
        glowColor={dark ? '#f06a9b' : '#c2185b'}
        enableBorderGlow
        enableSpotlight
        spotlightRadius={300}
        clickEffect
        style={
          {
            '--mb-pad': '28px',
            '--mb-surface': 'var(--surface)',
            '--mb-ink': 'var(--ink)',
            '--mb-muted': 'var(--ink-2)',
            '--mb-shadow': 'var(--ring)'
          } as CSSProperties
        }
      />
    </section>
  );
}

function FaceCard() {
  return (
    <div className="feature feature--face">
      <div className="card-media">
        <img src={photo(3)} alt="" loading="lazy" />
        <div className="face-frame" aria-hidden="true">
          <span className="face-oval" />
        </div>
      </div>
      <div className="card-body">
        <h3>Finds the face, frames the head</h3>
        <p>Face detection runs right in the browser and sizes head and shoulders for each photo size. Drag or zoom if a customer wants it different.</p>
      </div>
    </div>
  );
}

function CutsCard() {
  return (
    <div className="feature feature--cuts">
      <svg className="cuts-art" viewBox="0 0 120 80" aria-hidden="true">
        <rect x="34" y="4" width="48" height="72" rx="1.5" className="cuts-sheet" />
        <g className="cuts-lines">
          <line x1="58" y1="0" x2="58" y2="80" />
          <line x1="30" y1="28" x2="86" y2="28" />
          <line x1="30" y1="52" x2="86" y2="52" />
          <line x1="30" y1="64" x2="86" y2="64" />
          <line x1="46" y1="52" x2="46" y2="80" />
          <line x1="70" y1="52" x2="70" y2="80" />
        </g>
      </svg>
      <div className="card-body">
        <h3>
          <Scissors size={18} strokeWidth={STROKE} aria-hidden="true" /> Cuts in straight lines
        </h3>
        <p>Every layout splits edge to edge, so each pass on the trimmer goes straight across. No photo is boxed in by another.</p>
      </div>
    </div>
  );
}

function SizeCard() {
  return (
    <div className="feature feature--size">
      <p className="size-figure">
        300<span>DPI</span>
      </p>
      <div className="card-body">
        <h3>True size, every time</h3>
        <p>PDFs are made at the exact paper size. Print at Actual size (100%) and a 2x2 measures two inches.</p>
      </div>
    </div>
  );
}

function PrivateCard() {
  return (
    <div className="feature feature--private">
      <ShieldCheck className="private-icon" size={34} strokeWidth={1.75} aria-hidden="true" />
      <div className="card-body">
        <h3>Photos stay on this computer</h3>
        <p>Customer photos are personal data under RA 10173, so Sylvi never uploads them. Recent jobs delete themselves after 24 hours.</p>
      </div>
    </div>
  );
}

function PaperCard() {
  return (
    <div className="feature feature--paper">
      <div className="card-body">
        <h3>Whatever is loaded in the printer</h3>
        <p>3R to long bond, or a custom size. Portrait, landscape, or let Sylvi pick whichever needs fewer sheets.</p>
      </div>
      <ul className="papers" aria-label="Paper sizes, drawn to scale">
        {PAPERS.map(p => (
          <li key={p.name}>
            <span className="paper" style={{ '--w': p.w, '--h': p.h } as CSSProperties} />
            <span className="paper-name">{p.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const SCRUB =
  'A customer asks for four 2x2 and eight 1x1. Sylvi finds the face, frames head and shoulders, fits every photo on one 4R sheet and marks where to cut. The prints are ready before you have counted the change.';

function Statement() {
  return (
    <section className="section statement">
      <h2 className="statement-title">
        Stop nudging <span className="pill pill--photo" style={{ backgroundImage: `url(${photo(2)})` }} aria-hidden="true" /> photos around a{' '}
        <span className="pill pill--sheet" aria-hidden="true" /> page in Word.
      </h2>
      <p className="scrub">
        {SCRUB.split(' ').map((word, i) => (
          <span key={i} className="scrub-word">
            {word}{' '}
          </span>
        ))}
      </p>
    </section>
  );
}

function HowItWorks() {
  const wheel = BUILT_IN_PACKAGES.slice(0, 5);
  return (
    <section className="section how" id="how">
      <div className="how-pin">
        <h2 className="section-title">Three moves at the counter.</h2>
        <p className="how-lede">The same three moves for the first customer of the day and the fiftieth. Shops can save their own packages too.</p>
        <a className="text-link" href={APP_URL}>
          Try it with any photo <ArrowRight size={16} strokeWidth={STROKE} aria-hidden="true" />
        </a>
      </div>

      <div className="how-steps">
        <article className="step">
          <div className="step-art mat" aria-hidden="true">
            <div className="scan">
              <img src={photo(6)} alt="" loading="lazy" />
              <span className="scan-line" />
              <span className="scan-corners" />
            </div>
          </div>
          <h3>Drop the photo in</h3>
          <p>Drag it onto the page, paste it with Ctrl+V or browse your files. Sylvi finds the face and crops it for you.</p>
        </article>

        <article className="step">
          <div className="step-art mat" aria-hidden="true">
            <ul className="wheel">
              {wheel.map((pkg, i) => (
                <li key={pkg.id} className="wheel-item" data-offset={i - 1}>
                  {pkg.name}
                </li>
              ))}
            </ul>
            <p className="wheel-detail">{describePackage(BUILT_IN_PACKAGES[1])}</p>
          </div>
          <h3>Spin to the package</h3>
          <p>Packages A to D match the menus shops already post, plus whole-sheet fills. Sylvi packs them onto the paper and adds extra sheets when it runs out of room.</p>
        </article>

        <article className="step">
          <div className="step-art mat" aria-hidden="true">
            <div className="export">
              <div className="export-row export-row--on">
                <b>PDF</b>
                <span>Best for printing</span>
              </div>
              <div className="export-row">
                <b>PNG</b>
                <span>Sharpest image</span>
              </div>
              <div className="export-row">
                <b>JPG</b>
                <span>Smallest file</span>
              </div>
              <div className="export-button">Download PDF</div>
              <p className="export-hint">Print at Actual size (100%)</p>
            </div>
          </div>
          <h3>Download or print</h3>
          <p>Save a PDF, PNG or JPG at 300 DPI, or print straight from the browser. Crop marks, cut lines or a white border, your call.</p>
        </article>
      </div>
    </section>
  );
}

const REQUESTS: { ask: string; answer: string; detail: string; photos: Portrait[] }[] = [
  { ask: 'Four 2x2 and eight 1x1, for my board exam.', answer: 'Package B', detail: '4 × 2x2 and 8 × 1x1, all on one 4R sheet', photos: [1, 3, 4] },
  { ask: 'Passport size, please. And a few 1x1 too.', answer: 'Package C', detail: '4 × passport (35 × 45 mm) and 6 × 1x1', photos: [4, 5, 6] },
  { ask: 'Just fill a whole sheet with 1x1.', answer: 'Whole sheet 1x1', detail: '24 photos on a borderless 4R', photos: [5, 2, 1] },
  { ask: 'There are three of us. Can we share one sheet?', answer: 'Several customers, one sheet', detail: 'Each person keeps their own package and crop', photos: [6, 1, 3] },
  { ask: 'All I have is this selfie.', answer: 'Auto-crop', detail: 'Finds the face, and warns you when a photo will print soft', photos: [2, 4, 5] }
];

function Requests() {
  const [index, setIndex] = useState(0);
  const request = REQUESTS[index];
  const go = (step: number) => setIndex(i => (i + step + REQUESTS.length) % REQUESTS.length);

  return (
    <section className="section requests" id="requests" aria-roledescription="carousel" aria-label="What customers ask for">
      <h2 className="section-title">What walks up to the counter.</h2>
      <div className="requests-body">
        <div className="faces" aria-hidden="true">
          {request.photos.map((n, i) => (
            <img key={`${index}-${n}`} className={`face face--${i}`} src={photo(n)} alt="" loading="lazy" />
          ))}
        </div>
        <div className="request" aria-live="polite">
          {/* Keyed so each request enters fresh; the buttons below are not, so they keep focus. */}
          <blockquote key={`ask-${index}`} className="request-ask">
            <p>“{request.ask}”</p>
          </blockquote>
          <p key={`answer-${index}`} className="request-answer">
            <b>{request.answer}</b>
            <span>{request.detail}</span>
          </p>
          <div className="request-nav">
            <button type="button" className="round-btn" onClick={() => go(-1)} aria-label="Previous request">
              <ArrowLeft size={18} />
            </button>
            <span className="request-count">
              {index + 1} / {REQUESTS.length}
            </span>
            <button type="button" className="round-btn" onClick={() => go(1)} aria-label="Next request">
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function CallToAction() {
  return (
    <section className="cta mat">
      <h2 className="cta-title">Your next customer is already in line.</h2>
      <a className="btn btn-primary btn-xl" href={APP_URL}>
        Open Sylvi <ArrowRight size={22} strokeWidth={STROKE} aria-hidden="true" />
      </a>
      <p className="cta-note">Runs in your browser with no sign-up. Works offline after the first visit, and photos never leave the computer.</p>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <a className="nav-brand" href="#top">
        <Mark size={24} />
        <span>Sylvi</span>
      </a>
      <nav className="footer-links" aria-label="Footer">
        <a href={APP_URL}>Open Sylvi</a>
        <a href="#features">Features</a>
        <a href="#how">How it works</a>
        <a href="#requests">Packages</a>
      </nav>
      <p className="footer-note">
        Portraits from{' '}
        <a href="https://unsplash.com" rel="noreferrer">
          Unsplash
        </a>
        . © 2026 Sylvi
      </p>
    </footer>
  );
}
