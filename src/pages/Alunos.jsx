import React, { useState } from "react";
import { appClient } from "@/api/appClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Plus, Pencil, Trash2, Search, Download, FileSpreadsheet, Upload, Loader2, CheckCircle2, XCircle, ArrowUpDown, ClipboardCheck } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/AlertDialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { checkContent } from "@/lib/profanityFilter";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

const normalizeKey = (key) => String(key || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const detectField = (row, candidates) => {
  for (const key of Object.keys(row)) {
    if (candidates.includes(normalizeKey(key))) return row[key] || "";
  }
  return "";
};

const parseAlunoRow = (row) => ({
  nome: detectField(row, ["nome", "name", "aluno", "student", "aluno(a)"]),
  matricula: detectField(row, ["matricula", "mat", "registration", "matriculation", "rm", "ra"]),
  email: detectField(row, ["email", "e-mail", "mail"]),
});

export default function Alunos() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedAluno, setSelectedAluno] = useState(null);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterTurma, setFilterTurma] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("nome_asc");
  const [form, setForm] = useState({ nome: "", matricula: "", email: "", turma_id: "", ativo: true });
  const [importRows, setImportRows] = useState([]);
  const [importTurmaId, setImportTurmaId] = useState("");
  const [importProgress, setImportProgress] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: alunos = [] } = useQuery({ queryKey: ["alunos"], queryFn: () => appClient.entities.Aluno.list() });
  const { data: turmas = [] } = useQuery({ queryKey: ["turmas"], queryFn: () => appClient.entities.Turma.list() });
  const { data: avaliacoes = [] } = useQuery({ queryKey: ["avaliacoes"], queryFn: () => appClient.entities.Avaliacao.list() });
  const { data: resultados = [] } = useQuery({ queryKey: ["resultados"], queryFn: () => appClient.entities.Resultado.list() });

  const create = useMutation({ mutationFn: (d) => appClient.entities.Aluno.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["alunos"] }); closeDialog(); } });
  const update = useMutation({ mutationFn: ({ id, d }) => appClient.entities.Aluno.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["alunos"] }); closeDialog(); } });
  const remove = useMutation({ mutationFn: (id) => appClient.entities.Aluno.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["alunos"] }) });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm({ nome: "", matricula: "", email: "", turma_id: "", ativo: true }); };
  const openEdit = (a, e) => {
    e?.stopPropagation();
    setEditing(a);
    setForm({ nome: a.nome, matricula: a.matricula || "", email: a.email || "", turma_id: a.turma_id || "", ativo: a.ativo !== false });
    setDialogOpen(true);
  };

  const openDetail = (a) => { setSelectedAluno(a); setDetailOpen(true); };

  const handleDelete = (aluno, e) => { e?.stopPropagation(); setDeleteTarget(aluno); setDeleteDialogOpen(true); };

  const closeImportDialog = () => {
    setImportDialogOpen(false);
    setImportRows([]);
    setImportTurmaId("");
    setImportProgress(null);
    setImportResults(null);
  };

  const handleSubmit = () => {
    if (!form.nome || !form.turma_id) return;
    const check = checkContent(form.nome);
    if (!check.ok) {
      toast({ title: "Conteúdo inadequado", description: "O nome informado contém palavras inapropriadas.", variant: "destructive" });
      return;
    }
    const isChangingTurma = editing ? editing.turma_id !== form.turma_id : true;
    if (!editing || isChangingTurma) {
      const alunosNaTurma = alunos.filter(a => a.turma_id === form.turma_id && a.id !== editing?.id);
      if (alunosNaTurma.length >= 30) {
        toast({ title: "Limite atingido", description: "Esta turma já possui 30 alunos (limite máximo).", variant: "destructive" });
        return;
      }
    }
    editing ? update.mutate({ id: editing.id, d: form }) : create.mutate(form);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        const parsed = rows.map(parseAlunoRow).filter(r => r.nome.trim());
        setImportRows(parsed);
        setImportResults(null);
      } catch {
        toast({ title: "Erro ao ler arquivo", description: "Verifique se o arquivo é um CSV ou XLSX válido.", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!importTurmaId || importRows.length === 0) return;

    const alunosNaTurma = alunos.filter(a => a.turma_id === importTurmaId);
    const vagas = 30 - alunosNaTurma.length;
    const toImport = importRows.slice(0, Math.max(0, vagas));

    if (toImport.length === 0) {
      toast({ title: "Turma lotada", description: "Esta turma já possui 30 alunos.", variant: "destructive" });
      return;
    }

    const results = { ok: 0, fail: 0, skipped: importRows.length - toImport.length };
    setImportProgress({ current: 0, total: toImport.length });

    for (let i = 0; i < toImport.length; i++) {
      const row = toImport[i];
      try {
        await appClient.entities.Aluno.create({ nome: row.nome.trim(), matricula: row.matricula || "", email: row.email || "", turma_id: importTurmaId, ativo: true });
        results.ok++;
      } catch {
        results.fail++;
      }
      setImportProgress({ current: i + 1, total: toImport.length });
    }

    qc.invalidateQueries({ queryKey: ["alunos"] });
    setImportResults(results);
    setImportProgress(null);
  };

  const getTurmaName = (id) => turmas.find(t => t.id === id)?.nome || "—";

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = alunos
    .filter(a => filterTurma === "all" || a.turma_id === filterTurma)
    .filter(a => filterStatus === "all" || (filterStatus === "ativo" ? a.ativo !== false : a.ativo === false))
    .filter(a => a.nome?.toLowerCase().includes(search.toLowerCase()) || String(a.matricula ?? "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case "nome_asc":  return (a.nome || "").localeCompare(b.nome || "", "pt-BR");
        case "nome_desc": return (b.nome || "").localeCompare(a.nome || "", "pt-BR");
        case "mat_asc":   return String(a.matricula ?? "").localeCompare(String(b.matricula ?? ""), "pt-BR");
        case "mat_desc":  return String(b.matricula ?? "").localeCompare(String(a.matricula ?? ""), "pt-BR");
        case "turma":     return getTurmaName(a.turma_id).localeCompare(getTurmaName(b.turma_id), "pt-BR");
        default: return 0;
      }
    });

  const buildAlunosRows = () =>
    filtered.map(a => ({
      Nome: a.nome,
      Matrícula: a.matricula || "",
      Email: a.email || "",
      Turma: getTurmaName(a.turma_id),
      Status: a.ativo !== false ? "Ativo" : "Inativo",
    }));

  const exportAlunosXLSX = () => {
    const rows = buildAlunosRows();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Info: "Sem dados" }]);
    XLSX.utils.book_append_sheet(wb, ws, "Alunos");
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "lista_alunos.xlsx");
  };

  const exportAlunosPDF = () => {
    const rows = buildAlunosRows();
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    let y = 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    rows.forEach((row, i) => {
      if (y > 278) { doc.addPage(); y = 14; }
      doc.text(`${i + 1}. ${row.Nome}  |  Mat: ${row.Matrícula || "—"}  |  ${row.Turma}`, 14, y);
      y += 6;
    });
    doc.save("lista_alunos.pdf");
  };

  const getResultadosDoAluno = (alunoId) => resultados.filter(r => r.aluno_id === alunoId);
  const getAvaliacaoTitulo = (avaliacaoId) => avaliacoes.find(a => a.id === avaliacaoId)?.titulo || "—";

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Alunos" description="Gerencie os alunos de suas turmas" action={() => setDialogOpen(true)} actionLabel="Novo Aluno" actionIcon={Plus} />

      <div className="flex flex-wrap gap-2 mb-3">
        <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
          <Upload className="w-4 h-4 mr-2" />Importar em Lote
        </Button>
        <Button variant="outline" size="sm" onClick={exportAlunosXLSX} disabled={filtered.length === 0}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />Exportar XLSX
        </Button>
        <Button variant="outline" size="sm" onClick={exportAlunosPDF} disabled={filtered.length === 0}>
          <Download className="w-4 h-4 mr-2" />Exportar PDF
        </Button>
      </div>

      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input placeholder="Buscar por nome ou matrícula..." aria-label="Buscar alunos por nome ou matrícula" value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={filterTurma} onValueChange={setFilterTurma}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Turma" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as turmas</SelectItem>
              {turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-48">
              <ArrowUpDown className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nome_asc">Nome A → Z</SelectItem>
              <SelectItem value="nome_desc">Nome Z → A</SelectItem>
              <SelectItem value="mat_asc">Matrícula ↑</SelectItem>
              <SelectItem value="mat_desc">Matrícula ↓</SelectItem>
              <SelectItem value="turma">Turma</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(search || filterTurma !== "all" || filterStatus !== "all") && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{filtered.length} aluno(s) encontrado(s)</span>
            <button
              className="text-primary hover:underline text-xs"
              onClick={() => { setSearch(""); setFilterTurma("all"); setFilterStatus("all"); setSortBy("nome_asc"); }}
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={GraduationCap} title="Nenhum aluno" description="Cadastre seus alunos para começar." actionLabel="Cadastrar Aluno" onAction={() => setDialogOpen(true)} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none hover:text-foreground"
                    onClick={() => setSortBy(s => s === "nome_asc" ? "nome_desc" : "nome_asc")}
                  >
                    <span className="flex items-center gap-1">Nome <ArrowUpDown className="w-3 h-3 opacity-50" /></span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:text-foreground"
                    onClick={() => setSortBy(s => s === "mat_asc" ? "mat_desc" : "mat_asc")}
                  >
                    <span className="flex items-center gap-1">Matrícula <ArrowUpDown className="w-3 h-3 opacity-50" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => setSortBy("turma")}>
                    <span className="flex items-center gap-1">Turma <ArrowUpDown className="w-3 h-3 opacity-50" /></span>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(a => (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => openDetail(a)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                          {a.nome?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{a.nome}</p>
                          {a.email && <p className="text-xs text-muted-foreground">{a.email}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{a.matricula || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{getTurmaName(a.turma_id)}</Badge></TableCell>
                    <TableCell><Badge variant={a.ativo !== false ? "default" : "secondary"} className="text-xs">{a.ativo !== false ? "Ativo" : "Inativo"}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Editar aluno ${a.nome}`} onClick={(e) => openEdit(a, e)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label={`Excluir aluno ${a.nome}`} onClick={(e) => handleDelete(a, e)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Dialog: Novo/Editar aluno */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Aluno" : "Novo Aluno"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Nome completo *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Matrícula</Label><Input value={form.matricula} onChange={e => setForm({ ...form, matricula: e.target.value })} /></div>
              <div className="space-y-2"><Label>E-mail</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Turma *</Label>
              <Select value={form.turma_id} onValueChange={v => setForm({ ...form, turma_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>{editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Detalhe do aluno */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                {selectedAluno?.nome?.[0]?.toUpperCase()}
              </div>
              {selectedAluno?.nome}
            </DialogTitle>
          </DialogHeader>
          {selectedAluno && (
            <div className="space-y-5 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Matrícula</p>
                  <p className="font-medium">{selectedAluno.matricula || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Turma</p>
                  <p className="font-medium">{getTurmaName(selectedAluno.turma_id)}</p>
                </div>
                {selectedAluno.email && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">E-mail</p>
                    <p className="font-medium">{selectedAluno.email}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={selectedAluno.ativo !== false ? "default" : "secondary"} className="text-xs mt-1">
                    {selectedAluno.ativo !== false ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-primary" />
                  Notas nas Avaliações ({getResultadosDoAluno(selectedAluno.id).length})
                </h3>
                {getResultadosDoAluno(selectedAluno.id).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma avaliação corrigida para este aluno.</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Avaliação</TableHead>
                          <TableHead className="text-xs text-right">Acertos</TableHead>
                          <TableHead className="text-xs text-right">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getResultadosDoAluno(selectedAluno.id).map(r => (
                          <TableRow key={r.id}>
                            <TableCell className="text-xs py-2">{getAvaliacaoTitulo(r.avaliacao_id)}</TableCell>
                            <TableCell className="text-xs py-2 text-right text-muted-foreground">
                              {r.acertos ?? "—"}{r.total_questoes ? `/${r.total_questoes}` : ""}
                            </TableCell>
                            <TableCell className="text-xs py-2 text-right font-medium">
                              {r.percentual_acerto != null ? `${Number(r.percentual_acerto).toFixed(1)}%` : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Fechar</Button>
            {selectedAluno && (
              <Button onClick={(e) => { setDetailOpen(false); openEdit(selectedAluno, e); }}>
                <Pencil className="w-4 h-4 mr-2" />
                Editar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Importar em lote */}
      <Dialog open={importDialogOpen} onOpenChange={v => { if (!v) closeImportDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar Alunos em Lote</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Selecione um arquivo <strong>CSV ou XLSX</strong> com as colunas: <strong>Nome</strong>, Matrícula (opcional), Email (opcional).
            </p>

            <div className="space-y-2">
              <Label>Arquivo (CSV ou XLSX)</Label>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-foreground"
              />
            </div>

            {importRows.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label>Turma de destino *</Label>
                  <Select value={importTurmaId} onValueChange={setImportTurmaId}>
                    <SelectTrigger><SelectValue placeholder="Selecione a turma" /></SelectTrigger>
                    <SelectContent>{turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                  </Select>
                  {importTurmaId && (
                    <p className="text-xs text-muted-foreground">
                      Vagas disponíveis: {Math.max(0, 30 - alunos.filter(a => a.turma_id === importTurmaId).length)} de 30
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">{importRows.length} aluno(s) detectado(s) — pré-visualização:</p>
                  <div className="max-h-48 overflow-y-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Nome</TableHead>
                          <TableHead className="text-xs">Matrícula</TableHead>
                          <TableHead className="text-xs">Email</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importRows.slice(0, 20).map((row, i) => (
                          <TableRow key={i} className={!row.nome.trim() ? "opacity-40" : ""}>
                            <TableCell className="text-xs py-1">{row.nome || "—"}</TableCell>
                            <TableCell className="text-xs py-1 text-muted-foreground">{row.matricula || "—"}</TableCell>
                            <TableCell className="text-xs py-1 text-muted-foreground">{row.email || "—"}</TableCell>
                          </TableRow>
                        ))}
                        {importRows.length > 20 && (
                          <TableRow><TableCell colSpan={3} className="text-xs text-center text-muted-foreground">... e mais {importRows.length - 20} registros</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}

            {importProgress && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Importando {importProgress.current} de {importProgress.total}...</p>
                <Progress value={(importProgress.current / importProgress.total) * 100} />
              </div>
            )}

            {importResults && (
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2 text-success">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm font-medium">{importResults.ok} aluno(s) importado(s) com sucesso</span>
                  </div>
                  {importResults.fail > 0 && (
                    <div className="flex items-center gap-2 text-destructive">
                      <XCircle className="w-4 h-4" />
                      <span className="text-sm">{importResults.fail} falha(s)</span>
                    </div>
                  )}
                  {importResults.skipped > 0 && (
                    <p className="text-xs text-muted-foreground">{importResults.skipped} ignorado(s) por limite da turma (máx. 30).</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeImportDialog}>
              {importResults ? "Fechar" : "Cancelar"}
            </Button>
            {!importResults && (
              <Button
                onClick={handleImport}
                disabled={!importTurmaId || importRows.length === 0 || !!importProgress}
              >
                {importProgress ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {importProgress ? "Importando..." : `Importar ${importRows.length} aluno(s)`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aluno?</AlertDialogTitle>
            <AlertDialogDescription>
              O aluno <strong>{deleteTarget?.nome}</strong> será excluído permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteDialogOpen(false); setDeleteTarget(null); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { remove.mutate(deleteTarget.id); setDeleteDialogOpen(false); setDeleteTarget(null); }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
