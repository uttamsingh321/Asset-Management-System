import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FL, PL, CN, buildMachines } from './data';

const CC = {
  Ismartu: {
    c: '#00e5ff',
    l: 'url(#ismartuLeftWall)',
    r: 'url(#ismartuRightWall)',
    t: 'url(#ismartuRoof)',
    w: '#8ff3ff',
    glow: 'rgba(0, 229, 255, 0.45)',
    accent: '#00e5ff',
    base: '#081c2c',
  },
  Padget: {
    c: '#ff2bd6',
    l: 'url(#padgetLeftWall)',
    r: 'url(#padgetRightWall)',
    t: 'url(#padgetRoof)',
    w: '#ffa0ee',
    glow: 'rgba(255, 43, 214, 0.45)',
    accent: '#ff2bd6',
    base: '#260a2b',
  },
};

const GB = [
  { id: 'C39', co: 'Ismartu', x: 10, y: 9, w: 5, d: 7 },
  { id: 'C39', co: 'Padget', x: 15, y: 9, w: 5, d: 7 },
  { id: 'D198', co: 'Ismartu', x: 12, y: -1, w: 7, d: 6 },
  { id: 'D197', co: 'Padget', x: 0, y: 13, w: 6, d: 6 },
  { id: 'D199', co: 'Padget', x: 0, y: 0, w: 6, d: 5 },
];

const SP = [-3.5, 7.5];

const RT = {
  C39Ismartu: [[8.5, 7.5], [8.5, 17.2], [12.5, 17.2], [12.5, 16]],
  C39Padget: [[8.5, 7.5], [8.5, 17.2], [17.5, 17.2], [17.5, 16]],
  D198Ismartu: [[15.5, 7.5], [15.5, 5]],
  D197Padget: [[8.5, 7.5], [8.5, 19.9], [3, 19.9], [3, 19]],
  D199Padget: [[3, 7.5], [3, 5]],
};

