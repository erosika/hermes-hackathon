import type { Model, Profile } from "@hermetika/shared";

// seed pantheon — placeholder slice of the 23; real list + dates still open.
// 1–2 marked gpu:// are the Brev self-host targets; rest proxied so all are invokable.
export const MODELS: Model[] = [
  {
    id: "m_oracle07",
    slug: "oracle-07",
    name: "Oracle 07",
    kind: "ascii",
    lineage: "hermes-trismegistus",
    backend: "gpu",
    backendRef: "gpu://brev/oracle-07",
    releasedAt: "2025-11-02",
    cardMd: "# Oracle 07\nASCII oracle finetune. Self-hosted on NVIDIA Brev.",
    tags: ["esoteric", "ascii", "generative"],
    enabled: true,
  },
  {
    id: "m_scarab",
    slug: "scarab-visual",
    name: "Scarab",
    kind: "visual",
    lineage: null,
    backend: "gpu",
    backendRef: "gpu://brev/scarab",
    releasedAt: "2025-09-14",
    cardMd: "# Scarab\nVisual model. Self-hosted on NVIDIA Brev.",
    tags: ["esoteric", "visual"],
    enabled: true,
  },
  {
    id: "m_hermes4",
    slug: "hermes-4",
    name: "Hermes 4",
    kind: "tech",
    lineage: "hermes-trismegistus",
    backend: "proxy",
    backendRef: "proxy://nous/hermes-4",
    releasedAt: "2025-08-01",
    cardMd: "# Hermes 4\nTeknium's Hermes line — the dynasty head.",
    tags: ["hermes", "flagship"],
    enabled: true,
  },
  {
    id: "m_nemotron",
    slug: "nemotron-3-ultra",
    name: "Nemotron 3 Ultra",
    kind: "tech",
    lineage: null,
    backend: "proxy",
    backendRef: "proxy://nvidia/nemotron-3-ultra",
    releasedAt: "2026-01-15",
    cardMd: "# Nemotron 3 Ultra\nProxied via build.nvidia.com.",
    tags: ["nvidia", "flagship"],
    enabled: true,
  },
];

// MVP operators — 2 peers. curator/ops folded into hermetika for now.
export const PROFILES: Profile[] = [
  {
    id: "p_hermetika",
    slug: "hermes.hermetika",
    name: "Hermetika",
    peerId: "hermetika",
    role: "orchestrator",
    curates: MODELS.map((m) => m.slug),
  },
  {
    id: "p_steward",
    slug: "hermes.steward",
    name: "Steward",
    peerId: "steward",
    role: "steward",
    curates: [],
  },
];
