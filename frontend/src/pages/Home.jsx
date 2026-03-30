import axios from "axios";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AuditList from "../components/AuditList";
import { useAuthContext } from "../components/AuthProvider";
import { buildBranchesMap, fetchBranches } from "../components/branches";

const PAGE_SIZE = 8;

export default function Home() {
  const { role } = useAuthContext();
  const [configs, setConfigs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState([]);
  const [branchesMap, setBranchesMap] = useState({});
  const [query, setQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [offset, setOffset] = useState(0);

  const canManageConfigs = role === "admin" || role === "operator";
  const canSeeAudit = role === "admin" || role === "auditor";

  useEffect(() => {
    fetchBranches()
      .then((items) => {
        const branchItems = items || [];
        setBranches(branchItems);
        setBranchesMap(buildBranchesMap(branchItems));
      })
      .catch(() => {
        setBranches([]);
        setBranchesMap({});
      });
  }, []);

  useEffect(() => {
    setLoading(true);

    const params = {
      limit: PAGE_SIZE,
      offset,
    };

    const qValue = query.trim();
    if (qValue) params.q = qValue;

    if (branchFilter) params.branch_id = Number(branchFilter);

    const typeValue = typeFilter.trim();
    if (typeValue) params.device_type = typeValue;

    axios
      .get("/api/configs", { params })
      .then((res) => {
        setConfigs(res.data?.items || []);
        setTotal(Number(res.data?.total) || 0);
      })
      .catch(() => {
        setConfigs([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [branchFilter, offset, query, typeFilter]);

  const handleQueryChange = (e) => {
    setQuery(e.target.value);
    setOffset(0);
  };

  const handleBranchChange = (e) => {
    setBranchFilter(e.target.value);
    setOffset(0);
  };

  const handleTypeChange = (e) => {
    setTypeFilter(e.target.value);
    setOffset(0);
  };

  const clearFilters = () => {
    setQuery("");
    setBranchFilter("");
    setTypeFilter("");
    setOffset(0);
  };

  const hasPrev = offset > 0;
  const hasNext = offset + configs.length < total;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const shownFrom = total > 0 ? offset + 1 : 0;
  const shownTo = total > 0 ? Math.min(offset + configs.length, total) : 0;

  return (
    <main className="container home-page">
      <div className="page-header home-header">
        <h2>Конфигурации сетевого оборудования</h2>
        <p className="muted">
          Контроль конфигураций сетевого оборудования в филиалах банка
        </p>
      </div>

      <div className="grid">
        <div>
          <div className="card home-table-card">
            <div className="page-actions home-filters">
              <input
                type="text"
                placeholder="Поиск по названию..."
                value={query}
                onChange={handleQueryChange}
              />
              <select value={branchFilter} onChange={handleBranchChange}>
                <option value="">Все филиалы</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Тип устройства..."
                value={typeFilter}
                onChange={handleTypeChange}
              />
              <button
                type="button"
                className="btn-small btn-outline"
                onClick={clearFilters}
              >
                Очистить
              </button>
            </div>

            {loading ? (
              <div className="center">Загрузка...</div>
            ) : (
              <>
                <table className="table home-table">
                  <thead>
                    <tr>
                      <th>Название</th>
                      <th>Филиал</th>
                      <th>Вид</th>
                      <th>Последнее изменение</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {configs.length ? (
                      configs.map((cfg) => (
                        <tr key={cfg.id}>
                          <td>
                            <Link to={`/detail/${cfg.id}`} className="link">
                              {cfg.name || `#${cfg.id}`}
                            </Link>
                          </td>
                          <td>{branchesMap[cfg.branch_id] ?? cfg.branch_id}</td>
                          <td>{cfg.device_type || "-"}</td>
                          <td>
                            {cfg.last_modified
                              ? new Date(cfg.last_modified).toLocaleString()
                              : "-"}
                          </td>
                          <td className="table-actions">
                            {canManageConfigs ? (
                              <Link to={`/edit/${cfg.id}`} className="btn-small">
                                Изменить
                              </Link>
                            ) : null}
                            <Link
                              to={`/detail/${cfg.id}`}
                              className="btn-small btn-outline"
                            >
                              Подробнее
                            </Link>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="muted-small">
                          Конфигурации не найдены
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div className="page-actions pagination-bar">
                  <p className="muted-small">
                    Показано {shownFrom}-{shownTo} из {total}
                  </p>
                  <div className="pagination-controls">
                    {hasPrev ? (
                      <button
                        type="button"
                        className="btn-small btn-outline"
                        onClick={() =>
                          setOffset((prev) => Math.max(0, prev - PAGE_SIZE))
                        }
                      >
                        Назад
                      </button>
                    ) : null}
                    <span className="muted-small pagination-page">
                      Страница {currentPage} из {totalPages}
                    </span>
                    {hasNext ? (
                      <button
                        type="button"
                        className="btn-small btn-outline"
                        onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
                      >
                        Вперед
                      </button>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <aside className="grid-aside home-aside">
          {canManageConfigs ? (
            <div className="card card--accent home-side-card">
              <h3>Быстрый доступ</h3>
              <p className="muted">Создать новую конфигурацию.</p>
              <div style={{ marginTop: 12 }}>
                <Link to="/add" className="btn">
                  Создать
                </Link>
              </div>
            </div>
          ) : null}

          <div className="card home-side-card">
            <h4>Статистика</h4>
            <div className="stat-row">
              <div className="stat">
                <div className="stat-value">{total}</div>
                <div className="stat-label">Всего конфигураций</div>
              </div>
            </div>
          </div>

          {canSeeAudit ? (
            <div className="card home-side-card">
              <h4>Последние действия</h4>
              <AuditList
                limit={8}
                compact
                showConfig
                branchesMap={branchesMap}
              />
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
