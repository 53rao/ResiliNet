import rawFixture from "@/data/m2-cascade-fixture.json";
import rawPresets from "@/data/presets.json";
import type { CascadeResult } from "@/lib/types";


function validateFixture(value: unknown): CascadeResult {
  if (!value || typeof value !== "object") throw new Error("M2 fixture is not an object");
  const fixture = value as CascadeResult;
  if (
    fixture.graph_version !== "0.3.0" ||
    fixture.model_version !== "fixture-playback-0.3.0" ||
    !Array.isArray(fixture.events) ||
    !Array.isArray(fixture.node_results)
  ) {
    throw new Error("M2 fixture does not match the expected contract version");
  }
  return fixture;
}


export const M2_FIXTURE = validateFixture(rawFixture);
export const PRESETS = rawPresets;
