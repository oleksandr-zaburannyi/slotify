import {createService, startService} from "./api";
import * as request from "supertest";
import {Server} from "http";
import {Request, Response} from "express";
import Exception from "./Exception";
import {StatusCode} from "./StatusCode";

describe("API Service", () => {
    let server: Server;
    let api: any;

    beforeAll(async () => {
        const service = await createService("test-service");
        api = service.api;
        api.get("/error", () => {
            throw new Error("Test error");
        });
        api.get("/exception", () => {
            throw new Exception("Test exception", {
                status: StatusCode.BAD_REQUEST,
                code: "TEST_EXCEPTION",
            });
        });
        api.get("/ids", (req: Request, res: Response) => {
            res.json({
                correlationId: req.get("x-correlation-id"),
                sessionId: req.get("x-session-id"),
            });
        });
        server = await startService(api, 0);
    });

    afterAll(async () => {
        if (server) {
            await new Promise<void>(resolve => server.close(() => resolve()));
        }
    });

    test("should handle health check endpoint", async () => {
        const response = await request(api).get("/health");
        expect(response.status).toBe(200);
        expect(response.text).toBe("OK");
    });

    test("should handle root endpoint", async () => {
        const response = await request(api).get("/");
        expect(response.status).toBe(200);
        expect(response.text).toBe("OK");
    });

    test("should handle version endpoint", async () => {
        const response = await request(api).get("/version");
        expect(response.status).toBe(200);
        expect(response.text).toBeTruthy();
    });

    test("should handle 404 for unknown routes", async () => {
        const response = await request(api).get("/unknown-route");
        expect(response.status).toBe(404);
        expect(response.body.error).toBeDefined();
    });

    test("should handle favicon.ico without error", async () => {
        const response = await request(api).get("/favicon.ico");
        expect(response.status).toBe(404);
    });

    test("should handle robots.txt without error", async () => {
        const response = await request(api).get("/robots.txt");
        expect(response.status).toBe(404);
    });

    test("should handle POST requests with JSON body", async () => {
        const response = await request(api).post("/test-endpoint").send({test: "data"}).set("Content-Type", "application/json");
        expect(response.status).toBe(404);
    });

    test("should handle CORS headers", async () => {
        const response = await request(api).options("/health").set("Origin", "http://localhost:3000");
        expect(response.headers["access-control-allow-origin"]).toBeDefined();
    });

    test("should handle compression", async () => {
        const response = await request(api).get("/health").set("Accept-Encoding", "gzip");
        expect(response.status).toBe(200);
    });

    test("should handle generic errors and trigger error middleware", async () => {
        const response = await request(api).get("/error");
        expect(response.status).toBe(500);
        expect(response.body.error).toBeDefined();
        expect(response.body.error.code).toBe("SERVER_ERROR");
        expect(response.body.error.message).toBe("Server Error");
    });

    test("should handle custom exceptions and trigger error middleware", async () => {
        const response = await request(api).get("/exception");
        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
        expect(response.body.error.code).toBe("TEST_EXCEPTION");
        expect(response.body.error.message).toBe("Application Error");
    });

    test("should use provided correlation and session IDs", async () => {
        const response = await request(api).get("/ids").set("x-correlation-id", "test-correlation").set("x-session-id", "test-session");
        expect(response.body.correlationId).toBe("test-correlation");
        expect(response.body.sessionId).toBe("test-session");
    });

    test("should auto-generate correlation and session IDs if not provided", async () => {
        const response = await request(api).get("/ids");
        expect(response.body.correlationId).toBeUndefined();
        expect(response.body.sessionId).toBeUndefined();
    });
});
