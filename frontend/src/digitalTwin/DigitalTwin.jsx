import { useEffect, useMemo, useRef, useState } from 'react';
import './digitalTwin.css';
import { COL, FL, PL, CN, BL, DIM, buildMachines } from './data';
import Gis from './Gis';

function Walker() {
  const b = (k, w, d, h, c, x, y, z, extraClass = '') => (
    <div
      key={k}
      className={'bx ' + extraClass}
      style={{
        left: x,
        top: y,
        '--w': w + 'px',
        '--d': d + 'px',
        '--h': h + 'px',
        '--b': c,
        transform: `translateZ(${z}px)`,
      }}
    >
      <i className="ft" />
      <i className="ff" />
      <i className="fb" />
      <i className="fr2" />
      <i className="fl2" />
    </div>
  );

  const j = (k, cls, y, z, kids) => (
    <div key={k} className={'jt ' + cls} style={{ top: y, '--pz': z + 'px' }}>
      {kids}
    </div>
  );

  // Legs with industrial safety work boots
  const leg = [
    b('a', 5, 5, 12, '#1e293b', 0, 0, -15),
    b('b', 7, 5.4, 3.5, '#0f172a', 1, 0, -15, 'boot-toe'),
  ];

  // Arms with hi-vis sleeves and hands
  const arm = [
    b('c', 4, 4, 11, '#ea580c', 0, 0, -11),
    b('d', 3.6, 3.6, 3, '#fcd34d', 0, 0, -14),
  ];

  return (
    <>
      {/* Contact ground shadow */}
      <i className="shd" />

      {/* Walking kinematic joints */}
      {j('l1', 'lgA', -3.2, 15, leg)}
      {j('l2', 'lgB', 3.2, 15, leg)}

      {/* Hi-Vis Safety Vest with Silver Reflective Safety Stripes */}
      {b('t', 7.5, 12.2, 13, '#ea580c', 0, 0, 15, 'vest')}
      {b('s', 7.8, 12.5, 2.5, '#f8fafc', 0, 0, 21, 'tape')}

      {j('a1', 'arA', -8, 27.5, arm)}
      {j('a2', 'arB', 8, 27.5, arm)}

      {/* Head and Safety Hard Hat with Headlamp */}
      {b('h', 6.5, 7, 7, '#fcd34d', 0.5, 0, 28)}
      {b('hat', 8.6, 9.2, 3.5, '#facc15', 0, 0, 34.5, 'hardhat')}
      {b('br', 11.2, 9.4, 1.2, '#eab308', 1.5, 0, 34)}
      {/* Forward Headlamp Beam */}
      <i className="h-beam" />
    </>
  );
}

function Stairs({ H, up }) {
  const box = (key, x, y, w, d, h, c, z = 0, isNosing = false) => (
    <div
      key={key}
      className={'m st' + (isNosing ? ' nosing' : '')}
      style={{
        left: x + 'px',
        top: y + 'px',
        '--w': w + 'px',
        '--d': d + 'px',
        '--h': h + 'px',
        '--b': c,
        '--c': 'transparent',
        transform: `translateZ(${z}px)`,
      }}
    >
      <i className="ft" />
      <i className="ff" />
      <i className="fb" />
      <i className="fr2" />
      <i className="fl2" />
    </div>
  );

  return (
    <>
      {up &&
        Array.from({ length: 14 }, (_, i) => {
          const t = ((i + 1) * H) / 14;
          return [
            // Tread base with diamond plate steel texture
            box('s' + i, 46 + i * 12, 289, 12, 26, 2.5, i % 2 ? '#94a3b8' : '#cbd5e1', t - 2.5),
            // High-visibility yellow safety edge nosing on step tread
            box('sn' + i, 46 + i * 12, 289, 2.5, 26, 2.6, '#facc15', t - 2.4, true),
            // Left steel handrail
            box('l' + i, 46 + i * 12, 277, 12, 2, t, '#eab308'),
            // Right steel handrail
            box('r' + i, 46 + i * 12, 301, 12, 2, t, '#eab308'),
          ];
        })}
      {/* Wall enclosures */}
      {box('wa', 55, 236, 94, 4, 30, '#64748b')}
      {box('wb', 185, 236, 94, 4, 30, '#64748b')}
    </>
  );
}

