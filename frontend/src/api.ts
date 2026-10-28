import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000",
  timeout: 120000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ai_analyst_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export interface Dataset {
  id: number;
  original_filename: string;
  file_type: string;
  file_size_bytes: number;
  created_at: string;
}

export interface DatasetPreview {
  dataset_id: number;
  filename: string;
  columns: string[];
  row_count: number;
  preview: Record<string, unknown>[];
}

export interface DatasetProfile {
  row_count: number;
  column_count: number;
  duplicate_row_count: number;
  columns: {
    name: string;
    data_type: string;
    null_count: number;
    null_percentage: number;
    distinct_count: number;
    min?: unknown;
    max?: unknown;
    mean?: unknown;
    median?: unknown;
  }[];
}

export interface ChartPayload {
  chart_type: string;
  title?: string;
  x_axis?: string;
  y_axis?: string;
  points?: Record<string, unknown>[];
  data?: Record<string, unknown>[];
  x_column?: string;
  y_column?: string | null;
}

export interface AnalysisResponse {
  question?: string;
  answer: string;
  tool_calls: unknown[];
  chart?: ChartPayload | null;
  report?: Record<string, unknown> | null;
  report_error?: string;
  [key: string]: unknown;
}

export interface DatabaseConnection {
  id: number;
  name: string;
  database_type: string;
  host: string;
  port: number;
  database_name: string;
  username: string;
  is_active: boolean;
  last_tested_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  chart?: ChartPayload | null;
  report?: Record<string, unknown> | null;
  tool_calls?: unknown[];
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: number;
  title: string;
  source_type: "dataset" | "database";
  dataset_id: number | null;
  connection_id: number | null;
  messages: ConversationMessage[];
  created_at: string;
  updated_at: string;
}

export interface DatabaseSchema {
  connection_id: number;
  connection_name: string;
  table_count: number;
  tables: {
    schema: string;
    name: string;
    type: string;
    columns: {
      name: string;
      data_type: string;
      nullable: boolean;
    }[];
  }[];
}

