import React, { useState, useMemo } from "react";
import { appClient } from "@/api/appClient";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Relatorios() {
  const [filterTurma, setFilterTurma] = useState("all");
  const [filterAvaliacao, setFilterAvaliacao] = useState("all");

  const { data: turmas = [] } = useQuery({ queryKey: ["turmas"], queryFn: () => appClient.entities.Turma.list() });
  const { data: avaliacoes = [] } = useQuery({ queryKey: ["avaliacoes"], queryFn: () => appClient.entities.Avaliacao.list() });
  const { data: alunos = [] } = useQuery({ queryKey: ["alunos"], queryFn: () => appClient.entities.Aluno.list() });
  const { data: questoes = [] } = useQuery({ queryKey: ["questoes"], queryFn: () => appClient.entities.Questao.list() });
  const { data: resultados = [] } = useQuery({ queryKey: ["resultados"], queryFn: () => appClient.entities.Resultado.list() });

  const filteredResults = useMemo(() => {
    return resultados.filter(r => {
      if (filterTurma !== "all" && r.turma_id !== filterTurma) return false;
      if (filterAvaliacao !== "all" && r.avaliacao_id !== filterAvaliacao) return false;
      return true;
    });
  }, [resultados, filterTurma, filterAvaliacao]);

  const stats = useMemo(() => {
    if (filteredResults.length === 0) return { media: 0, max: 0, min: 0, aprovados: 0, total: 0 };
    const notas = filteredResults.map(r => r.percentual_acerto || 0);
    return {
      media: Math.round(notas.reduce((a, b) => a + b, 0) / notas.length),
      max: Math.round(Math.max(...notas)),
      min: Math.round(Math.min(...notas)),
      aprovados: notas.filter(n => n >= 60).length,
      total: filteredResults.length
    };
  }, [filteredResults]);

  const desempenhoQuestoes = useMemo(() => {
    if (filteredResults.length === 0) return [];
    const qMap = {};
    filteredResults.forEach(r => {
      r.respostas?.forEach(resp => {
        if (!qMap[resp.questao_id]) qMap[resp.questao_id] = { acertos: 0, total: 0 };
        qMap[resp.questao_id].total++;
        if (resp.correta) qMap[resp.questao_id].acertos++;
      });
    });
    return Object.entries(qMap).map(([qid, data], idx) => ({
      name: `Q${idx + 1}`,
      percentual: Math.round((data.acertos / data.total) * 100),
      questao: questoes.find(q => q.id === qid)
    }));
  }, [filteredResults, questoes]);

  const exportCSV = () => {
    const header = "Aluno,Nota,Acertos,Total,Percentual\n";
    const rows = filteredResults.map(r => {
      const aluno = alunos.find(a => a.id === r.aluno_id);
      return `${aluno?.nome || "—"},${r.nota},${r.total_acertos},${r.total_questoes},${r.percentual_acerto}%`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio_resultados.csv";
    a.click();
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader title="Relatórios" description="Análise de desempenho dos alunos" />

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
          <div className="space-y-2 flex-1">
            <Label>Turma</Label>
            <Select value={filterTurma} onValueChange={setFilterTurma}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as turmas</SelectItem>
                {turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 flex-1">
            <Label>Avaliação</Label>
            <Select value={filterAvaliacao} onValueChange={setFilterAvaliacao}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {avaliacoes.map(a => <SelectItem key={a.id} value={a.id}>{a.titulo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full sm:w-auto" variant="outline" onClick={exportCSV} disabled={filteredResults.length === 0}>
            <Download className="w-4 h-4 mr-2" />Exportar CSV
          </Button>
        </CardContent>
      </Card>

      {filteredResults.length === 0 ? (
        <EmptyState icon={BarChart3} title="Sem resultados" description="Corrija avaliações para ver relatórios aqui." />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-5">
              <p className="text-sm text-muted-foreground">Média Geral</p>
              <p className="text-3xl font-bold text-primary mt-1">{stats.media}%</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground">Nota Máxima</p>
              <p className="text-3xl font-bold text-success mt-1">{stats.max}%</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground">Nota Mínima</p>
              <p className="text-3xl font-bold text-destructive mt-1">{stats.min}%</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground">Aprovados (≥60%)</p>
              <p className="text-3xl font-bold text-foreground mt-1">{stats.aprovados}/{stats.total}</p>
            </Card>
          </div>

          {/* Gráfico de desempenho por questão */}
          {desempenhoQuestoes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Acerto por Questão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={desempenhoQuestoes}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(val) => `${val}%`} />
                    <Bar dataKey="percentual" fill="hsl(234, 89%, 56%)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Tabela de resultados */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Resultados Individuais</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aluno</TableHead>
                      <TableHead>Avaliação</TableHead>
                      <TableHead>Nota</TableHead>
                      <TableHead>Acertos</TableHead>
                      <TableHead>Desempenho</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResults.map(r => {
                      const aluno = alunos.find(a => a.id === r.aluno_id);
                      const av = avaliacoes.find(a => a.id === r.avaliacao_id);
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{aluno?.nome || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{av?.titulo || "—"}</TableCell>
                          <TableCell className="font-semibold">{r.nota}</TableCell>
                          <TableCell>{r.total_acertos}/{r.total_questoes}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3 min-w-[120px]">
                              <Progress value={r.percentual_acerto} className="flex-1" />
                              <span className={`text-sm font-medium ${r.percentual_acerto >= 60 ? 'text-success' : 'text-destructive'}`}>
                                {r.percentual_acerto}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