function Machine({ m, cls, onPick, onTip, onTipMove, onTipHide }) {
  const rk = m.zone === 'Central Server Room';
  const d = rk ? [12, 16, 34, '#1e293b'] : DIM[m.cat];

  const node = (
    <>
      <b>{m.code}</b>
      <br />
      {m.cat} · {m.zone}
      <br />
      {m.co} · {m.p} ({m.u})
      <br />
      {m.who} · <span style={{ color: COL[m.st] }}>{m.st}</span>
    </>
  );

  return (
    <div
      className={'m' + (rk ? ' rk' : '') + cls}
      style={{
        left: m.x + '%',
        top: m.y + '%',
        '--w': d[0] + 'px',
        '--d': d[1] + 'px',
        '--h': d[2] + 'px',
        '--b': d[3],
        '--c': COL[m.st],
      }}
      onClick={(e) => {
        e.stopPropagation();
        onPick(m.id);
      }}
      onMouseEnter={(e) => onTip(e, node)}
      onMouseMove={onTipMove}
      onMouseLeave={onTipHide}
    >
      {/* 3D Box Faces */}
      <i className="ft" />
      <i className="ff" />
      <i className="fb" />
      <i className="fr2" />
      <i className="fl2" />

      {/* Realistic Andon 3-Stage Signal Light Tower (Red / Amber / Green) */}
      <i className="tw" />
      <i className="tw2" />

      {/* SMT Front Inspection Glass Window */}
      {!rk && <i className="win-inspect" />}

      {/* SMT Feeder Reel Rack or Server Mesh */}
      {!rk && <i className="feeder-rack" />}

      {/* Operator Touchscreen Terminal */}
      {!rk && <i className="op-screen" />}
    </div>
  );
}

