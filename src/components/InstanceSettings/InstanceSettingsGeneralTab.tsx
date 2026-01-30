import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Clock, Loader2, MessageSquare, Save } from "lucide-react";

type Props = {
  dailyLimit: number;
  setDailyLimit: (v: number) => void;
  businessHoursEnabled: boolean;
  setBusinessHoursEnabled: (v: boolean) => void;
  businessHoursStart: string;
  setBusinessHoursStart: (v: string) => void;
  businessHoursEnd: string;
  setBusinessHoursEnd: (v: string) => void;
  isSaving: boolean;
  onSave: () => void;
};

export function InstanceSettingsGeneralTab({
  dailyLimit,
  setDailyLimit,
  businessHoursEnabled,
  setBusinessHoursEnabled,
  businessHoursStart,
  setBusinessHoursStart,
  businessHoursEnd,
  setBusinessHoursEnd,
  isSaving,
  onSave,
}: Props) {
  return (
    <div className="space-y-6">
      {/* Daily Limit */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="daily-limit">Limite diário de mensagens</Label>
        </div>
        <Input
          id="daily-limit"
          type="number"
          value={dailyLimit}
          onChange={(e) => setDailyLimit(Number(e.target.value))}
          min={1}
          max={10000}
          className="max-w-[200px]"
        />
        <p className="text-xs text-muted-foreground">
          Limite máximo de mensagens que podem ser enviadas por dia nesta instância.
        </p>
      </div>

      <Separator />

      {/* Business Hours */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="business-hours">Horário comercial</Label>
          </div>
          <Switch id="business-hours" checked={businessHoursEnabled} onCheckedChange={setBusinessHoursEnabled} />
        </div>

        {businessHoursEnabled && (
          <div className="grid grid-cols-2 gap-4 pl-6">
            <div className="space-y-2">
              <Label htmlFor="start-time" className="text-xs">
                Início
              </Label>
              <Input
                id="start-time"
                type="time"
                value={businessHoursStart}
                onChange={(e) => setBusinessHoursStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-time" className="text-xs">
                Fim
              </Label>
              <Input
                id="end-time"
                type="time"
                value={businessHoursEnd}
                onChange={(e) => setBusinessHoursEnd(e.target.value)}
              />
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground pl-6">
          Define o horário de funcionamento para automações e respostas.
        </p>
      </div>

      <Separator />

      <div className="flex justify-end gap-2">
        <Button onClick={onSave} disabled={isSaving} className="gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}
