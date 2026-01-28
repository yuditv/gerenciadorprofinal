import { ArrowLeft, Wifi } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { VPNTestGenerator } from "@/components/Inbox/VPNTest/VPNTestGenerator";

export default function VPNTest() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Teste VPN (Offline)</h1>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-3xl mx-auto">
        <VPNTestGenerator />
      </main>
    </div>
  );
}
