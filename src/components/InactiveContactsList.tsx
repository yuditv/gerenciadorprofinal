import { useState } from "react";
import { PhoneOff, Trash2, RotateCcw, Search, Wrench, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useInactiveContacts, getReasonLabel } from "@/hooks/useInactiveContacts";
import { motion } from "framer-motion";

export function InactiveContactsList() {
  const {
    contacts, isLoading, totalCount,
    restoreContact, deleteContact, clearAll, restoreAllFixable,
  } = useInactiveContacts();

  const [searchQuery, setSearchQuery] = useState("");
  const [clearConfirm, setClearConfirm] = useState(false);

  const fixableCount = contacts.filter(c => c.fixedPhone).length;

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  const reasonColor = (reason: string) => {
    switch (reason) {
      case "no_whatsapp": return "bg-red-500/15 text-red-400 border-red-500/30";
      case "invalid_number": return "bg-orange-500/15 text-orange-400 border-orange-500/30";
      case "blocked": return "bg-purple-500/15 text-purple-400 border-purple-500/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (isLoading && contacts.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 rounded-2xl bg-red-500/15 flex items-center justify-center">
              <PhoneOff className="h-8 w-8 text-red-400" />
            </div>
            <div>
              <CardTitle className="text-4xl font-bold text-gradient">{totalCount.toLocaleString()}</CardTitle>
              <CardDescription className="text-base mt-1">
                {totalCount === 1 ? "Contato inativo" : "Contatos inativos"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Números sem WhatsApp ou com problemas são movidos para cá automaticamente durante os disparos.
            {fixableCount > 0 && (
              <span className="text-primary font-medium"> {fixableCount} número(s) podem ser corrigidos automaticamente.</span>
            )}
          </p>

          <div className="flex flex-wrap gap-3">
            {fixableCount > 0 && (
              <Button onClick={restoreAllFixable} className="gap-2" variant="default">
                <Wrench className="h-4 w-4" />
                Corrigir e restaurar {fixableCount}
              </Button>
            )}
            {contacts.length > 0 && (
              <Button variant="destructive" className="gap-2" onClick={() => setClearConfirm(true)}>
                <Trash2 className="h-4 w-4" />
                Limpar inativos
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {contacts.length > 0 && (
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-lg">Contatos Inativos</CardTitle>
              <div className="relative w-full sm:w-64 search-glow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-white/10 rounded-xl bg-background/50 backdrop-blur-sm focus:outline-none focus:border-primary/30 transition-all"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {filtered.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum resultado para "{searchQuery}"</p>
              ) : (
                filtered.map((contact, index) => (
                  <motion.div
                    key={contact.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.5) }}
                    className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-background/30 hover:bg-primary/5 hover:border-primary/15 transition-all group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-foreground truncate">{contact.name}</p>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${reasonColor(contact.reason)}`}>
                          {getReasonLabel(contact.reason)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="font-mono">{contact.phone}</span>
                        {contact.fixedPhone && (
                          <span className="flex items-center gap-1 text-primary text-xs">
                            <Wrench className="h-3 w-3" />
                            → {contact.fixedPhone}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => restoreContact(contact)}
                        className="h-9 w-9 rounded-lg text-primary hover:text-primary hover:bg-primary/10"
                        title={contact.fixedPhone ? "Restaurar com número corrigido" : "Restaurar"}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteContact(contact.id)}
                        className="h-9 w-9 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {contacts.length === 0 && (
        <Card className="glass-card">
          <CardContent className="empty-state">
            <div className="empty-state-icon">
              <AlertTriangle />
            </div>
            <h3 className="text-lg font-semibold mb-2">Nenhum contato inativo</h3>
            <p className="text-muted-foreground max-w-md">
              Números sem WhatsApp ou com problemas detectados durante disparos aparecerão aqui automaticamente.
            </p>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={clearConfirm} onOpenChange={setClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar contatos inativos?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os {totalCount} contato(s) inativo(s) serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { clearAll(); setClearConfirm(false); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Limpar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
