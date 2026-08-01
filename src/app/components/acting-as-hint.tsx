import { useActingUserOptional } from "../lib/acting-user";
import { userHasCapability } from "../lib/role-affordances";

type ActingAsHintProps = {
  /** Extra class on the outer paragraph. */
  className?: string;
  /** When set, append whether the acting user has this capability. */
  requireCapability?: Parameters<typeof userHasCapability>[1];
  capabilityLabel?: string;
};

/** Compact “Acting as …” line for composers and gated panels. */
export function ActingAsHint({
  className = "text-xs text-neutral-500",
  requireCapability,
  capabilityLabel,
}: ActingAsHintProps) {
  const { user, affordances } = useActingUserOptional();
  const authorized =
    requireCapability == null
      ? null
      : userHasCapability(user, requireCapability);

  return (
    <p className={className} data-testid="acting-as-hint">
      Acting as{" "}
      <span className="font-medium text-neutral-700">
        {user.display_name}
      </span>{" "}
      ({affordances.role_labels.join(", ")})
      {requireCapability != null && capabilityLabel ? (
        <>
          {" — "}
          <span
            className={
              authorized ? "text-emerald-700" : "font-medium text-amber-800"
            }
          >
            {authorized
              ? `authorized to ${capabilityLabel}`
              : `not authorized to ${capabilityLabel}`}
          </span>
        </>
      ) : null}
      . Change identity in the header.
    </p>
  );
}
