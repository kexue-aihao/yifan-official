"use client";
import { Link as NextLink, usePathname, useRouter } from "../i18n/navigation";
import {
  useSearchParams as useNextSearchParams,
  useParams as useNextParams,
} from "next/navigation";
import { useEffect, useMemo, type AnchorHTMLAttributes } from "react";

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string;
};
export function Link({ to, ...props }: LinkProps) {
  return <NextLink href={to} {...props} />;
}
export function NavLink({
  to,
  end: _end,
  className,
  ...props
}: LinkProps & { end?: boolean }) {
  const pathname = usePathname();
  return (
    <Link
      to={to}
      className={`${className || ""} ${pathname === to ? "active" : ""}`}
      aria-current={pathname === to ? "page" : undefined}
      {...props}
    />
  );
}
export function useLocation() {
  const pathname = usePathname(),
    params = useNextSearchParams();
  const search = params.toString();
  return {
    pathname,
    search: search ? `?${search}` : "",
    hash: typeof window === "undefined" ? "" : window.location.hash,
  };
}
export function useNavigate() {
  const router = useRouter();
  return (to: string, options?: { replace?: boolean }) =>
    options?.replace ? router.replace(to) : router.push(to);
}
export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (replace) router.replace(to);
    else router.push(to);
  }, [router, to, replace]);
  return null;
}
export function useSearchParams() {
  const search = useNextSearchParams().toString(),
    pathname = usePathname(),
    router = useRouter();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const set = (value: URLSearchParams, options?: { replace?: boolean }) => {
    const url = `${pathname}${value.size ? `?${value}` : ""}`;
    if (options?.replace) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  };
  return [params, set] as const;
}
export const useParams = () => useNextParams<{ id: string }>();
