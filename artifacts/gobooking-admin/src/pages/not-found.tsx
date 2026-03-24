import { Link } from "wouter";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-display font-bold text-primary mb-4">404</h1>
        <h2 className="text-2xl font-bold mb-2">Page introuvable</h2>
        <p className="text-muted-foreground mb-8">
          La page que vous recherchez n'existe pas ou a été déplacée.
        </p>
        <Link href="/admin/dashboard" className="inline-block">
          <Button size="lg">Retour au tableau de bord</Button>
        </Link>
      </div>
    </div>
  );
}
