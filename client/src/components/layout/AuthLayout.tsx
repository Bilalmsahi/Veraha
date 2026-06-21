import { Link, Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-3">
        <Link to="/" className="flex flex-col items-center gap-2">
          <img
            src="/logo-brand.png"
            alt="Veraha Security"
            className="h-12 object-contain dark:hidden"
          />
          <img
            src="/logo-brand-white-text.png"
            alt="Veraha Security"
            className="hidden h-12 object-contain dark:block"
          />
        </Link>
        <p className="text-sm text-muted-foreground">Compliance Platform</p>
      </div>
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
}
