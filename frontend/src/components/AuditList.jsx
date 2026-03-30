import { useEffect, useState } from "react";
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

export default function AuditList({
  configId = null,
  limit = 20,
  compact = false,
  showConfig = false,
  branchesMap = {},
}) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const endpoint = configId
      ? `/api/configs/${configId}/audit`
      : `/api/audit?limit=${limit}`;

    axios
      .get(endpoint)
      .then((r) => setItems(r.data))
      .catch(() => setItems([]));
  }, [configId, limit]);

  const getBranchName = (id) => branchesMap[Number(id)] ?? id;

  const formatDescription = (desc) => {
    if (!desc) return "";
    const branchMatch = desc.match(/branch_id: '(\d+)' -> '(\d+)'/);
    if (branchMatch) {
      const oldName = getBranchName(branchMatch[1]);
      const newName = getBranchName(branchMatch[2]);
      return `branch: '${oldName}' -> '${newName}'`;
    }
    return desc;
  };

  if (!items.length) return <div className="audit-empty">Записей аудита пока нет</div>;

  return (
    <div className={`audit-list ${compact ? "audit-list--compact" : ""}`}>
      {items.map((a) => (
        <div key={a.id} className="audit-row">
          <div className="audit-left">
            <Badge type={a.action}>{a.action}</Badge>
            <div className="audit-meta">
              <div className="meta-user">
                {a.user_id ? `User #${a.user_id}` : "Unknown"}
              </div>
              {showConfig && <div className="meta-config">Конфиг #{a.config_id}</div>}
              <div className="meta-time">
                {a.event_at ? new Date(a.event_at).toLocaleString() : ""}
              </div>
            </div>
          </div>
          <div className="audit-desc">{formatDescription(a.description)}</div>
        </div>
      ))}
    </div>
  );
}
