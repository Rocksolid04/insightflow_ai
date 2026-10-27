import { useCallback, useEffect, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import {
  Activity, ArrowRight, BarChart3, CheckCircle2, ChevronRight, CircleHelp,
  Database, Download, FileSpreadsheet, FileText, LayoutDashboard, LoaderCircle,
  LogOut, MessageSquare, Paperclip, Plus, Send, ShieldCheck, Sparkles, Table2,
  Upload, X, Server, History, FileBarChart2, Trash2, Play, RefreshCw,
  Code2, Pencil,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import {
  apiClient, getErrorMessage, type AnalysisResponse, type Dataset,
  type DatasetPreview, type DatasetProfile, type DatabaseConnection,
  type DatabaseSchema, type Conversation, type ConversationMessage,
} from "./api";
import "./App.css";

type Section = "overview" | "datasets" | "connections" | "analyst" | "reports";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function displayValue(value: unknown): string {
  if (value == null) return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("ai_analyst_token") || "");
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(token));
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [section, setSection] = useState<Section>("overview");
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [notice, setNotice] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<number | null>(null);
  const [databaseSchema, setDatabaseSchema] = useState<DatabaseSchema | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const [connectionForm, setConnectionForm] = useState({ name: "", host: "", port: "5432", database_name: "", username: "", password: "" });
  const [connectionSaving, setConnectionSaving] = useState(false);
  const [connectionAction, setConnectionAction] = useState("");
  const [dbQuestion, setDbQuestion] = useState("");
  const [dbAnalysis, setDbAnalysis] = useState<AnalysisResponse | null>(null);
  const [dbSql, setDbSql] = useState("SELECT * FROM public.your_table LIMIT 20;");
  const [dbQueryResult, setDbQueryResult] = useState<{ columns?: string[]; rows?: Record<string, unknown>[]; row_count?: number; truncated?: boolean } | null>(null);
  const [databaseTableProfile, setDatabaseTableProfile] = useState<Record<string, unknown> | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportResult, setReportResult] = useState<AnalysisResponse | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [activeMessages, setActiveMessages] = useState<ConversationMessage[]>([]);

  const selectedDataset = datasets.find((item) => item.id === selectedId) ?? null;

  const loadDatasets = useCallback(async () => {
    setLoadingDatasets(true);
    try {
      const result = await apiClient.listDatasets();
      setDatasets(result);
      setSelectedId((current) => current !== null && result.some((item) => item.id === current)
        ? current : result[0]?.id ?? null);
    } catch (error) {
      setNotice(getErrorMessage(error));
    } finally {
      setLoadingDatasets(false);
    }
  }, []);

  const loadConnections = useCallback(async () => {
    try {
      const result = await apiClient.listDatabaseConnections();
      setConnections(result);
      setSelectedConnectionId((current) => current !== null && result.some((item) => item.id === current) ? current : result[0]?.id ?? null);
    } catch (error) {
      setNotice(getErrorMessage(error));
    }
  }, []);

  const loadConversations = useCallback(async () => {
    try { setConversations(await apiClient.listConversations()); }
    catch (error) { setNotice(getErrorMessage(error)); }
  }, []);

  useEffect(() => {
    if (!token) return;
    let active = true;
    async function initialize() {
      try {
        const currentUser = await apiClient.me();
        if (!active) return;
        setUser(currentUser);
        await Promise.all([loadDatasets(), loadConnections(), loadConversations()]);
      } catch {
        if (!active) return;
        localStorage.removeItem("ai_analyst_token");
        setToken("");
        setUser(null);
      } finally {
        if (active) setAuthLoading(false);
      }
    }
    void initialize();
    return () => { active = false; };
  }, [token, loadDatasets, loadConnections, loadConversations]);

  useEffect(() => {
    if (!token || selectedId === null) return;
    const datasetId = selectedId;
    let active = true;
    async function loadSelectedDatasetData() {
      setLoadingPreview(true);
      setLoadingProfile(true);
      setPreview(null);
      setProfile(null);
      if (!conversations.some((item) => item.id === activeConversationId && item.dataset_id === datasetId)) {
        setAnalysis(null);
        setAnalysisError("");
      }
      try {
        const result = await apiClient.previewDataset(datasetId);
        if (active) setPreview(result);
      } catch (error) {
        if (active) setNotice(getErrorMessage(error));
      } finally {
        if (active) setLoadingPreview(false);
      }
      try {
        const result = await apiClient.profileDataset(datasetId);
        if (active) setProfile(result);
      } catch (error) {
        if (active) setNotice(getErrorMessage(error));
      } finally {
        if (active) setLoadingProfile(false);
      }
    }
    void loadSelectedDatasetData();
    return () => { active = false; };
  }, [token, selectedId, conversations, activeConversationId]);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAuthError(""); setAuthSubmitting(true);
    try {
      if (authMode === "register") await apiClient.register(email.trim(), password);
      const result = await apiClient.login(email.trim(), password);
      localStorage.setItem("ai_analyst_token", result.access_token);
      setToken(result.access_token);
      setUser(await apiClient.me());
      setPassword("");
      setNotice(authMode === "register" ? "Your account has been created." : "Welcome back.");
    } catch (error) {
      setAuthError(getErrorMessage(error));
    } finally {
      setAuthSubmitting(false);
    }
  }

  function logout() {
    localStorage.removeItem("ai_analyst_token");
    setToken(""); setUser(null); setDatasets([]); setSelectedId(null);
    setPreview(null); setProfile(null); setAnalysis(null); setPassword("");
    setNotice(""); setAuthLoading(false);
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    setUploadError(""); setUploading(true);
    try {
      const result = await apiClient.uploadDataset(file);
      await loadDatasets();
      setSelectedId(result.dataset_id); setSection("datasets"); setShowUpload(false);
      setNotice(`${result.filename} uploaded successfully.`);
    } catch (error) {
      setUploadError(getErrorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  async function handleAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedId === null || !question.trim()) return;
    const submittedQuestion = question.trim();
    setAsking(true); setAnalysis(null); setAnalysisError("");
    try {
      let conversationId = activeConversationId;
      if (!conversationId || !conversations.some((item) => item.id === conversationId && item.source_type === "dataset" && item.dataset_id === selectedId)) {
        const created = await apiClient.createConversation({ title: submittedQuestion.slice(0, 80), source_type: "dataset", dataset_id: selectedId });
        conversationId = created.id;
        setActiveConversationId(created.id);
        setConversations((current) => [created, ...current]);
      }
      await apiClient.appendConversationMessage(conversationId, { role: "user", content: submittedQuestion });
      const result = await apiClient.askDataset(selectedId, submittedQuestion);
      setAnalysis(result);
      await apiClient.appendConversationMessage(conversationId, {
        role: "assistant", content: result.answer, chart: result.chart ?? null,
        report: result.report ?? null, tool_calls: result.tool_calls ?? [],
        metadata: { question: submittedQuestion, report_error: result.report_error ?? null },
      });
      const refreshedConversation = await apiClient.getConversation(conversationId);
      setActiveMessages(refreshedConversation.messages);
      await loadConversations();
      setQuestion("");
    } catch (error) {
      setAnalysisError(getErrorMessage(error));
    } finally {
      setAsking(false);
    }
  }

  async function openConversation(id: number) {
    try {
      const conversation = await apiClient.getConversation(id);
      setActiveMessages(conversation.messages);
      setActiveConversationId(id);
      if (conversation.source_type === "dataset" && conversation.dataset_id) {
        setSelectedId(conversation.dataset_id);
        setSection("analyst");
        const assistantMessage = [...conversation.messages].reverse().find((item) => item.role === "assistant");
        const userMessage = [...conversation.messages].reverse().find((item) => item.role === "user");
        if (assistantMessage) setAnalysis({ answer: assistantMessage.content, question: String(assistantMessage.metadata?.question ?? userMessage?.content ?? ""), tool_calls: assistantMessage.tool_calls ?? [], chart: assistantMessage.chart ?? null, report: assistantMessage.report ?? null });
        if (userMessage) setQuestion(userMessage.content);
      } else if (conversation.source_type === "database" && conversation.connection_id) {
        setSelectedConnectionId(conversation.connection_id);
        setSection("connections");
        const assistantMessage = [...conversation.messages].reverse().find((item) => item.role === "assistant");
        if (assistantMessage) setDbAnalysis({ answer: assistantMessage.content, question: String(assistantMessage.metadata?.question ?? ""), tool_calls: assistantMessage.tool_calls ?? [], chart: assistantMessage.chart ?? null, report: assistantMessage.report ?? null });
      }
    } catch (error) { setNotice(getErrorMessage(error)); }
  }

  async function deleteConversation(id: number) {
    try {
      await apiClient.deleteConversation(id);
      setConversations((current) => current.filter((item) => item.id !== id));
      if (activeConversationId === id) { setActiveConversationId(null); setActiveMessages([]); setAnalysis(null); setDbAnalysis(null); }
    } catch (error) { setNotice(getErrorMessage(error)); }
  }

  async function handleGenerateReport() {
    if (selectedId === null) return;
    setReportLoading(true); setReportResult(null); setAnalysisError("");
    try {
      const result = await apiClient.generateDatasetReport(selectedId);
      setReportResult(result);
      let conversationId = activeConversationId;
      if (!conversationId || !conversations.some((item) => item.id === conversationId && item.source_type === "dataset" && item.dataset_id === selectedId)) {
        const created = await apiClient.createConversation({ title: `Full report — ${selectedDataset?.original_filename ?? "Dataset"}`, source_type: "dataset", dataset_id: selectedId });
        conversationId = created.id; setActiveConversationId(created.id);
      }
      await apiClient.appendConversationMessage(conversationId, { role: "user", content: "Generate a comprehensive full report" });
      await apiClient.appendConversationMessage(conversationId, { role: "assistant", content: result.answer, chart: result.chart ?? null, report: result.report ?? null, tool_calls: result.tool_calls ?? [], metadata: { full_report: true } });
      const refreshedConversation = await apiClient.getConversation(conversationId);
      setActiveMessages(refreshedConversation.messages);
      await loadConversations();
    } catch (error) { setAnalysisError(getErrorMessage(error)); }
    finally { setReportLoading(false); }
  }

  async function handleCreateConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setConnectionError(""); setConnectionSaving(true);
    try {
      const created = await apiClient.createDatabaseConnection({ ...connectionForm, port: Number(connectionForm.port) });
      setConnectionForm({ name: "", host: "", port: "5432", database_name: "", username: "", password: "" });
      await loadConnections(); setSelectedConnectionId(created.id); setNotice("Database connection saved. Test it before browsing data.");
    } catch (error) { setConnectionError(getErrorMessage(error)); }
    finally { setConnectionSaving(false); }
  }

  async function testConnection(id: number) {
    setConnectionAction(`test-${id}`); setConnectionError("");
    try {
      const result = await apiClient.testDatabaseConnection(id);
      setNotice(result.message); await loadConnections();
      if (result.success) setDatabaseSchema(await apiClient.getDatabaseSchema(id));
    } catch (error) { setConnectionError(getErrorMessage(error)); }
    finally { setConnectionAction(""); }
  }

  async function loadSchema(id: number) {
    setConnectionAction(`schema-${id}`); setConnectionError("");
    try { setDatabaseSchema(await apiClient.getDatabaseSchema(id)); setSelectedConnectionId(id); }
    catch (error) { setConnectionError(getErrorMessage(error)); }
    finally { setConnectionAction(""); }
  }

  async function handleDatabaseAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedConnectionId || !dbQuestion.trim()) return;
    setConnectionAction("ask"); setConnectionError(""); setDbAnalysis(null);
    try {
      const submitted = dbQuestion.trim();
      let conversationId = activeConversationId;
      if (!conversationId || !conversations.some((item) => item.id === conversationId && item.source_type === "database" && item.connection_id === selectedConnectionId)) {
        const created = await apiClient.createConversation({ title: submitted.slice(0, 80), source_type: "database", connection_id: selectedConnectionId });
        conversationId = created.id; setActiveConversationId(created.id);
      }
      await apiClient.appendConversationMessage(conversationId, { role: "user", content: submitted });
      const result = await apiClient.askDatabase(selectedConnectionId, submitted); setDbAnalysis(result);
      await apiClient.appendConversationMessage(conversationId, { role: "assistant", content: result.answer, chart: result.chart ?? null, report: result.report ?? null, tool_calls: result.tool_calls ?? [], metadata: { question: submitted } });
      const refreshedConversation = await apiClient.getConversation(conversationId);
      setActiveMessages(refreshedConversation.messages);
      await loadConversations(); setDbQuestion("");
    } catch (error) { setConnectionError(getErrorMessage(error)); }
    finally { setConnectionAction(""); }
  }

  async function runSqlQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedConnectionId) return;
    setConnectionAction("query"); setConnectionError(""); setDbQueryResult(null);
    try { setDbQueryResult(await apiClient.queryDatabase(selectedConnectionId, dbSql)); }
    catch (error) { setConnectionError(getErrorMessage(error)); }
    finally { setConnectionAction(""); }
  }

  async function handleExport(format: "csv" | "excel") {
    if (selectedId === null) return;
    try { await apiClient.exportDataset(selectedId, format); }
    catch (error) { setNotice(getErrorMessage(error)); }
  }

  if (authLoading) return <div className="full-loader"><LoaderCircle className="spin" size={30} /><p>Connecting to your workspace…</p></div>;

  if (!token || !user) return (
    <main className="auth-page">
      <section className="auth-brand"><div className="brand-mark"><BarChart3 size={25} /></div><span>InsightFlow</span><span className="brand-pill">AI DATA ANALYST</span></section>
      <section className="auth-card">
        <div className="auth-icon"><Sparkles size={24} /></div><p className="eyebrow">YOUR DATA, UNDERSTOOD</p>
        <h1>Turn data into<br /><span>clear decisions.</span></h1>
        <p className="auth-description">Upload your data, ask questions in plain English, and discover insights without writing queries.</p>
        <div className="auth-tabs">
          <button className={authMode === "login" ? "active" : ""} type="button" onClick={() => { setAuthMode("login"); setAuthError(""); }}>Sign in</button>
          <button className={authMode === "register" ? "active" : ""} type="button" onClick={() => { setAuthMode("register"); setAuthError(""); }}>Create account</button>
        </div>
        <form className="auth-form" onSubmit={handleAuthSubmit}>
          <label htmlFor="email">Email address</label><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" required />
          <label htmlFor="password">Password</label><input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" autoComplete={authMode === "login" ? "current-password" : "new-password"} required />
          {authError && <p className="error-message">{authError}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={authSubmitting}>{authSubmitting ? <LoaderCircle className="spin" size={17} /> : <>{authMode === "login" ? "Sign in" : "Create account"} <ArrowRight size={17} /></>}</button>
        </form>
        <p className="auth-footnote"><ShieldCheck size={15} /> Your datasets are accessible only to your authenticated account.</p>
      </section><p className="auth-copyright">InsightFlow · AI-powered data analysis</p>
    </main>
  );

  const totalBytes = datasets.reduce((total, item) => total + item.file_size_bytes, 0);
  const chart = analysis?.chart;
  const chartPoints = Array.isArray(chart?.points) ? chart.points : [];

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="sidebar-brand"><div className="brand-mark"><BarChart3 size={22} /></div><div><strong>InsightFlow</strong><span>AI DATA ANALYST</span></div></div>
      <p className="nav-label">WORKSPACE</p><nav className="side-nav">
        <button className={section === "overview" ? "nav-item active" : "nav-item"} onClick={() => setSection("overview")}><LayoutDashboard size={18} /> Overview</button>
        <button className={section === "datasets" ? "nav-item active" : "nav-item"} onClick={() => setSection("datasets")}><FileSpreadsheet size={18} /> My datasets <span className="nav-count">{datasets.length}</span></button>
        <button className={section === "connections" ? "nav-item active" : "nav-item"} onClick={() => setSection("connections")}><Server size={18} /> Database connections <span className="nav-count">{connections.length}</span></button>
        <button className={section === "analyst" ? "nav-item active" : "nav-item"} onClick={() => setSection("analyst")}><MessageSquare size={18} /> AI analyst</button>
        <button className={section === "reports" ? "nav-item active" : "nav-item"} onClick={() => setSection("reports")}><FileBarChart2 size={18} /> Full reports</button>
      </nav><div className="sidebar-spacer" />
      <div className="sidebar-help"><div className="help-icon"><CircleHelp size={18} /></div><strong>Need a starting point?</strong><p>Upload a CSV or Excel file to start exploring your data.</p><button onClick={() => setShowUpload(true)}>Upload a dataset <ArrowRight size={14} /></button></div>
      <div className="sidebar-user"><div className="avatar">{(user.email || "U").slice(0, 1).toUpperCase()}</div><div className="user-details"><strong>{user.email || "Your account"}</strong><span>Personal workspace</span></div><button className="icon-button logout-button" onClick={logout} title="Sign out"><LogOut size={17} /></button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs">Workspace <ChevronRight size={14} /><strong>{{ overview: "Overview", datasets: "My datasets", connections: "Database connections", analyst: "AI analyst", reports: "Full reports" }[section]}</strong></div><div className="topbar-actions"><span className="connection-status"><span className="status-dot" /> Workspace connected</span><button className="primary-button compact" onClick={() => setShowUpload(true)}><Plus size={17} /> Add dataset</button></div></header>
      {notice && <div className="notice-banner"><CheckCircle2 size={17} /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss notice"><X size={16} /></button></div>}

      {section === "overview" && <section className="page-content">
        <div className="page-heading"><div><p className="eyebrow">YOUR ANALYTICS WORKSPACE</p><h1>Good to see you again.</h1><p>Bring your data in. Ask better questions. Find your next move.</p></div><button className="primary-button" onClick={() => setShowUpload(true)}><Upload size={17} /> Upload data</button></div>
        <div className="welcome-banner"><div className="welcome-copy"><span className="welcome-kicker"><Sparkles size={15} /> YOUR AI ANALYST IS READY</span><h2>What story does your data tell?</h2><p>Explore patterns, investigate changes, and generate evidence-based reports using natural language.</p><button className="welcome-button" disabled={!datasets.length} onClick={() => setSection("analyst")}>Start analyzing <ArrowRight size={16} /></button></div><div className="welcome-art"><div className="art-ring ring-one" /><div className="art-ring ring-two" /><div className="art-center"><Activity size={34} /></div><div className="art-floating floating-one"><BarChart3 size={20} /></div><div className="art-floating floating-two"><Database size={19} /></div><div className="art-floating floating-three"><Sparkles size={19} /></div></div></div>
        <div className="section-title-row"><div><h2>Workspace at a glance</h2><p>A quick look at your uploaded data.</p></div><button className="text-button" onClick={() => setSection("datasets")}>View datasets <ArrowRight size={15} /></button></div>
        <div className="stats-grid">
          <article className="stat-card"><div className="stat-top"><span>Uploaded datasets</span><span className="stat-icon purple"><Database size={19} /></span></div><strong>{datasets.length}</strong><p>Files in your workspace</p></article>
          <article className="stat-card"><div className="stat-top"><span>Storage used</span><span className="stat-icon blue"><FileSpreadsheet size={19} /></span></div><strong>{formatBytes(totalBytes)}</strong><p>Across uploaded files</p></article>
          <article className="stat-card"><div className="stat-top"><span>Selected dataset</span><span className="stat-icon green"><Table2 size={19} /></span></div><strong className="stat-selected">{selectedDataset?.original_filename || "None yet"}</strong><p>{selectedDataset ? `${selectedDataset.file_type.toUpperCase()} file` : "Upload your first dataset"}</p></article>
        </div><div className="section-title-row"><div><h2>Recent datasets</h2><p>Your most recently uploaded files.</p></div></div>
        <DatasetTable datasets={datasets.slice(0, 5)} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setSection("datasets"); }} loading={loadingDatasets} />
      </section>}

      {section === "datasets" && <section className="page-content">
        <div className="page-heading"><div><p className="eyebrow">DATA MANAGEMENT</p><h1>My datasets</h1><p>Upload, preview, profile, and export your data.</p></div><button className="primary-button" onClick={() => setShowUpload(true)}><Plus size={17} /> Add dataset</button></div>
        <DatasetTable datasets={datasets} selectedId={selectedId} onSelect={setSelectedId} loading={loadingDatasets} />
        {selectedDataset && <div className="dataset-detail">
          <div className="detail-heading"><div className="detail-file-icon"><FileSpreadsheet size={23} /></div><div className="detail-file-copy"><h2>{selectedDataset.original_filename}</h2><p>{selectedDataset.file_type.toUpperCase()} · {formatBytes(selectedDataset.file_size_bytes)} · Uploaded {formatDate(selectedDataset.created_at)}</p></div><div className="detail-actions"><button className="secondary-button" onClick={() => void handleExport("csv")}><Download size={15} /> CSV</button><button className="secondary-button" onClick={() => void handleExport("excel")}><Download size={15} /> Excel</button><button className="primary-button compact" onClick={() => setSection("analyst")}><Sparkles size={16} /> Ask AI</button></div></div>
          <div className="detail-tabs"><span className="detail-tab active"><Table2 size={15} /> Data preview</span><span className="detail-tab"><BarChart3 size={15} /> Data profile</span></div>
          <div className="preview-section"><div className="preview-heading"><div><h3>First rows</h3><p>Showing the preview returned by your API.</p></div>{preview && <span className="subtle-badge">{preview.columns.length} columns</span>}</div>{loadingPreview ? <LoadingState text="Loading dataset preview…" /> : preview ? <DataTable preview={preview} /> : <EmptyState title="Preview unavailable" text="Check the API response or try selecting this dataset again." />}</div>
          <div className="profile-section"><div className="preview-heading"><div><h3>Data profile</h3><p>Summary statistics calculated from the dataset.</p></div>{profile && <span className="subtle-badge">{profile.row_count.toLocaleString()} rows</span>}</div>
            {loadingProfile ? <LoadingState text="Profiling dataset…" /> : profile ? <><div className="profile-stats"><div><span>Total rows</span><strong>{profile.row_count.toLocaleString()}</strong></div><div><span>Columns</span><strong>{profile.column_count}</strong></div><div><span>Duplicate rows</span><strong>{profile.duplicate_row_count.toLocaleString()}</strong></div></div><div className="table-scroll"><table><thead><tr><th>Column</th><th>Data type</th><th>Missing</th><th>Unique</th><th>Min</th><th>Max</th><th>Mean</th></tr></thead><tbody>{profile.columns.map((column) => <tr key={column.name}><td className="cell-strong">{column.name}</td><td><span className="type-badge">{column.data_type}</span></td><td>{column.null_count} ({column.null_percentage}%)</td><td>{column.distinct_count}</td><td>{displayValue(column.min)}</td><td>{displayValue(column.max)}</td><td>{displayValue(column.mean)}</td></tr>)}</tbody></table></div></> : <EmptyState title="Profile unavailable" text="Your data preview may still be available above." />}
          </div>
        </div>}
        {!selectedDataset && !loadingDatasets && <EmptyState title="Your workspace is ready" text="Upload a CSV or Excel file to see its preview and statistical profile here." action={<button className="primary-button" onClick={() => setShowUpload(true)}><Upload size={16} /> Upload dataset</button>} />}
      </section>}

      {section === "connections" && <section className="page-content">
        <div className="page-heading"><div><p className="eyebrow">LIVE DATA SOURCES</p><h1>Database connections</h1><p>Save PostgreSQL connections, inspect tables, preview data, run read-only SQL, or ask the analyst.</p></div></div>
        <div className="connection-layout">
          <div className="panel-card"><div className="panel-title"><Server size={18} /><div><h2>Add a connection</h2><p>Credentials are encrypted before they are stored.</p></div></div>
            <form className="connection-form" onSubmit={handleCreateConnection}>
              <label>Connection name<input required value={connectionForm.name} onChange={(e) => setConnectionForm({ ...connectionForm, name: e.target.value })} placeholder="Analytics warehouse" /></label>
              <div className="form-two"><label>Host<input required value={connectionForm.host} onChange={(e) => setConnectionForm({ ...connectionForm, host: e.target.value })} placeholder="db.example.com" /></label><label>Port<input required type="number" min="1" max="65535" value={connectionForm.port} onChange={(e) => setConnectionForm({ ...connectionForm, port: e.target.value })} /></label></div>
              <label>Database name<input required value={connectionForm.database_name} onChange={(e) => setConnectionForm({ ...connectionForm, database_name: e.target.value })} /></label>
              <label>Username<input required value={connectionForm.username} onChange={(e) => setConnectionForm({ ...connectionForm, username: e.target.value })} /></label>
              <label>Password<input required type="password" value={connectionForm.password} onChange={(e) => setConnectionForm({ ...connectionForm, password: e.target.value })} autoComplete="new-password" /></label>
              {connectionError && <p className="error-message">{connectionError}</p>}
              <button className="primary-button" type="submit" disabled={connectionSaving}>{connectionSaving ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Save connection</button>
            </form>
          </div>
          <div className="panel-card"><div className="panel-title"><Database size={18} /><div><h2>Saved connections</h2><p>{connections.length} saved source{connections.length === 1 ? "" : "s"}</p></div><button className="icon-button" title="Refresh connections" onClick={() => void loadConnections()}><RefreshCw size={16} /></button></div>
            {!connections.length ? <EmptyState title="No database connections" text="Add a PostgreSQL connection to browse live tables and query data." /> : <div className="connection-list">{connections.map((item) => <article key={item.id} className={selectedConnectionId === item.id ? "connection-item selected" : "connection-item"}><div className="connection-item-icon"><Database size={18} /></div><div className="connection-item-copy"><strong>{item.name}</strong><span>{item.username}@{item.host}:{item.port}/{item.database_name}</span><small className={item.is_active ? "success-text" : "muted-text"}>{item.is_active ? "Connection verified" : "Not tested"}</small></div><div className="connection-item-actions"><button className="secondary-button" onClick={() => void testConnection(item.id)} disabled={connectionAction !== ""}>{connectionAction === `test-${item.id}` ? <LoaderCircle className="spin" size={14} /> : <CheckCircle2 size={14} />} Test</button><button className="secondary-button" onClick={() => void loadSchema(item.id)} disabled={connectionAction !== ""}><Table2 size={14} /> Browse</button><button className="icon-button danger-button" title="Delete connection" onClick={async () => { if (confirm(`Delete connection '${item.name}'?`)) { try { await apiClient.deleteDatabaseConnection(item.id); setConnections((current) => current.filter((c) => c.id !== item.id)); if (selectedConnectionId === item.id) { setSelectedConnectionId(null); setDatabaseSchema(null); } } catch (error) { setConnectionError(getErrorMessage(error)); } } }}><Trash2 size={15} /></button></div></article>)}</div>}
          </div>
        </div>
        {databaseSchema && <div className="panel-card schema-panel"><div className="panel-title"><Table2 size={18} /><div><h2>{databaseSchema.connection_name} · Schema explorer</h2><p>{databaseSchema.table_count} tables and views available</p></div></div><div className="schema-grid">{databaseSchema.tables.map((table) => <article className="schema-table" key={`${table.schema}.${table.name}`}><div className="schema-table-title"><div><strong>{table.schema}.{table.name}</strong><span>{table.columns.length} columns · {table.type.toLowerCase()}</span></div><div className="schema-table-actions"><button className="secondary-button" onClick={async () => { if (selectedConnectionId) { try { const result = await apiClient.previewDatabaseTable(selectedConnectionId, table.schema, table.name); const rows = result.rows ?? result.data ?? []; setDbQueryResult({ columns: result.columns ?? (rows[0] ? Object.keys(rows[0]) : []), rows, row_count: result.row_count ?? rows.length }); } catch (error) { setConnectionError(getErrorMessage(error)); } } }}><Play size={13} /> Preview</button><button className="secondary-button" onClick={async () => { if (selectedConnectionId) { try { setDatabaseTableProfile(await apiClient.profileDatabaseTable(selectedConnectionId, table.schema, table.name)); } catch (error) { setConnectionError(getErrorMessage(error)); } } }}><BarChart3 size={13} /> Profile</button></div></div><div className="schema-columns">{table.columns.map((column) => <div key={column.name}><span>{column.name}</span><small>{column.data_type}</small></div>)}</div></article>)}</div></div>}
        {databaseTableProfile && <div className="panel-card schema-panel"><div className="panel-title"><BarChart3 size={18} /><div><h2>Table profile</h2><p>Statistical summary returned by the connected database.</p></div><button className="icon-button" title="Close profile" onClick={() => setDatabaseTableProfile(null)}><X size={16} /></button></div><pre className="profile-json">{JSON.stringify(databaseTableProfile, null, 2)}</pre></div>}
        {selectedConnectionId && <div className="database-tools-grid">
          <div className="panel-card"><div className="panel-title"><Sparkles size={18} /><div><h2>Ask your database</h2><p>Natural-language answers backed by read-only database tools.</p></div></div><form className="db-ask-form" onSubmit={handleDatabaseAsk}><textarea value={dbQuestion} onChange={(e) => setDbQuestion(e.target.value)} rows={3} placeholder="Which tables have the highest order volume?" /><button className="primary-button" type="submit" disabled={!dbQuestion.trim() || connectionAction !== ""}>{connectionAction === "ask" ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />} Ask AI</button></form>{dbAnalysis && <div className="db-answer">{activeMessages.slice(0, Math.max(0, activeMessages.length - 2)).map((message, index) => <div className={message.role === "user" ? "history-message user-history-message" : "history-message"} key={`db-history-${activeConversationId}-${index}`}><span>{message.role === "user" ? "You asked" : "Previous analysis"}</span>{message.role === "assistant" ? <MarkdownContent text={message.content} /> : <p>{message.content}</p>}</div>)}<MarkdownContent text={dbAnalysis.answer} />{dbAnalysis.chart && <ChartView chart={dbAnalysis.chart as unknown as { chart_type?: string; title?: string; x_column?: string; y_column?: string | null; data?: Record<string, unknown>[] }} />}{dbAnalysis.tool_calls?.length > 0 && <details className="tool-details"><summary><Activity size={14} /> Analysis steps ({dbAnalysis.tool_calls.length})</summary><pre>{JSON.stringify(dbAnalysis.tool_calls, null, 2)}</pre></details>}</div>}</div>
          <div className="panel-card"><div className="panel-title"><Code2 size={18} /><div><h2>Read-only SQL runner</h2><p>Only validated read-only queries are allowed by the API.</p></div></div><form className="sql-form" onSubmit={runSqlQuery}><textarea value={dbSql} onChange={(e) => setDbSql(e.target.value)} rows={5} spellCheck={false} /><button className="primary-button" type="submit" disabled={connectionAction !== ""}>{connectionAction === "query" ? <LoaderCircle className="spin" size={16} /> : <Play size={15} />} Run query</button></form>{dbQueryResult && <div className="query-result"><div className="query-result-toolbar"><div className="query-result-meta">{dbQueryResult.row_count ?? dbQueryResult.rows?.length ?? 0} rows returned{dbQueryResult.truncated ? " · results truncated" : ""}</div><button className="secondary-button" onClick={() => selectedConnectionId && void apiClient.exportDatabaseQuery(selectedConnectionId, dbSql).catch((error) => setConnectionError(getErrorMessage(error)))}><Download size={14} /> Export CSV</button></div><GenericTable columns={dbQueryResult.columns ?? (dbQueryResult.rows?.[0] ? Object.keys(dbQueryResult.rows[0]) : [])} rows={dbQueryResult.rows ?? []} /></div>}</div>
        </div>}
      </section>}

      {section === "reports" && <section className="page-content">
        <div className="page-heading"><div><p className="eyebrow">EVIDENCE-FIRST REPORTING</p><h1>Full reports</h1><p>Generate a structured analysis covering data quality, statistics, trends, anomalies, findings, and recommendations.</p></div></div>
        {!datasets.length ? <EmptyState title="Upload data to create a report" text="A full report needs a dataset to analyze." action={<button className="primary-button" onClick={() => setShowUpload(true)}><Upload size={16} /> Upload dataset</button>} /> : <div className="report-workspace"><div className="panel-card report-controls"><div className="panel-title"><FileBarChart2 size={19} /><div><h2>Report source</h2><p>Choose the dataset you want to investigate.</p></div></div><label className="field-label" htmlFor="report-dataset">Dataset</label><select id="report-dataset" value={selectedId ?? ""} onChange={(e) => { setSelectedId(Number(e.target.value)); setReportResult(null); }} className="report-select">{datasets.map((item) => <option key={item.id} value={item.id}>{item.original_filename}</option>)}</select>{selectedDataset && <div className="report-source-summary"><FileSpreadsheet size={22} /><div><strong>{selectedDataset.original_filename}</strong><span>{formatBytes(selectedDataset.file_size_bytes)} · {profile?.row_count?.toLocaleString() ?? "—"} rows in profile</span></div></div>}<button className="primary-button report-generate" onClick={() => void handleGenerateReport()} disabled={reportLoading || selectedId === null}>{reportLoading ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />} Generate full report</button><p className="subtle-note">The report uses analytical tool results as evidence. Unsupported conclusions should be marked as limitations.</p>{analysisError && <p className="error-message">{analysisError}</p>}</div><div className="panel-card full-report-result">{reportLoading ? <LoadingState text="Profiling the data and gathering evidence before writing the report…" /> : reportResult?.report ? <><ReportView report={reportResult.report} answer={reportResult.answer} />{reportResult.chart && <ChartView chart={reportResult.chart} />}{reportResult.tool_calls?.length > 0 && <details className="tool-details"><summary><Activity size={14} /> Evidence collected ({reportResult.tool_calls.length} steps)</summary><pre>{JSON.stringify(reportResult.tool_calls, null, 2)}</pre></details>}</> : <EmptyState title="Your report will appear here" text="Generate a report to see an executive summary, findings, trend analysis, data-quality notes, recommendations, and limitations." />}</div></div>}
      </section>}

      {section === "analyst" && <section className="page-content analyst-page">
        <div className="page-heading"><div><p className="eyebrow">NATURAL LANGUAGE ANALYTICS</p><h1>AI analyst</h1><p>Ask questions about your data. Get answers backed by analytical tools.</p></div><button className="secondary-button" onClick={() => { setActiveConversationId(null); setActiveMessages([]); setAnalysis(null); setQuestion(""); }}><Plus size={15} /> New chat</button></div>
        <div className="history-strip"><div className="history-strip-title"><History size={16} /><strong>Recent conversations</strong><span>{conversations.length}</span></div>{conversations.slice(0, 5).map((item) => <div className={activeConversationId === item.id ? "history-chip active" : "history-chip"} key={item.id}><button onClick={() => void openConversation(item.id)} title={item.title}>{item.title}</button><button className="history-delete" title="Rename conversation" onClick={async () => { const title = prompt("Rename this conversation", item.title); if (title?.trim()) { try { await apiClient.renameConversation(item.id, title.trim()); await loadConversations(); } catch (error) { setNotice(getErrorMessage(error)); } } }}><Pencil size={12} /></button><button className="history-delete" title="Delete conversation" onClick={() => void deleteConversation(item.id)}><Trash2 size={12} /></button></div>)}</div>
        {datasets.length ? <div className="analyst-workspace">
          <aside className="analyst-context"><div className="context-header"><Database size={17} /> ACTIVE DATASET</div><label htmlFor="dataset-select">Analyze data from</label><select id="dataset-select" value={selectedId ?? ""} onChange={(e) => setSelectedId(Number(e.target.value))}>{datasets.map((item) => <option value={item.id} key={item.id}>{item.original_filename}</option>)}</select>{selectedDataset && <div className="context-file"><div className="file-icon-small"><FileSpreadsheet size={20} /></div><div><strong>{selectedDataset.original_filename}</strong><span>{formatBytes(selectedDataset.file_size_bytes)}</span></div></div>}{profile && <div className="context-metrics"><div><span>Rows</span><strong>{profile.row_count.toLocaleString()}</strong></div><div><span>Columns</span><strong>{profile.column_count}</strong></div></div>}<div className="context-divider" /><p className="context-tip"><Sparkles size={16} /> Try asking about trends, outliers, relationships, or a summary of the data.</p></aside>
          <div className="analyst-chat"><div className="chat-header"><div className="chat-avatar"><Sparkles size={19} /></div><div><strong>Data Analyst Agent</strong><span><span className="status-dot" /> Ready to analyze</span></div></div>
            <div className="chat-body">
              {activeMessages.slice(0, Math.max(0, activeMessages.length - 2)).map((message, index) => <div className={message.role === "user" ? "history-message user-history-message" : "history-message"} key={`${activeConversationId}-${index}`}><span>{message.role === "user" ? "You asked" : "Previous analysis"}</span>{message.role === "assistant" ? <MarkdownContent text={message.content} /> : <p>{message.content}</p>}{message.role === "assistant" && message.chart && <ChartView chart={message.chart} />}</div>)}
              {!analysis && !asking && !analysisError && <div className="chat-welcome"><div className="chat-welcome-icon"><Sparkles size={25} /></div><h2>Let's explore your data.</h2><p>Ask a question below. I'll use your dataset to find evidence and explain the results.</p><div className="suggestion-grid">{["Give me an overview of this dataset", "What are the key trends?", "Are there any unusual values?", "Create a comprehensive report"].map((item) => <button key={item} onClick={() => setQuestion(item)}><MessageSquare size={15} /> {item} <ArrowRight size={14} /></button>)}</div></div>}
              {asking && <LoadingState text="Analyzing your data. This may take a moment…" />}
              {analysisError && <div className="analysis-error"><CircleHelp size={20} /><div><strong>Analysis could not be completed</strong><p>{analysisError}</p></div><button className="secondary-button" onClick={() => setAnalysisError("")}>Dismiss</button></div>}
              {analysis && <div className="analysis-result"><div className="question-bubble"><span>You asked</span>{analysis.question || question}</div><div className="answer-heading"><div className="chat-avatar small"><Sparkles size={15} /></div><strong>Analysis</strong></div><div className="answer-content"><MarkdownContent text={analysis.answer} /></div>
                {chart && chartPoints.length > 0 && <ChartView chart={chart} />}
                {analysis.report && <ReportView report={analysis.report} answer={analysis.answer} />}
                {analysis.report_error && !analysis.report && <p className="inline-warning">The answer is available, but report generation failed: {analysis.report_error}</p>}
                {analysis.tool_calls.length > 0 && <details className="tool-details"><summary><Activity size={15} /> Analysis steps ({analysis.tool_calls.length})</summary><pre>{JSON.stringify(analysis.tool_calls, null, 2)}</pre></details>}
              </div>}
            </div>
            <form className="chat-composer" onSubmit={handleAsk}><textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask anything about your dataset…" rows={2} maxLength={500} disabled={asking || selectedId === null} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} /><div className="composer-bottom"><span><Paperclip size={14} /> {selectedDataset?.original_filename || "Select a dataset"} · Enter to send</span><button className="primary-button send-button" type="submit" disabled={asking || !question.trim()}>{asking ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />} Ask AI</button></div></form>
          </div>
        </div> : <div className="analyst-empty"><div className="empty-icon"><Database size={27} /></div><h2>First, bring in your data.</h2><p>Upload a CSV or Excel file to start asking questions.</p><button className="primary-button" onClick={() => setShowUpload(true)}><Upload size={16} /> Upload dataset</button></div>}
      </section>}
    </main>

    {showUpload && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowUpload(false); }}><div className="upload-modal"><div className="modal-heading"><div><span className="eyebrow">ADD TO WORKSPACE</span><h2>Upload a dataset</h2></div><button className="icon-button" onClick={() => setShowUpload(false)} aria-label="Close upload dialog"><X size={19} /></button></div><p className="modal-description">Choose a CSV or Excel file. Maximum file size: 10 MB.</p><label className="dropzone"><div className="dropzone-icon"><Upload size={24} /></div><strong>{uploading ? "Uploading your dataset…" : "Choose a file to upload"}</strong><span>CSV or XLSX · Up to 10 MB</span><input type="file" accept=".csv,.xlsx" onChange={(e) => void handleUpload(e)} disabled={uploading} />{uploading && <LoaderCircle className="spin" size={19} />}</label>{uploadError && <p className="error-message">{uploadError}</p>}<div className="upload-note"><ShieldCheck size={16} /><span>Your uploaded file is associated with your account.</span></div></div></div>}
  </div>;
}

