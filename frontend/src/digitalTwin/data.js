// Mapping constants (populated from master data / API)
export const COL = { Deployed: '#39ff88', Pending: '#ffb020', Fault: '#ff3b3b' };

// Floors and zones follow the Master Mapping (Floor -> Department -> Area/Zone)
export const FL = [
  { n: 'Ground floor', z: [] },
  { n: '1st floor · SMT', z: [] },
  { n: '2nd floor · Quality', z: [] },
  { n: '3rd floor · Finance & IT', z: [] },
];
export const CAT = [];

// SAP plant codes (WERKS) per company (BUKRS) and building
export const PL = [];
export const CN = {};
export const BL = [];

// machine box size [width, depth, height, color] by category
export const DIM = {
  'Fixed assets': [],
  Accessories: [],
  Tools: [],
  Fixtures: [],
};

export function buildMachines(realAssets = []) {
  // Zero dummy data: only render verified assets mapped from storage / API.
  if (!realAssets || realAssets.length === 0) {
    return [];
  }
  return realAssets.map((asset, idx) => ({
    id: idx + 1,
    b: asset.building || 'C39',
    co: asset.company || 'Ismartu',
    p: asset.plant || 'TUW1',
    u: 'Transmission',
    code: asset.assetCode || `AST-${idx + 1}`,
    fi: 0,
    zi: 0,
    zone: asset.location || 'General',
    cat: asset.category || 'Fixed assets',
    who: asset.assignedTo || 'Unassigned',
    st: asset.status === 'Active' || asset.status === 'Completed' ? 'Deployed' : asset.status === 'Maintenance' ? 'Fault' : 'Pending',
    x: 20 + ((idx % 5) * 15),
    y: 20 + (Math.floor(idx / 5) * 15),
  }));
}
