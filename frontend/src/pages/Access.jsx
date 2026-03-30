import axios from "axios";
import { useEffect, useState } from "react";
import { useAuthContext } from "../components/AuthProvider";
import { isHandledByGlobalInterceptor } from "../components/httpErrors";
import { showToast } from "../components/toastBus";

const ROLE_OPTIONS = [
  { value: "viewer", label: "viewer" },
  { value: "operator", label: "operator" },
  { value: "auditor", label: "auditor" },
  { value: "admin", label: "admin" },
];

function isGlobalRole(role) {
  return role === "admin" || role === "auditor";
}

function sortBranches(items) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

export default function Access() {
  const { user: currentUser, loading: meLoading } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [savingUserId, setSavingUserId] = useState(null);
  const [newBranchName, setNewBranchName] = useState("");
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [branchQueries, setBranchQueries] = useState({});
  const [editingBranchId, setEditingBranchId] = useState(null);
  const [editingBranchName, setEditingBranchName] = useState("");
  const [savingBranchId, setSavingBranchId] = useState(null);
  const [deletingBranchId, setDeletingBranchId] = useState(null);
  const [activeSection, setActiveSection] = useState("users");

  const requireBranchName = (value) => {
    const name = value.trim();
    if (!name) {
      setError("Введите название филиала");
      return null;
    }
    return name;
  };

  useEffect(() => {
    Promise.all([axios.get("/api/users"), axios.get("/api/branches")])
      .then(([usersRes, branchesRes]) => {
        const userItems = usersRes.data || [];
        setUsers(userItems);
        setBranches(sortBranches(branchesRes.data || []));

        const initialDrafts = {};
        userItems.forEach((u) => {
          initialDrafts[u.user_id] = {
            role: u.role,
            branch_ids: [...(u.branch_ids || [])],
          };
        });
        setDrafts(initialDrafts);
      })
      .catch((err) => {
        if (isHandledByGlobalInterceptor(err?.response?.status)) {
          return;
        }
        showToast("Не удалось загрузить данные по доступам");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleRoleChange = (userId, role) => {
    setDrafts((prev) => {
      const current = prev[userId] || { role: "viewer", branch_ids: [] };
      return {
        ...prev,
        [userId]: {
          role,
          branch_ids: isGlobalRole(role) ? [] : current.branch_ids,
        },
      };
    });
  };

  const toggleBranch = (userId, branchId) => {
    setDrafts((prev) => {
      const current = prev[userId] || { role: "viewer", branch_ids: [] };
      const currentBranchIds = current.branch_ids || [];
      const hasBranch = currentBranchIds.includes(branchId);
      const nextBranchIds = hasBranch
        ? currentBranchIds.filter((id) => id !== branchId)
        : [...currentBranchIds, branchId];

      return {
        ...prev,
        [userId]: {
          ...current,
          branch_ids: nextBranchIds,
        },
      };
    });
  };

  const setBranchesForUser = (userId, branchIds) => {
    setDrafts((prev) => {
      const current = prev[userId] || { role: "viewer", branch_ids: [] };
      return {
        ...prev,
        [userId]: {
          ...current,
          branch_ids: branchIds,
        },
      };
    });
  };

  const removeBranchFromDrafts = (branchId) => {
    setDrafts((prev) => {
      const next = {};
      Object.entries(prev).forEach(([userId, draft]) => {
        next[userId] = {
          ...draft,
          branch_ids: (draft.branch_ids || []).filter((id) => id !== branchId),
        };
      });
      return next;
    });
  };

  const handleSave = async (userId) => {
    const draft = drafts[userId];
    if (!draft) return;

    setSavingUserId(userId);
    setSaveMessage("");
    setError("");
    try {
      const payload = {
        role: draft.role,
        branch_ids: isGlobalRole(draft.role) ? [] : draft.branch_ids,
      };
      const res = await axios.put(`/api/users/${userId}`, payload);
      const updated = res.data;

      setUsers((prev) => prev.map((u) => (u.user_id === userId ? updated : u)));
      setDrafts((prev) => ({
        ...prev,
        [userId]: {
          role: updated.role,
          branch_ids: [...(updated.branch_ids || [])],
        },
      }));
      setSaveMessage(`Доступ пользователя ${updated.username} обновлен`);
    } catch (err) {
      if (isHandledByGlobalInterceptor(err?.response?.status)) {
        return;
      }
      showToast("Не удалось сохранить изменения");
    } finally {
      setSavingUserId(null);
    }
  };

  const handleCreateBranch = async () => {
    const name = requireBranchName(newBranchName);
    if (!name) return;

    setCreatingBranch(true);
    setError("");
    setSaveMessage("");
    try {
      const res = await axios.post("/api/branches", { name });
      const created = res.data;
      setBranches((prev) => {
        if (prev.some((b) => b.id === created.id)) return prev;
        return sortBranches([...prev, created]);
      });
      setNewBranchName("");
      setSaveMessage(`Филиал "${created.name}" доступен для назначения`);
    } catch (err) {
      if (isHandledByGlobalInterceptor(err?.response?.status)) {
        return;
      }
      if (err?.response?.data?.detail === "branch already exists") {
        showToast("Филиал с таким названием уже существует");
        return;
      }
      showToast("Не удалось создать филиал");
    } finally {
      setCreatingBranch(false);
    }
  };

  const startEditBranch = (branch) => {
    setEditingBranchId(branch.id);
    setEditingBranchName(branch.name);
  };

  const cancelEditBranch = () => {
    setEditingBranchId(null);
    setEditingBranchName("");
  };

  const handleUpdateBranch = async (branchId) => {
    const name = requireBranchName(editingBranchName);
    if (!name) return;

    setSavingBranchId(branchId);
    setError("");
    setSaveMessage("");
    try {
      const res = await axios.put(`/api/branches/${branchId}`, { name });
      const updated = res.data;
      setBranches((prev) =>
        sortBranches(prev.map((b) => (b.id === branchId ? updated : b))),
      );
      cancelEditBranch();
      setSaveMessage(`Филиал "${updated.name}" обновлен`);
    } catch (err) {
      if (isHandledByGlobalInterceptor(err?.response?.status)) {
        return;
      }
      if (err?.response?.data?.detail === "branch already exists") {
        showToast("Филиал с таким названием уже существует");
        return;
      }
      if (err?.response?.data?.detail === "branch not found") {
        showToast("Филиал не найден");
        return;
      }
      showToast("Не удалось изменить филиал");
    } finally {
      setSavingBranchId(null);
    }
  };

  const handleDeleteBranch = async (branch) => {
    if (
      !window.confirm(
        `Удалить филиал "${branch.name}"?\nВсе связанные конфигурации и аудит будут удалены.`,
      )
    ) {
      return;
    }

    setDeletingBranchId(branch.id);
    setError("");
    setSaveMessage("");
    try {
      await axios.delete(`/api/branches/${branch.id}`);
      setBranches((prev) => prev.filter((b) => b.id !== branch.id));
      removeBranchFromDrafts(branch.id);
      setSaveMessage(`Филиал "${branch.name}" удален`);
      if (editingBranchId === branch.id) {
        cancelEditBranch();
      }
    } catch (err) {
      if (isHandledByGlobalInterceptor(err?.response?.status)) {
        return;
      }
      if (err?.response?.data?.detail === "branch not found") {
        showToast("Филиал не найден");
        return;
      }
      showToast("Не удалось удалить филиал");
    } finally {
      setDeletingBranchId(null);
    }
  };

  const editableUsers = users.filter((u) => u.user_id !== currentUser?.id);

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <h2>Доступ пользователей</h2>
          <p className="muted">Назначение ролей и филиалов</p>
        </div>
      </div>

      {loading || meLoading ? (
        <div className="card">
          <div className="center">Загрузка...</div>
        </div>
      ) : (
        <>
          {error ? <p className="error">{error}</p> : null}
          {saveMessage ? <p className="muted-small">{saveMessage}</p> : null}

          <div className="page-actions" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className={
                activeSection === "users"
                  ? "btn-small"
                  : "btn-small btn-outline"
              }
              onClick={() => setActiveSection("users")}
            >
              Пользователи
            </button>
            <button
              type="button"
              className={
                activeSection === "branches"
                  ? "btn-small"
                  : "btn-small btn-outline"
              }
              onClick={() => setActiveSection("branches")}
            >
              Филиалы
            </button>
          </div>

          {activeSection === "users" ? (
            <div className="card">
              {editableUsers.length ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Пользователь</th>
                      <th>Роль</th>
                      <th>Филиалы</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editableUsers.map((u) => {
                      const draft = drafts[u.user_id] || {
                        role: u.role,
                        branch_ids: u.branch_ids || [],
                      };
                      const disabledBranches = isGlobalRole(draft.role);
                      const selectedBranchIds = draft.branch_ids || [];
                      const query = (branchQueries[u.user_id] || "")
                        .toLowerCase()
                        .trim();
                      const filteredBranches = query
                        ? branches.filter((b) =>
                            b.name.toLowerCase().includes(query),
                          )
                        : branches;

                      return (
                        <tr key={u.user_id}>
                          <td>{u.username}</td>
                          <td>
                            <select
                              value={draft.role}
                              onChange={(e) =>
                                handleRoleChange(u.user_id, e.target.value)
                              }
                            >
                              {ROLE_OPTIONS.map((role) => (
                                <option key={role.value} value={role.value}>
                                  {role.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            {disabledBranches ? (
                              <p className="muted-small">
                                Для роли {draft.role} филиалы не назначаются
                              </p>
                            ) : (
                              <details className="branch-picker">
                                <summary className="branch-picker-summary">
                                  Выбрано филиалов: {selectedBranchIds.length}
                                </summary>
                                <div className="branch-picker-panel">
                                  <input
                                    type="text"
                                    className="branch-picker-search"
                                    placeholder="Поиск филиала..."
                                    value={branchQueries[u.user_id] || ""}
                                    onChange={(e) =>
                                      setBranchQueries((prev) => ({
                                        ...prev,
                                        [u.user_id]: e.target.value,
                                      }))
                                    }
                                  />
                                  <div className="branch-picker-actions">
                                    <button
                                      type="button"
                                      className="btn-small btn-outline"
                                      onClick={() =>
                                        setBranchesForUser(
                                          u.user_id,
                                          filteredBranches.map((b) => b.id),
                                        )
                                      }
                                    >
                                      Все в фильтре
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-small btn-outline"
                                      onClick={() =>
                                        setBranchesForUser(u.user_id, [])
                                      }
                                    >
                                      Очистить
                                    </button>
                                  </div>

                                  <div className="branch-picker-list">
                                    {filteredBranches.length ? (
                                      filteredBranches.map((b) => (
                                        <label
                                          className="branch-check"
                                          key={b.id}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={selectedBranchIds.includes(
                                              b.id,
                                            )}
                                            onChange={() =>
                                              toggleBranch(u.user_id, b.id)
                                            }
                                          />
                                          <span>{b.name}</span>
                                        </label>
                                      ))
                                    ) : (
                                      <p className="muted-small">
                                        Ничего не найдено
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </details>
                            )}
                          </td>
                          <td className="table-actions">
                            <button
                              type="button"
                              className="btn-small"
                              disabled={savingUserId === u.user_id}
                              onClick={() => handleSave(u.user_id)}
                            >
                              {savingUserId === u.user_id
                                ? "Сохранение..."
                                : "Сохранить"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="muted-small">Нет пользователей для изменения.</p>
              )}
            </div>
          ) : null}

          {activeSection === "branches" ? (
            <div className="card">
              <h3>Филиалы</h3>
              <div className="page-actions" style={{ marginBottom: 12 }}>
                <input
                  type="text"
                  placeholder="Новый филиал"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                />
                <button
                  type="button"
                  className="btn"
                  disabled={creatingBranch}
                  onClick={handleCreateBranch}
                >
                  {creatingBranch ? "Создание..." : "Создать филиал"}
                </button>
              </div>

              {branches.length ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Название</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map((branch) => (
                      <tr key={branch.id}>
                        <td>
                          {editingBranchId === branch.id ? (
                            <input
                              type="text"
                              value={editingBranchName}
                              onChange={(e) =>
                                setEditingBranchName(e.target.value)
                              }
                            />
                          ) : (
                            branch.name
                          )}
                        </td>
                        <td className="table-actions">
                          {editingBranchId === branch.id ? (
                            <>
                              <button
                                type="button"
                                className="btn-small"
                                disabled={savingBranchId === branch.id}
                                onClick={() => handleUpdateBranch(branch.id)}
                              >
                                {savingBranchId === branch.id
                                  ? "Сохранение..."
                                  : "Сохранить"}
                              </button>
                              <button
                                type="button"
                                className="btn-small btn-outline"
                                onClick={cancelEditBranch}
                              >
                                Отмена
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="btn-small btn-outline"
                                onClick={() => startEditBranch(branch)}
                              >
                                Переименовать
                              </button>
                              <button
                                type="button"
                                className="btn-small btn-danger"
                                disabled={deletingBranchId === branch.id}
                                onClick={() => handleDeleteBranch(branch)}
                              >
                                {deletingBranchId === branch.id
                                  ? "Удаление..."
                                  : "Удалить"}
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted-small">Филиалов пока нет.</p>
              )}
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
