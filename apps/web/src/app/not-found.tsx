import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="text-center">
        <p className="label-caps">404</p>
        <p className="mt-1 text-sm text-foreground">This view does not exist.</p>
        <Link href="/" className="mt-3 inline-block text-xs text-primary hover:underline">
          Return to mission overview
        </Link>
      </div>
    </div>
  );
}
