import { createRequestHandler } from "@remix-run/express";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";

// eslint-disable-next-line no-undef
const viteDevServer =
  process.env.NODE_ENV === "production"
    ? null
    : await import("vite").then((vite) =>
        vite.createServer({ server: { middlewareMode: true } }),
      );

const app = express();
app.use(
  viteDevServer ? viteDevServer.middlewares : express.static("build/client"),
);

const httpServer = createServer(app);
const io = new Server(httpServer);

io.on("connection", (socket) => {
  socket.on("joinRoom", (roomKey) => {
    socket.join(roomKey);
  });

  const reflect = (ev) => {
    socket.on(ev, (roomKey, ...args) => {
      io.to(roomKey).emit(ev, ...args);
    });
  };
  reflect("itemStream");
});


io.engine.on("connection_error", (err) => {
  console.log(err.req); // the request object
  console.log(err.code); // the error code, for example 1
  console.log(err.message); // the error message, for example "Session ID unknown"
  console.log(err.context); // some additional error context
});

const build = viteDevServer
  ? () => viteDevServer.ssrLoadModule("virtual:remix/server-build")
  : await import("./build/server/index.js");
app.all("*", createRequestHandler({ build }));

httpServer.listen(5173, () => {
  console.log("App listening on http://localhost:5173");
});