const DX = (g) => { const r = RT[g.id + g.co]; return r[r.length - 1][0]; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LABELS = [
  ['C39 · Sector 57', 'Ismartu 5020 · Padget 9500', 15, 12.5],
  ['D198', 'Ismartu 5020', 15.5, 2],
  ['D197', 'Padget 9500', 3, 16],
  ['D199', 'Padget 9500', 3, 2.5],
];

const PLOTS = [
  [9, 8.4, 12, 8.8, '#7fa0c8'],
  [11, -2, 9, 8.6, '#00e5ff'],
  [-1, 12, 8.6, 8.4, '#ff2bd6'],
  [-1, -1.5, 8, 7.8, '#ff2bd6'],
];

const TREES = [
  [-0.6, 6.2], [1.5, 6.2], [4.5, 6.2], [6.8, 6.2],
  [10.2, 6.2], [13.4, 6.2], [17.5, 6.2], [21.5, 6.2], [24.5, 6.2],
  [7.2, 9.8], [7.2, 13.5], [7.2, 17.2], [7.2, 21.0],
  [9.8, 23.2], [13.2, 23.2], [16.8, 23.2], [20.5, 23.2],
  [19.2, -1.5], [19.2, 2.2], [19.2, 5.2],
];

const LAMPS = [
  [-1.5, 6.4], [5.5, 6.4], [12.0, 6.4], [19.0, 6.4],
  [7.4, 11.5], [7.4, 18.5],
];

const TRUCKS = [
  { x: 6.8, y: 1.5, co: 'Padget', color: '#ff2bd6', lbl: 'LOGISTICS' },
  { x: 14.8, y: 16.8, co: 'Ismartu', color: '#00e5ff', lbl: 'PARTS EXP' },
];

const ox = 450, oy = 85, kx = 19.1, ky = 11, FH = 15, HH = 4 * FH;
const P = (x, y, z) => [ox + (x - y) * kx, oy + (x + y) * ky - z];
const pts = (a) => a.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ');
const mk = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;

function IsometricTree({ x, y }) {
  const p0 = P(x, y, 0);
  const p1 = P(x, y, 9);
  return (
    <g pointerEvents="none" className="tree-iso">
      {/* Ground drop shadow */}
      <ellipse cx={p0[0] + 3} cy={p0[1] + 2} rx="6.5" ry="3.5" fill="rgba(0,0,0,0.45)" />
      {/* Trunk */}
      <line x1={p0[0]} y1={p0[1]} x2={p1[0]} y2={p1[1]} stroke="#4a3b32" strokeWidth="2.2" strokeLinecap="round" />
      {/* Lower dark canopy */}
      <circle cx={p1[0]} cy={p1[1] + 1} r="5.8" fill="#0f3d24" />
      {/* Mid foliage */}
      <circle cx={p1[0] - 0.5} cy={p1[1] - 2} r="5.2" fill="#15803d" />
      {/* Top sunlit highlight */}
      <circle cx={p1[0] - 1.2} cy={p1[1] - 4} r="3.6" fill="#22c55e" opacity="0.9" />
      <circle cx={p1[0] - 1.8} cy={p1[1] - 4.5} r="1.5" fill="#86efac" opacity="0.8" />
    </g>
  );
}

function IsometricLamp({ x, y }) {
  const p0 = P(x, y, 0);
  const pTop = P(x, y, 16);
  return (
    <g pointerEvents="none" className="lamp-iso">
      {/* Ambient ground pool light */}
      <ellipse cx={p0[0]} cy={p0[1]} rx="14" ry="7" fill="url(#lampGlow)" opacity="0.65" />
      {/* Light pole */}
      <line x1={p0[0]} y1={p0[1]} x2={pTop[0]} y2={pTop[1]} stroke="#94a3b8" strokeWidth="1.2" />
      {/* Outreach arm */}
      <line x1={pTop[0]} y1={pTop[1]} x2={pTop[0] + 4} y2={pTop[1] + 2} stroke="#cbd5e1" strokeWidth="1.2" />
      {/* Luminaire head with glow */}
      <circle cx={pTop[0] + 4} cy={pTop[1] + 2} r="2" fill="#00e5ff" />
      <circle cx={pTop[0] + 4} cy={pTop[1] + 2} r="4.5" fill="#00e5ff" opacity="0.4" />
    </g>
  );
}

function IsometricTruck({ x, y, co, color, lbl }) {
  const w = 1.4, d = 3.2, h = 1.8;
  const pShd = [P(x - 0.2, y + d + 0.3, 0), P(x + w + 0.5, y + d + 0.3, 0), P(x + w + 0.5, y - 0.2, 0), P(x - 0.2, y - 0.2, 0)];
  const pCargoL = [P(x, y + d, 0.4), P(x + w, y + d, 0.4), P(x + w, y + d, h), P(x, y + d, h)];
  const pCargoR = [P(x + w, y + 0.9, 0.4), P(x + w, y + d, 0.4), P(x + w, y + d, h), P(x + w, y + 0.9, h)];
  const pCargoT = [P(x, y + 0.9, h), P(x + w, y + 0.9, h), P(x + w, y + d, h), P(x, y + d, h)];
  const pCabL = [P(x, y + 0.9, 0.4), P(x + w, y + 0.9, 0.4), P(x + w, y + 0.9, h * 0.75), P(x, y + 0.9, h * 0.75)];
  const pCabT = [P(x, y, h * 0.75), P(x + w, y, h * 0.75), P(x + w, y + 0.9, h * 0.75), P(x, y + 0.9, h * 0.75)];
  const pGlass = [P(x + 0.15, y + 0.05, h * 0.72), P(x + w - 0.15, y + 0.05, h * 0.72), P(x + w - 0.15, y + 0.45, h * 0.72), P(x + 0.15, y + 0.45, h * 0.72)];

  return (
    <g pointerEvents="none" className="truck-iso">
      {/* Ground shadow */}
      <polygon points={pts(pShd)} fill="rgba(0,0,0,0.5)" filter="url(#bldgShadow)" />
      {/* Wheels */}
      <circle cx={P(x + 0.1, y + d * 0.3, 0.2)[0]} cy={P(x + 0.1, y + d * 0.3, 0.2)[1]} r="1.8" fill="#0f172a" />
      <circle cx={P(x + 0.1, y + d * 0.8, 0.2)[0]} cy={P(x + 0.1, y + d * 0.8, 0.2)[1]} r="1.8" fill="#0f172a" />
      {/* Cargo Body */}
      <polygon points={pts(pCargoL)} fill="#1e293b" stroke="#334155" strokeWidth="0.5" />
      <polygon points={pts(pCargoR)} fill="#0f172a" stroke="#334155" strokeWidth="0.5" />
      <polygon points={pts(pCargoT)} fill="#334155" stroke={color} strokeWidth="0.8" />
      {/* Fleet logo badge */}
      <line x1={pCargoT[0][0]} y1={pCargoT[0][1] + 3} x2={pCargoT[1][0]} y2={pCargoT[1][1] + 3} stroke={color} strokeWidth="1.2" />
      {/* Cab & Windshield */}
      <polygon points={pts(pCabL)} fill="#475569" stroke="#64748b" strokeWidth="0.5" />
      <polygon points={pts(pCabT)} fill="#64748b" stroke="#94a3b8" strokeWidth="0.5" />
      <polygon points={pts(pGlass)} fill="#38bdf8" opacity="0.85" />
      {/* Headlights */}
      <circle cx={P(x + 0.2, y, 0.4)[0]} cy={P(x + 0.2, y, 0.4)[1]} r="1.2" fill="#fef08a" />
      <circle cx={P(x + w - 0.2, y, 0.4)[0]} cy={P(x + w - 0.2, y, 0.4)[1]} r="1.2" fill="#fef08a" />
    </g>
  );
}

function Box({ x, y, w, d, z0, H, k, win, rnd }) {
  const pL = [P(x, y + d, z0), P(x + w, y + d, z0), P(x + w, y + d, z0 + H), P(x, y + d, z0 + H)];
  const pR = [P(x + w, y, z0), P(x + w, y + d, z0), P(x + w, y + d, z0 + H), P(x + w, y, z0 + H)];
  const pT = [P(x, y, z0 + H), P(x + w, y, z0 + H), P(x + w, y + d, z0 + H), P(x, y + d, z0 + H)];

  const els = [
    // Left facade with architectural gradient and panel joints
    <polygon key="l" points={pts(pL)} fill={k.l} stroke={k.c} strokeWidth="0.8" strokeOpacity="0.8" />,
    // Right facade with depth ambient occlusion
    <polygon key="r" points={pts(pR)} fill={k.r} stroke={k.c} strokeWidth="0.8" strokeOpacity="0.8" />,
    // Roof top plane
    <polygon key="t" points={pts(pT)} fill={k.t} stroke={k.c} strokeWidth="1" />,
  ];

  if (win) {
    const nf = Math.round(H / FH);
    // Rooftop parapet coping coping border
    els.push(
      <polygon
        key="parapet-coping"
        points={pts(pT)}
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    );

    // Architectural window bands with illuminated cleanroom/office lights
    [[w, (t) => [x + t * w, y + d]], [d, (t) => [x + w, y + t * d]]].forEach(([len, f], s) => {
      const n = Math.round(len * 1.15);
      for (let fl = 0; fl < nf; fl++) {
        for (let i = 0; i < n; i++) {
          const a = f((i + 0.18) / n);
          const b = f((i + 0.82) / n);
          const za = z0 + (fl + 0.28) * FH;
          const zb = z0 + (fl + 0.74) * FH;
          const isLit = rnd() < 0.65;
          const winColor = isLit ? (rnd() < 0.35 ? '#e0f7ff' : k.w) : 'rgba(255,255,255,0.06)';
          els.push(
            <polygon
              key={`w${s}-${fl}-${i}`}
              points={pts([P(a[0], a[1], za), P(b[0], b[1], za), P(b[0], b[1], zb), P(a[0], a[1], zb)])}
              fill={winColor}
              stroke={isLit ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.5)'}
              strokeWidth="0.4"
            />
          );
        }
      }
    });

    // Ground floor architectural entrance canopy & glass lobby
    const lobbyW = Math.min(2.4, w * 0.5);
    const lobbyH = FH * 0.85;
    const pLobby = [
      P(x + (w - lobbyW) / 2, y + d, z0),
      P(x + (w + lobbyW) / 2, y + d, z0),
      P(x + (w + lobbyW) / 2, y + d, z0 + lobbyH),
      P(x + (w - lobbyW) / 2, y + d, z0 + lobbyH),
    ];
    els.push(
      <polygon
        key="lobby-glass"
        points={pts(pLobby)}
        fill="rgba(0, 229, 255, 0.25)"
        stroke="#00e5ff"
        strokeWidth="1"
      />
    );
  }

  return <>{els}</>;
}

export default function Gis({
  M,
  co = 'All',
  onOpen: openIn = () => {},
  onExitCo = () => {},
  onTip = () => {},
  onTipMove = () => {},
  onTipHide = () => {},
  from,
  onDone,
}) {
  const defaultM = useMemo(buildMachines, []);
  const machines = M || defaultM;
  const rt0 = from ? RT[from] : null;
  const e0 = rt0 ? rt0[rt0.length - 1] : SP;
  const cp = useRef(e0);
  const busy = useRef(false);
  const [pp, setPp] = useState({ p: e0, v: from ? 0 : 1, ms: 0, w: 0 });
  const [dop, setDop] = useState(null);

  const mv = async (p) => {
    const d = Math.hypot(p[0] - cp.current[0], p[1] - cp.current[1]) * 130;
    cp.current = p;
    setPp({ p, v: 1, ms: d, w: 1 });
    await sleep(d);
  };

  const onOpen = async (id, c) => {
    if (busy.current) return;
    busy.current = true;
    onTipHide();
    const key = id + c;
    for (const p of RT[key]) await mv(p);
    setPp((s) => ({ ...s, w: 0 }));
    setDop(key);
    await sleep(450);
    setPp((s) => ({ ...s, v: 0 }));
    await sleep(350);
    busy.current = false;
    openIn(id, c);
  };

  useEffect(() => {
    if (!from) return;
    const rt = RT[from];
    (async () => {
      busy.current = true;
      setDop(from);
      await sleep(500);
      setPp((s) => ({ ...s, v: 1 }));
      await sleep(450);
      let i = 0;
      for (const p of rt.slice(0, -1).reverse().concat([SP])) {
        await mv(p);
        if (!i++) setDop(null);
      }
      setPp((s) => ({ ...s, w: 0 }));
      busy.current = false;
      onDone && onDone();
    })();
  }, []);

  const order = [...GB].sort((a, b) => a.x + a.y - b.x - b.y);

  // Ground grid with realistic industrial tech-campus coordinates
  const grid = [];
  for (let i = -4; i <= 26; i += 2) {
    grid.push(
      <polyline
        key={'a' + i}
        points={pts([P(i, -4, 0), P(i, 24, 0)])}
        stroke="rgba(0,229,255,0.06)"
        strokeWidth="0.8"
        fill="none"
      />,
      <polyline
        key={'b' + i}
        points={pts([P(-4, i, 0), P(26, i, 0)])}
        stroke="rgba(0,229,255,0.06)"
        strokeWidth="0.8"
        fill="none"
      />
    );
  }

  const mx = Math.max(
    1,
    ...GB.flatMap((g) =>
      FL.map(
        (f, fi) =>
          machines.filter((m) => m.b === g.id && m.co === g.co && m.fi === fi).length
      )
    )
  );

  const tipFor = (g) => {
    const a = machines.filter((m) => m.b === g.id && m.co === g.co);
    const d = a.filter((m) => m.st === 'Deployed').length;
    return (
      <>
        <b>{g.id}</b> · {CN[g.co]}<br />
        {PL.filter((p) => p.b === g.id && p.co === g.co).map((p) => p.c + ' ' + p.u).join(' · ')}<br />
        {a.length} units · {Math.round((d / a.length) * 100)}% deployed<br />Click to open the floors
      </>
    );
  };

  // Roadway polygon points
  const pMainRoad = [P(-4, 6.7, 0), P(26, 6.7, 0), P(26, 8.3, 0), P(-4, 8.3, 0)];
  const pCenterLine = [P(-4, 7.5, 0), P(26, 7.5, 0)];
  const pCrossRoad = [P(7.7, 8.3, 0), P(9.3, 8.3, 0), P(9.3, 24, 0), P(7.7, 24, 0)];
  const pCrossCenter = [P(8.5, 8.3, 0), P(8.5, 24, 0)];

  // Zebra Crosswalks at building entrances
  const zebraWalks = [
    [P(12.0, 7.5, 0), P(13.0, 7.5, 0)],
    [P(17.0, 7.5, 0), P(18.0, 7.5, 0)],
    [P(8.5, 15.5, 0), P(8.5, 16.5, 0)],
    [P(2.5, 7.5, 0), P(3.5, 7.5, 0)],
  ];

  return (
    <section className="gis">
      <div className="gmap">
        <svg
          viewBox="0 0 900 520"
          width="100%"
          role="img"
          aria-label="Site map of both companies"
          id="gsvg"
        >
          <defs>
            {/* Atmospheric Background Radial Gradient */}
            <radialGradient id="gg" cx="50%" cy="55%" r="65%">
              <stop offset="0%" stopColor="#0c1b33" />
              <stop offset="60%" stopColor="#060c18" />
              <stop offset="100%" stopColor="#020408" />
            </radialGradient>

            {/* Building Ground Soft Shadow Blur */}
            <filter id="bldgShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="4.5" />
              <feOffset dx="3" dy="4" result="offsetblur" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.55" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Road Lamp Spotlight Radial Glow */}
            <radialGradient id="lampGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(0, 229, 255, 0.45)" />
              <stop offset="60%" stopColor="rgba(0, 229, 255, 0.12)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>

            {/* Photovoltaic Solar Panel Pattern */}
            <pattern id="solarGrid" width="6" height="4" patternUnits="userSpaceOnUse">
              <rect width="6" height="4" fill="#0d1b2a" stroke="#1e3a5f" strokeWidth="0.5" />
              <line x1="0" y1="2" x2="6" y2="2" stroke="#38bdf8" strokeWidth="0.3" opacity="0.6" />
            </pattern>

            {/* Ismartu Building Facade Gradients (Cyan Theme) */}
            <linearGradient id="ismartuLeftWall" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#061b29" />
              <stop offset="50%" stopColor="#0a2a40" />
              <stop offset="100%" stopColor="#103c5b" />
            </linearGradient>
            <linearGradient id="ismartuRightWall" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#082538" />
              <stop offset="60%" stopColor="#0d3a58" />
              <stop offset="100%" stopColor="#14517b" />
            </linearGradient>
            <linearGradient id="ismartuRoof" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#114b66" />
              <stop offset="100%" stopColor="#1d86b0" />
            </linearGradient>

            {/* Padget Building Facade Gradients (Magenta Theme) */}
            <linearGradient id="padgetLeftWall" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#220826" />
              <stop offset="50%" stopColor="#35103a" />
              <stop offset="100%" stopColor="#4f1857" />
            </linearGradient>
            <linearGradient id="padgetRightWall" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#2f0c35" />
              <stop offset="60%" stopColor="#4a1550" />
              <stop offset="100%" stopColor="#671e6f" />
            </linearGradient>
            <linearGradient id="padgetRoof" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#551a5c" />
              <stop offset="100%" stopColor="#8a2a92" />
            </linearGradient>
          </defs>

          {/* Deep Campus Space Canvas */}
          <rect width="900" height="520" fill="url(#gg)" />

          {/* Isometric Survey Coordinate Grid */}
          {grid}

          {/* Landscaped Plots & Industrial Parcels */}
          {PLOTS.map((p, i) => (
            <g key={i}>
              {/* Plot Ground Foundation Slab */}
              <polygon
                points={pts([
                  P(p[0], p[1], 0),
                  P(p[0] + p[2], p[1], 0),
                  P(p[0] + p[2], p[1] + p[3], 0),
                  P(p[0], p[1] + p[3], 0),
                ])}
                fill="rgba(14, 28, 48, 0.65)"
                stroke={p[4]}
                strokeOpacity="0.45"
                strokeWidth="1.2"
                strokeDasharray="6 4"
              />
              {/* Perimeter Security Curb */}
              <polygon
                points={pts([
                  P(p[0] + 0.3, p[1] + 0.3, 0),
                  P(p[0] + p[2] - 0.3, p[1] + 0.3, 0),
                  P(p[0] + p[2] - 0.3, p[1] + p[3] - 0.3, 0),
                  P(p[0] + 0.3, p[1] + p[3] - 0.3, 0),
                ])}
                fill="none"
                stroke="rgba(0, 229, 255, 0.12)"
                strokeWidth="0.8"
              />
            </g>
          ))}

          {/* Asphalt Roadway Network */}
          {/* Main East-West Boulevard */}
          <polygon
            points={pts(pMainRoad)}
            fill="#09111e"
            stroke="#1b2c4a"
            strokeWidth="1.5"
          />
          {/* Main Double-Yellow Dashed Centerline */}
          <polyline
            points={pts(pCenterLine)}
            stroke="#facc15"
            strokeWidth="1.2"
            strokeDasharray="7 5"
            strokeOpacity="0.85"
            fill="none"
          />

          {/* North-South Complex Connector Road */}
          <polygon
            points={pts(pCrossRoad)}
            fill="#09111e"
            stroke="#1b2c4a"
            strokeWidth="1.5"
          />
          <polyline
            points={pts(pCrossCenter)}
            stroke="#facc15"
            strokeWidth="1.2"
            strokeDasharray="7 5"
            strokeOpacity="0.85"
            fill="none"
          />

          {/* Pedestrian Zebra Crossings */}
          {zebraWalks.map(([pA, pB], zi) => (
            <g key={zi} opacity="0.8">
              {Array.from({ length: 5 }, (_, k) => (
                <line
                  key={k}
                  x1={pA[0] + k * 3 - 6}
                  y1={pA[1] + k * 1.8 - 3}
                  x2={pB[0] + k * 3 - 6}
                  y2={pB[1] + k * 1.8 - 3}
                  stroke="#ffffff"
                  strokeWidth="2.2"
                />
              ))}
            </g>
          ))}

          {/* Parking Stalls & Delivery Lanes */}
          <g opacity="0.6">
            {Array.from({ length: 4 }, (_, pi) => {
              const spA = P(0.5 + pi * 1.2, 5.5, 0);
              const spB = P(0.5 + pi * 1.2, 6.5, 0);
              return <line key={pi} x1={spA[0]} y1={spA[1]} x2={spB[0]} y2={spB[1]} stroke="#ffffff" strokeWidth="1" strokeDasharray="3 2" />;
            })}
          </g>

          {/* Logistics Trucks parked on facility grounds */}
          {TRUCKS.map((trk, ti) => (
            <IsometricTruck key={ti} {...trk} />
          ))}

          {/* Streetlamps with Illumination Cones */}
          {LAMPS.map(([lx, ly], li) => (
            <IsometricLamp key={li} x={lx} y={ly} />
          ))}

          {/* Landscaped Trees with 3D Canopies */}
          {TREES.map(([tx, ty], tri) => (
            <IsometricTree key={tri} x={tx} y={ty} />
          ))}

          {/* Extruded 3D Industrial Complex Buildings */}
          {order.map((b, i) => {
            const k = CC[b.co],
              rnd = mk(i * 977 + 13),
              dim = co !== 'All' && co !== b.co;

            // Directional Ground Drop Shadow Cast by Building
            const shadowPoints = [
              P(b.x, b.y + b.d, 0),
              P(b.x + b.w, b.y + b.d, 0),
              P(b.x + b.w + 3.8, b.y + b.d + 3.2, 0),
              P(b.x + 3.8, b.y + b.d + 3.2, 0),
            ];

            // Rooftop elevator core antenna beacon tip
            const antennaTip = P(b.x + b.w * 0.2 + 0.6, b.y + b.d * 0.25 + 0.6, HH + 16);

            return (
              <g
                key={b.id + b.co}
                className="bd"
                data-b={b.id}
                style={{ '--gc': k.accent, opacity: dim ? 0.22 : 1 }}
                onMouseEnter={(e) => onTip(e, tipFor(b))}
                onMouseMove={onTipMove}
                onMouseLeave={onTipHide}
                onClick={() => {
                  onTipHide();
                  onOpen(b.id, b.co);
                }}
              >
                {/* 1. Ground Drop Shadow */}
                <polygon
                  points={pts(shadowPoints)}
                  fill="rgba(0, 0, 0, 0.55)"
                  filter="url(#bldgShadow)"
                />

                {/* 2. Main Building 3D Extrusion */}
                <Box x={b.x} y={b.y} w={b.w} d={b.d} z0={0} H={HH} k={k} win rnd={rnd} />

                {/* 3. Rooftop Elevator & Mechanical Penthouse */}
                <Box
                  x={b.x + b.w * 0.2}
                  y={b.y + b.d * 0.25}
                  w={1.3}
                  d={1.3}
                  z0={HH}
                  H={8}
                  k={k}
                  rnd={rnd}
                />

                {/* 4. Rooftop HVAC Chiller Unit with Cooling Fan */}
                <Box
                  x={b.x + b.w * 0.6}
                  y={b.y + b.d * 0.55}
                  w={1.4}
                  d={1.2}
                  z0={HH}
                  H={5.5}
                  k={k}
                  rnd={rnd}
                />

                {/* 5. Photovoltaic Solar Panel Array on Roof */}
                {(b.id === 'C39' || b.id === 'D198') && (
                  <polygon
                    points={pts([
                      P(b.x + b.w * 0.15, b.y + b.d * 0.6, HH + 0.8),
                      P(b.x + b.w * 0.45, b.y + b.d * 0.6, HH + 0.8),
                      P(b.x + b.w * 0.45, b.y + b.d * 0.88, HH + 2.2),
                      P(b.x + b.w * 0.15, b.y + b.d * 0.88, HH + 2.2),
                    ])}
                    fill="url(#solarGrid)"
                    stroke="#00e5ff"
                    strokeWidth="0.6"
                    opacity="0.9"
                  />
                )}

                {/* 6. Communication Mast & Red Aviation Warning Beacon */}
                <line
                  x1={P(b.x + b.w * 0.2 + 0.6, b.y + b.d * 0.25 + 0.6, HH + 8)[0]}
                  y1={P(b.x + b.w * 0.2 + 0.6, b.y + b.d * 0.25 + 0.6, HH + 8)[1]}
                  x2={antennaTip[0]}
                  y2={antennaTip[1]}
                  stroke="#e2e8f0"
                  strokeWidth="1.2"
                />
                <circle
                  cx={antennaTip[0]}
                  cy={antennaTip[1]}
                  r="2.2"
                  fill="#ff2233"
                  className="beacon-dot"
                />
                <circle
                  cx={antennaTip[0]}
                  cy={antennaTip[1]}
                  r="5"
                  fill="#ff2233"
                  opacity="0.4"
                  className="beacon-pulse"
                />

                {/* 7. Illuminated Ground Entrance Doorway */}
                <polygon
                  points={pts([
                    P(DX(b) - 0.5, b.y + b.d, 0),
                    P(DX(b) + 0.5, b.y + b.d, 0),
                    P(DX(b) + 0.5, b.y + b.d, 12),
                    P(DX(b) - 0.5, b.y + b.d, 12),
                  ])}
                  fill={dop === b.id + b.co ? '#ffcf40' : '#071526'}
                  stroke="#ffb020"
                  strokeWidth="1.2"
                />
                {/* Doorway threshold glow */}
                <ellipse
                  cx={P(DX(b), b.y + b.d + 0.2, 0)[0]}
                  cy={P(DX(b), b.y + b.d + 0.2, 0)[1]}
                  rx="7"
                  ry="3"
                  fill={dop === b.id + b.co ? 'rgba(255, 207, 64, 0.7)' : 'rgba(255, 176, 32, 0.35)'}
                />
              </g>
            );
          })}

          {/* Animated 3D Pedestrian Technician along roads */}
          {(() => {
            const q = P(pp.p[0], pp.p[1], 0);
            return (
              <g
                pointerEvents="none"
                className={'sp' + (pp.w ? ' wk' : '')}
                style={{
                  transform: `translate(${q[0]}px,${q[1]}px)`,
                  transition: `transform ${pp.ms}ms linear, opacity .3s`,
                  opacity: pp.v,
                }}
              >
                {/* Contact Shadow */}
                <ellipse rx="7.5" ry="3.2" fill="rgba(0,0,0,0.6)" />
                {/* Legs with walking stride */}
                <rect className="lg l1" x="-3.5" y="-9" width="3" height="9" rx="1" fill="#1e293b" />
                <rect className="lg l2" x="0.5" y="-9" width="3" height="9" rx="1" fill="#1e293b" />
                {/* High-visibility Safety Vest */}
                <rect x="-4.5" y="-19.5" width="9" height="11.5" rx="2.5" fill="#f97316" />
                {/* Silver retroreflective stripes */}
                <line x1="-4.5" y1="-14" x2="4.5" y2="-14" stroke="#ffffff" strokeWidth="1.2" opacity="0.9" />
                <line x1="-4.5" y1="-11" x2="4.5" y2="-11" stroke="#ffffff" strokeWidth="1.2" opacity="0.9" />
                {/* Head & Yellow Hard Hat with Headlamp */}
                <circle cy="-23.5" r="3.6" fill="#fcd34d" />
                <path d="M -4.5 -24 Q 0 -28 4.5 -24 Z" fill="#eab308" />
                <circle cx="2.2" cy="-24" r="1.2" fill="#38bdf8" />
              </g>
            );
          })()}

          {/* Floating Telemetry Building Labels */}
          {LABELS.map((l) => {
            const t = P(l[2], l[3], HH + 8);
            return (
              <g key={l[0]} pointerEvents="none">
                <rect
                  x={t[0] - 82}
                  y={t[1] - 52}
                  width="164"
                  height="36"
                  rx="9"
                  fill="rgba(5, 12, 24, 0.92)"
                  stroke="#00e5ff"
                  strokeOpacity="0.75"
                  strokeWidth="1.2"
                />
                <text
                  x={t[0]}
                  y={t[1] - 34}
                  textAnchor="middle"
                  fill="#e0f2fe"
                  fontSize="12.5"
                  fontWeight="700"
                  letterSpacing="0.3"
                >
                  {l[0]}
                </text>
                <text
                  x={t[0]}
                  y={t[1] - 20}
                  textAnchor="middle"
                  fill="#7dd3fc"
                  fontSize="10"
                  fontWeight="500"
                >
                  {l[1]}
                </text>
                <line x1={t[0]} y1={t[1] - 16} x2={t[0]} y2={t[1]} stroke="#00e5ff" strokeWidth="1.2" />
                <circle cx={t[0]} cy={t[1]} r="3" fill="#00e5ff" />
                <circle cx={t[0]} cy={t[1]} r="6" fill="#00e5ff" opacity="0.35" />
              </g>
            );
          })}

          {/* Precision Navigational Compass */}
          <g transform="translate(850 52)" pointerEvents="none">
            <circle r="22" fill="rgba(5, 12, 24, 0.85)" stroke="#00e5ff" strokeOpacity="0.6" strokeWidth="1.2" />
            <circle r="18" fill="none" stroke="#00e5ff" strokeOpacity="0.25" strokeDasharray="3 3" />
            <polygon points="0,-16 5,4 0,0 -5,4" fill="#00e5ff" />
            <polygon points="0,16 4,3 0,0 -4,3" fill="#334155" />
            <text y="-26" textAnchor="middle" fill="#00e5ff" fontSize="11" fontWeight="700">N</text>
          </g>

          <text x="20" y="506" fill="#7f9bbd" fontSize="11" letterSpacing="0.3">
            Schematic site map, not to scale
          </text>
        </svg>

        {/* View Mode & Filter Tools */}
        <div className="tools">
          <span className="chip on" style={{ cursor: 'default' }}>Site overview</span>
          {co !== 'All' && (
            <button
              className="chip"
              style={{ borderColor: '#ffb020', color: '#ffb020' }}
              onClick={onExitCo}
            >
              Exit company
            </button>
          )}
          <span className="chip" style={{ borderColor: '#00e5ff', cursor: 'default' }}>
            Ismartu India
          </span>
          <span className="chip" style={{ borderColor: '#ff2bd6', cursor: 'default' }}>
            Padget Electronics
          </span>
        </div>

        {/* Cyberpunk HUD Corner Accents */}
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      </div>

      {/* Right Sidebar Breakdown Matrix */}
      <aside>
        {['Ismartu', 'Padget'].map((c) => (
          <div key={c} className="gc" style={{ '--gc': CC[c].accent }}>
            <h4>{CN[c]}</h4>
            {[...new Set(GB.filter((g) => g.co === c).map((g) => g.id))].map((b) => {
              const a = machines.filter((m) => m.b === b && m.co === c);
              return (
                <button key={b} className="gb" onClick={() => onOpen(b, c)}>
                  <b>{b}</b>
                  <small>{PL.filter((p) => p.b === b && p.co === c).map((p) => p.c).join(' · ')}</small>
                  <div className="fr">
                    {FL.map((f, fi) => {
                      const n = a.filter((m) => m.fi === fi).length;
                      const w = mx > 0 ? (n / mx) * 100 : 0;
                      return (
                        <span key={fi} style={{ display: 'contents' }}>
                          <span>{f.n}</span>
                          <i>
                            <u style={{ width: Math.min(100, Math.max(0, w)) + '%' }} />
                          </i>
                          <em>{n}</em>
                        </span>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </aside>
    </section>
  );
}
