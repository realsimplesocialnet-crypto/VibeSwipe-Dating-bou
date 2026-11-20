import { lazy, Suspense } from "react";
import { Route, Router, Switch } from "wouter";

import "./index.css";

const PrivacyPolicyPage = lazy(() => import("@/pages/privacy-policy"));
const TermsPage = lazy(() => import("@/pages/terms"));
const CommunityGuidelinesPage = lazy(() => import("@/pages/community-guidelines"));
const artifactBasePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function PublicLegalEntry() {
  return (
    <Router base={artifactBasePath}>
      <Suspense fallback={<main className="min-h-[100dvh] bg-background px-4 py-7 text-sm text-muted-foreground">Loading MYAGEBEAUTY information…</main>}>
        <Switch>
          <Route path="/privacy-policy" component={PrivacyPolicyPage} />
          <Route path="/terms" component={TermsPage} />
          <Route path="/community-guidelines" component={CommunityGuidelinesPage} />
          <Route>
            <main className="min-h-[100dvh] bg-background px-4 py-7 text-foreground">
              <div className="mx-auto max-w-3xl">
                <h1 className="text-2xl font-bold">Page not found</h1>
                <a className="mt-4 inline-block text-primary underline" href={`${artifactBasePath}/`}>MYAGEBEAUTY home</a>
              </div>
            </main>
          </Route>
        </Switch>
      </Suspense>
    </Router>
  );
}
