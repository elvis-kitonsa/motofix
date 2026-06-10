import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;
const TARGET = process.env.ADMIN_API_URL || "https://motofix-admin-dashboard.onrender.com";

// Proxy API calls to the admin backend to avoid browser CORS
const proxyConfig = {
  target: TARGET,
  changeOrigin: true,
  secure: true,
  ws: false,
  logLevel: "warn",
};

app.use("/api", createProxyMiddleware(proxyConfig));
app.use("/admin", createProxyMiddleware(proxyConfig));

// Serve static assets
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Control Center serving on port ${PORT} with API proxy to ${TARGET}`);
});

