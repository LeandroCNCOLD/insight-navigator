import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Brain, FileText, BarChart3, MessagesSquare, ShieldCheck, Zap, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "DocIntel — Inteligência competitiva documental com IA" },
      { name: "description", content: "Plataforma SaaS para análise massiva de propostas, contratos e documentos técnicos de concorrentes. Extração com IA, benchmarking e chat analítico." },
    ],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-8 rounded-md gradient-primary shadow-glow flex items-center justify-center">
              <Brain className="size-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">DocIntel</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost" size="sm">Entrar</Button></Link>
            <Link to="/auth"><Button size="sm">Começar grátis</Button></Link>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-muted/30 text-xs text-muted-foreground mb-6">
          <Zap className="size-3 text-primary" /> Nova geração de inteligência competitiva
        </div>
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight max-w-3xl mx-auto leading-[1.05]">
          Transforme milhares de propostas em <span className="text-gradient">vantagem estratégica</span>
        </h1>
        <p className="text-lg text-muted-foreground mt-6 max-w-2xl mx-auto">
          Análise massiva de propostas comerciais, contratos e memoriais técnicos de concorrentes. Extração com IA, benchmarking e chat analítico para refrigeração, agroindústria e engenharia.
        </p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <Link to="/auth"><Button size="lg" className="gradient-primary shadow-glow">Começar agora <ArrowRight className="size-4 ml-1" /></Button></Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: FileText, title: "Upload massivo", desc: "PDF, DOCX, XLSX. Centenas de arquivos por vez, organizados por concorrente, cliente e região." },
            { icon: Brain, title: "Extração com IA", desc: "Cliente, valor, equipamentos, prazos, garantia, cláusulas — tudo estruturado com score de confiança." },
            { icon: BarChart3, title: "Benchmarking técnico", desc: "Dashboards comerciais, técnicos, contratuais, geográficos e estratégicos com filtros profundos." },
            { icon: MessagesSquare, title: "Chat analítico", desc: "Pergunte em linguagem natural sobre sua base e receba respostas com evidência e gráficos." },
            { icon: ShieldCheck, title: "Revisão humana", desc: "Valide campos com baixa confiança, treine dicionários e melhore a precisão continuamente." },
            { icon: Zap, title: "Comparação lado-a-lado", desc: "Compare propostas, escopo, prazos, valores e cláusulas para identificar padrões e oportunidades." },
          ].map((f) => (
            <div key={f.title} className="p-6 rounded-lg border border-border gradient-surface">
              <div className="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center mb-3"><f.icon className="size-4" /></div>
              <div className="font-medium">{f.title}</div>
              <div className="text-sm text-muted-foreground mt-1">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        DocIntel © {new Date().getFullYear()} — Inteligência competitiva documental com IA.
      </footer>
    </div>
  );
}
