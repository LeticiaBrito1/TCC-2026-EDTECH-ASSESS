import React, { useState } from "react";
import { appClient } from "@/api/appClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Plus, Pencil, Trash2, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

export default function Alunos() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterTurma, setFilterTurma] = useState("all");
  const [form, setForm] = useState({ nome: "", matricula: "", email: "", turma_id: "", ativo: true });
  const qc = useQueryClient();

  const { data: alunos = [] } = useQuery({ queryKey: ["alunos"], queryFn: () => appClient.entities.Aluno.list() });
  const { data: turmas = [] } = useQuery({ queryKey: ["turmas"], queryFn: () => appClient.entities.Turma.list() });

  const create = useMutation({ mutationFn: (d) => appClient.entities.Aluno.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["alunos"] }); closeDialog(); } });
  const update = useMutation({ mutationFn: ({ id, d }) => appClient.entities.Aluno.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["alunos"] }); closeDialog(); } });
  const remove = useMutation({ mutationFn: (id) => appClient.entities.Aluno.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["alunos"] }) });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm({ nome: "", matricula: "", email: "", turma_id: "", ativo: true }); };
  const openEdit = (a) => { setEditing(a); setForm({ nome: a.nome, matricula: a.matricula || "", email: a.email || "", turma_id: a.turma_id || "", ativo: a.ativo !== false }); setDialogOpen(true); };

  const handleSubmit = () => {
    if (!form.nome || !form.turma_id) return;
    editing ? update.mutate({ id: editing.id, d: form }) : create.mutate(form);
  };

  const getTurmaName = (id) => turmas.find(t => t.id === id)?.nome || "—";
  const filtered = alunos
    .filter(a => filterTurma === "all" || a.turma_id === filterTurma)
    .filter(a => a.nome?.toLowerCase().includes(search.toLowerCase()) || a.matricula?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Alunos" description="Gerencie os alunos de suas turmas" action={() => setDialogOpen(true)} actionLabel="Novo Aluno" actionIcon={Plus} />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar alunos..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterTurma} onValueChange={setFilterTurma}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Filtrar turma" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as turmas</SelectItem>
            {turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={GraduationCap} title="Nenhum aluno" description="Cadastre seus alunos para começar." actionLabel="Cadastrar Aluno" onAction={() => setDialogOpen(true)} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Turma</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(a => (
                  <TableRow key={a.id}>
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
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove.mutate(a.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

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
    </div>
  );
}