function DatasetTable({ datasets, selectedId, onSelect, loading }: {
  datasets: Dataset[]; selectedId: number | null; onSelect: (id: number) => void; loading: boolean;
}) {
  if (loading) return <LoadingState text="Loading datasets…" />;
  if (!datasets.length) return <EmptyState title="No datasets yet" text="Upload a CSV or Excel file to begin exploring your data." />;
  return <div className="data-table-card"><div className="table-scroll"><table><thead><tr><th>Dataset</th><th>Format</th><th>File size</th><th>Uploaded</th><th>Status</th><th /></tr></thead><tbody>{datasets.map((item) => <tr key={item.id} className={selectedId === item.id ? "selected-row" : ""} onClick={() => onSelect(item.id)}><td><div className="dataset-name-cell"><div className="table-file-icon"><FileSpreadsheet size={18} /></div><div><strong>{item.original_filename}</strong><span>Dataset #{item.id}</span></div></div></td><td><span className="type-badge">{item.file_type.toUpperCase()}</span></td><td>{formatBytes(item.file_size_bytes)}</td><td>{formatDate(item.created_at)}</td><td><span className="status-badge"><span className="status-dot" /> Available</span></td><td><button className="icon-button row-open" title="Open dataset" onClick={(e) => { e.stopPropagation(); onSelect(item.id); }}><ChevronRight size={17} /></button></td></tr>)}</tbody></table></div></div>;
}
function DataTable({ preview }: { preview: DatasetPreview }) {
  if (!preview.columns.length || !preview.preview.length) return <EmptyState title="No rows to display" text="The dataset may be empty or contain only headers." />;
  return <div className="table-scroll preview-table"><table><thead><tr>{preview.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{preview.preview.map((row, index) => <tr key={index}>{preview.columns.map((column) => <td key={column} title={displayValue(row[column])}>{displayValue(row[column])}</td>)}</tr>)}</tbody></table><div className="table-footer">Previewing {preview.row_count} row(s) · {preview.columns.length} columns</div></div>;
}
function LoadingState({ text }: { text: string }) {
  return <div className="loading-state"><LoaderCircle className="spin" size={20} /><span>{text}</span></div>;
}
function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><FileSpreadsheet size={24} /></div><h3>{title}</h3><p>{text}</p>{action}</div>;
}
function MarkdownContent({ text }: { text: string }) {
  const lines = String(text ?? "").split("\n");
  const elements: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let tableRows: string[][] = [];
  const flushList = () => { if (list) { const Tag = list.ordered ? "ol" : "ul"; elements.push(<Tag key={`list-${elements.length}`}>{list.items.map((item, i) => <li key={i}><InlineMarkdown text={item} /></li>)}</Tag>); list = null; } };
  const flushTable = () => { if (tableRows.length) { const rows = tableRows.filter((row) => !row.every((cell) => /^:?-{3,}:?$/.test(cell.trim()))); elements.push(<div className="markdown-table-wrap" key={`table-${elements.length}`}><table><thead><tr>{(rows[0] ?? []).map((cell, i) => <th key={i}><InlineMarkdown text={cell} /></th>)}</tr></thead><tbody>{rows.slice(1).map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}><InlineMarkdown text={cell} /></td>)}</tr>)}</tbody></table></div>); tableRows = []; } };
  const cells = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
  lines.forEach((line, index) => {
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) { flushList(); tableRows.push(cells(line)); return; }
    flushTable();
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    const item = line.match(/^\s*([-*+] |\d+\. )(.+)$/);
    if (heading) { flushList(); const level = heading[1].length; const content = <InlineMarkdown text={heading[2]} />; elements.push(level === 1 ? <h2 key={index}>{content}</h2> : level === 2 ? <h3 key={index}>{content}</h3> : <h4 key={index}>{content}</h4>); }
    else if (item) { const ordered = /^\s*\d+\./.test(line); if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] }; } list.items.push(item[2]); }
    else if (!line.trim()) { flushList(); }
    else if (/^\s*[-*_]{3,}\s*$/.test(line)) { flushList(); elements.push(<hr key={index} />); }
    else { flushList(); elements.push(<p key={index}><InlineMarkdown text={line} /></p>); }
  });
  flushTable(); flushList();
  return <div className="markdown-content">{elements}</div>;
}