export const apiClient = {
  async register(email: string, password: string) {
    const { data } = await api.post("/users/register", {
      email,
      password,
    });

    return data;
  },

  async login(email: string, password: string) {
    const form = new URLSearchParams();
    form.set("username", email);
    form.set("password", password);

    const { data } = await api.post("/users/login", form, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    return data as {
      access_token: string;
      token_type: string;
    };
  },

  async me() {
    const { data } = await api.get("/users/me");
    return data;
  },

  async listDatasets() {
    const { data } = await api.get<Dataset[]>("/datasets/");
    return data;
  },

  // Delete a dataset owned by the authenticated user.
  async deleteDataset(id: number): Promise<void> {
    await api.delete(`/datasets/${id}`);
  },

  async uploadDataset(file: File) {
    const form = new FormData();
    form.append("file", file);

    const { data } = await api.post("/datasets/upload", form);

    return data as {
      dataset_id: number;
      filename: string;
      file_type: string;
      file_size_bytes: number;
      columns: string[];
    };
  },

  async previewDataset(id: number) {
    const { data } = await api.get<DatasetPreview>(
      `/datasets/${id}/preview`,
    );

    return data;
  },

  async profileDataset(id: number) {
    const { data } = await api.get<DatasetProfile>(
      `/datasets/${id}/profile`,
    );

    return data;
  },

  async askDataset(id: number, question: string) {
    const { data } = await api.post<AnalysisResponse>(
      `/datasets/${id}/ask`,
      { question },
    );

    return data;
  },

  async generateDatasetReport(id: number) {
    const { data } = await api.post<AnalysisResponse>(
      `/datasets/${id}/report`,
    );

    return data;
  },

  async listDatabaseConnections() {
    const { data } = await api.get<DatabaseConnection[]>(
      "/database-connections/",
    );

    return data;
  },

  async createDatabaseConnection(payload: {
    name: string;
    host: string;
    port: number;
    database_name: string;
    username: string;
    password: string;
  }) {
    const { data } = await api.post<DatabaseConnection>(
      "/database-connections/",
      payload,
    );

    return data;
  },

  async testDatabaseConnection(id: number) {
    const { data } = await api.post<{
      connection_id: number;
      success: boolean;
      message: string;
      tested_at: string;
    }>(`/database-connections/${id}/test`);

    return data;
  },

  async deleteDatabaseConnection(id: number) {
    await api.delete(`/database-connections/${id}`);
  },

  async getDatabaseSchema(id: number) {
    const { data } = await api.get<DatabaseSchema>(
      `/database-connections/${id}/schema`,
    );

    return data;
  },

  async previewDatabaseTable(
    id: number,
    schema: string,
    table: string,
  ) {
    const { data } = await api.get(
      `/database-connections/${id}/tables/${encodeURIComponent(schema)}/${encodeURIComponent(table)}/preview`,
    );

    return data as {
      schema: string;
      table: string;
      columns: string[];
      rows: Record<string, unknown>[];
      row_count?: number;
      data?: Record<string, unknown>[];
    };
  },

  async profileDatabaseTable(
    id: number,
    schema: string,
    table: string,
  ) {
    const { data } = await api.get(
      `/database-connections/${id}/tables/${encodeURIComponent(schema)}/${encodeURIComponent(table)}/profile`,
    );

    return data as Record<string, unknown>;
  },

  async queryDatabase(id: number, query: string) {
    const { data } = await api.post(
      `/database-connections/${id}/query`,
      { query },
    );

    return data as {
      columns?: string[];
      rows?: Record<string, unknown>[];
      data?: Record<string, unknown>[];
      row_count?: number;
      truncated?: boolean;
    };
  },

  async exportDatabaseQuery(id: number, sqlQuery: string) {
    const { data, headers } = await api.post(
      `/database-connections/${id}/export/csv`,
      { sql_query: sqlQuery },
      { responseType: "blob" },
    );

    const blobUrl = URL.createObjectURL(data);
    const link = document.createElement("a");

    link.href = blobUrl;
    link.download =
      headers["content-disposition"]?.match(/filename="([^"]+)"/)?.[1] ||
      `database_${id}_export.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  },

  async askDatabase(id: number, question: string) {
    const { data } = await api.post<AnalysisResponse>(
      `/database-connections/${id}/ask`,
      { query: question },
    );

    return data;
  },

  async listConversations() {
    const { data } = await api.get<Conversation[]>("/conversations/");
    return data;
  },

  async getConversation(id: number) {
    const { data } = await api.get<Conversation>(
      `/conversations/${id}`,
    );

    return data;
  },

  async createConversation(payload: {
    title?: string;
    source_type: "dataset" | "database";
    dataset_id?: number | null;
    connection_id?: number | null;
  }) {
    const { data } = await api.post<Conversation>(
      "/conversations/",
      payload,
    );

    return data;
  },

  async appendConversationMessage(
    id: number,
    message: ConversationMessage,
  ) {
    const { data } = await api.post<Conversation>(
      `/conversations/${id}/messages`,
      message,
    );

    return data;
  },

  async renameConversation(id: number, title: string) {
    const { data } = await api.patch<Conversation>(
      `/conversations/${id}`,
      { title },
    );

    return data;
  },

  async deleteConversation(id: number) {
    await api.delete(`/conversations/${id}`);
  },

  async exportDataset(id: number, format: "csv" | "excel") {
    const { data, headers } = await api.get(
      `/datasets/${id}/export/${format}`,
      { responseType: "blob" },
    );

    const blobUrl = URL.createObjectURL(data);
    const link = document.createElement("a");

    link.href = blobUrl;
    link.download =
      headers["content-disposition"]?.match(/filename="([^"]+)"/)?.[1] ||
      `dataset_${id}_export.${format === "csv" ? "csv" : "xlsx"}`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  },
};

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail)) {
      return detail
        .map((item: { msg?: string }) => item.msg || "Invalid input")
        .join(", ");
    }

    if (error.code === "ECONNABORTED") {
      return "The request timed out. Please try again.";
    }

    if (!error.response) {
      return "Cannot reach FastAPI. Check that the backend is running.";
    }

    return `Request failed (${error.response.status}).`;
  }

  return error instanceof Error
    ? error.message
    : "Something went wrong.";
}