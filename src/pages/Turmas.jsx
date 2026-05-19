import React, { useState } from "react";
import { appClient } from "@/api/appClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Pencil, Trash2, Search, GraduationCap, BookOpen, ClipboardCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { format, isValid, parseISO } from "date-fns";

const PERIODOS = { matutino: "Matutino", vespertino: "Vespertino", noturno: "Noturno", integral: "Integral" };
const NIVEIS = { fundamental_1: "Fund. I", fundamental_2: "Fund. II", medio: "Médio", superior: "Superior", tecnico: "Técnico" };

const STATUS_LABEL = { rascunho: "Rascunho", publicada: "Publicada", aplicada: "Aplicada", corrigida: "Corrigida" };

export default function Turmas() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTurma, setSelectedTurma] = useState(null);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ nome: "", ano_letivo: "2025", periodo: "matutino", nivel: "medio", instituicao: "", ativa: true });
  const qc = useQueryClient();

  const { data: turmas = [] } = useQuery({ queryKey: ["turmas"], queryFn: () => appClient.entities.Turma.list() });
  const { data: alunos = [] } = useQuery({ queryKey: ["alunos"], queryFn: () => appClient.entities.Aluno.list() });
  const { data: disciplinas = [] } = useQuery({ queryKey: ["disciplinas"], queryFn: () => appClient.entities.Disciplina.list() });
  const { data: avaliacoes = [] } = useQuery({ queryKey: ["avaliacoes"], queryFn: () => appClient.entities.Avaliacao.list() });

  const create = useMutation({ mutationFn: (d) => appClient.entities.Turma.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["turmas"] }); closeDialog(); } });
  const update = useMutation({ mutationFn: ({ id, d }) => appClient.entities.Turma.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["turmas"] }); closeDialog(); } });
  const remove = useMutation({ mutationFn: (id) => appClient.entities.Turma.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["turmas"] }) });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm({ nome: "", ano_letivo: "2025", periodo: "matutino", nivel: "medio", instituicao: "", ativa: true }); };

  const openEdit = (t, e) => {
    e?.stopPropagation();
    setEditing(t);
    setForm({ nome: t.nome, ano_letivo: t.ano_letivo, periodo: t.periodo || "matutino", nivel: t.nivel || "medio", instituicao: t.instituicao || "", ativa: t.ativa !== false });
    setDialogOpen(true);
  };

  const openDetail = (t) => { setSelectedTurma(t); setDetailOpen(true); };

  const handleDelete = (id, e) => { e?.stopPropagation(); remove.mutate(id); };

  const handleSubmit = () => {
    if (!form.nome || !form.ano_letivo) return;
    editing ? update.mutate({ id: editing.id, d: form }) : create.mutate(form);
  };

  const filtered = turmas.filter(t => t.nome?.toLowerCase().includes(search.toLowerCase()) || t.instituicao?.toLowerCase().includes(search.toLowerCase()));

  const getAlunosDaTurma = (id) => alunos.filter(a => a.turma_id === id);
  const getDisciplinasDaTurma = (id) => disciplinas.filter(d => d.turma_id === id);
  const getAvaliacoesDaTurma = (id) => avaliacoes.filter(a => a.turma_id === id);

  const formatDate = (d) => {
    if (!d) return "—";
    const p = typeof d === "string" ? parseISO(d) : new Date(d);
    return isValid(p) ? format(p, "dd/MM/yyyy") : "—";
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Turmas" description="Gerencie suas turmas" action={() => setDialogOpen(true)} actionLabel="Nova Turma" actionIcon={Plus} />

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar turmas..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="Nenhuma turma" description="Cadastre sua primeira turma para começar." actionLabel="Criar Turma" onAction={() => setDialogOpen(true)} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => {
            const numAlunos = alunos.filter(a => a.turma_id === t.id).length;
            return (
              <Card key={t.id} className="hover:shadow-lg transition-shadow duration-300 group cursor-pointer" onClick={() => openDetail(t)}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{t.nome}</h3>
                        <p className="text-xs text-muted-foreground">{t.ano_letivo} • {PERIODOS[t.periodo] || t.periodo}</p>
                      </div>
                    </div>
                    <Badge variant={t.ativa !== false ? "default" : "secondary"} className="text-xs">
                      {t.ativa !== false ? "Ativa" : "Inativa"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-xs">{NIVEIS[t.nivel] || t.nivel}</Badge>
                      <Badge variant="outline" className="text-xs">{numAlunos} alunos</Badge>
                    </div>
                    <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => openEdit(t, e)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => handleDelete(t.id, e)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog: Novo/Editar turma */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Turma" : "Nova Turma"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: 3º Ano A" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Ano Letivo *</Label>
                <Select value={form.ano_letivo} onValueChange={v => setForm({ ...form, ano_letivo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["2020","2021","2022","2023","2024","2025","2026","2027","2028","2029","2030"].map(y => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Período</Label>
                <Select value={form.periodo} onValueChange={v => setForm({ ...form, periodo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PERIODOS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Nível</Label>
                <Select value={form.nivel} onValueChange={v => setForm({ ...form, nivel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(NIVEIS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Instituição</Label><Input value={form.instituicao} onChange={e => setForm({ ...form, instituicao: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>{editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Detalhe da turma */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              {selectedTurma?.nome}
            </DialogTitle>
          </DialogHeader>
          {selectedTurma && (
            <div className="space-y-6 py-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{selectedTurma.ano_letivo}</Badge>
                <Badge variant="outline">{PERIODOS[selectedTurma.periodo] || selectedTurma.periodo}</Badge>
                <Badge variant="outline">{NIVEIS[selectedTurma.nivel] || selectedTurma.nivel}</Badge>
                {selectedTurma.instituicao && <Badge variant="outline">{selectedTurma.instituicao}</Badge>}
                <Badge variant={selectedTurma.ativa !== false ? "default" : "secondary"}>
                  {selectedTurma.ativa !== false ? "Ativa" : "Inativa"}
                </Badge>
              </div>

              {/* Alunos */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  Alunos ({getAlunosDaTurma(selectedTurma.id).length})
                </h3>
                {getAlunosDaTurma(selectedTurma.id).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum aluno nesta turma.</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Nome</TableHead>
                          <TableHead className="text-xs">Matrícula</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getAlunosDaTurma(selectedTurma.id).map(a => (
                          <TableRow key={a.id}>
                            <TableCell className="text-sm py-2">{a.nome}</TableCell>
                            <TableCell className="text-sm py-2 text-muted-foreground">{a.matricula || "—"}</TableCell>
                            <TableCell className="py-2">
                              <Badge variant={a.ativo !== false ? "default" : "secondary"} className="text-xs">
                                {a.ativo !== false ? "Ativo" : "Inativo"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Disciplinas */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  Disciplinas ({getDisciplinasDaTurma(selectedTurma.id).length})
                </h3>
                {getDisciplinasDaTurma(selectedTurma.id).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma disciplina vinculada a esta turma.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {getDisciplinasDaTurma(selectedTurma.id).map(d => (
                      <Badge key={d.id} variant="secondary">{d.nome}{d.codigo ? ` (${d.codigo})` : ""}</Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Avaliações */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-primary" />
                  Avaliações Aplicadas ({getAvaliacoesDaTurma(selectedTurma.id).length})
                </h3>
                {getAvaliacoesDaTurma(selectedTurma.id).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma avaliação aplicada para esta turma.</p>
                ) : (
                  <div className="space-y-2">
                    {getAvaliacoesDaTurma(selectedTurma.id).map(a => (
                      <div key={a.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                        <div>
                          <p className="font-medium">{a.titulo}</p>
                          <p className="text-xs text-muted-foreground">{a.questoes_ids?.length || 0} questões · {a.total_pontos || 0} pts</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {a.data_aplicacao && <span className="text-xs text-muted-foreground">{formatDate(a.data_aplicacao)}</span>}
                          <Badge className="text-xs">{STATUS_LABEL[a.status] || a.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Fechar</Button>
            {selectedTurma && (
              <Button onClick={(e) => { setDetailOpen(false); openEdit(selectedTurma, e); }}>
                <Pencil className="w-4 h-4 mr-2" />
                Editar Turma
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
