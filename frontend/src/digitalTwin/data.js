// Sample data + helpers. Replace buildMachines() with your API / master mapping.
export const COL = { Deployed: '#39ff88', Pending: '#ffb020', Fault: '#ff3b3b' };

// Floors and zones follow the Master Mapping (Floor -> Department -> Area/Zone)
export const FL = [
  { n: 'Ground floor', z: ['Production'] },
  { n: '1st floor · SMT', z: ['SMT Line 1 (Cleanroom A)', 'SMT Line 2 (Cleanroom B)'] },
  { n: '2nd floor · Quality', z: ['Thermal Testing Chamber'] },
  { n: '3rd floor · Finance & IT', z: ['Finance & Accounts', 'Central Server Room'] },
];
export const CAT = ['Fixed assets', 'Accessories', 'Tools', 'Fixtures'];

// SAP plant codes (WERKS) per company (BUKRS) and building
export const PL = [
  { c: 'TUW1', co: 'Ismartu', b: 'D198', u: 'Transmission' },
  { c: 'TUW2', co: 'Ismartu', b: 'D198', u: 'Transmission' },
  { c: 'TUW3', co: 'Ismartu', b: 'D198', u: 'OEM' },
  { c: 'TUW5', co: 'Ismartu', b: 'C39', u: 'Transmission' },
  { c: 'TUW6', co: 'Ismartu', b: 'C39', u: 'OEM' },
  { c: '9502', co: 'Padget', b: 'D197', u: 'Transmission' },
  { c: '9503', co: 'Padget', b: 'D197', u: 'Transmission' },
  { c: '9504', co: 'Padget', b: 'D199', u: 'OEM' }, // assumed: confirm D197 vs D199
  { c: '9505', co: 'Padget', b: 'C39', u: 'Transmission' },
  { c: '9506', co: 'Padget', b: 'C39', u: 'OEM' },
];
export const CN = {
  Ismartu: 'Ismartu India Pvt Ltd (5020)',
  Padget: 'Padget Electronics Pvt Ltd (9500)',
};
export const BL = ['C39', 'D197', 'D198', 'D199'];

// machine box size [width, depth, height, color] by category
export const DIM = {
  'Fixed assets': [28, 16, 17, '#c9d2db'],
  Accessories: [11, 9, 6, '#8e9aa8'],
  Tools: [13, 10, 8, '#d4a63a'],
  Fixtures: [19, 13, 11, '#7d95ab'],
};

export function buildMachines() {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const M = [];
  let id = 1;
  BL.forEach((b) => {
    const pls = PL.filter((p) => p.b === b);
    FL.forEach((f, fi) => {
      const rows = Math.ceil(f.z.length / 2);
      f.z.forEach((zn, zi) => {
        const c = zi % 2, r = Math.floor(zi / 2);
        const x0 = c * 50 + 3, w = f.z.length === 1 ? 94 : 44;
        const y0 = (r * 100) / rows + 5, h = 100 / rows - 10;
        const n = fi === 0 && zi === 2 ? 0 : 3 + Math.floor(rnd() * 4);
        const cols = Math.ceil(n / 2);
        for (let k = 0; k < n; k++) {
          const s = rnd(), p = pls[Math.floor(rnd() * pls.length)];
          M.push({
            id, b, co: p.co, p: p.c, u: p.u,
            code: '20' + String(5900 + id * 7), fi, zi, zone: zn,
            cat: CAT[Math.floor(rnd() * 4)],
            who: 'USR-' + String(10 + Math.floor(rnd() * 80)).padStart(3, '0'),
            st: s < 0.62 ? 'Deployed' : s < 0.88 ? 'Pending' : 'Fault',
            x: x0 + ((k % cols) + 0.5) * w / cols,
            y: y0 + 12 + (Math.floor(k / cols) + 0.5) * (h - 12) / 2,
          });
          id++;
        }
      });
    });
  });
  return M;
}
