import React, { useEffect, useState } from "react";
import axios from "axios";

function Badge({ children, type = "DEFAULT" }) {
  const colors = {
    CREATE: "badge--green",
    UPDATE: "badge--orange",
    DELETE: "badge--red",
    DEFAULT: "badge--muted",
  };

  const cls = colors[type] || colors.DEFAULT;
  return <span className={`badge ${cls}`}>{children}</span>;
}

export default function AuditList({ configId }) {
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    axios.get("/api/users").then((r) => setUsers(r.data));
    axios.get("/api/branches").then((r) => setBranches(r.data));
  }, []);

  useEffect(() => {
    if (!configId) return;
    axios
      .get(`/api/configs/${configId}/audit`)
      .then((r) => setItems(r.data))
      .catch(() => setItems([]));
  }, [configId]);

  const getUserName = (id) =>
    users.find((u) => u.id === id)?.username || `User #${id}`;

  const getBranchName = (id) =>
    branches.find((b) => b.id === Number(id))?.name || id;

  const formatDescription = (desc) => {
    const branchMatch = desc.match(/branch_id: '(\d+)' -> '(\d+)'/);
    if (branchMatch) {
      const oldName = getBranchName(branchMatch[1]);
      const newName = getBranchName(branchMatch[2]);
      return `branch: '${oldName}' -> '${newName}'`;
    }
    return desc;
  };

  if (!items.length) {
    return <div className="audit-empty">No audit entries</div>;
  }

  return (
    <div className="audit-list">
      {items.map((a) => (
        <div key={a.id} className="audit-row">
          <div className="audit-left">
            <Badge type={a.action}>{a.action}</Badge>
            <div className="audit-meta">
              <div className="meta-user">
                {a.user_id ? getUserName(a.user_id) : "Unknown"}
              </div>
              <div className="meta-time">
                {a.timestamp ? new Date(a.timestamp).toLocaleString() : ""}
              </div>
            </div>
          </div>
          <div className="audit-desc">{formatDescription(a.description)}</div>
        </div>
      ))}
    </div>
  );
}
