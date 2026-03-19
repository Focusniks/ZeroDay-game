import { LoginForm } from "../components/LoginForm";

export function LoginPage() {
  return (
    <div className="login-wallpaper flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </div>
  );
}

