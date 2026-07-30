import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  loadFlyerStudioState,
  saveFlyerStudioState,
  type FlyerStudioPersistedState,
} from "./studio-storage";

const SAMPLE_IMAGE = "data:image/png;base64,abc123";
const storage = new Map<string, string>();

function installSessionStorageMock() {
  const sessionStorageMock = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  };

  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: sessionStorageMock,
  });
}

function sampleState(overrides: Partial<FlyerStudioPersistedState> = {}): FlyerStudioPersistedState {
  return {
    version: 1,
    template: "professional",
    format: "letter",
    promptRefinement: "warmer tones",
    displayOptions: {
      showPhone: true,
      showStars: true,
      showAddress: false,
      showTagline: true,
    },
    preview: SAMPLE_IMAGE,
    studioCache: {
      backgroundDataUrl: "data:image/png;base64,background",
      imagePrompt: "Soft gradient backdrop",
      copy: {
        headline: "We'd love your feedback",
        subhead: "Share your experience on Google",
        cta: "Thank you!",
        qrLabel: "Scan to review",
        supportLine: "Plumber · Austin, TX",
      },
    },
    history: [
      {
        id: "entry-1",
        imageDataUrl: SAMPLE_IMAGE,
        label: "professional · Letter",
        template: "professional",
        format: "letter",
        createdAt: "2026-07-30T00:00:00.000Z",
      },
    ],
    selectedHistoryId: "entry-1",
    updatedAt: "2026-07-30T00:00:00.000Z",
    ...overrides,
  };
}

describe("flyer studio storage", () => {
  beforeEach(() => {
    storage.clear();
    installSessionStorageMock();
  });

  it("round-trips flyer studio state through sessionStorage", () => {
    saveFlyerStudioState("biz-1", sampleState());
    const restored = loadFlyerStudioState("biz-1");

    assert.ok(restored);
    assert.equal(restored?.template, "professional");
    assert.equal(restored?.format, "letter");
    assert.equal(restored?.preview, SAMPLE_IMAGE);
    assert.equal(restored?.studioCache?.imagePrompt, "Soft gradient backdrop");
    assert.equal(restored?.history.length, 1);
    assert.equal(restored?.selectedHistoryId, "entry-1");
  });

  it("returns null for invalid stored payloads", () => {
    storage.set(
      "profile-guide-flyer-studio:biz-1",
      JSON.stringify({ version: 1, preview: "not-an-image" })
    );

    assert.equal(loadFlyerStudioState("biz-1"), null);
  });
});
