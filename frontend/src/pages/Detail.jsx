import axios from "axios";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AuditList from "../components/AuditList";
import Card from "../components/Card";
import { fetchBranches } from "../components/branches";

export default function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cfg, setCfg] = useState(null);
  const [branchesMap, setBranchesMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([axios.get(`/api/configs/${id}`), fetchBranches()])
      .then(([cfgRes, branches]) => {
        setCfg(cfgRes.data);
        const map = {};
        (branches || []).forEach((b) => {
          map[b.id] = b.name;
        });
        setBranchesMap(map);
      })
      .catch(() => {
        setCfg(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm("Удалить конфигурацию?")) return;
    try {
      await axios.delete(`/api/configs/${id}`);
      navigate("/");
    } catch (e) {
      alert("Не удалось удалить");
    }
  };

  if (loading)
    return (
      <div className="container">
        <Card>
          <div className="center">Загрузка...</div>
        </Card>
      </div>
    );
  if (!cfg)
    return (
      <div className="container">
        <Card>
          <div className="center">Не найдено</div>
        </Card>
      </div>
    );

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <h2>{cfg.name || `#${cfg.id}`}</h2>
          <p className="muted">
            {cfg.device_type || "Device"} •{" "}
            {branchesMap[cfg.branch_id] ?? `Branch ${cfg.branch_id}`}
          </p>
        </div>
        <div className="page-actions">
          <Link to={`/edit/${cfg.id}`} className="btn">
            Изменить
          </Link>
          <button onClick={handleDelete} className="btn btn-danger">
            Удалить
          </button>
        </div>
      </div>

      <div className="grid">
        <div className="grid-col">
          <Card>
            <h4>Конфигурация</h4>
            <pre className="config-block">{cfg.config_text}</pre>
          </Card>
        </div>

        <aside className="grid-aside">
          <Card>
            <h4>Данные</h4>
            <div className="meta-row">
              <strong>Изменено</strong>
              <div>
                {cfg.last_modified
                  ? new Date(cfg.last_modified).toLocaleString()
                  : "-"}
              </div>
            </div>
            <div className="meta-row">
              <strong>Филиал</strong>
              <div>
                {branchesMap[cfg.branch_id] ?? `Branch ${cfg.branch_id}`}
              </div>
            </div>
          </Card>

          <Card>
            <h4>Аудит</h4>
            <AuditList configId={cfg.id} />
          </Card>
        </aside>
      </div>
    </main>
  );
}
