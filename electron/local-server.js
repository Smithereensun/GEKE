import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function getContentType(filePath) {
  return MIME_TYPES.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream";
}

function isInsideRoot(rootDir, filePath) {
  const relativePath = path.relative(rootDir, filePath);
  return relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function resolveRequestFile(rootDir, requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://127.0.0.1").pathname);
  const normalizedPath = pathname === "/" ? "/index.html" : pathname;
  const candidates = [];

  if (normalizedPath.endsWith("/")) {
    candidates.push(path.join(rootDir, normalizedPath, "index.html"));
  } else {
    candidates.push(path.join(rootDir, normalizedPath));

    if (!path.extname(normalizedPath)) {
      candidates.push(path.join(rootDir, normalizedPath, "index.html"));
      candidates.push(path.join(rootDir, `${normalizedPath}.html`));
    }
  }

  for (const candidate of candidates) {
    const absolutePath = path.normalize(candidate);

    if (!isInsideRoot(rootDir, absolutePath)) {
      continue;
    }

    if (existsSync(absolutePath) && statSync(absolutePath).isFile()) {
      return absolutePath;
    }
  }

  return null;
}

export async function createStaticServer(rootDir) {
  const resolvedRoot = path.resolve(rootDir);

  const server = createServer((request, response) => {
    const filePath = resolveRequestFile(resolvedRoot, request.url ?? "/");

    if (!filePath) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": getContentType(filePath),
    });

    createReadStream(filePath)
      .on("error", () => {
        if (!response.headersSent) {
          response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        }

        response.end("Internal Server Error");
      })
      .pipe(response);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve the local app server address.");
  }

  return {
    close() {
      return new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
    url: `http://127.0.0.1:${address.port}`,
  };
}
