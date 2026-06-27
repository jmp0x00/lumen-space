import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "docs",
  "app"
);
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"]
]);

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache"
};

const server = createServer(async (request, response) => {
  try {
    const filePath = await resolveRequestPath(request.url);
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      sendNotFound(response);
      return;
    }

    response.writeHead(200, {
      ...noCacheHeaders,
      "Content-Length": fileStat.size,
      "Content-Type": getContentType(filePath)
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch {
    sendNotFound(response);
  }
});

server.listen(port, host, () => {
  console.log(`Serving ${rootDirectory} at http://localhost:${port}/ with no-store cache headers`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Stop the other server or run with PORT=<port>.`);
    process.exit(1);
  }
  throw error;
});

async function resolveRequestPath(requestUrl = "/") {
  const url = new URL(requestUrl, `http://localhost:${port}`);
  const decodedPath = decodeURIComponent(url.pathname);
  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.slice(1);
  const candidatePath = path.resolve(rootDirectory, relativePath);
  if (!candidatePath.startsWith(`${rootDirectory}${path.sep}`) && candidatePath !== rootDirectory) {
    throw new Error("Path escapes static root");
  }

  const fileStat = await stat(candidatePath);
  return fileStat.isDirectory() ? path.join(candidatePath, "index.html") : candidatePath;
}

function getContentType(filePath) {
  return contentTypes.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream";
}

function sendNotFound(response) {
  response.writeHead(404, {
    ...noCacheHeaders,
    "Content-Type": "text/plain; charset=utf-8"
  });
  response.end("Not found");
}
