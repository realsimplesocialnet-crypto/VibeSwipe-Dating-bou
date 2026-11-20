import {
  Children,
  createContext,
  createElement,
  isValidElement,
  useCallback,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  BrowserRouter,
  Link as RouterLink,
  Navigate,
  Route as RouterRoute,
  Routes,
  useLocation as useRouterLocation,
  useNavigate,
  useParams as useRouterParams,
  useRoutes,
  type Location,
} from "react-router-dom";

type LegacyLocationOptions = { replace?: boolean };
type LegacyRouteProps = {
  path?: string;
  component?: ComponentType;
  children?: ReactNode;
};

const PRIMARY_TAB_PATHS = new Set(["/discover", "/messages", "/profile", "/settings"]);

export const RouteVisibilityContext = createContext(true);

function normalizedPath(path?: string) {
  if (!path) return "*";
  return path.replace(/\/\*\?$/, "/*");
}

function routeElement({ component: Component, children }: LegacyRouteProps) {
  return Component ? createElement(Component) : children ?? null;
}

export function Router({ base, children }: { base?: string; children: ReactNode }) {
  return <BrowserRouter basename={base || undefined}>{children}</BrowserRouter>;
}

export function Link({
  href,
  replace,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  replace?: boolean;
}) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) {
    return <a href={href} {...props} />;
  }
  return <RouterLink to={href} replace={replace} {...props} />;
}

export function Redirect({ to, replace = false }: { to: string; replace?: boolean }) {
  return <Navigate to={to} replace={replace} />;
}

export function Route(_props: LegacyRouteProps) {
  return null;
}

export function Switch({ children }: { children: ReactNode }) {
  const location = useRouterLocation();
  const routeDefinitions = Children.toArray(children).flatMap((child) => {
    if (!isValidElement<LegacyRouteProps>(child)) return [];
    return [{
      path: normalizedPath(child.props.path),
      originalPath: child.props.path,
      element: routeElement(child.props),
    }];
  });
  const activeTabPath = PRIMARY_TAB_PATHS.has(location.pathname) ? location.pathname : null;
  const [visitedTabs, setVisitedTabs] = useState<string[]>(() => activeTabPath ? [activeTabPath] : []);

  useEffect(() => {
    if (!activeTabPath) return;
    setVisitedTabs((current) => current.includes(activeTabPath) ? current : [...current, activeTabPath]);
  }, [activeTabPath]);

  const tabRoutes = routeDefinitions.filter((route) => (
    route.originalPath && PRIMARY_TAB_PATHS.has(route.originalPath)
  ));
  const standardRoutes = routeDefinitions
    .filter((route) => !route.originalPath || !PRIMARY_TAB_PATHS.has(route.originalPath))
    .map(({ path, element }) => ({ path, element }));
  const standardPage = useRoutes(standardRoutes);

  return <>
    {tabRoutes
      .filter((route) => visitedTabs.includes(route.originalPath!) || route.originalPath === activeTabPath)
      .map((route) => {
        const isActive = route.originalPath === activeTabPath;
        const tabLocation: Location | string = isActive ? location : route.path;
        return <RouteVisibilityContext.Provider key={route.originalPath} value={isActive}>
          <div hidden={!isActive} aria-hidden={!isActive} data-kept-tab={route.originalPath}>
            <Routes location={tabLocation}>
              <RouterRoute path={route.path} element={route.element} />
            </Routes>
          </div>
        </RouteVisibilityContext.Provider>;
      })}
    {activeTabPath ? null : standardPage}
  </>;
}

export function useLocation(): [string, (path: string, options?: LegacyLocationOptions) => void] {
  const location = useRouterLocation();
  const navigate = useNavigate();
  const setLocation = useCallback((path: string, options?: LegacyLocationOptions) => {
    navigate(path, { replace: options?.replace });
  }, [navigate]);
  return [location.pathname, setLocation];
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>() {
  return useRouterParams() as T;
}

export function useSearch() {
  return useRouterLocation().search;
}
