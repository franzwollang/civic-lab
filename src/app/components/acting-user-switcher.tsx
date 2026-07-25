import { ChevronDown, UserRound } from "lucide-react";
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

/**
 * Global header impersonation switcher (M8).
 * Powers stay role-distinct — switching identity changes gated chrome.
 */
export function ActingUserSwitcher() {
  const { userId, user, affordances, setActingUserId } = useActingUser();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 max-w-[220px] gap-2 border-neutral-200 bg-white px-2.5 text-left font-normal"
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
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="space-y-1 font-normal">
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Impersonate (prototype)
          </div>
          <p className="text-xs leading-snug text-neutral-600">
            {affordances.headline}. Separation of powers — roles do not collapse
            into one admin.
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
                    {summary.capability_labels.slice(0, 3).join(" · ")}
                    {summary.capability_labels.length > 3 ? " · …" : ""}
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
