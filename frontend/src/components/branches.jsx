import axios from "axios";

export async function fetchBranches() {
  const res = await axios.get("/api/branches");
  return res.data || [];
}
