import express from "express";
import { WindowsExecutorService } from "./windows-executor";

export class WindowsApiServer {
  private app: express.Application;
  private executor: WindowsExecutorService;
  private server: any;

  constructor(private port: number = 8643) {
    this.app = express();
    this.executor = new WindowsExecutorService();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json({ limit: "10mb" }));
    
    // CORS
    this.app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      if (req.method === "OPTIONS") {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // 简单的认证
    this.app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== `Bearer ${process.env.API_SERVER_KEY || "hermes-local-key"}`) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      next();
    });
  }

  private setupRoutes() {
    // 执行命令
    this.app.post("/api/execute", async (req, res) => {
      const { command, cwd } = req.body;
      if (!command) {
        res.status(400).json({ error: "Command is required" });
        return;
      }
      const result = await this.executor.executeCommand(command, cwd);
      res.json(result);
    });

    // 执行 PowerShell
    this.app.post("/api/powershell", async (req, res) => {
      const { script, cwd } = req.body;
      if (!script) {
        res.status(400).json({ error: "Script is required" });
        return;
      }
      const result = await this.executor.executePowerShell(script, cwd);
      res.json(result);
    });

    // 打开文件
    this.app.post("/api/open", async (req, res) => {
      const { filePath } = req.body;
      if (!filePath) {
        res.status(400).json({ error: "File path is required" });
        return;
      }
      const result = await this.executor.openFile(filePath);
      res.json(result);
    });

    // 读取文件
    this.app.post("/api/file/read", async (req, res) => {
      const { filePath } = req.body;
      if (!filePath) {
        res.status(400).json({ error: "File path is required" });
        return;
      }
      const result = await this.executor.readFile(filePath);
      res.json(result);
    });

    // 写入文件
    this.app.post("/api/file/write", async (req, res) => {
      const { filePath, content } = req.body;
      if (!filePath || content === undefined) {
        res.status(400).json({ error: "File path and content are required" });
        return;
      }
      const result = await this.executor.writeFile(filePath, content);
      res.json(result);
    });

    // 列出目录
    this.app.post("/api/directory/list", async (req, res) => {
      const { dirPath } = req.body;
      if (!dirPath) {
        res.status(400).json({ error: "Directory path is required" });
        return;
      }
      const result = await this.executor.listDirectory(dirPath);
      res.json(result);
    });

    // 健康检查
    this.app.get("/health", (req, res) => {
      res.json({ status: "ok", service: "windows-api" });
    });
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          console.log(`[WindowsAPI] Server started on http://localhost:${this.port}`);
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log("[WindowsAPI] Server stopped");
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
