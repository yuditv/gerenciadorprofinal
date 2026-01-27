import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/ThemeProvider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="glass-card border-primary/30 hover:border-primary hover:neon-glow transition-all duration-300"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Alternar tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass-card border-border/50">
        <DropdownMenuItem 
          onClick={() => setTheme("light")}
          className={`hover:bg-primary/10 ${theme === 'light' ? 'bg-primary/10' : ''}`}
        >
          <Sun className="h-4 w-4 mr-2 text-yellow-500" />
          Claro
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme("dark")}
          className={`hover:bg-primary/10 ${theme === 'dark' ? 'bg-primary/10' : ''}`}
        >
          <Moon className="h-4 w-4 mr-2 text-primary" />
          Escuro
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme("system")}
          className={`hover:bg-primary/10 ${theme === 'system' ? 'bg-primary/10' : ''}`}
        >
          <span className="h-4 w-4 mr-2 flex items-center justify-center text-accent">💻</span>
          Sistema
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