function InlineMarkdown({ text }: { text: string }) {
  const chunks = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return <>{chunks.map((chunk, i) => chunk.startsWith("**") && chunk.endsWith("**") ? <strong key={i}>{chunk.slice(2, -2)}</strong> : chunk.startsWith("`") && chunk.endsWith("`") ? <code key={i}>{chunk.slice(1, -1)}</code> : chunk.startsWith("*") && chunk.endsWith("*") ? <em key={i}>{chunk.slice(1, -1)}</em> : chunk)}</>;
}

function ChartView({ chart }: { chart: AnalysisResponse["chart"] | { chart_type?: string; title?: string; x_axis?: string; y_axis?: string; x_column?: string; y_column?: string | null; points?: Record<string, unknown>[]; data?: Record<string, unknown>[] } }) {
  const rawPoints = chart?.points ?? chart?.data ?? [];
  if (!chart || !rawPoints.length) return null;
  const chartLike = chart as { x_column?: string; y_column?: string | null };
  const points = rawPoints.map((point) => ({ ...point, x: String(point.x ?? point[chartLike.x_column ?? ""] ?? point.category ?? point.label ?? ""), y: Number(point.y ?? point[chartLike.y_column ?? ""] ?? point.value ?? point.count ?? 0) }));
  const line = chart.chart_type?.toLowerCase().includes("line");
  return <div className="chart-card"><div className="chart-heading"><BarChart3 size={17} /><div><strong>{chart.title || "Analysis chart"}</strong><span>{chart.x_axis || chartLike.x_column || "Category"} · {chart.y_axis || chartLike.y_column || "Value"}</span></div></div><div className="chart-container"><ResponsiveContainer width="100%" height="100%">{line ? <LineChart data={points}><CartesianGrid strokeDasharray="3 3" stroke="#e8eaf0" /><XAxis dataKey="x" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="y" stroke="#7165e3" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart> : <BarChart data={points}><CartesianGrid strokeDasharray="3 3" stroke="#e8eaf0" /><XAxis dataKey="x" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="y" fill="#7165e3" radius={[5, 5, 0, 0]} /></BarChart>}</ResponsiveContainer></div></div>;
}

