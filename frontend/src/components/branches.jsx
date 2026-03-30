import axios from "axios";

export async function fetchBranches() {
  const res = await axios.get("/api/branches");
  return res.data || [];
}

export function buildBranchesMap(branches) {
  const map = {};
  (branches || []).forEach((branch) => {
    map[branch.id] = branch.name;
  });
  return map;
}
