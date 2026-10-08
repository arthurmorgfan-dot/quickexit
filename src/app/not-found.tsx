import Brand from "@/components/ui/Brand";
import Button from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="not-found container">
      <header>
        <Brand href="/" />
      </header>
      <main className="not-found-content">
        <div className="eyebrow">404 · A CLEAR WAY BACK</div>
        <h1>This isn’t your exit.</h1>
        <p>
          The page you’re looking for doesn’t exist. Head home to explore
          QuickExit.
        </p>
        <Button href="/">Back to QuickExit</Button>
      </main>
      <footer>
        <p>
          Product concept / prototype. Crypto involves financial risk. Capital
          is at risk; profits are not guaranteed.
        </p>
      </footer>
    </div>
  );
}
