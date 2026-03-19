import { AuthLayout } from "../components/AuthLayout";
import { LoginForm } from "../components/LoginForm";

export function LoginPage() {
  return (
    <AuthLayout variant="menu">
      <h2 className="mb-4 text-xl font-semibold">Main menu — login</h2>
      <LoginForm />
    </AuthLayout>
  );
}

