// ============================================================
// 私人笔记应用 - 主逻辑
// ============================================================

// ------------------------------------------------------------
// 全局状态
// ------------------------------------------------------------
let currentUser = null;       // 当前登录用户
let categories = [];          // 分类列表缓存
let notes = [];                // 笔记列表缓存
let currentNoteId = null;     // 当前正在编辑的笔记 id
let currentFilter = "all";    // 当前筛选: all | favorite
let currentCategoryId = "";   // 当前选中的分类 id（""表示全部）
let searchKeyword = "";       // 搜索关键词
let isAuthLoginMode = true;   // true=登录模式, false=注册模式

let saveTimer = null;         // 自动保存的 debounce timer
const SAVE_DEBOUNCE_MS = 800; // 自动保存延迟

// ------------------------------------------------------------
// DOM 元素引用
// ------------------------------------------------------------
const authView = document.getElementById("auth-view");
const appView = document.getElementById("app-view");
const authForm = document.getElementById("auth-form");
const authError = document.getElementById("auth-error");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const toggleAuthModeLink = document.getElementById("toggle-auth-mode");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const logoutBtn = document.getElementById("logout-btn");
const searchInput = document.getElementById("search-input");
const newNoteBtn = document.getElementById("new-note-btn");
const filterTabs = document.querySelectorAll(".filter-tab");
const categoryList = document.getElementById("category-list");
const addCategoryBtn = document.getElementById("add-category-btn");
const notesList = document.getElementById("notes-list");

const emptyState = document.getElementById("empty-state");
const editor = document.getElementById("editor");
const noteTitleInput = document.getElementById("note-title");
const noteCategorySelect = document.getElementById("note-category-select");
const favoriteBtn = document.getElementById("favorite-btn");
const deleteNoteBtn = document.getElementById("delete-note-btn");
const noteContent = document.getElementById("note-content");
const saveStatus = document.getElementById("save-status");
const rteToolbar = document.querySelector(".rte-toolbar");

const categoryModal = document.getElementById("category-modal");
const categoryNameInput = document.getElementById("category-name-input");
const categoryCancelBtn = document.getElementById("category-cancel-btn");
const categoryConfirmBtn = document.getElementById("category-confirm-btn");

// ============================================================
// 1. 认证逻辑
// ============================================================

/**
 * 切换登录 / 注册模式
 */
toggleAuthModeLink.addEventListener("click", (e) => {
  e.preventDefault();
  isAuthLoginMode = !isAuthLoginMode;
  authSubmitBtn.textContent = isAuthLoginMode ? "登录" : "注册";
  toggleAuthModeLink.textContent = isAuthLoginMode ? "立即注册" : "立即登录";
  toggleAuthModeLink.previousSibling.textContent = isAuthLoginMode
    ? "还没有账号？"
    : "已经有账号？";
  hideAuthError();
});

/**
 * 提交登录 / 注册表单
 */
authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAuthError();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  authSubmitBtn.disabled = true;
  authSubmitBtn.textContent = "处理中...";

  try {
    if (isAuthLoginMode) {
      // 登录
      const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } else {
      // 注册
      const { error } = await supabaseClient.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
      showAuthError("注册成功！如果开启了邮箱验证，请检查邮箱后登录。", false);
    }
  } catch (err) {
    showAuthError(err.message);
  } finally {
    authSubmitBtn.disabled = false;
    authSubmitBtn.textContent = isAuthLoginMode ? "登录" : "注册";
  }
});

function showAuthError(message, isError = true) {
  authError.textContent = message;
  authError.classList.remove("hidden");
  authError.style.color = isError ? "" : "#16a34a";
  authError.style.background = isError ? "" : "#f0fdf4";
  authError.style.borderColor = isError ? "" : "#bbf7d0";
}

function hideAuthError() {
  authError.classList.add("hidden");
}

/**
 * 退出登录
 */
logoutBtn.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
});

/**
 * 监听 Supabase Auth 状态变化
 * - SIGNED_IN: 显示主应用，加载数据
 * - SIGNED_OUT: 显示登录界面
 */
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (session && session.user) {
    currentUser = session.user;
    showAppView();
    initAppData();
  } else {
    currentUser = null;
    showAuthView();
  }
});

function showAppView() {
  authView.classList.add("hidden");
  appView.classList.remove("hidden");
}

function showAuthView() {
  appView.classList.add("hidden");
  authView.classList.remove("hidden");
  authForm.reset();
}

// ============================================================
// 2. 初始化应用数据
// ============================================================