function ReportView({ report, answer }: { report: Record<string, unknown>; answer: string }) {
  const array = (key: string) => Array.isArray(report[key]) ? report[key] as unknown[] : [];
  const findings = array("key_findings");
  return <div className="full-report-view"><div className="report-heading"><FileText size={20} /><div><strong>{displayValue(report.title || "Analytical report")}</strong><span>Generated from analytical evidence</span></div><button className="secondary-button" onClick={() => { const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "insightflow-report.json"; a.click(); URL.revokeObjectURL(url); }}><Download size={14} /> Export JSON</button></div>
    <section className="report-section"><h3>Executive summary</h3><p>{displayValue(report.executive_summary || answer)}</p></section>
    {findings.length > 0 && <section className="report-section"><h3>Key findings</h3><div className="report-findings-grid">{findings.map((value, index) => { const finding = typeof value === "object" && value !== null ? value as Record<string, unknown> : { finding: value }; return <article className="report-finding" key={index}><strong>{displayValue(finding.finding)}</strong><p><b>Evidence</b> · {displayValue(finding.supporting_evidence)}</p><p><b>Implication</b> · {displayValue(finding.business_implication)}</p></article>; })}</div></section>}
    {report.trend_analysis != null && <section className="report-section"><h3>Trend analysis</h3><p>{displayValue(report.trend_analysis)}</p></section>}
    {["data_quality_notes", "recommendations", "limitations"].map((key) => array(key).length > 0 && <section className="report-section" key={key}><h3>{key.replaceAll("_", " ").replace(/^./, (char) => char.toUpperCase())}</h3><ul>{array(key).map((value, index) => <li key={index}>{displayValue(value)}</li>)}</ul></section>)}
    </div>;
}

function GenericTable({ columns, rows }: { columns: string[]; rows: Record<string, unknown>[] }) {
  if (!columns.length) return <EmptyState title="No result columns" text="The query did not return a tabular result." />;
  return <div className="table-scroll"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column} title={displayValue(row[column])}>{displayValue(row[column])}</td>)}</tr>)}</tbody></table></div>;
}

export default App;
