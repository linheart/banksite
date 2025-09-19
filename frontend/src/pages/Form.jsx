import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Card from "../components/Card";

export default function Form() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    branch_id: "",
    name: "",
    device_type: "",
    config_text: "",
  });

  useEffect(() => {
    if (id) {
      axios
        .get(`/api/configs/${id}`)
        .then((r) => {
          setFormData({
            branch_name: "",
            ...r.data,
          });
          axios.get("/api/branches").then((res) => {
            const found = res.data.find((b) => b.id === r.data.branch_id);
            if (found)
              setFormData((prev) => ({ ...prev, branch_name: found.name }));
          });
        })
        .catch(() => {});
    }
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const branches = await axios.get("/api/branches").then((r) => r.data);
    let branch = branches.find(
      (b) => b.name.toLowerCase() === formData.branch_name.toLowerCase()
    );
    if (!branch) {
      branch = await axios
        .post("/api/branches", { name: formData.branch_name })
        .then((r) => r.data);
    }

    const payload = {
      branch_id: branch.id,
      name: formData.name,
      device_type: formData.device_type,
      config_text: formData.config_text,
    };

    if (id) await axios.put(`/api/configs/${id}`, payload);
    else await axios.post(`/api/configs`, payload);

    navigate("/");
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

      <Card>
        <form onSubmit={handleSubmit}>
          <label>Филиал</label>
          <input
            name="branch_name"
            value={formData.branch_name}
            onChange={handleChange}
            required
          />

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
            <button type="submit" className="btn">
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
      </Card>
    </main>
  );
}
