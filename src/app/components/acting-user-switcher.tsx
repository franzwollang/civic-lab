import { useEffect, useState } from "react";
import { ChevronDown, UserRound } from "lucide-react";
import { getIdentities } from "../../api/client";
import type { UserIdentityRow } from "../../doc/types";
import { identityStatusLabel } from "../../lib/identityPolicy";
import { useActingUser } from "../lib/acting-user";
import { PROTOTYPE_USERS, formatUserLabel } from "../lib/prototype-users";
import { summarizeRoleAffordances } from "../lib/role-affordances";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

function identityHint(row: UserIdentityRow | undefined): string {
  if (!row) return "Identity: unverified";
  const status = identityStatusLabel(row.verification_status);
  const countries =
    row.country_codes.length > 0
      ? ` · ${row.country_codes.join(", ")}`
      : row.long_term_ties_note
        ? " · long-term ties"
        : "";
  return `${status}${countries}`;
}

/**
 * Global header impersonation switcher (M8) + identity status (M9 §8.6).
 * Powers stay role-distinct — switching identity changes gated chrome.
 */
export function ActingUserSwitcher() {
  const { userId, user, affordances, setActingUserId } = useActingUser();
  const [identities, setIdentities] = useState<
    Record<string, UserIdentityRow>
  >({});

  useEffect(() => {
    let cancelled = false;
    getIdentities()
      .then((rows) => {
        if (cancelled) return;
        const map: Record<string, UserIdentityRow> = {};
        for (const row of rows) map[row.user_id] = row;
        setIdentities(map);
      })
      .catch(() => {
        // API may be down during isolated client work; badge stays absent.
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const actingIdentity = identities[userId];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 max-w-[240px] gap-2 border-neutral-200 bg-white px-2.5 text-left font-normal"
          aria-label={`Acting as ${user.display_name}. Change prototype identity.`}
          data-testid="acting-user-switcher"
        >
          <UserRound className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
          <span className="min-w-0 flex-1 truncate">
            <span className="block truncate text-xs font-medium text-neutral-900">
              {user.display_name}
            </span>
            <span className="block truncate text-[10px] leading-tight text-neutral-500">
              {affordances.primary_label}
              {actingIdentity
                ? ` · ${identityStatusLabel(actingIdentity.verification_status)}`
                : ""}
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="space-y-1 font-normal">
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Impersonate (session)
          </div>
          <p className="text-xs leading-snug text-neutral-600">
            {affordances.headline}. Switcher binds a server session cookie
            (IdP-lite); real-identity hooks (CONCEPT §8.6) still gate Manual
            steward actions. When configured, `/api/auth/oidc/start` binds the
            same session via external OIDC.
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={userId}
          onValueChange={setActingUserId}
        >
          {PROTOTYPE_USERS.map((u) => {
            const summary = summarizeRoleAffordances(u);
            return (
              <DropdownMenuRadioItem
                key={u.id}
                value={u.id}
                className="items-start py-2"
              >
                <div className="min-w-0 flex-1 pl-1">
                  <div className="text-sm font-medium text-neutral-900">
                    {formatUserLabel(u)}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                    {summary.capability_labels.slice(0, 2).join(" · ")}
                    {summary.capability_labels.length > 2 ? " · …" : ""}
                  </div>
                  <div className="mt-0.5 text-[10px] text-neutral-400">
                    {identityHint(identities[u.id])}
                  </div>
                </div>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
            This identity can
          </div>
          <ul className="space-y-0.5 text-[11px] text-neutral-600">
            {affordances.capability_labels.map((label) => (
              <li key={label}>· {label}</li>
            ))}
          </ul>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
