import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { isHandledByGlobalInterceptor } from "../components/httpErrors";
import { showToast } from "../components/toastBus";

export default function Form() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    branch_id: "",
    name: "",
    device_type: "",
    config_text: "",
  });

  useEffect(() => {
    axios
      .get("/api/branches")
      .then((res) => setBranches(res.data || []))
      .catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    if (id) {
      axios
        .get(`/api/configs/${id}`)
        .then((r) => {
          setFormData({
            branch_id: String(r.data?.branch_id ?? ""),
            name: r.data?.name ?? "",
            device_type: r.data?.device_type ?? "",
            config_text: r.data?.config_text ?? "",
          });
        })
        .catch((err) => {
          const status = err?.response?.status;
          if (isHandledByGlobalInterceptor(status)) {
            return;
          }
          if (status === 404) {
            showToast("Конфигурация не найдена");
            navigate("/");
            return;
          }
          showToast("Не удалось загрузить конфигурацию");
        });
    }
  }, [id, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const branchId = Number(formData.branch_id);
    if (!branchId) {
      setError("Выберите филиал из списка");
      return;
    }

    const payload = {
      branch_id: branchId,
      name: formData.name,
      device_type: formData.device_type,
      config_text: formData.config_text,
    };

    try {
      if (id) await axios.put(`/api/configs/${id}`, payload);
      else await axios.post(`/api/configs`, payload);

      navigate("/");
    } catch (err) {
      const status = err?.response?.status;
      if (isHandledByGlobalInterceptor(status)) {
        return;
      }
      const detail = err?.response?.data?.detail;
      if (detail === "config already exists in branch") {
        showToast("Конфигурация с таким названием уже есть в этом филиале");
        return;
      }
      if (detail === "branch not found") {
        showToast("Филиал не найден");
        return;
      }
      showToast("Не удалось сохранить конфигурацию");
    }
  };

  return (
    <main className="container">
      <div className="page-header">
        <h2>{id ? "Изменить конфигурацию" : "Создать конфигурацию"}</h2>
        <p className="muted">
          {id
            ? "Изменить конфигурацию сетевого оборудования"
            : "Добавить конфигурацию сетевого оборудования"}
        </p>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          {error && <p className="error">{error}</p>}
          <label>Филиал</label>
          <select
            name="branch_id"
            value={formData.branch_id || ""}
            onChange={handleChange}
            required
          >
            <option value="">Выберите филиал</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <label>Название</label>
          <input
            name="name"
            value={formData.name || ""}
            onChange={handleChange}
            required
          />

          <label>Вид</label>
          <input
            name="device_type"
            value={formData.device_type || ""}
            onChange={handleChange}
            required
          />

          <label>Конфигурация</label>
          <textarea
            name="config_text"
            value={formData.config_text || ""}
            onChange={handleChange}
            rows="8"
            required
          />

          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" className="btn" disabled={!branches.length}>
              {id ? "Обновить" : "Создать"}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => navigate(-1)}
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