/**
 * 用户登录后初始化：加载分类 + 笔记
 */
async function initAppData() {
  currentNoteId = null;
  currentCategoryId = "";
  currentFilter = "all";
  searchKeyword = "";
  searchInput.value = "";
  filterTabs.forEach((t) => t.classList.toggle("active", t.dataset.filter === "all"));
  showEmptyEditor();

  await loadCategories();
  await loadNotes();
}

// ============================================================
// 3. 分类（categories）相关
// ============================================================

/**
 * 从数据库加载所有分类，并渲染到侧边栏 + 编辑器下拉框
 */
async function loadCategories() {
  const { data, error } = await supabaseClient
    .from("categories")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("加载分类失败:", error.message);
    return;
  }

  categories = data || [];
  renderCategoryList();
  renderCategorySelect();
}

/**
 * 渲染侧边栏分类列表
 */
function renderCategoryList() {
  // 清空除"全部分类"以外的项
  categoryList.innerHTML = "";

  // "全部分类" 项
  const allItem = document.createElement("li");
  allItem.className = "category-item" + (currentCategoryId === "" ? " active" : "");
  allItem.dataset.id = "";
  allItem.textContent = "全部分类";
  allItem.addEventListener("click", () => selectCategory(""));
  categoryList.appendChild(allItem);

  // 用户自定义分类
  categories.forEach((cat) => {
    const li = document.createElement("li");
    li.className = "category-item" + (currentCategoryId === cat.id ? " active" : "");
    li.dataset.id = cat.id;

    const nameSpan = document.createElement("span");
    nameSpan.textContent = cat.name;
    nameSpan.style.flex = "1";
    nameSpan.style.overflow = "hidden";
    nameSpan.style.textOverflow = "ellipsis";
    nameSpan.style.whiteSpace = "nowrap";

    const delBtn = document.createElement("span");
    delBtn.className = "delete-cat-btn";
    delBtn.textContent = "✕";
    delBtn.title = "删除分类";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteCategory(cat.id, cat.name);
    });

    li.appendChild(nameSpan);
    li.appendChild(delBtn);
    li.addEventListener("click", () => selectCategory(cat.id));
    categoryList.appendChild(li);
  });
}

/**
 * 渲染编辑器内的分类下拉选择框
 */
function renderCategorySelect() {
  noteCategorySelect.innerHTML = '<option value="">未分类</option>';
  categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = cat.name;
    noteCategorySelect.appendChild(opt);
  });
}

/**
 * 选中某个分类进行筛选
 */
function selectCategory(categoryId) {
  currentCategoryId = categoryId;
  renderCategoryList();
  renderNotesList();
}

/**
 * 打开"新建分类"弹窗
 */
addCategoryBtn.addEventListener("click", () => {
  categoryNameInput.value = "";
  categoryModal.classList.remove("hidden");
  categoryNameInput.focus();
});

categoryCancelBtn.addEventListener("click", () => {
  categoryModal.classList.add("hidden");
});

categoryModal.addEventListener("click", (e) => {
  if (e.target === categoryModal) categoryModal.classList.add("hidden");
});

categoryConfirmBtn.addEventListener("click", createCategory);
categoryNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") createCategory();
});

/**
 * 创建新分类
 */
async function createCategory() {
  const name = categoryNameInput.value.trim();
  if (!name) return;

  const { data, error } = await supabaseClient
    .from("categories")
    .insert({ name, user_id: currentUser.id })
    .select()
    .single();

  if (error) {
    alert("创建分类失败: " + error.message);
    return;
  }

  categories.push(data);
  renderCategoryList();
  renderCategorySelect();
  categoryModal.classList.add("hidden");
}

/**
 * 删除分类（笔记的 category_id 会被设为 null，由数据库 ON DELETE SET NULL 处理）
 */
async function deleteCategory(categoryId, categoryName) {
  if (!confirm(`确定删除分类"${categoryName}"吗？该分类下的笔记将变为未分类。`)) return;

  const { error } = await supabaseClient
    .from("categories")
    .delete()
    .eq("id", categoryId);

  if (error) {
    alert("删除分类失败: " + error.message);
    return;
  }

  categories = categories.filter((c) => c.id !== categoryId);

  // 受影响的本地笔记缓存同步更新
  notes.forEach((n) => {
    if (n.category_id === categoryId) n.category_id = null;
  });

  if (currentCategoryId === categoryId) currentCategoryId = "";

  renderCategoryList();
  renderCategorySelect();
  renderNotesList();

  // 若当前编辑的笔记属于被删分类，更新其下拉框显示
  if (currentNoteId) {
    const note = notes.find((n) => n.id === currentNoteId);
    if (note) noteCategorySelect.value = note.category_id || "";
  }
}

