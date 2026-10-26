import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type RefObject } from 'react';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import Carousel from '../components/reactbits/Carousel/Carousel';
import CloudShader from '../components/CloudShader';
import PillNav from '../components/reactbits/PillNav/PillNav';
import TechText from '../components/reactbits/TechText/TechText';
import VariableProximity from '../components/reactbits/VariableProximity/VariableProximity';
import { buildPackItems } from '../lib/layout/items';
import { pack, type Sheet as PackedSheet } from '../lib/layout/pack';
import { BUILT_IN_PACKAGES } from '../lib/packages';
import { SheetDemo } from './SheetDemo';

gsap.registerPlugin(ScrollTrigger, CustomEase, useGSAP);

// The app's --ease-out token, so the page moves like the tool.
const EASE_OUT = CustomEase.create('sylvi-out', '0.2, 0, 0, 1');

const APP_URL = '/app/';
type Portrait = 1 | 2 | 3 | 4;
const photo = (n: Portrait) => `/landing/portrait-${n}.jpg`;
// The uncropped photo the customer sends, before Sylvi frames it.
const PHONE_PHOTO = '/landing/phone-photo.jpg';

export default function Landing() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add({ motion: '(prefers-reduced-motion: no-preference)', wide: '(min-width: 900px)' }, ctx => {
        const { motion, wide } = ctx.conditions as { motion: boolean; wide: boolean };
        if (!motion) {
          // Reduced motion: the hero still arrives, as a plain cross-fade. Nothing moves, scrubs or pins.
          gsap.from('.hero-title, .hero-lede, .hero-actions, .hero-note, .hero-visual', { opacity: 0, duration: 0.3, ease: EASE_OUT, stagger: 0.1 });
          return;
        }

        // The headline draws itself (TechText); the description and actions follow it,
        // 100ms apart, each rising 12px out of a 4px blur.
        gsap.from('.hero-lede, .hero-actions, .hero-note', { opacity: 0, y: 12, filter: 'blur(4px)', duration: 0.3, ease: EASE_OUT, stagger: 0.1, delay: 0.5 });
        // The customer's message comes in first: her photo, then what she wants.
        gsap.from('.hero-chat > *', { opacity: 0, y: 8, duration: 0.3, ease: EASE_OUT, stagger: 0.12, delay: 0.2 });
        // Then the photos land on the sheet one by one, the way the app fills it.
        gsap.from('.hero-sheet--front .cell', { opacity: 0, scale: 0.96, duration: 0.3, ease: EASE_OUT, stagger: 0.04, delay: 0.75 });
        // The sheet's measurements arrive once its photos have landed.
        gsap.from('.hero .dim, .sheet-tag', { opacity: 0, duration: 0.3, ease: EASE_OUT, stagger: 0.1, delay: 1.4 });

        // Photo to trimmer. Created before the triggers further down the page,
        // so its pin spacing is in place when they measure.
        const cleanupPress = animatePress(root.current!.querySelector<HTMLElement>('.press')!, wide);

        // Each Word chore is crossed off as it scrolls past. --struck drives both the
        // line and the fade (landing.css); without motion it rests at 1, crossed off.
        gsap.utils.toArray<HTMLElement>('.chore').forEach(chore => {
          gsap.fromTo(
            chore.querySelector('.chore-text'),
            { '--struck': 0 },
            { '--struck': 1, ease: 'none', scrollTrigger: { trigger: chore, start: 'top 72%', end: 'top 48%', scrub: true } }
          );
        });

        // Each section's parts arrive once, in reading order: the heading, its words, then what it shows.
        // 70ms apart, rising 20px; triggered once, so scrolling back up never hides anything.
        gsap.utils.toArray<HTMLElement>('[data-enter]').forEach(group => {
          gsap.from(group.querySelectorAll('[data-part]'), {
            opacity: 0,
            y: 20,
            duration: 0.5,
            ease: EASE_OUT,
            stagger: 0.07,
            scrollTrigger: { trigger: group, start: 'top 78%', once: true }
          });
        });
        return cleanupPress;
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
        {/* The problem, then the answer, then where it happens, then a sheet to try. */}
        <Statement />
        <Features />
        <AppScreen />
        <Packages />
        <Requests />
        <Questions />
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

const NAV_ITEMS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how' },
  { label: 'Packages', href: '#packages' },
  { label: 'Questions', href: '#questions' }
];

/** The section crossing the middle of the viewport, so the nav's dot follows the reader. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    const sections = ids.map(id => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
    sections.forEach(section => observer.observe(section));
    // Back at the top, nothing is marked.
    const hero = document.getElementById('top');
    const top = new IntersectionObserver(([entry]) => entry.isIntersecting && setActive(null), { rootMargin: '-45% 0px -50% 0px' });
    if (hero) top.observe(hero);
    return () => {
      observer.disconnect();
      top.disconnect();
    };
  }, [ids]);
  return active;
}

const NAV_IDS = NAV_ITEMS.map(item => item.href.slice(1));

function Nav() {
  const dark = useMedia('(prefers-color-scheme: dark)');
  const active = useActiveSection(NAV_IDS);
  return (
    <header className="site-nav">
      <a className="site-brand" href="#top" aria-label="Sylvi, back to top">
        <Mark size={24} />
        <span>Sylvi</span>
      </a>
      <div className="site-nav-pill">
        <PillNav
          items={NAV_ITEMS}
          // A href no item has marks nothing, while the hero is in view.
          activeHref={active ? `#${active}` : '#top'}
          theme={dark ? 'dark' : 'light'}
          itemStyle="plain"
          hoverEffect="fill"
          indicator="dot"
          highlightColor={dark ? '#f06a9b' : '#c2185b'}
          barColor={dark ? 'rgb(22 28 25 / 0.74)' : 'rgb(255 255 255 / 0.82)'}
          ariaLabel="Main"
          // Sylvi's own neutrals instead of the component's zinc; hover fills with the mat green.
          style={
            {
              '--pn-solid': 'var(--surface)',
              '--pn-edge': 'var(--line)',
              '--pn-text': 'var(--ink-2)',
              '--pn-strong': 'var(--ink)',
              '--pn-tile': 'var(--surface-2)',
              '--pn-row-hover': 'var(--surface-2)',
              '--pn-pill': 'var(--mat)',
              '--pn-pill-ink': '#fff',
              '--pn-ring': 'var(--line-strong)'
            } as CSSProperties
          }
        />
      </div>
      <a className="btn btn-primary site-nav-cta" href={APP_URL}>
        Open Sylvi
      </a>
    </header>
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

const HEADLINE_FONT = "'Geist Variable', ui-sans-serif, system-ui, sans-serif";
const HEADLINE_TRACK = -0.045;
// TechText fits a line's ink inside 90% of its box's width and 66% of its height,
// inset 5% from the left. Boxes are 1.6em tall and overlap to a 1.1em line pitch.
const LINE_BOX = 1.6;
const LINE_PITCH = 1.1;
// Each line starts drawing 220ms after the last and takes 1.3s; the handoff follows.
const DRAWN_AFTER = 2 * 220 + 1300 + 150;

/**
 * The h1 in two acts. First TechText draws each line on a canvas, the way it
 * always has. Then it cross-fades through a slight blur into real text set
 * with VariableProximity, whose letters get heavier near the pointer anywhere
 * over the hero. Under reduced motion the real text is there from the start.
 */
function HeroHeadline({ area }: { area: RefObject<HTMLElement | null> }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [fit, setFit] = useState<{ size: number; box: number; shifts: number[] } | null>(null);
  const [lines, setLines] = useState(1);
  // drawing: TechText on show; live: real text fading in; done: canvases gone.
  const [phase, setPhase] = useState<'drawing' | 'live' | 'done'>(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'done' : 'drawing'
  );

  useLayoutEffect(() => {
    if (phase === 'done') return;
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
    // Measured once per drawing; the phase only ever moves forward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lines start drawing one after another, like the photos landing on the sheet; then the handoff.
  useEffect(() => {
    if (phase !== 'drawing') return;
    const timers = [
      ...[1, 2].map(n => window.setTimeout(() => setLines(n + 1), n * 220)),
      window.setTimeout(() => setPhase('live'), DRAWN_AFTER),
      window.setTimeout(() => setPhase('done'), DRAWN_AFTER + 500)
    ];
    return () => timers.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <h1 ref={ref} className="hero-title" data-phase={phase}>
      {phase !== 'done' && fit ? (
        <span className="hero-title-art" aria-hidden="true">
          {HEADLINE.map((line, i) => (
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
          ))}
        </span>
      ) : null}
      <span className="hero-title-live">
        {HEADLINE.map(line => (
          <span key={line} className="hero-live-line">
            <VariableProximity
              label={line}
              fromFontVariationSettings="'wght' 600"
              toFontVariationSettings="'wght' 900"
              containerRef={area}
              radius={170}
              falloff="gaussian"
              smoothing={0.25}
            />
          </span>
        ))}
      </span>
    </h1>
  );
}

function Hero() {
  const area = useRef<HTMLElement>(null);
  return (
    <header ref={area} className="hero mat" id="top">
      <div className="hero-copy">
        <HeroHeadline area={area} />
        <p className="hero-lede">
          Sylvi lays out 1x1, 2x2 and passport photos for print shops. It finds the face, packs every size onto the paper you load and marks
          each cut. No Word, no ruler, no guessing margins.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary btn-lg" href={APP_URL}>
            Open Sylvi
          </a>
          <a className="btn btn-on-mat btn-lg" href="#how">
            See how it works
          </a>
        </div>
        <p className="hero-note">Free, with no sign-up. Photos never leave the computer.</p>
      </div>
      <figure
        className="hero-visual"
        aria-label="A customer messages her phone photo and asks for four 2x2 and eight 1x1. Sylvi turns it into one finished 4R sheet with every cut marked."
      >
        <div className="hero-pair">
          {/* What arrives at the counter: an uncropped phone photo and a request. */}
          <div className="hero-chat" aria-hidden="true">
            <span className="chat-from">Bea</span>
            <img className="chat-photo" src={PHONE_PHOTO} alt="" width={720} height={720} />
            {/* Non-breaking spaces keep each count with its size. */}
            <p className="chat-text">Pa-print po: 4{' '}na{' '}2x2, 8{' '}na{' '}1x1.</p>
            <span className="chat-time">9:41 AM</span>
          </div>
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
        </div>
      </figure>
    </header>
  );
}

// The workspace top to bottom, with where each part sits on the 1440 × 900 screenshot, in percent,
// and the keys that drive it from the counter.
const SCREEN_PARTS = [
  {
    title: 'Package board',
    text: 'Every package across the top, drawn as the prints the customer takes home. Pick what they asked for.',
    keys: [{ combo: ['←', '→'], does: 'move along the board' }],
    area: { x: 0, y: 5.8, w: 100, h: 8.6 }
  },
  {
    title: 'The sheet',
    text: 'Drop, paste or browse for the photo. It lands at true size on a ruler, every cut marked. Click a print for crop, light and color.',
    keys: [{ combo: ['Ctrl', 'V'], does: 'paste from Messenger' }],
    area: { x: 35.5, y: 20.5, w: 64, h: 72 }
  },
  {
    title: 'Print bar',
    text: 'Paper, cut guides and file type in one strip, then Print or Download a 300 DPI PDF, PNG or JPG.',
    keys: [
      { combo: ['Ctrl', 'P'], does: 'print' },
      { combo: ['Ctrl', 'S'], does: 'download' }
    ],
    area: { x: 0, y: 94.2, w: 100, h: 5.8 }
  }
];

/**
 * The real workspace beside its three parts. Pointing at a part, or tabbing
 * to it, lights that area of the screenshot and frames both with crop marks,
 * the way the in-app guide does; its shortcut keys press once as it lights.
 */
function AppScreen() {
  const [shown, setShown] = useState(0);
  const area = SCREEN_PARTS[shown].area;
  return (
    <section className="section screen" id="how" data-enter>
      {/* First in reading order; its title and parts are placed around the shot by the section's grid. */}
      <div className="screen-rail">
        <h2 className="section-title screen-title" data-part>
          Everything happens on one screen.
        </h2>
        <p className="screen-lede" data-part>
          No menus to dig through, and the same few moves for the first customer of the day and the fiftieth.
        </p>
        <div className="screen-parts" data-part>
          {SCREEN_PARTS.map((part, i) => (
            <button
              key={part.title}
              type="button"
              className="screen-part"
              aria-pressed={i === shown}
              onMouseEnter={() => setShown(i)}
              onFocus={() => setShown(i)}
              onClick={() => setShown(i)}
            >
              <span className="screen-part-title">{part.title}</span>
              <span className="screen-part-text">{part.text}</span>
              <span className="screen-keys">
                {part.keys.map(key => (
                  <span key={key.does} className="screen-key">
                    <span className="keycaps">
                      {key.combo.map(cap => (
                        <kbd key={cap}>{cap}</kbd>
                      ))}
                    </span>
                    {key.does}
                  </span>
                ))}
              </span>
            </button>
          ))}
        </div>
      </div>
      <figure className="screen-figure" data-part>
        <div className="screen-stage">
          <img
            className="screen-shot"
            src="/landing/app-screen.jpg"
            width={1440}
            height={900}
            loading="lazy"
            alt="Sylvi with one customer, Bea Santos, on Package B: the package board across the top, her 4R sheet of 2x2 and 1x1 photos in the middle with the Adjustments panel beside it, and the print bar along the bottom."
          />
          <span
            className="screen-spot"
            style={{ left: `${area.x}%`, top: `${area.y}%`, width: `${area.w}%`, height: `${area.h}%` }}
            aria-hidden="true"
          >
            <span className="screen-mark screen-mark--tl" />
            <span className="screen-mark screen-mark--tr" />
            <span className="screen-mark screen-mark--bl" />
            <span className="screen-mark screen-mark--br" />
          </span>
        </div>
      </figure>
    </section>
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

// One subscriber per query, so components don't resubscribe on every render.
const subscribers = new Map<string, (onChange: () => void) => () => void>();
const subscribe = (query: string) => {
  let fn = subscribers.get(query);
  if (!fn) {
    fn = onChange => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    };
    subscribers.set(query, fn);
  }
  return fn;
};
const useMedia = (query: string) => useSyncExternalStore(subscribe(query), () => window.matchMedia(query).matches, () => false);

// Package B on a 4R sheet, in inch cells (4 across, 6 down). dx/dy point from
// the sheet's centre to each photo's centre, so the trim can push them apart.
const PRESS_CELLS = [
  { col: 1, row: 1, span: 2 },
  { col: 3, row: 1, span: 2 },
  { col: 1, row: 3, span: 2 },
  { col: 3, row: 3, span: 2 },
  ...[1, 2, 3, 4].map(col => ({ col, row: 5, span: 1 })),
  ...[1, 2, 3, 4].map(col => ({ col, row: 6, span: 1 }))
].map(cell => ({ ...cell, dx: cell.col - 1 + cell.span / 2 - 2, dy: cell.row - 1 + cell.span / 2 - 3 }));

// Its cuts in trimmer order, in tenths of an inch, running past the edges like a blade.
const PRESS_CUTS = [
  { x1: -3, y1: 40, x2: 43, y2: 40 },
  { x1: -3, y1: 20, x2: 43, y2: 20 },
  { x1: 20, y1: -3, x2: 20, y2: 40 },
  { x1: -3, y1: 50, x2: 43, y2: 50 },
  { x1: 10, y1: 40, x2: 10, y2: 63 },
  { x1: 20, y1: 40, x2: 20, y2: 63 },
  { x1: 30, y1: 40, x2: 30, y2: 63 }
];

const PRESS_STEPS = [
  { title: 'Finds the face', text: 'Face detection frames head and shoulders for each size. Drag or zoom if the customer wants it different.' },
  { title: 'Fits the paper', text: 'The crop goes onto whatever is loaded, 3R to long bond, turned whichever way needs fewer sheets.' },
  { title: 'Marks every cut', text: 'Every layout splits edge to edge, so each pass on the trimmer goes straight across.' },
  { title: 'Ready for the trimmer', text: '300 DPI at true size. Print at Actual size (100%) and every cut lands where it’s marked.' }
];

// Where the crop window sits on press-photo.jpg (692 × 924): the square press-crop.jpg was cut from.
const PRESS_FRAME = { left: 71 / 692, top: 0, width: 550 / 692 };

/**
 * One customer photo, taken from phone to trimmer. Without motion this is the
 * finished state; with motion, Landing's useGSAP plays it as a sequence: the
 * crop window finds the face, that crop flies onto the sheet and the copies
 * fill in, the cuts draw in trimmer order, then the sheet is measured and
 * splits into prints.
 */
function Features() {
  return (
    <section className="features mat" id="features">
      <div className="press">
        <h2 className="section-title press-title">Everything between the photo and the trimmer.</h2>
        <ol className="press-steps">
          {PRESS_STEPS.map(step => (
            <li key={step.title} className="press-step">
              <h3>{step.title}</h3>
              {/* Collapses while another step plays; landing.css opens it for the one being shown. */}
              <div className="press-step-body">
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="press-stage" aria-hidden="true">
          <div className="press-photo">
            <img src="/landing/press-photo.jpg" alt="" width={692} height={924} loading="lazy" />
            <span
              className="press-frame"
              style={{ left: `${PRESS_FRAME.left * 100}%`, top: `${PRESS_FRAME.top * 100}%`, width: `${PRESS_FRAME.width * 100}%` }}
            />
          </div>
          <div className="press-sheet">
            {PRESS_CELLS.map((cell, i) => (
              <span
                key={i}
                className="press-cell"
                style={
                  {
                    gridColumn: `${cell.col} / span ${cell.span}`,
                    gridRow: `${cell.row} / span ${cell.span}`,
                    '--dx': cell.dx,
                    '--dy': cell.dy
                  } as CSSProperties
                }
              />
            ))}
            <svg className="press-cuts" viewBox="0 0 40 60">
              {PRESS_CUTS.map((c, i) => (
                <line key={i} {...c} style={{ '--len': Math.hypot(c.x2 - c.x1, c.y2 - c.y1) } as CSSProperties} />
              ))}
            </svg>
            <span className="dim dim--w">
              <span>4 in</span>
            </span>
            <span className="dim dim--h">
              <span>6 in</span>
            </span>
          </div>
          <img className="press-crop" src="/landing/press-crop.jpg" alt="" width={440} height={440} />
        </div>
      </div>
    </section>
  );
}

// When each step's part of the sequence starts, in timeline seconds.
const PRESS_MARKS = [0, 1, 2.4, 3.4];
const SHEET_SHADOW = '0 1px 1px rgba(0,0,0,0.18), 0 3px 8px -2px rgba(0,0,0,0.25), 0 24px 48px -16px rgba(0,0,0,0.5)';
const SHEET_SHADOW_GONE = '0 1px 1px rgba(0,0,0,0), 0 3px 8px -2px rgba(0,0,0,0), 0 24px 48px -16px rgba(0,0,0,0)';

/**
 * Plays the photo-to-trimmer sequence: pinned and scrubbed by scroll on wide
 * screens, played once on arrival on narrow ones. The step being shown is
 * marked so its text lights up. Returns the cleanup for those marks.
 */
function animatePress(press: HTMLElement, wide: boolean) {
  const stage = press.querySelector<HTMLElement>('.press-stage')!;
  const photo = press.querySelector<HTMLElement>('.press-photo')!;
  const frame = press.querySelector<HTMLElement>('.press-frame')!;
  const sheet = press.querySelector<HTMLElement>('.press-sheet')!;
  const crop = press.querySelector<HTMLElement>('.press-crop')!;
  const cells = gsap.utils.toArray<HTMLElement>('.press-cell', press);
  const cuts = gsap.utils.toArray<SVGLineElement>('.press-cuts line', press);
  const dims = gsap.utils.toArray<HTMLElement>('.dim', sheet);
  const steps = gsap.utils.toArray<HTMLElement>('.press-step', press);

  // Boxes relative to the stage, read from the photo and sheet, which never
  // transform, so they hold mid-animation and after a resize.
  const box = (el: HTMLElement) => {
    const s = stage.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height };
  };
  const cropWindow = () => {
    const p = box(photo);
    return { x: p.x + PRESS_FRAME.left * p.w, y: p.y + PRESS_FRAME.top * p.h, w: PRESS_FRAME.width * p.w };
  };
  // The first 2x2 spans two of four columns with a 1px gap between them.
  const firstCell = () => {
    const s = box(sheet);
    return { x: s.x, y: s.y, w: (s.w - 1) / 2 };
  };

  const mark = (time: number) => {
    const active = PRESS_MARKS.reduce((found, start, i) => (time >= start - 0.001 ? i : found), 0);
    steps.forEach((step, i) => step.toggleAttribute('data-active', i === active));
  };

  press.setAttribute('data-motion', '');
  const tl = gsap.timeline({
    onUpdate: () => mark(tl.time()),
    scrollTrigger: wide
      ? // 1.8 screens of scroll: long enough to read each step, short enough that the finished sheet doesn't sit on an empty mat.
        { trigger: press, start: 'top top+=96', end: () => `+=${innerHeight * 1.8}`, pin: true, scrub: 0.6, invalidateOnRefresh: true }
      : { trigger: stage, start: 'top 70%' }
  });

  // Finds the face: the crop window settles onto the head and the rest dims.
  tl.fromTo(
    frame,
    { opacity: 0, scale: 1.3, boxShadow: '0 0 0 100vmax rgba(16,28,24,0)' },
    { opacity: 1, scale: 1, boxShadow: '0 0 0 100vmax rgba(16,28,24,0.5)', duration: 0.8, ease: EASE_OUT },
    0
  );
  tl.fromTo(sheet, { opacity: 0.35 }, { opacity: 1, duration: 0.4 }, 1);

  // Fits the paper: that exact crop lifts out of the photo onto the first 2x2, then the copies fill in.
  tl.fromTo(crop, { opacity: 0 }, { opacity: 1, duration: 0.05 }, 1);
  tl.fromTo(
    crop,
    { x: () => cropWindow().x, y: () => cropWindow().y, width: () => cropWindow().w, scale: 1 },
    { x: () => firstCell().x, y: () => firstCell().y, width: () => cropWindow().w, scale: () => firstCell().w / cropWindow().w, duration: 0.7, ease: EASE_OUT },
    1.05
  );
  tl.fromTo(photo, { opacity: 1 }, { opacity: 0.45, duration: 0.5 }, 1.05);
  tl.fromTo(cells[0], { opacity: 0 }, { opacity: 1, duration: 0.02 }, 1.75);
  tl.to(crop, { opacity: 0, duration: 0.02 }, 1.77);
  tl.fromTo(cells.slice(1), { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.22, ease: EASE_OUT, stagger: 0.05 }, 1.8);

  // Marks every cut, in trimmer order.
  tl.fromTo(
    cuts,
    { strokeDashoffset: (_: number, line: SVGLineElement) => line.style.getPropertyValue('--len') },
    { strokeDashoffset: 0, duration: 0.3, ease: EASE_OUT, stagger: 0.13 },
    2.4
  );

  // Ready for the trimmer: measured, then cut apart into separate prints.
  tl.fromTo(dims, { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.1 }, 3.4);
  tl.fromTo(cuts, { opacity: 1 }, { opacity: 0, duration: 0.3 }, 3.9);
  tl.fromTo(
    sheet,
    { backgroundColor: 'rgba(255,255,255,1)', boxShadow: SHEET_SHADOW },
    { backgroundColor: 'rgba(255,255,255,0)', boxShadow: SHEET_SHADOW_GONE, duration: 0.7, ease: EASE_OUT },
    3.9
  );
  // Each print moves 7px per inch it sits from the sheet's centre (--dx, --dy).
  const spread = (axis: '--dx' | '--dy') => (_: number, cell: HTMLElement) => Number(cell.style.getPropertyValue(axis)) * 7;
  tl.fromTo(
    cells,
    { x: 0, y: 0, boxShadow: '0 6px 14px -6px rgba(0,0,0,0)' },
    { x: spread('--dx'), y: spread('--dy'), boxShadow: '0 6px 14px -6px rgba(0,0,0,0.5)', duration: 0.7, ease: EASE_OUT },
    3.9
  );
  // A beat on the finished prints before the pin lets go.
  tl.to({}, { duration: 0.4 });

  return () => {
    press.removeAttribute('data-motion');
    steps.forEach(step => step.removeAttribute('data-active'));
  };
}

// What one ID photo order takes in Word, in the order a shop does it.
const CHORES = [
  'Insert the photo and crop the face by eye.',
  'Set it to 2 × 2 inches, then check it with a ruler.',
  'Copy it three more times and line them up.',
  'Shrink eight more to 1 × 1 and squeeze them in.',
  'Guess the margins, print a test and fix what moved.'
];

/**
 * The problem, before the answer: the chores one order takes in Word, crossed
 * off as they scroll past. Its last line hands over to the sequence below.
 */
function Statement() {
  return (
    <section className="section statement" id="word">
      <div className="statement-head" data-enter>
        <h2 className="statement-title" data-part>
          Stop nudging photos around a page in Word.
        </h2>
        <p className="statement-lede" data-part>
          One order for four 2x2 and eight 1x1, done the usual way.
        </p>
      </div>
      <ol className="chores" aria-label="What one order takes in Word">
        {CHORES.map(chore => (
          <li key={chore} className="chore">
            <span className="chore-text">{chore}</span>
          </li>
        ))}
      </ol>
      <p className="chores-after">Sylvi does every one of these the moment the photo lands.</p>
    </section>
  );
}

const FOUR_R = { w: 101.6, h: 152.4 };
// Each built-in package laid out by Sylvi's own packer on 4R, for the answer tiles beside the counter carousel.
const SHOWCASE = BUILT_IN_PACKAGES.map(pkg => {
  const { sheets } = pack(buildPackItems([{ personId: 'sample', pkg }], FOUR_R.w * FOUR_R.h), {
    paperWidthMm: FOUR_R.w,
    paperHeightMm: FOUR_R.h,
    marginMm: 0,
    gapMm: 0,
    orientation: 'auto'
  });
  return { pkg, sheet: sheets[0] };
});

function MiniLayout({ sheet, portrait }: { sheet: PackedSheet; portrait: Portrait }) {
  return (
    <div className="mini-layout" style={{ aspectRatio: `${sheet.widthMm} / ${sheet.heightMm}` }} aria-hidden="true">
      {sheet.placements.map((p, i) => (
        <span
          key={i}
          className="mini-cell"
          style={{
            left: `${(p.x / sheet.widthMm) * 100}%`,
            top: `${(p.y / sheet.heightMm) * 100}%`,
            width: `${(p.w / sheet.widthMm) * 100}%`,
            height: `${(p.h / sheet.heightMm) * 100}%`,
            backgroundImage: `url(${photo(portrait)})`
          }}
        />
      ))}
    </div>
  );
}

/**
 * The built-in packages as the menu board a shop already has on its wall,
 * beside a live sheet: picking a package or paper runs Sylvi's real packer.
 */
function Packages() {
  return (
    <section className="packages mat" id="packages">
      <div className="packages-inner">
        <div className="packages-head" data-enter>
          <h2 className="section-title" data-part>
            The menu your counter already sells.
          </h2>
          <p className="section-lede" data-part>
            Packages A to D and whole-sheet fills come built in. Pick one, or another paper, and the sheet packs itself the way it prints. Shops can save their own.
          </p>
        </div>
        <SheetDemo />
      </div>
    </section>
  );
}

// What Sylvi answers each customer with: the package tile, previewing that customer's own sheet.
// A package answer shows the real packed layout; the other two show their photo instead.
const REQUESTS: { ask: string; answer: string; detail: string; preview: { pkg: string; portrait: Portrait } | { image: string } }[] = [
  { ask: 'Four 2x2 and eight 1x1, for my board exam.', answer: 'Package B', detail: '4 × 2x2 and 8 × 1x1 on one 4R sheet', preview: { pkg: 'pkg-b', portrait: 2 } },
  { ask: 'Passport size, please. And a few 1x1 too.', answer: 'Package C', detail: '4 passport (35 × 45 mm) and 6 × 1x1', preview: { pkg: 'pkg-c', portrait: 4 } },
  { ask: 'Just fill a whole sheet with 1x1.', answer: 'Whole sheet 1x1', detail: 'As many 1x1 as fit, borderless on 4R', preview: { pkg: 'pkg-full-1x1', portrait: 3 } },
  { ask: 'There are three of us. Can we share one sheet?', answer: 'Several customers, one sheet', detail: 'Each keeps their own package and crop', preview: { image: '/landing/counter-4.jpg' } },
  { ask: 'All I have is this selfie.', answer: 'Auto-crop', detail: 'Finds the face, and warns if the photo will print soft', preview: { image: photo(1) } }
];

// The photo each customer brings. The quote beside the carousel says what they want, so the cards carry no text.
const COUNTER_SLIDES = REQUESTS.map((_, i) => ({ id: i, image: `/landing/counter-${i + 1}.jpg`, alt: '' }));

/**
 * Customers at the counter, one at a time: their photo in the carousel, their
 * request beside it. No autoplay: people are reading the quote, so they move
 * it on themselves.
 */
function Requests() {
  const [index, setIndex] = useState(0);
  const dark = useMedia('(prefers-color-scheme: dark)');
  const request = REQUESTS[index];

  return (
    <section className="section requests" id="requests">
      <div className="requests-body">
        <div className="counter-slider" aria-label="Customers at the counter">
          <Carousel
            items={COUNTER_SLIDES}
            baseWidth={440}
            aspectRatio={0.8}
            radius={18}
            effect="tilt"
            indicator="dots"
            arrows
            theme={dark ? 'dark' : 'light'}
            onChange={setIndex}
            // The page's surfaces and ink, so the frame matches the cards and panels around it.
            style={
              {
                '--carousel-frame': 'var(--surface)',
                '--carousel-frame-edge': 'var(--line)',
                '--carousel-frame-highlight': 'transparent',
                '--carousel-frame-shadow': 'var(--ring)',
                '--carousel-tile': 'var(--surface-2)',
                '--carousel-tile-edge': 'var(--line)',
                '--carousel-tile-highlight': 'transparent',
                '--carousel-tile-shadow': 'none',
                '--carousel-ink': 'var(--ink)',
                '--carousel-muted': 'var(--ink-2)',
                '--carousel-faint': 'var(--line-strong)',
                '--carousel-soft': 'var(--ink-3)',
                '--carousel-badge': 'var(--surface-2)'
              } as CSSProperties
            }
          />
        </div>
        <div className="request">
          <h2 className="section-title">What walks up to the counter.</h2>
          <p className="request-lede">Drag the photo or use the arrows to meet the next customer.</p>
          <div className="request-live" aria-live="polite">
            <p className="request-count">
            Customer {index + 1} of {REQUESTS.length}
          </p>
          {/* Keyed so each request enters fresh as its customer arrives. */}
          <blockquote key={`ask-${index}`} className="request-ask">
            <p>“{request.ask}”</p>
          </blockquote>
          <div key={`answer-${index}`} className="request-answer">
            <AnswerPreview preview={request.preview} />
            <span className="request-answer-text">
              <b>{request.answer}</b>
              <span>{request.detail}</span>
            </span>
          </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const QUESTIONS = [
  { ask: 'Is Sylvi free?', answer: 'Yes. No trial, no watermark and nothing to pay. Open it and start printing.' },
  {
    ask: 'Do we need to sign up?',
    answer: 'No. Sylvi works the moment it opens. Shops can sign in with Google to keep their packages and shop details on every computer they use.'
  },
  {
    ask: 'Will it run on our old shop computer?',
    answer:
      'If it has a recent Chrome, Edge or Firefox, yes. There’s nothing to install, and face detection runs on the processor, so no graphics card is needed. A slower computer just takes a moment longer to find the face.'
  },
  { ask: 'Does it need the internet?', answer: 'Only the first time you use it. After that, Sylvi opens and lays out photos with the internet off.' },
  {
    ask: 'Which printers and paper work?',
    answer: 'Any printer that prints at Actual size (100%). Sylvi saves 300 DPI PDF, PNG or JPG files for 3R, 4R, 5R, A4, short bond, long bond or a custom size.'
  },
  {
    ask: 'Where do the customer photos go?',
    answer:
      'Nowhere. They stay on the computer and are never uploaded (RA 10173). Recent jobs delete themselves after 24 hours, and signing in syncs packages and settings, never photos.'
  }
];

function Questions() {
  return (
    <section className="section questions" id="questions" data-enter>
      <h2 className="section-title" data-part>
        What shops ask before they try it.
      </h2>
      <div className="faq" data-part>
        {QUESTIONS.map((item, i) => (
          <details key={item.ask} className="faq-item" open={i === 0}>
            <summary>
              {item.ask}
              <span className="faq-sign" aria-hidden="true" />
            </summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** The small sheet on the answer tile, like the previews on Sylvi's package board. */
function AnswerPreview({ preview }: { preview: (typeof REQUESTS)[number]['preview'] }) {
  if ('image' in preview) return <img className="request-answer-image" src={preview.image} alt="" width={44} height={55} />;
  const item = SHOWCASE.find(s => s.pkg.id === preview.pkg);
  if (!item) return null;
  return (
    <span className="request-answer-sheet">
      <MiniLayout sheet={item.sheet} portrait={preview.portrait} />
    </span>
  );
}

function CallToAction() {
  const section = useRef<HTMLElement>(null);
  return (
    <section ref={section} className="cta mat" id="start">
      {/* Slow mist over the mat, tinted to its greens; nothing shows without WebGL. */}
      <CloudShader className="cta-mist" count={4} speed={0.45} maxDpr={1} cloudColor="#5f8075" skyTopColor="#1c372f" skyBottomColor="#24443b" />
      <span className="cta-frame" aria-hidden="true" />
      {/* The letters near the pointer get heavier, on the page's own Geist weight axis. */}
      <h2 className="cta-title">
        <VariableProximity
          label="Your next customer is already in line."
          fromFontVariationSettings="'wght' 600"
          toFontVariationSettings="'wght' 900"
          containerRef={section}
          radius={150}
          falloff="gaussian"
          smoothing={0.25}
        />
      </h2>
      <a className="btn btn-primary btn-xl" href={APP_URL}>
        Open Sylvi
      </a>
      <p className="cta-note">Free, in your browser, with no sign-up. Works offline after the first visit, and photos never leave the computer.</p>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      {/* The edge of the cutting mat: a true-inch ruler, as on Sylvi's own sheets. */}
      <div className="footer-ruler" aria-hidden="true">
        {Array.from({ length: 24 }, (_, inch) => (
          <span key={inch} style={{ left: `${inch}in` }}>
            {inch}
          </span>
        ))}
      </div>
      <div className="footer-inner">
        <div className="footer-about">
          <a className="footer-brand" href="#top">
            <Mark size={28} />
            <span>Sylvi</span>
          </a>
          <p className="footer-tagline">ID photo sheets for print shops. Free, in your browser.</p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#packages">Packages</a>
          <a href="#questions">Questions</a>
        </nav>
        <div className="footer-cta">
          <a className="btn btn-primary" href={APP_URL}>
            Open Sylvi
          </a>
          <p className="footer-note">Photos never leave the computer.</p>
        </div>
      </div>
      <p className="footer-legal">© 2026 Sylvi</p>
    </footer>
  );
}
