import { describe, expect, it } from "vitest";
import {
  aggregateCheers,
  applyRemoteCheer,
  emptyCheers,
  toggleMyCheer,
} from "./cheersState";

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const ME = "00000000-0000-0000-0000-0000000000ee";
const OTHER = "00000000-0000-0000-0000-0000000000ff";

describe("emptyCheers", () => {
  it("seeds zero-count entries for every visible check-in", () => {
    expect(emptyCheers([A, B])).toEqual({
      [A]: { count: 0, mine: false },
      [B]: { count: 0, mine: false },
    });
  });
});

describe("aggregateCheers", () => {
  it("counts cheers per check-in and flags the current user's reaction", () => {
    const result = aggregateCheers(
      [A, B],
      [
        { check_in_id: A, user_id: ME },
        { check_in_id: A, user_id: OTHER },
        { check_in_id: B, user_id: OTHER },
      ],
      ME
    );
    expect(result).toEqual({
      [A]: { count: 2, mine: true },
      [B]: { count: 1, mine: false },
    });
  });

  it("ignores rows for check-ins that aren't visible", () => {
    const result = aggregateCheers([A], [{ check_in_id: B, user_id: OTHER }], ME);
    expect(result).toEqual({ [A]: { count: 0, mine: false } });
  });

  it("never marks 'mine' when there is no signed-in user", () => {
    const result = aggregateCheers([A], [{ check_in_id: A, user_id: ME }], null);
    expect(result[A]).toEqual({ count: 1, mine: false });
  });
});

describe("toggleMyCheer", () => {
  it("optimistically increments count when the user cheers", () => {
    const prev = { [A]: { count: 2, mine: false } };
    const next = toggleMyCheer(prev, A, true);
    expect(next[A]).toEqual({ count: 3, mine: true });
  });

  it("optimistically decrements count when the user un-cheers", () => {
    const prev = { [A]: { count: 3, mine: true } };
    const next = toggleMyCheer(prev, A, false);
    expect(next[A]).toEqual({ count: 2, mine: false });
  });

  it("clamps count at zero so a desync can't go negative", () => {
    const prev = { [A]: { count: 0, mine: true } };
    const next = toggleMyCheer(prev, A, false);
    expect(next[A]).toEqual({ count: 0, mine: false });
  });

  it("returns the same reference when state is already in the target state", () => {
    const prev = { [A]: { count: 1, mine: true } };
    expect(toggleMyCheer(prev, A, true)).toBe(prev);
  });

  it("works for a check-in that has no entry yet", () => {
    const next = toggleMyCheer({}, A, true);
    expect(next[A]).toEqual({ count: 1, mine: true });
  });
});

describe("applyRemoteCheer", () => {
  const visible = new Set([A]);

  it("increments count on remote INSERT from another user", () => {
    const prev = { [A]: { count: 1, mine: false } };
    const next = applyRemoteCheer(
      prev,
      { type: "INSERT", checkInId: A, userId: OTHER },
      ME,
      visible
    );
    expect(next[A]).toEqual({ count: 2, mine: false });
  });

  it("decrements count on remote DELETE from another user", () => {
    const prev = { [A]: { count: 2, mine: true } };
    const next = applyRemoteCheer(
      prev,
      { type: "DELETE", checkInId: A, userId: OTHER },
      ME,
      visible
    );
    expect(next[A]).toEqual({ count: 1, mine: true });
  });

  it("ignores self-events to avoid double-counting the optimistic toggle", () => {
    const prev = { [A]: { count: 1, mine: true } };
    expect(
      applyRemoteCheer(
        prev,
        { type: "INSERT", checkInId: A, userId: ME },
        ME,
        visible
      )
    ).toBe(prev);
  });

  it("ignores events for check-ins outside the current view", () => {
    const prev = { [A]: { count: 1, mine: false } };
    expect(
      applyRemoteCheer(
        prev,
        { type: "INSERT", checkInId: B, userId: OTHER },
        ME,
        visible
      )
    ).toBe(prev);
  });

  it("clamps DELETE so a stale event can't make the count negative", () => {
    const prev = { [A]: { count: 0, mine: false } };
    const next = applyRemoteCheer(
      prev,
      { type: "DELETE", checkInId: A, userId: OTHER },
      ME,
      visible
    );
    expect(next[A]).toEqual({ count: 0, mine: false });
  });
});
