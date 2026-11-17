import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FL, PL, CN, buildMachines } from './data';

const CC = {
  Ismartu: { c: '#00e5ff', l: '#0a2a40', r: '#0d3a58', t: '#1a7fa8', w: '#8ff3ff' },
  Padget: { c: '#ff2bd6', l: '#35103a', r: '#4a1550', t: '#8a2a92', w: '#ffa0ee' },
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
const PLOTS = [[9, 8.4, 12, 8.8, '#7fa0c8'], [11, -2, 9, 8.6, '#00e5ff'], [-1, 12, 8.6, 8.4, '#ff2bd6'], [-1, -1.5, 8, 7.8, '#ff2bd6']];
const ox = 450, oy = 85, kx = 19.1, ky = 11, FH = 15, HH = 4 * FH;
const P = (x, y, z) => [ox + (x - y) * kx, oy + (x + y) * ky - z];
const pts = (a) => a.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ');
const mk = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;

function Box({ x, y, w, d, z0, H, k, win, rnd }) {
  const els = [
    <polygon key="l" points={pts([P(x, y + d, z0), P(x + w, y + d, z0), P(x + w, y + d, z0 + H), P(x, y + d, z0 + H)])} fill={k.l} stroke={k.c} />,
    <polygon key="r" points={pts([P(x + w, y, z0), P(x + w, y + d, z0), P(x + w, y + d, z0 + H), P(x + w, y, z0 + H)])} fill={k.r} stroke={k.c} />,
    <polygon key="t" points={pts([P(x, y, z0 + H), P(x + w, y, z0 + H), P(x + w, y + d, z0 + H), P(x, y + d, z0 + H)])} fill={k.t} stroke={k.c} />,
  ];
  if (win) {
    const nf = Math.round(H / FH);
    [[w, (t) => [x + t * w, y + d]], [d, (t) => [x + w, y + t * d]]].forEach(([len, f], s) => {
      const n = Math.round(len * 1.1);
      for (let fl = 0; fl < nf; fl++)
        for (let i = 0; i < n; i++) {
          const a = f((i + 0.2) / n), b = f((i + 0.8) / n);
          const za = z0 + (fl + 0.3) * FH, zb = z0 + (fl + 0.75) * FH;
          els.push(<polygon key={`w${s}-${fl}-${i}`}
            points={pts([P(a[0], a[1], za), P(b[0], b[1], za), P(b[0], b[1], zb), P(a[0], a[1], zb)])}
            fill={rnd() < 0.62 ? k.w : 'rgba(255,255,255,.08)'} />);
        }
    });
  }
  return <>{els}</>;
}

export default function Gis({ M, co = 'All', onOpen: openIn = () => {}, onExitCo = () => {}, onTip = () => {}, onTipMove = () => {}, onTipHide = () => {}, from, onDone }) {
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
    cp.current = p; setPp({ p, v: 1, ms: d, w: 1 }); await sleep(d);
  };
  const onOpen = async (id, c) => {
    if (busy.current) return;
    busy.current = true; onTipHide();
    const key = id + c;
    for (const p of RT[key]) await mv(p);
    setPp((s) => ({ ...s, w: 0 })); setDop(key); await sleep(450);
    setPp((s) => ({ ...s, v: 0 })); await sleep(350);
    busy.current = false; openIn(id, c);
  };
  useEffect(() => {
    if (!from) return;
    const rt = RT[from];
    (async () => {
      busy.current = true; setDop(from); await sleep(500);
      setPp((s) => ({ ...s, v: 1 })); await sleep(450);
      let i = 0;
      for (const p of rt.slice(0, -1).reverse().concat([SP])) { await mv(p); if (!i++) setDop(null); }
      setPp((s) => ({ ...s, w: 0 })); busy.current = false; onDone && onDone();
    })();
  }, []);
  const order = [...GB].sort((a, b) => a.x + a.y - b.x - b.y);
  const grid = [];
  for (let i = -4; i <= 26; i += 2)
    grid.push(
      <polyline key={'a' + i} points={pts([P(i, -4, 0), P(i, 24, 0)])} stroke="rgba(0,229,255,.07)" fill="none" />,
      <polyline key={'b' + i} points={pts([P(-4, i, 0), P(26, i, 0)])} stroke="rgba(0,229,255,.07)" fill="none" />
    );
  const mx = Math.max(1, ...GB.flatMap((g) => FL.map((f, fi) => machines.filter((m) => m.b === g.id && m.co === g.co && m.fi === fi).length)));
  const tipFor = (g) => {
    const a = machines.filter((m) => m.b === g.id && m.co === g.co);
    const d = a.filter((m) => m.st === 'Deployed').length;
    return (<>
      <b>{g.id}</b> · {CN[g.co]}<br />
      {PL.filter((p) => p.b === g.id && p.co === g.co).map((p) => p.c + ' ' + p.u).join(' · ')}<br />
      {a.length} units · {Math.round((d / a.length) * 100)}% deployed<br />Click to open the floors
    </>);
  };
  return (
    <section className="gis">
      <div className="gmap">
        <svg viewBox="0 0 900 520" width="100%" role="img" aria-label="Site map of both companies" id="gsvg">
          <defs><radialGradient id="gg" cx="50%" cy="55%" r="65%"><stop offset="0" stopColor="#0b1a33" /><stop offset="1" stopColor="#04060c" /></radialGradient></defs>
          <rect width="900" height="520" fill="url(#gg)" />
          {grid}
          <polygon points={pts([P(-4, 6.8, 0), P(26, 6.8, 0), P(26, 8.2, 0), P(-4, 8.2, 0)])} fill="#0c1424" stroke="#1b2c4a" />
          <polyline points={pts([P(-4, 7.5, 0), P(26, 7.5, 0)])} stroke="#3a5a86" strokeDasharray="6 6" fill="none" />
          <polygon points={pts([P(7.8, 8.2, 0), P(9.2, 8.2, 0), P(9.2, 24, 0), P(7.8, 24, 0)])} fill="#0c1424" stroke="#1b2c4a" />
          {PLOTS.map((p, i) => (
            <g key={i}>
              <polygon points={pts([P(p[0], p[1], 0), P(p[0] + p[2], p[1], 0), P(p[0] + p[2], p[1] + p[3], 0), P(p[0], p[1] + p[3], 0)])}
                fill="rgba(20,40,70,.55)" stroke={p[4]} strokeOpacity=".7" strokeDasharray="5 4" />
              {Array.from({ length: 7 }, (_, t) => {
                const q = P(p[0] + ((t + 0.5) * p[2]) / 7, p[1] + p[3] - 0.5, 0);
                return <circle key={t} cx={q[0]} cy={q[1]} r="3.5" fill="#1d6b48" opacity=".85" />;
              })}
            </g>
          ))}
          {order.map((b, i) => {
            const k = CC[b.co], rnd = mk(i * 977 + 13), dim = co !== 'All' && co !== b.co;
            return (
              <g key={b.id + b.co} className="bd" style={{ '--gc': k.c, opacity: dim ? 0.22 : 1 }}
                onMouseEnter={(e) => onTip(e, tipFor(b))} onMouseMove={onTipMove} onMouseLeave={onTipHide}
                onClick={() => { onTipHide(); onOpen(b.id, b.co); }}>
                <Box x={b.x} y={b.y} w={b.w} d={b.d} z0={0} H={HH} k={k} win rnd={rnd} />
                <Box x={b.x + b.w * 0.2} y={b.y + b.d * 0.25} w={1.2} d={1.2} z0={HH} H={6} k={k} rnd={rnd} />
                <Box x={b.x + b.w * 0.6} y={b.y + b.d * 0.55} w={1.2} d={1.2} z0={HH} H={6} k={k} rnd={rnd} />
                <polygon points={pts([P(DX(b) - 0.4, b.y + b.d, 0), P(DX(b) + 0.4, b.y + b.d, 0), P(DX(b) + 0.4, b.y + b.d, 11), P(DX(b) - 0.4, b.y + b.d, 11)])} fill={dop === b.id + b.co ? '#ffcf40' : '#06101f'} stroke="#ffb020" />
              </g>
            );
          })}
          {(() => { const q = P(pp.p[0], pp.p[1], 0); return (
            <g pointerEvents="none" className={'sp' + (pp.w ? ' wk' : '')} style={{ transform: `translate(${q[0]}px,${q[1]}px)`, transition: `transform ${pp.ms}ms linear, opacity .3s`, opacity: pp.v }}>
              <ellipse rx="6" ry="2.5" fill="rgba(0,0,0,.45)" />
              <rect className="lg l1" x="-3.5" y="-9" width="3" height="9" fill="#2a3d63" />
              <rect className="lg l2" x=".5" y="-9" width="3" height="9" fill="#2a3d63" />
              <rect x="-4.5" y="-19" width="9" height="11" rx="2.5" fill="#ffb020" />
              <circle cy="-23" r="3.6" fill="#ffd9b0" />
            </g>); })()}
          {LABELS.map((l) => {
            const t = P(l[2], l[3], HH + 8);
            return (
              <g key={l[0]} pointerEvents="none">
                <rect x={t[0] - 80} y={t[1] - 50} width="160" height="34" rx="8" fill="rgba(5,9,18,.88)" stroke="#00e5ff" strokeOpacity=".6" />
                <text x={t[0]} y={t[1] - 34} textAnchor="middle" fill="#d4eaff" fontSize="12" fontWeight="600">{l[0]}</text>
                <text x={t[0]} y={t[1] - 21} textAnchor="middle" fill="#7f9bbd" fontSize="10">{l[1]}</text>
                <line x1={t[0]} y1={t[1] - 16} x2={t[0]} y2={t[1]} stroke="#00e5ff" />
                <circle cx={t[0]} cy={t[1]} r="3" fill="#00e5ff" />
              </g>
            );
          })}
          <g transform="translate(850 52)" pointerEvents="none">
            <circle r="20" fill="none" stroke="#00e5ff" strokeOpacity=".6" />
            <polygon points="0,-16 5,4 0,0 -5,4" fill="#00e5ff" />
            <text y="-26" textAnchor="middle" fill="#00e5ff" fontSize="10">N</text>
          </g>
          <text x="20" y="506" fill="#7f9bbd" fontSize="11">Schematic site map, not to scale</text>
        </svg>
        <div className="tools">
          <span className="chip on" style={{ cursor: 'default' }}>Site overview</span>
          {co !== 'All' && <button className="chip" style={{ borderColor: '#ffb020', color: '#ffb020' }} onClick={onExitCo}>Exit company</button>}
          <span className="chip" style={{ borderColor: '#00e5ff', cursor: 'default' }}>Ismartu India</span>
          <span className="chip" style={{ borderColor: '#ff2bd6', cursor: 'default' }}>Padget Electronics</span>
        </div>
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      </div>
      <aside>
        {['Ismartu', 'Padget'].map((c) => (
          <div key={c} className="gc" style={{ '--gc': CC[c].c }}>
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
                      return (<span key={fi} style={{ display: 'contents' }}>
                        <span>{f.n}</span><i><u style={{ width: (n / mx) * 100 + '%' }} /></i><em>{n}</em>
                      </span>);
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