// ============================================================
// 4. 笔记（notes）相关 - 加载与列表渲染
// ============================================================

/**
 * 从数据库加载所有笔记（按最近编辑排序）
 */
async function loadNotes() {
  const { data, error } = await supabaseClient
    .from("notes")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("加载笔记失败:", error.message);
    return;
  }

  notes = data || [];
  renderNotesList();
}

/**
 * 根据当前筛选条件（分类 / 收藏 / 搜索）渲染笔记列表
 */
function renderNotesList() {
  let filtered = [...notes];

  // 分类筛选
  if (currentCategoryId) {
    filtered = filtered.filter((n) => n.category_id === currentCategoryId);
  }

  // 收藏筛选
  if (currentFilter === "favorite") {
    filtered = filtered.filter((n) => n.is_favorite);
  }

  // 搜索筛选（标题或内容包含关键词，忽略大小写）
  if (searchKeyword) {
    const kw = searchKeyword.toLowerCase();
    filtered = filtered.filter((n) => {
      const titleMatch = (n.title || "").toLowerCase().includes(kw);
      const contentText = stripHtml(n.content || "").toLowerCase();
      const contentMatch = contentText.includes(kw);
      return titleMatch || contentMatch;
    });
  }

  // 始终按最近编辑排序
  filtered.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  notesList.innerHTML = "";

  if (filtered.length === 0) {
    const hint = document.createElement("div");
    hint.className = "note-empty-hint";
    hint.textContent = searchKeyword ? "没有找到匹配的笔记" : "暂无笔记";
    notesList.appendChild(hint);
    return;
  }

  filtered.forEach((note) => {
    const li = document.createElement("li");
    li.className = "note-item" + (note.id === currentNoteId ? " active" : "");
    li.dataset.id = note.id;

    const titleDiv = document.createElement("div");
    titleDiv.className = "note-item-title";
    titleDiv.innerHTML = `${note.is_favorite ? "⭐ " : ""}${escapeHtml(note.title || "无标题笔记")}`;

    const previewDiv = document.createElement("div");
    previewDiv.className = "note-item-preview";
    previewDiv.textContent = stripHtml(note.content || "") || "无内容";

    const metaDiv = document.createElement("div");
    metaDiv.className = "note-item-meta";
    metaDiv.textContent = formatDate(note.updated_at);

    li.appendChild(titleDiv);
    li.appendChild(previewDiv);
    li.appendChild(metaDiv);

    li.addEventListener("click", () => openNote(note.id));
    notesList.appendChild(li);
  });
}

/**
 * 去除 HTML 标签，获取纯文本（用于搜索 / 预览）
 */
function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").trim();
}

/**
 * HTML 转义，防止注入
 */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * 格式化日期为简短可读形式
 */
function formatDate(isoStr) {
  const date = new Date(isoStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 7) return `${diffDay} 天前`;

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================
// 5. 搜索 / 筛选 Tab
// ============================================================

let searchDebounceTimer = null;
searchInput.addEventListener("input", (e) => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    searchKeyword = e.target.value.trim();
    renderNotesList();
  }, 250);
});

filterTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    filterTabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentFilter = tab.dataset.filter;
    renderNotesList();
  });
});

// ============================================================
// 6. 笔记编辑器 - 打开 / 新建 / 自动保存 / 删除 / 收藏
// ============================================================

/**
 * 显示空状态（未选中任何笔记）
 */
function showEmptyEditor() {
  currentNoteId = null;
  editor.classList.add("hidden");
  emptyState.classList.remove("hidden");
}

/**
 * 打开指定笔记进行编辑
 */
function openNote(noteId) {
  const note = notes.find((n) => n.id === noteId);
  if (!note) return;

  currentNoteId = noteId;

  emptyState.classList.add("hidden");
  editor.classList.remove("hidden");

  noteTitleInput.value = note.title || "";
  noteContent.innerHTML = note.content || "";
  noteCategorySelect.value = note.category_id || "";
  updateFavoriteUI(note.is_favorite);
  setSaveStatus("已保存");

  // 高亮选中的列表项
  renderNotesList();
}

/**
 * 更新收藏按钮的 UI 状态
 */
function updateFavoriteUI(isFavorite) {
  if (isFavorite) {
    favoriteBtn.textContent = "★";
    favoriteBtn.classList.add("active");
    favoriteBtn.title = "取消收藏";
  } else {
    favoriteBtn.textContent = "☆";
    favoriteBtn.classList.remove("active");
    favoriteBtn.title = "收藏";
  }
}

