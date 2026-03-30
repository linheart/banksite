import axios from "axios";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AuditList from "../components/AuditList";
import { useAuthContext } from "../components/AuthProvider";
import { buildBranchesMap, fetchBranches } from "../components/branches";
import { isHandledByGlobalInterceptor } from "../components/httpErrors";
import { showToast } from "../components/toastBus";

export default function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuthContext();
  const [cfg, setCfg] = useState(null);
  const [branchesMap, setBranchesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const canEdit = role === "admin" || role === "operator";
  const canDelete = role === "admin";
  const canSeeAudit = role === "admin" || role === "auditor";

  useEffect(() => {
    let isActive = true;
    setLoading(true);
    setLoadError("");

    Promise.allSettled([axios.get(`/api/configs/${id}`), fetchBranches()])
      .then(([cfgResult, branchesResult]) => {
        if (!isActive) return;

        if (cfgResult.status === "rejected") {
          setCfg(null);
          if (cfgResult.reason?.response?.status === 404) {
            setLoadError("not_found");
            return;
          }
          setLoadError("load_failed");
          return;
        }

        setCfg(cfgResult.value.data);
        if (branchesResult.status === "fulfilled") {
          setBranchesMap(buildBranchesMap(branchesResult.value));
          return;
        }
        setBranchesMap({});
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm("Удалить конфигурацию?")) return;
    try {
      await axios.delete(`/api/configs/${id}`);
      navigate("/");
    } catch (err) {
      const status = err?.response?.status;
      if (isHandledByGlobalInterceptor(status)) {
        return;
      }
      showToast("Не удалось удалить конфигурацию");
    }
  };

  if (loading)
    return (
      <div className="container">
        <div className="card">
          <div className="center">Загрузка...</div>
        </div>
      </div>
    );
  if (loadError === "load_failed")
    return (
      <div className="container">
        <div className="card">
          <div className="center">Не удалось загрузить</div>
        </div>
      </div>
    );
  if (loadError === "not_found" || !cfg)
    return (
      <div className="container">
        <div className="card">
          <div className="center">Не найдено</div>
        </div>
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
        {canEdit || canDelete ? (
          <div className="page-actions">
            {canEdit ? (
              <Link to={`/edit/${cfg.id}`} className="btn">
                Изменить
              </Link>
            ) : null}
            {canDelete ? (
              <button onClick={handleDelete} className="btn btn-danger">
                Удалить
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid">
        <div>
          <div className="card">
            <h4>Конфигурация</h4>
            <pre className="config-block">{cfg.config_text}</pre>
          </div>
        </div>

        <aside className="grid-aside">
          <div className="card">
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
          </div>

          {canSeeAudit ? (
            <div className="card">
              <h4>Аудит</h4>
              <AuditList configId={cfg.id} branchesMap={branchesMap} />
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
