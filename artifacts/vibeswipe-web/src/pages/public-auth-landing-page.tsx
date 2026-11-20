export default function PublicAuthLandingPage() {
  const basePath = import.meta.env.BASE_URL;

  return (
    <main className="public-auth-page" data-testid="public-auth-landing">
      <section className="public-auth-content" aria-label="VIBESWIPES account access">
        <div className="public-auth-brand" aria-label="VIBESWIPES">
          <img
            src={`${basePath}logo.svg`}
            alt=""
            width="64"
            height="64"
            data-testid="img-vibeswipes-logo"
          />
          <span>VIBESWIPES</span>
        </div>
        <nav className="public-auth-actions" aria-label="Account">
          <a href={`${basePath}sign-in`} className="public-auth-link public-auth-login" data-testid="link-login">
            Login
          </a>
          <a href={`${basePath}sign-up`} className="public-auth-link public-auth-signup" data-testid="link-sign-up">
            Sign Up
          </a>
        </nav>
      </section>
    </main>
  );
}
