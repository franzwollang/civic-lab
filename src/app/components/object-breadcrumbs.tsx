import { Link } from "react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import type { NavCrumb } from "../lib/object-nav";
import { cn } from "./ui/utils";

export function ObjectBreadcrumbs({
  crumbs,
  className,
}: {
  crumbs: NavCrumb[];
  className?: string;
}) {
  if (crumbs.length === 0) return null;

  return (
    <Breadcrumb className={cn("mb-3", className)}>
      <BreadcrumbList>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <BreadcrumbItem key={`${crumb.label}-${i}`}>
              {i > 0 && <BreadcrumbSeparator />}
              {isLast || !crumb.href ? (
                <BreadcrumbPage className="max-w-[16rem] truncate">
                  {crumb.label}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link
                    to={crumb.href}
                    className="max-w-[12rem] truncate text-neutral-500 hover:text-neutral-800"
                  >
                    {crumb.label}
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