export default function DigitalTwin() {
  const M = useMemo(buildMachines, []);
  const [view, setView] = useState('gis');
  const [b, setB] = useState('C39');
  const [co, setCo] = useState('All');
  const [pl, setPl] = useState('All');
  const [fl, setFl] = useState(2);
  const [sel, setSel] = useState(null);
  const [stt, setStt] = useState('All');
  const [q, setQ] = useState('');
  const [zone, setZone] = useState(null);
  const [ex, setEx] = useState(true);
  const [heat, setHeat] = useState(false);
  const [spin, setSpin] = useState(false);
  const [fm, setFm] = useState(false);
  const [cam, setCam] = useState({ rx: 58, rz: -38, sc: 1 });
  const [dragging, setDragging] = useState(false);
  const [tip, setTip] = useState(null);
  const P0 = { x: 36, y: 380, f: 0, z: 0, h: -90, v: 1, ms: 0, w: 0, out: 1, room: 0 };
  const [pw, setPw] = useState(P0);
  const [door, setDoor] = useState(-1);
  const [from, setFrom] = useState(null);
  const pwr = useRef(P0);
  const sq = useRef(0);
  const lb = useRef(null);
  const drag = useRef(null);
  const moved = useRef(0);
  const stageRef = useRef(null);

  const cm = (m) => (co === 'All' || m.co === co) && (pl === 'All' || m.p === pl);
  const cnt = (fi) => {
    const a = M.filter((m) => m.b === b && m.fi === fi && cm(m));
    return {
      t: a.length,
      d: a.filter((m) => m.st === 'Deployed').length,
      p: a.filter((m) => m.st === 'Pending').length,
      f: a.filter((m) => m.st === 'Fault').length,
    };
  };

  const rows = M.filter(
    (m) =>
      m.b === b &&
      m.fi === fl &&
      cm(m) &&
      (stt === 'All' || m.st === stt) &&
      (zone === null || m.zi === zone) &&
      (!q || (m.code + m.zone + m.who + m.cat).toLowerCase().includes(q))
  );

  const vis = new Set(rows.map((m) => m.id));
  const B = M.filter((m) => m.b === b && cm(m));
  const T = B.length || 1;
  const D = B.filter((m) => m.st === 'Deployed').length;
  const Pn = B.filter((m) => m.st === 'Pending').length;
  const F = B.filter((m) => m.st === 'Fault').length;
  const mach = sel ? M[sel - 1] : null;

  const upd = (o) => {
    pwr.current = { ...pwr.current, ...o };
    setPw({ ...pwr.current });
  };

  const run = async (seq) => {
    const id = ++sq.current;
    for (const s of seq) {
      if (sq.current !== id) return false;
      if (s.wait) await new Promise((r) => setTimeout(r, s.wait));
      else if (s.d !== undefined) setDoor(s.d);
      else {
        upd(s);
        if (s.ms) await new Promise((r) => setTimeout(r, s.ms));
      }
    }
    return sq.current === id;
  };

  const zf = (fi) => (fm && fi === fl ? 0 : (fi - 1.5) * gap + (fi === fl && ex ? 18 : 0));

  const plan = (t) => {
    const s = [];
    let c = pwr.current;
    let f = c.f,
      x = c.x,
      y = c.y,
      hd = c.h;
    const hh = (a) => {
      hd += ((((a - hd + 180) % 360) + 360) % 360) - 180;
      return hd;
    };
    const mv = (nx, ny, o) => {
      if (nx === x && ny === y) return;
      s.push({
        x: nx,
        y: ny,
        ms: Math.round((Math.abs(nx - x) + Math.abs(ny - y)) * 5),
        w: 1,
        h: hh((Math.atan2(ny - y, nx - x) * 180) / Math.PI),
        ...o,
      });
      x = nx;
      y = ny;
    };
    const H = (g) => Math.max(zf(g + 1) - zf(g), 6);
    const bottom = () => {
      if (x !== 34 || y !== 289) {
        mv(x, 255);
        mv(34, 255);
        mv(34, 289);
      }
    };
    const top = () => {
      if (x !== 214 || y !== 289) {
        mv(x, 255);
        mv(214, 255);
        mv(214, 289);
      }
    };

    if (c.out) {
      s.push({ x: 36, y: 380, f: 0, z: 0, v: 1, ms: 0 }, { d: 10, wait: 500 });
      x = 36;
      y = 380;
      f = 0;
      mv(36, 312);
      mv(34, 289, { out: 0 });
      s.push({ d: -1, wait: 300 });
    } else if (c.room) {
      s.push({ d: f, wait: 400 });
      mv(120, 255, { room: 0 });
      s.push({ d: -1, wait: 300 });
    }

    const end = Math.max(t, 0);
    while (f !== end) {
      if (end > f) {
        bottom();
        for (let i = 0; i < 14; i++)
          s.push({ x: 46 + i * 12, y: 289, z: ((i + 1) * H(f)) / 14, ms: 220, w: 1, h: hh(0) });
        s.push({ x: 214, y: 289, z: H(f), ms: 220, w: 1, h: hh(0) }, { f: f + 1, z: 0, ms: 0 });
        f++;
        x = 214;
        y = 289;
      } else {
        const h = H(f - 1);
        top();
        s.push({ f: f - 1, z: h, ms: 0 });
        for (let i = 13; i >= 0; i--)
          s.push({ x: 46 + i * 12, y: 289, z: ((i + 1) * h) / 14, ms: 220, w: 1, h: hh(180) });
        s.push({ x: 34, y: 289, z: 0, ms: 220, w: 1, h: hh(180) });
        f--;
        x = 34;
        y = 289;
      }
    }

    if (t < 0) {
      bottom();
      s.push({ d: 10, wait: 450 });
      mv(36, 312);
      mv(36, 385, { out: 1 });
      s.push({ d: -1, wait: 200 }, { v: 0, ms: 0 });
    } else {
      if (y !== 255) mv(x, 255);
      mv(120, 255);
      s.push({ d: t, wait: 500 });
      mv(120, 150, { room: 1 });
      s.push({ d: -1, wait: 300 });
    }
    return s;
  };

  useEffect(() => {
    if (view !== 'twin') {
      sq.current++;
      lb.current = null;
      upd(P0);
      setDoor(-1);
      return;
    }
    if (lb.current !== b) {
      lb.current = b;
      upd(P0);
      setDoor(-1);
    }
    run(plan(fl)).then((ok) => ok && upd({ w: 0 }));
  }, [view, b, fl]);

  const enter = () => {
    setFm(true);
    setCam({ rx: 52, rz: -28, sc: 1.55 });
    setEx(false);
  };

  const leave = (q) => {
    setFm(false);
    setCam({ rx: 58, rz: -38, sc: 1 });
    setEx(true);
    if (q !== true && pwr.current.room)
      run([
        { d: pwr.current.f, wait: 400 },
        { x: 120, y: 255, ms: 525, w: 1, room: 0 },
        { d: -1, wait: 300 },
      ]);
  };

  const exitCo = async () => {
    const key = view === 'twin' && co !== 'All' ? b + co : null;
    if (fm) leave(true);
    if (view === 'twin') {
      const s = plan(-1);
      await run(s);
    }
    setFrom(key);
    setCo('All');
    setPl('All');
    setSel(null);
    setZone(null);
    setView('gis');
  };

  const openB = (bb, c) => {
    setB(bb);
    setCo(c);
    setPl('All');
    setSel(null);
    setZone(null);
    setFrom(null);
    setView('twin');
  };

  const pick = (id) => {
    setSel(id);
    setFl(M[id - 1].fi);
  };

  const onFloor = (fi) => {
    if (moved.current > 5) return;
    if (fl === fi && !fm) {
      setSel(null);
      setZone(null);
      enter();
      return;
    }
    setFl(fi);
    setSel(null);
    setZone(null);
  };

  const showTip = (e, node) => setTip({ x: e.clientX, y: e.clientY, node });
  const moveTip = (e) => setTip((t) => t && { ...t, x: e.clientX, y: e.clientY });
  const hideTip = () => setTip(null);

  useEffect(() => {
    const mv = (e) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x,
        dy = e.clientY - d.y;
      moved.current += Math.abs(dx) + Math.abs(dy);
      d.x = e.clientX;
      d.y = e.clientY;
      setSpin(false);
      setCam((c) => ({
        ...c,
        rz: c.rz + dx * 0.35,
        rx: Math.max(10, Math.min(85, c.rx - dy * 0.3)),
      }));
    };
    const up = () => {
      drag.current = null;
      setDragging(false);
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const h = (e) => {
      e.preventDefault();
      setCam((c) => ({
        ...c,
        sc: Math.max(0.5, Math.min(2, c.sc * (e.deltaY > 0 ? 0.92 : 1.08))),
      }));
    };
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  }, [view]);

  useEffect(() => {
    if (!spin) return;
    const t = setInterval(() => setCam((c) => ({ ...c, rz: c.rz + 0.4 })), 30);
    return () => clearInterval(t);
  }, [spin]);

  useEffect(() => {
    const h = (e) => {
      if (e.key !== 'Escape' || e.target.tagName === 'INPUT') return;
      if (fm) leave();
      else if (co !== 'All') exitCo();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const k = typeof window !== 'undefined' && window.innerWidth < 700 ? 0.6 : 1;
  const gap = ex ? 95 : 30;
  const exitBtn = { borderColor: '#ffb020', color: '#ffb020' };

  return (
    <div className="dt">
      <div className="wrap">
        <header>
          <div>
            <h1>
              Digital Twin Facility Visualizer
              <span className="live">
                <i />
                Live telemetry
              </span>
            </h1>
            <div className="sub">
              Building {b} · {FL.length} floors · preview with sample data
            </div>
          </div>
          <div className="chips">
            {BL.map((x) => (
              <button
                key={x}
                className={'chip' + (b === x ? ' on' : '')}
                onClick={() => {
                  setB(x);
                  setPl('All');
                  setSel(null);
                  setZone(null);
                }}
              >
                {x}
              </button>
            ))}
          </div>
        </header>

        <div className="chips" style={{ marginBottom: 12 }}>
          <button className={'chip' + (view === 'gis' ? ' on' : '')} onClick={() => setView('gis')}>
            GIS site map
          </button>
          <button className={'chip' + (view === 'twin' ? ' on' : '')} onClick={() => setView('twin')}>
            3D floor twin
          </button>
        </div>

        <div className="chips" style={{ marginBottom: 12 }}>
          {[
            ['All', 'All companies'],
            ['Ismartu', 'Ismartu India (5020)'],
            ['Padget', 'Padget Electronics (9500)'],
          ].map((c) => (
            <button
              key={c[0]}
              className={'chip' + (co === c[0] ? ' on' : '')}
              onClick={() => {
                setCo(c[0]);
                setPl('All');
                setSel(null);
              }}
            >
              {c[1]}
            </button>
          ))}
          {PL.filter((p) => p.b === b && (co === 'All' || p.co === co)).map((p) => (
            <button
              key={p.c}
              className={'chip' + (pl === p.c ? ' on' : '')}
              onClick={() => {
                setPl(pl === p.c ? 'All' : p.c);
                setSel(null);
              }}
            >
              {p.c} · {p.u}
            </button>
          ))}
        </div>

        <div className="kpis">
          {[
            ['Units in ' + b, B.length],
            ['Deployed', Math.round((D / T) * 100) + '%'],
            ['Pending', Pn],
            ['Faults', F],
            ['Selected floor', cnt(fl).t + ' units'],
          ].map((x) => (
            <div className="kpi" key={x[0]}>
              <b>{x[1]}</b>
              <span>{x[0]}</span>
            </div>
          ))}
        </div>

        {view === 'gis' && (
          <Gis
            M={M}
            co={co}
            onOpen={openB}
            from={from}
            onDone={() => setFrom(null)}
            onExitCo={exitCo}
            onTip={showTip}
            onTipMove={moveTip}
            onTipHide={hideTip}
          />
        )}

        {view === 'twin' && (
          <>
            <div className="main">
              <div className="rail">
                {FL.map((f, fi) => {
                  const c = cnt(fi),
                    t = Math.max(c.t, 1);
                  return (
                    <button
                      key={fi}
                      className={'fl' + (fi === fl ? ' on' : '')}
                      onClick={() => {
                        setFl(fi);
                        setSel(null);
                        setZone(null);
                      }}
                    >
                      <b>{f.n}</b>
                      <small>{c.t ? c.t + ' units' : 'No units yet'}</small>
                      <div className="bar">
                        <i style={{ width: (c.d / t) * 100 + '%', background: 'var(--lime)' }} />
                        <i style={{ width: (c.p / t) * 100 + '%', background: 'var(--am)' }} />
                        <i style={{ width: (c.f / t) * 100 + '%', background: 'var(--mg)' }} />
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="stagebox">
                <div className="tools">
                  {co !== 'All' && (
                    <button className="chip" style={exitBtn} onClick={exitCo}>
                      Exit company
                    </button>
                  )}
                  {fm ? (
                    <button
                      className="chip"
                      style={{ borderColor: '#ff2bd6', color: '#ff2bd6' }}
                      onClick={leave}
                    >
                      Exit floor
                    </button>
                  ) : (
                    <button
                      className="chip"
                      style={{ borderColor: '#00e5ff', color: '#00e5ff' }}
                      onClick={enter}
                    >
                      Enter floor
                    </button>
                  )}
                  {!fm && (
                    <button className={'chip' + (ex ? ' on' : '')} onClick={() => setEx(!ex)}>
                      Exploded view
                    </button>
                  )}
                  <button className={'chip' + (heat ? ' on' : '')} onClick={() => setHeat(!heat)}>
                    Heatmap
                  </button>
                  <button className={'chip' + (spin ? ' on' : '')} onClick={() => setSpin(!spin)}>
                    Spin
                  </button>
                  <button className="chip" onClick={() => setCam((c) => ({ ...c, rx: 84, rz: 0 }))}>
                    Top-down
                  </button>
                  <button
                    className="chip"
                    onClick={() =>
                      setCam(fm ? { rx: 52, rz: -28, sc: 1.55 } : { rx: 58, rz: -38, sc: 1 })
                    }
                  >
                    Reset
                  </button>
                </div>

                <div
                  className="stage"
                  ref={stageRef}
                  onPointerDown={(e) => {
                    drag.current = { x: e.clientX, y: e.clientY };
                    moved.current = 0;
                    setDragging(true);
                  }}
                >
                  <div
                    className={'world' + (dragging ? ' drag' : '') + (fm ? ' fm' : '')}
                    style={{
                      transform: `rotateX(${cam.rx}deg) rotateZ(${cam.rz}deg) scale(${cam.sc * k})`,
                    }}
                  >
                    {/* Animated Walking Technician */}
                    <div
                      className="pw"
                      style={{
                        transform: `translate3d(${pw.x - 230}px,${pw.y - 155}px,${zf(pw.f) + pw.z}px)`,
                        transition: `transform ${pw.ms}ms linear`,
                      }}
                    >
                      <div
                        className={'pr' + (pw.w ? ' wk' : '') + (pw.z > 0 ? ' cl' : '')}
                        style={{
                          visibility: pw.v ? 'visible' : 'hidden',
                          transform: `rotateZ(${pw.h}deg) scale3d(1.35,1.35,1.35)`,
                        }}
                      >
                        <Walker />
                      </div>
                    </div>

                    {/* Stacked 3D Industrial Floor Slabs */}
                    {FL.map((f, fi) => {
                      const rws = Math.ceil(f.z.length / 2);
                      const z = fm && fi === fl ? 0 : (fi - 1.5) * gap + (fi === fl && ex ? 18 : 0);
                      const cls =
                        'floor ' +
                        (fi === fl ? 'on' : 'dim') +
                        (fm && fi !== fl ? ' hide' : '');

                      return (
                        <div
                          key={fi}
                          className={cls}
                          style={{ transform: `translateZ(${z}px)` }}
                          onClick={() => onFloor(fi)}
                        >
                          <div className="fname">{f.n}</div>
                          {/* Central logistics & pedestrian walkway */}
                          <i className="aisle" />
                          {/* Elevator & staircase core */}
                          <i className="core">Lift</i>
                          {/* Slab 3D Edges with Industrial Hazard Striping */}
                          <b className="sl sls" />
                          <b className="sl sle" />
                          {/* Multi-step Industrial Staircase */}
                          <Stairs H={Math.max(zf(fi + 1) - zf(fi), 6)} up={fi < 3} />

                          {/* Animated Entrance Doors */}
                          {fi === 0 && (
                            <b
                              className={'dor' + (door === 10 ? ' op' : '')}
                              style={{ left: 18, top: 310 }}
                            >
                              <i className="jl" />
                              <i className="jr" />
                              <i className="lt" />
                              <i className="lf" />
                            </b>
                          )}
                          <b
                            className={'dor' + (door === fi ? ' op' : '')}
                            style={{ left: 102, top: 236 }}
                          >
                            <i className="jl" />
                            <i className="jr" />
                            <i className="lt" />
                            <i className="lf" />
                          </b>

                          {/* Department Zones & Production Bays */}
                          {f.z.map((zn, zi) => {
                            const c = zi % 2,
                              r = Math.floor(zi / 2);
                            let bg;
                            if (heat) {
                              const a = M.filter(
                                (m) => m.b === b && m.fi === fi && m.zi === zi && cm(m)
                              );
                              const p = a.length
                                ? a.filter((m) => m.st !== 'Deployed').length / a.length
                                : 0;
                              bg = `rgba(${
                                p > 0.4 ? '255,43,214' : p > 0.2 ? '255,176,32' : '57,255,136'
                              },${a.length ? 0.12 + a.length * 0.035 : 0.03})`;
                            }
                            return (
                              <div
                                key={zi}
                                className={'zone' + (fi === fl && zone === zi ? ' pick' : '')}
                                style={{
                                  left: c * 50 + 3 + '%',
                                  width: (f.z.length === 1 ? 94 : 44) + '%',
                                  top: (r * 100) / rws + 5 + '%',
                                  height: 100 / rws - 10 + '%',
                                  background: bg,
                                }}
                              >
                                <span>{zn}</span>
                                <b className="w wn" />
                                <b className="w ws" />
                                <b className="w ww" />
                                <b className="w we" />
                                {/* SMT Conveyor Belt with Moving PCB Assemblies */}
                                {zn.includes('SMT') && (
                                  <b className="conv">
                                    <i className="pcb pcb1" />
                                    <i className="pcb pcb2" />
                                    <i className="pcb pcb3" />
                                  </b>
                                )}
                              </div>
                            );
                          })}

                          {/* Machines & Equipment with Andon Signal Towers */}
                          {M.filter((m) => m.b === b && m.fi === fi).map((m) => (
                            <Machine
                              key={m.id}
                              m={m}
                              onPick={(id) => {
                                if (moved.current <= 5) pick(id);
                              }}
                              cls={
                                ((m.fi === fl ? !vis.has(m.id) : !cm(m)) ? ' dm' : '') +
                                (m.id === sel ? ' sel' : '')
                              }
                              onTip={showTip}
                              onTipMove={moveTip}
                              onTipHide={hideTip}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <i className="corner tl" />
                <i className="corner tr" />
                <i className="corner bl" />
                <i className="corner br" />

                <div className="hud read">
                  Rotation X {Math.round(cam.rx)}° · Z {Math.round(((cam.rz % 360) + 360) % 360)}°
                  <br />
                  Scale {Math.round(cam.sc * 100)}%
                </div>
                <div className="hud help">
                  {fm
                    ? 'Drag to orbit · scroll to zoom · click a machine · Esc to exit floor'
                    : 'Drag to orbit · scroll to zoom · click a floor to select it, click again to enter'}
                </div>
                <div className="hud" style={{ right: 16, bottom: 14, textAlign: 'right' }}>
                  {co !== 'All' ? CN[co].split(' ')[0] + ' › ' : ''}
                  <b>{b}</b> › {fm ? FL[fl].n : 'all floors'}
                </div>
              </div>

              <aside className="drawer">
                {mach ? (
                  <>
                    <h3>{mach.code}</h3>
                    <span className="pill" style={{ '--c': COL[mach.st] }}>
                      {mach.st}
                    </span>
                    <div style={{ marginTop: 10 }}>
                      {[
                        ['Category', mach.cat],
                        ['Floor', FL[mach.fi].n],
                        ['Zone', mach.zone],
                        ['Company', CN[mach.co]],
                        ['Plant code', mach.p + ' · ' + mach.u],
                        ['Custodian', mach.who],
                        ['Position', Math.round(mach.x) + '%, ' + Math.round(mach.y) + '%'],
                      ].map((r) => (
                        <div className="row" key={r[0]}>
                          <span>{r[0]}</span>
                          {r[1]}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="empty">
                    <b>No machine selected</b>
                    <br />
                    Click a machine in the 3D view or a row in the ledger to see its details here.
                  </div>
                )}
              </aside>
            </div>

            <section className="ledger">
              <div className="lh">
                <b>
                  {FL[fl].n} · {rows.length} of {cnt(fl).t} units
                </b>
                <div className="chips">
                  {['All', 'Deployed', 'Pending', 'Fault'].map((s) => (
                    <button
                      key={s}
                      className={'chip' + (stt === s ? ' on' : '')}
                      onClick={() => setStt(s)}
                    >
                      {s}
                    </button>
                  ))}
                  {FL[fl].z.map((zn, zi) => (
                    <button
                      key={zi}
                      className={'chip' + (zone === zi ? ' on' : '')}
                      onClick={() => setZone(zone === zi ? null : zi)}
                    >
                      {zn}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Search code, zone, custodian"
                  value={q}
                  onChange={(e) => setQ(e.target.value.toLowerCase())}
                />
              </div>

              <div className="twrap">
                <table>
                  <thead>
                    <tr>
                      <th>Asset code</th>
                      <th>Category</th>
                      <th>Zone</th>
                      <th>Company · plant</th>
                      <th>Custodian</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((m) => (
                      <tr
                        key={m.id}
                        className={'r' + (m.id === sel ? ' sel' : '')}
                        onClick={() => pick(m.id)}
                      >
                        <td>
                          <b>{m.code}</b>
                        </td>
                        <td>{m.cat}</td>
                        <td>{m.zone}</td>
                        <td>
                          {m.co} · {m.p}
                        </td>
                        <td>{m.who}</td>
                        <td>
                          <span className="pill" style={{ '--c': COL[m.st] }}>
                            {m.st}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>

      {tip && (
        <div className="tip" style={{ left: tip.x + 12, top: tip.y + 12 }}>
          {tip.node}
        </div>
      )}
    </div>
  );
}