/**
 * 新建笔记按钮
 */
newNoteBtn.addEventListener("click", async () => {
  const newNote = {
    user_id: currentUser.id,
    title: "无标题笔记",
    content: "",
    category_id: currentCategoryId || null,
    is_favorite: false,
  };

  const { data, error } = await supabaseClient
    .from("notes")
    .insert(newNote)
    .select()
    .single();

  if (error) {
    alert("创建笔记失败: " + error.message);
    return;
  }

  notes.unshift(data);
  renderNotesList();
  openNote(data.id);
  noteTitleInput.focus();
});

/**
 * 删除当前笔记
 */
deleteNoteBtn.addEventListener("click", async () => {
  if (!currentNoteId) return;
  if (!confirm("确定要删除这篇笔记吗？此操作不可恢复。")) return;

  const { error } = await supabaseClient
    .from("notes")
    .delete()
    .eq("id", currentNoteId);

  if (error) {
    alert("删除失败: " + error.message);
    return;
  }

  notes = notes.filter((n) => n.id !== currentNoteId);
  showEmptyEditor();
  renderNotesList();
});

/**
 * 切换收藏状态
 */
favoriteBtn.addEventListener("click", async () => {
  if (!currentNoteId) return;
  const note = notes.find((n) => n.id === currentNoteId);
  if (!note) return;

  const newFavorite = !note.is_favorite;

  const { error } = await supabaseClient
    .from("notes")
    .update({ is_favorite: newFavorite })
    .eq("id", currentNoteId)
    .select()
    .single();

  if (error) {
    alert("更新收藏状态失败: " + error.message);
    return;
  }

  note.is_favorite = newFavorite;
  note.updated_at = new Date().toISOString();
  updateFavoriteUI(newFavorite);
  renderNotesList();
});

/**
 * 切换笔记分类
 */
noteCategorySelect.addEventListener("change", () => {
  if (!currentNoteId) return;
  scheduleAutoSave();
});

/**
 * 标题 / 内容输入 -> 触发自动保存（debounce）
 */
noteTitleInput.addEventListener("input", scheduleAutoSave);
noteContent.addEventListener("input", scheduleAutoSave);

/**
 * 安排一次自动保存（防抖：停止输入 N 毫秒后才真正保存）
 */
function scheduleAutoSave() {
  if (!currentNoteId) return;
  setSaveStatus("正在编辑...");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCurrentNote, SAVE_DEBOUNCE_MS);
}

/**
 * 实际执行保存到 Supabase
 */
async function saveCurrentNote() {
  if (!currentNoteId) return;

  const note = notes.find((n) => n.id === currentNoteId);
  if (!note) return;

  const title = noteTitleInput.value.trim() || "无标题笔记";
  const content = noteContent.innerHTML;
  const categoryId = noteCategorySelect.value || null;

  setSaveStatus("保存中...", "saving");

  const { data, error } = await supabaseClient
    .from("notes")
    .update({
      title,
      content,
      category_id: categoryId,
    })
    .eq("id", currentNoteId)
    .select()
    .single();

  if (error) {
    setSaveStatus("保存失败", "error");
    console.error("保存失败:", error.message);
    return;
  }

  // 更新本地缓存
  note.title = data.title;
  note.content = data.content;
  note.category_id = data.category_id;
  note.updated_at = data.updated_at;

  setSaveStatus("已保存");
  renderNotesList();
}

/**
 * 更新保存状态提示文字
 */
function setSaveStatus(text, className) {
  saveStatus.textContent = text;
  saveStatus.classList.remove("saving", "error");
  if (className) saveStatus.classList.add(className);
}

// ============================================================
// 7. 富文本工具栏（execCommand）
// ============================================================

rteToolbar.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-cmd]");
  if (!btn) return;

  const cmd = btn.dataset.cmd;
  const value = btn.dataset.value || null;

  noteContent.focus();
  document.execCommand(cmd, false, value);

  // 内容变化，触发自动保存
  scheduleAutoSave();
});

// ============================================================
// 8. 页面离开前，确保未保存内容被保存
// ============================================================
window.addEventListener("beforeunload", () => {
  if (saveTimer) {
    clearTimeout(saveTimer);
    // 同步式发请求已不可行，浏览器卸载前异步请求可能被取消。
    // 此处尽力发起保存请求（best-effort）。
    saveCurrentNote();
  }
});
