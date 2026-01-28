import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function VPNTestTemplate({
  value,
  onCopy,
}: {
  value: string;
  onCopy: (value: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="px-3 py-2 border-b flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-foreground">Template para copiar</h4>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onCopy(value)}
          disabled={!value}
        >
          <Copy className="h-4 w-4 mr-2" />
          Copiar template
        </Button>
      </div>
      <div className="p-3">
        <Textarea
          value={value}
          readOnly
          className="min-h-[120px] resize-none"
        />
      </div>
    </div>
  );
}
