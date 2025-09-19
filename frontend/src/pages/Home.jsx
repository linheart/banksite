import axios from "axios";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../components/Card";
import { fetchBranches } from "../components/branches";

export default function Home() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branchesMap, setBranchesMap] = useState({});

  useEffect(() => {
    Promise.all([axios.get("/api/configs"), fetchBranches()])
      .then(([cfgRes, branches]) => {
        setConfigs(cfgRes.data || []);
        const map = {};
        (branches || []).forEach((b) => {
          map[b.id] = b.name;
        });
        setBranchesMap(map);
      })
      .catch((err) => {
        setConfigs([]);
        setBranchesMap({});
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="container">
      <div className="page-header">
        <h2>Конфигурации сетевого оборудования</h2>
        <p className="muted">
          Контроль конфигураций сетевого оборудования в филиалах банка
        </p>
      </div>

      <div className="grid">
        <div className="grid-col">
          <Card>
            {loading ? (
              <div className="center">Загрузка...</div>
            ) : (
              <table className="table">
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
                  {configs.map((cfg) => (
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
                        <Link to={`/edit/${cfg.id}`} className="btn-small">
                          Изменить
                        </Link>
                        <Link
                          to={`/detail/${cfg.id}`}
                          className="btn-small btn-outline"
                        >
                          Подробнее
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <aside className="grid-aside">
          <Card className="card--accent">
            <h3>Быстрый доступ</h3>
            <p className="muted">Создать новую конфигурацию.</p>
            <div style={{ marginTop: 12 }}>
              <Link to="/add" className="btn">
                Создать
              </Link>
            </div>
          </Card>

          <Card>
            <h4>Статистика</h4>
            <div className="stat-row">
              <div className="stat">
                <div className="stat-value">{configs.length}</div>
                <div className="stat-label">Всего конфигураций</div>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </main>
  );
}
