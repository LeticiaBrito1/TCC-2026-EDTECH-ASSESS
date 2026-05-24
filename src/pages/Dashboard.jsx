import React from "react";
import { useNavigate } from "react-router-dom";
import { appClient } from "@/api/appClient";
import { useQuery } from "@tanstack/react-query";
import { Users, BookOpen, GraduationCap, FileQuestion, ClipboardCheck, BarChart3, Target } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import StatCard from "@/components/shared/StatCard";
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = [
  "hsl(234, 89%, 56%)",
  "hsl(160, 84%, 39%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(280, 65%, 60%)"
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: turmas = [] } = useQuery({ queryKey: ["turmas"], queryFn: () => appClient.entities.Turma.list() });
  const { data: disciplinas = [] } = useQuery({ queryKey: ["disciplinas"], queryFn: () => appClient.entities.Disciplina.list() });
  const { data: alunos = [] } = useQuery({ queryKey: ["alunos"], queryFn: () => appClient.entities.Aluno.list() });
  const { data: questoes = [] } = useQuery({ queryKey: ["questoes"], queryFn: () => appClient.entities.Questao.list() });
  const { data: avaliacoes = [] } = useQuery({ queryKey: ["avaliacoes"], queryFn: () => appClient.entities.Avaliacao.list() });
  const { data: resultados = [] } = useQuery({ queryKey: ["resultados"], queryFn: () => appClient.entities.Resultado.list() });

  const statusData = [
    { name: "Rascunho", value: avaliacoes.filter(a => a.status === "rascunho").length },
    { name: "Publicada", value: avaliacoes.filter(a => a.status === "publicada").length },
    { name: "Aplicada", value: avaliacoes.filter(a => a.status === "aplicada").length },
    { name: "Corrigida", value: avaliacoes.filter(a => a.status === "corrigida").length },
  ].filter(d => d.value > 0);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Painel</h1>
        <p className="text-muted-foreground mt-1">Visão geral da plataforma EdTech Assess</p>
      </div>

      {/* Stats clicáveis */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="cursor-pointer" onClick={() => navigate("/Turmas")}>
          <StatCard title="Turmas" value={turmas.length} icon={Users} color="primary" />
        </div>
        <div className="cursor-pointer" onClick={() => navigate("/Alunos")}>
          <StatCard title="Alunos" value={alunos.length} icon={GraduationCap} color="success" />
        </div>
        <div className="cursor-pointer" onClick={() => navigate("/Questoes")}>
          <StatCard title="Questões" value={questoes.length} icon={FileQuestion} color="warning" />
        </div>
        <div className="cursor-pointer" onClick={() => navigate("/Avaliacoes")}>
          <StatCard title="Avaliações" value={avaliacoes.length} icon={ClipboardCheck} color="destructive" />
        </div>
      </div>

      {/* Status das avaliações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Status das Avaliações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhuma avaliação cadastrada
            </div>
          )}
          <div className="flex flex-wrap gap-3 mt-4 justify-center">
            {statusData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-muted-foreground">{d.name}: <span className="font-semibold text-foreground">{d.value}</span></span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Resumo rápido */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-6 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/Relatorios")}>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">Relatórios</h3>
          </div>
          <p className="text-3xl font-bold text-foreground">{resultados.length}</p>
          <p className="text-sm text-muted-foreground mt-1">resultados registrados</p>
        </Card>
        <Card className="p-6 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/Disciplinas")}>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">Disciplinas</h3>
          </div>
          <p className="text-3xl font-bold text-foreground">{disciplinas.length}</p>
          <p className="text-sm text-muted-foreground mt-1">disciplinas cadastradas</p>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-warning/10">
              <ClipboardCheck className="w-5 h-5 text-warning" />
            </div>
            <h3 className="font-semibold text-foreground">Correções</h3>
          </div>
          <p className="text-3xl font-bold text-foreground">{resultados.length}</p>
          <p className="text-sm text-muted-foreground mt-1">provas corrigidas</p>
        </Card>
      </div>
    </div>
  );
}
