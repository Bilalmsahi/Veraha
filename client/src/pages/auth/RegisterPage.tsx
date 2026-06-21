import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function RegisterPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign up is by invitation only</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center space-y-2">
          <p className="text-muted-foreground text-sm">
            Please check your email for an invitation link from your account manager.
          </p>
          <Link to="/login" className="text-primary text-sm underline">
            Already have an account? Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
