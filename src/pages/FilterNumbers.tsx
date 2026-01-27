import { WhatsAppNumberFilter } from "@/components/WhatsAppNumberFilter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search } from "lucide-react";
import { motion } from "framer-motion";

export default function FilterNumbers() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Premium Header */}
      <motion.div 
        className="flex items-center gap-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="page-header-icon">
          <Search />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gradient">Filtrar Números Ativos</h1>
          <p className="text-muted-foreground">
            Valide listas de contatos e identifique números ativos no WhatsApp
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Validação de Números</CardTitle>
            <CardDescription>
              Importe sua lista de contatos e verifique quais números estão ativos no WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WhatsAppNumberFilter />
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
