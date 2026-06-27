import { expect, test, describe, afterEach } from "bun:test";
import type { Model } from "@hermetika/shared";
import { parseRef, resolve } from "./router";
import { BACKENDS } from "./backends";

describe("parseRef — backend_ref grammar", () => {
  test("splits provider and id", () => {
    expect(parseRef("gpu://spark/oracle-07")).toEqual({ provider: "spark", id: "oracle-07" });
  });
  test("keeps nested ids intact", () => {
    expect(parseRef("gpu://brev/unbound/13b")).toEqual({ provider: "brev", id: "unbound/13b" });
  });
  test("handles proxy refs", () => {
    expect(parseRef("proxy://nous/hermes-4")).toEqual({ provider: "nous", id: "hermes-4" });
  });
});

const sparkModel = (): Model => ({
  id: "m_x",
  slug: "x",
  name: "X",
  kind: "ascii",
  lineage: null,
  backend: "gpu",
  backendRef: "gpu://spark/x",
  speed: "fast",
  releasedAt: "2025-01-01",
  cardMd: "",
  tags: [],
  enabled: true,
});

const nousModel = (): Model => ({ ...sparkModel(), backend: "proxy", backendRef: "proxy://nous/hermes-4" });

describe("resolve — failover (hermetika swings a dead lane to its twin)", () => {
  const brevUrl = BACKENDS.brev!.baseUrl;
  afterEach(() => {
    BACKENDS.brev!.baseUrl = brevUrl; // restore
  });

  test("unhealthy spark with a reachable failover swings to brev", () => {
    // health has no probes in-test → every backend reads unhealthy; give brev a url so it's a valid target
    BACKENDS.brev!.baseUrl = "http://brev.test/v1";
    const r = resolve(sparkModel());
    expect(r.provider).toBe("brev");
    expect(r.failedOver).toBe(true);
    expect(r.upstreamModel).toBe("x"); // model id carries across the swing
  });

  test("no failover target configured → stays on primary", () => {
    BACKENDS.brev!.baseUrl = undefined; // failover unreachable
    const r = resolve(sparkModel());
    expect(r.provider).toBe("spark");
    expect(r.failedOver).toBe(false);
  });

  test("a proxy backend with no failover declared stays put", () => {
    const r = resolve(nousModel());
    expect(r.provider).toBe("nous");
    expect(r.failedOver).toBe(false);
  });
});
