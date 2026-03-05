import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Yale } from "yalesyncalarm";

loadEnv({ path: resolve(process.cwd(), ".env.test.local"), quiet: true });

const username = process.env.YALE_USERNAME;
const password = process.env.YALE_PASSWORD;
const hasCredentials = Boolean(username && password);

const missingCredsMessage = [
    "Missing Yale integration credentials.",
    "Create .env.test.local in the repository root and set:",
    "  YALE_USERNAME=<your-yale-username>",
    "  YALE_PASSWORD=<your-yale-password>",
    "Then run: npm run test:integration",
].join("\n");

describe("Yale integration prerequisites", () => {
    it("requires YALE_USERNAME and YALE_PASSWORD in .env.test.local", () => {
        expect(Boolean(username), missingCredsMessage).toBe(true);
        expect(Boolean(password), missingCredsMessage).toBe(true);
    });
});

const describeIntegration = hasCredentials ? describe : describe.skip;

describeIntegration("Yale GET methods (integration)", () => {
    const createClient = () => new Yale(username as string, password as string);

    it("getPanelState returns a supported Yale mode", async () => {
        const state = await createClient().getPanelState();

        console.log("mode is: ", state);

        expect(["arm", "home", "disarm"]).toContain(state);
    });

    it("panel returns populated data after getPanelState", async () => {
        const yale = createClient();
        const latestState = await yale.getPanelState();
        const panel = await yale.panel();

        expect(panel).toBeDefined();
        expect(panel?.identifier).toMatch(/\S+/);
        expect(panel?.state).toBe(latestState);
    });

    it("update loads motion and contact sensor maps", async () => {
        const yale = createClient();

        await yale.update();
        const motionSensors = await yale.motionSensors();
        const contactSensors = await yale.contactSensors();

        expect(motionSensors).toBeTypeOf("object");
        expect(contactSensors).toBeTypeOf("object");
    });
});
