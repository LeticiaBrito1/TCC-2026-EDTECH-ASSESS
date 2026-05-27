import React, { useState, useMemo } from "react";
import { appClient } from "@/api/appClient";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download, FileSpreadsheet, FileText, Target, User, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";

export default function Relatorios() {
  const [filterTurma, setFilterTurma] = useState("all");
  const [filterAvaliacao, setFilterAvaliacao] = useState("all");
  const [filterAluno, setFilterAluno] = useState("all");

  const { data: turmas = [] } = useQuery({ queryKey: ["turmas"], queryFn: () => appClient.entities.Turma.list() });
  const { data: avaliacoes = [] } = useQuery({ queryKey: ["avaliacoes"], queryFn: () => appClient.entities.Avaliacao.list() });
  const { data: alunos = [] } = useQuery({ queryKey: ["alunos"], queryFn: () => appClient.entities.Aluno.list() });
  const { data: questoes = [] } = useQuery({ queryKey: ["questoes"], queryFn: () => appClient.entities.Questao.list() });
  const { data: resultados = [] } = useQuery({ queryKey: ["resultados"], queryFn: () => appClient.entities.Resultado.list() });

  const alunosFiltradosPorTurma = useMemo(() => {
    if (filterTurma === "all") return alunos;
    return alunos.filter(a => a.turma_id === filterTurma);
  }, [alunos, filterTurma]);

  const filteredResults = useMemo(() => {
    return resultados.filter(r => {
      if (filterTurma !== "all") {
        const alunoDoResult = alunos.find(a => a.id === r.aluno_id);
        const turmaEfetiva = r.turma_id || alunoDoResult?.turma_id;
        if (turmaEfetiva !== filterTurma) return false;
      }
      if (filterAvaliacao !== "all" && r.avaliacao_id !== filterAvaliacao) return false;
      if (filterAluno !== "all" && r.aluno_id !== filterAluno) return false;
      return true;
    });
  }, [resultados, filterTurma, filterAvaliacao, filterAluno, alunos]);

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

  const desempenhoCompetencias = useMemo(() => {
    if (filteredResults.length === 0) return [];
    const map = {};
    filteredResults.forEach((resultado) => {
      resultado.respostas?.forEach((resposta) => {
        const questao = questoes.find((q) => q.id === resposta.questao_id);
        const competencia = String(questao?.competencia || "Sem competência").trim();
        if (!map[competencia]) map[competencia] = { acertos: 0, total: 0 };
        map[competencia].total += 1;
        if (resposta.correta) map[competencia].acertos += 1;
      });
    });
    return Object.entries(map).map(([competencia, value]) => ({
      competencia,
      percentual: value.total > 0 ? Math.round((value.acertos / value.total) * 100) : 0,
      acertos: value.acertos,
      total: value.total,
    }));
  }, [filteredResults, questoes]);

  const relatorioIndividual = useMemo(() => {
    if (filterAluno === "all") return null;
    const aluno = alunos.find(a => a.id === filterAluno);
    if (!aluno) return null;
    const turma = turmas.find(t => t.id === aluno.turma_id);
    const resultadosAluno = filteredResults;
    const media = resultadosAluno.length > 0
      ? Math.round(resultadosAluno.reduce((acc, r) => acc + (r.percentual_acerto || 0), 0) / resultadosAluno.length)
      : 0;
    return {
      aluno,
      turma,
      resultados: resultadosAluno.map(r => ({
        ...r,
        avaliacao: avaliacoes.find(a => a.id === r.avaliacao_id),
      })),
      media,
    };
  }, [filterAluno, filteredResults, alunos, avaliacoes, turmas]);

  const relatorioGlobalTurma = useMemo(() => {
    if (filterTurma === "all") return null;
    const turma = turmas.find(t => t.id === filterTurma);
    if (!turma) return null;
    const alunosDaTurma = alunos.filter(a => a.turma_id === filterTurma);
    const idsAvsNaTurma = [...new Set(
      resultados.filter(r => r.turma_id === filterTurma).map(r => r.avaliacao_id)
    )];
    const avsTurma = idsAvsNaTurma.map(id => avaliacoes.find(a => a.id === id)).filter(Boolean);
    return { turma, alunos: alunosDaTurma, avaliacoes: avsTurma, resultados };
  }, [filterTurma, alunos, avaliacoes, resultados, turmas]);

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildExportRows = () => {
    const source = filteredResults.length > 0 ? filteredResults : resultados;
    return source.map((r) => {
      const aluno = alunos.find((a) => a.id === r.aluno_id);
      const avaliacao = avaliacoes.find((a) => a.id === r.avaliacao_id);
      const turmaEfetiva = turmas.find((t) => t.id === (r.turma_id || aluno?.turma_id));
      return {
        Aluno: aluno?.nome || "—",
        Turma: turmaEfetiva?.nome || "—",
        Avaliacao: avaliacao?.titulo || "—",
        Nota: r.nota ?? 0,
        Acertos: `${r.total_acertos ?? 0}/${r.total_questoes ?? 0}`,
        Percentual: `${r.percentual_acerto ?? 0}%`,
      };
    });
  };

  const exportCSV = () => {
    const rows = buildExportRows();
    const header = Object.keys(rows[0] || {}).join(",");
    const body = rows.map((row) => Object.values(row).join(",")).join("\n");
    const content = rows.length > 0 ? `${header}\n${body}` : "Sem dados";
    downloadBlob(new Blob([content], { type: "text/csv" }), "relatorio_resultados.csv");
  };

  const exportXLSX = () => {
    const rows = buildExportRows();
    const wb = XLSX.utils.book_new();
    const wsResultados = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Info: "Sem dados" }]);
    const wsResumo = XLSX.utils.json_to_sheet([
      { Indicador: "Média Geral", Valor: `${stats.media}%` },
      { Indicador: "Nota Máxima", Valor: `${stats.max}%` },
      { Indicador: "Nota Mínima", Valor: `${stats.min}%` },
      { Indicador: "Aprovados", Valor: `${stats.aprovados}/${stats.total}` },
    ]);
    XLSX.utils.book_append_sheet(wb, wsResultados, "Resultados");
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    downloadBlob(
      new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      "relatorio_resultados.xlsx"
    );
  };

  const exportPDF = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    let y = 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Relatório de Resultados", 14, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Média geral: ${stats.media}%`, 14, y);
    y += 6;
    doc.text(`Aprovados: ${stats.aprovados}/${stats.total}`, 14, y);
    y += 9;
    doc.setFont("helvetica", "bold");
    doc.text("Resultados Individuais", 14, y);
    y += 6;
    const rows = buildExportRows();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const row of rows) {
      const line = `${row.Aluno} | ${row.Avaliacao} | Nota ${row.Nota} | ${row.Percentual}`;
      const lines = doc.splitTextToSize(line, 180);
      if (y + lines.length * 5 > 285) { doc.addPage(); y = 14; }
      doc.text(lines, 14, y);
      y += lines.length * 5 + 1;
    }
    doc.save("relatorio_resultados.pdf");
  };

  const exportTurmaGlobalXLSX = () => {
    if (!relatorioGlobalTurma) return;
    const { turma, alunos: alunosTurma, avaliacoes: avsTurma, resultados: todos } = relatorioGlobalTurma;
    const rows = alunosTurma.map(aluno => {
      const row = { Aluno: aluno.nome, Matrícula: aluno.matricula || "—" };
      avsTurma.forEach(av => {
        const r = todos.find(r => r.aluno_id === aluno.id && r.avaliacao_id === av.id);
        row[av.titulo] = r != null ? r.nota : "—";
      });
      return row;
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Info: "Sem dados" }]);
    XLSX.utils.book_append_sheet(wb, ws, "Notas da Turma");
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    downloadBlob(
      new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `relatorio_turma_${turma.nome.replace(/\s+/g, "_")}.xlsx`
    );
  };

  const exportTurmaGlobalPDF = () => {
    if (!relatorioGlobalTurma) return;
    const { turma, alunos: alunosTurma, avaliacoes: avsTurma, resultados: todos } = relatorioGlobalTurma;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    let y = 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`Relatório Global — ${turma.nome}`, 14, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    alunosTurma.forEach(aluno => {
      if (y > 275) { doc.addPage(); y = 14; }
      const notasStr = avsTurma.map(av => {
        const r = todos.find(r => r.aluno_id === aluno.id && r.avaliacao_id === av.id);
        return `${av.titulo}: ${r != null ? r.nota : "—"}`;
      }).join("  |  ");
      const line = `${aluno.nome} — ${notasStr || "Sem resultados"}`;
      const lines = doc.splitTextToSize(line, 180);
      doc.text(lines, 14, y);
      y += lines.length * 5 + 2;
    });
    doc.save(`relatorio_turma_${turma.nome.replace(/\s+/g, "_")}.pdf`);
  };

  const exportAlunoIndividualPDF = () => {
    if (!relatorioIndividual) return;
    const { aluno, turma, resultados: rs, media } = relatorioIndividual;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    let y = 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`Relatório Individual — ${aluno.nome}`, 14, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    if (aluno.matricula) { doc.text(`Matrícula: ${aluno.matricula}`, 14, y); y += 5; }
    if (turma) { doc.text(`Turma: ${turma.nome}`, 14, y); y += 5; }
    doc.text(`Média geral: ${media}%`, 14, y);
    y += 9;
    doc.setFont("helvetica", "bold");
    doc.text("Avaliações realizadas:", 14, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    rs.forEach(r => {
      if (y > 275) { doc.addPage(); y = 14; }
      const line = `${r.avaliacao?.titulo || "—"}: Nota ${r.nota}  |  ${r.total_acertos}/${r.total_questoes} acertos  |  ${r.percentual_acerto}%`;
      const lines = doc.splitTextToSize(line, 180);
      doc.text(lines, 14, y);
      y += lines.length * 5 + 2;
    });
    doc.save(`relatorio_${aluno.nome.replace(/\s+/g, "_")}.pdf`);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader title="Relatórios" description="Análise de desempenho dos alunos" />

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="filtro-turma">Turma</Label>
              <Select value={filterTurma} onValueChange={v => { setFilterTurma(v); setFilterAluno("all"); }}>
                <SelectTrigger id="filtro-turma" aria-label="Filtrar por turma"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as turmas</SelectItem>
                  {turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filtro-avaliacao">Avaliação</Label>
              <Select value={filterAvaliacao} onValueChange={setFilterAvaliacao}>
                <SelectTrigger id="filtro-avaliacao" aria-label="Filtrar por avaliação"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {avaliacoes.map(a => <SelectItem key={a.id} value={a.id}>{a.titulo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filtro-aluno">Aluno</Label>
              <Select value={filterAluno} onValueChange={setFilterAluno}>
                <SelectTrigger id="filtro-aluno" aria-label="Filtrar por aluno"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os alunos</SelectItem>
                  {alunosFiltradosPorTurma.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" onClick={exportCSV} disabled={resultados.length === 0} aria-label="Exportar relatório em CSV">
              <Download className="w-4 h-4 mr-2" />CSV
            </Button>
            <Button variant="outline" onClick={exportXLSX} disabled={resultados.length === 0} aria-label="Exportar relatório em XLSX">
              <FileSpreadsheet className="w-4 h-4 mr-2" />XLSX
            </Button>
            <Button variant="outline" onClick={exportPDF} disabled={resultados.length === 0} aria-label="Exportar relatório em PDF">
              <FileText className="w-4 h-4 mr-2" />PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Relatório Global da Turma */}
      {relatorioGlobalTurma && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Relatório Global — {relatorioGlobalTurma.turma.nome}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportTurmaGlobalXLSX} disabled={relatorioGlobalTurma.alunos.length === 0}>
                <FileSpreadsheet className="w-4 h-4 mr-1" />XLSX
              </Button>
              <Button variant="outline" size="sm" onClick={exportTurmaGlobalPDF} disabled={relatorioGlobalTurma.alunos.length === 0}>
                <FileText className="w-4 h-4 mr-1" />PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {relatorioGlobalTurma.alunos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum aluno cadastrado nesta turma.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aluno</TableHead>
                      <TableHead>Matrícula</TableHead>
                      {relatorioGlobalTurma.avaliacoes.map(av => (
                        <TableHead key={av.id} className="text-center">{av.titulo}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relatorioGlobalTurma.alunos.map(aluno => (
                      <TableRow key={aluno.id}>
                        <TableCell className="font-medium">{aluno.nome}</TableCell>
                        <TableCell className="text-muted-foreground">{aluno.matricula || "—"}</TableCell>
                        {relatorioGlobalTurma.avaliacoes.map(av => {
                          const r = relatorioGlobalTurma.resultados.find(
                            r => r.aluno_id === aluno.id && r.avaliacao_id === av.id
                          );
                          return (
                            <TableCell key={av.id} className="text-center">
                              {r != null ? (
                                <Badge variant={r.percentual_acerto >= 60 ? "default" : "destructive"} className="text-xs">
                                  {r.nota}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Relatório Individual do Aluno */}
      {relatorioIndividual && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                Relatório Individual — {relatorioIndividual.aluno.nome}
              </CardTitle>
              {relatorioIndividual.turma && (
                <p className="text-xs text-muted-foreground mt-1">
                  {relatorioIndividual.turma.nome} {relatorioIndividual.aluno.matricula ? `· Mat. ${relatorioIndividual.aluno.matricula}` : ""}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Média</p>
                <p className={`text-xl font-bold ${relatorioIndividual.media >= 60 ? "text-success" : "text-destructive"}`}>
                  {relatorioIndividual.media}%
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={exportAlunoIndividualPDF} disabled={relatorioIndividual.resultados.length === 0}>
                <FileText className="w-4 h-4 mr-1" />PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {relatorioIndividual.resultados.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum resultado registrado para este aluno.</p>
            ) : (
              <div className="space-y-3">
                {relatorioIndividual.resultados.map(r => (
                  <div key={r.id} className="flex items-center gap-4 p-3 rounded-lg border">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.avaliacao?.titulo || "—"}</p>
                      <p className="text-xs text-muted-foreground">{r.total_acertos}/{r.total_questoes} acertos</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-24">
                        <Progress value={r.percentual_acerto} />
                      </div>
                      <span className={`text-sm font-semibold w-10 text-right ${r.percentual_acerto >= 60 ? "text-success" : "text-destructive"}`}>
                        {r.nota}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                  <BarChart data={desempenhoQuestoes} aria-label="Gráfico de acerto por questão">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                    <Tooltip formatter={(val) => `${val}%`} />
                    <Bar dataKey="percentual" fill="hsl(234, 89%, 56%)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {desempenhoCompetencias.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Desempenho por Competência</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {desempenhoCompetencias.map((item) => (
                    <div key={item.competencia}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>{item.competencia}</span>
                        <span className="font-medium">{item.percentual}%</span>
                      </div>
                      <Progress value={item.percentual} aria-label={`${item.competencia}: ${item.percentual}%`} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

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
