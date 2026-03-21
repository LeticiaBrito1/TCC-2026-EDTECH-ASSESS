import React, { useState } from "react";
import { appClient } from "@/api/appClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ScanLine, CheckCircle2, XCircle, Loader2, QrCode } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import PageHeader from "@/components/shared/PageHeader";
import QrCodeScanner from "@/components/shared/QrCodeScanner";

const AVALIACAO_KEYS = ["avaliacao_id", "avaliacaoId", "prova_id", "provaId", "avaliacao", "prova"];
const ALUNO_KEYS = ["aluno_id", "alunoId", "student_id", "studentId", "aluno", "student"];

const getFirstValue = (obj, keys) => {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return null;
};

const parseQrPayload = (rawValue) => {
  const raw = String(rawValue || "").trim();
  if (!raw) return null;

  const buildResult = (obj) => {
    const avaliacaoId = getFirstValue(obj, AVALIACAO_KEYS);
    const alunoId = getFirstValue(obj, ALUNO_KEYS);
    if (!avaliacaoId || !alunoId) return null;
    return { avaliacaoId, alunoId };
  };

  if (raw.startsWith("{") && raw.endsWith("}")) {
    try {
      const parsedJson = JSON.parse(raw);
      const result = buildResult(parsedJson);
      if (result) return result;
    } catch {
      // Ignora JSON inválido e segue para os outros formatos.
    }
  }

  try {
    const parsedUrl = new URL(raw);
    const urlParams = Object.fromEntries(parsedUrl.searchParams.entries());
    const result = buildResult(urlParams);
    if (result) return result;
  } catch {
    // Não é URL, segue fluxo.
  }

  const normalizedPairs = raw.replace(/[;,|]/g, "&");
  if (normalizedPairs.includes("=")) {
    const params = Object.fromEntries(new URLSearchParams(normalizedPairs).entries());
    const result = buildResult(params);
    if (result) return result;
  }

  return null;
};

export default function Correcao() {
  const [selectedAvaliacao, setSelectedAvaliacao] = useState("");
  const [selectedAluno, setSelectedAluno] = useState("");
  const [respostas, setRespostas] = useState({});
  const [correcting, setCorrecting] = useState(false);
  const [result, setResult] = useState(null);
  const [qrFeedback, setQrFeedback] = useState(null);
  const qc = useQueryClient();

  const { data: avaliacoes = [] } = useQuery({ queryKey: ["avaliacoes"], queryFn: () => appClient.entities.Avaliacao.list() });
  const { data: alunos = [] } = useQuery({ queryKey: ["alunos"], queryFn: () => appClient.entities.Aluno.list() });
  const { data: questoes = [] } = useQuery({ queryKey: ["questoes"], queryFn: () => appClient.entities.Questao.list() });

  const createResult = useMutation({
    mutationFn: (d) => appClient.entities.Resultado.create(d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resultados"] })
  });

  const avaliacao = avaliacoes.find(a => a.id === selectedAvaliacao);
  const alunosFiltrados = avaliacao ? alunos.filter(a => a.turma_id === avaliacao.turma_id) : [];
  const questoesAvaliacao = avaliacao?.questoes_ids?.map(id => questoes.find(q => q.id === id)).filter(Boolean) || [];

  const handleCorrigir = async () => {
    if (!selectedAvaliacao || !selectedAluno) return;
    setCorrecting(true);

    const respostasArray = questoesAvaliacao.map(q => ({
      questao_id: q.id,
      resposta: respostas[q.id] || "",
      correta: respostas[q.id] === q.gabarito
    }));

    const totalAcertos = respostasArray.filter(r => r.correta).length;
    const totalQuestoes = questoesAvaliacao.length;
    const percentual = totalQuestoes > 0 ? Math.round((totalAcertos / totalQuestoes) * 100) : 0;
    const nota = totalQuestoes > 0 ? ((totalAcertos / totalQuestoes) * (avaliacao.total_pontos || 10)) : 0;

    const resultado = {
      avaliacao_id: selectedAvaliacao,
      aluno_id: selectedAluno,
      turma_id: avaliacao.turma_id,
      respostas: respostasArray,
      nota: Math.round(nota * 100) / 100,
      total_acertos: totalAcertos,
      total_questoes: totalQuestoes,
      percentual_acerto: percentual,
      status: "corrigido"
    };

    await createResult.mutateAsync(resultado);
    setResult(resultado);
    setCorrecting(false);
  };

  const resetCorrecao = () => {
    setResult(null);
    setRespostas({});
    setSelectedAluno("");
  };

  const handleQrDecoded = (decodedValue) => {
    const parsed = parseQrPayload(decodedValue);
    if (!parsed) {
      setQrFeedback({
        type: "error",
        message: "QR lido, mas o formato não contém avaliação e aluno.",
      });
      return;
    }

    const avaliacaoEncontrada = avaliacoes.find(a => String(a.id) === parsed.avaliacaoId);
    const alunoEncontrado = alunos.find(a => String(a.id) === parsed.alunoId);

    if (!avaliacaoEncontrada || !alunoEncontrado) {
      setQrFeedback({
        type: "error",
        message: "IDs do QR não encontrados na base atual.",
      });
      return;
    }

    if (
      avaliacaoEncontrada.turma_id &&
      alunoEncontrado.turma_id &&
      avaliacaoEncontrada.turma_id !== alunoEncontrado.turma_id
    ) {
      setQrFeedback({
        type: "error",
        message: "A avaliação e o aluno do QR pertencem a turmas diferentes.",
      });
      return;
    }

    setSelectedAvaliacao(avaliacaoEncontrada.id);
    setSelectedAluno(alunoEncontrado.id);
    setRespostas({});
    setResult(null);
    setQrFeedback({
      type: "success",
      message: `QR validado: ${alunoEncontrado.nome} em ${avaliacaoEncontrada.titulo}.`,
    });
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <PageHeader title="Correção" description="Corrija as avaliações dos alunos" />

      {!result ? (
        <div className="space-y-6">
          {/* Seleção */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Avaliação</Label>
                  <Select value={selectedAvaliacao} onValueChange={v => { setSelectedAvaliacao(v); setSelectedAluno(""); setRespostas({}); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione a avaliação" /></SelectTrigger>
                    <SelectContent>{avaliacoes.map(a => <SelectItem key={a.id} value={a.id}>{a.titulo}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Aluno</Label>
                  <Select value={selectedAluno} onValueChange={setSelectedAluno} disabled={!selectedAvaliacao}>
                    <SelectTrigger><SelectValue placeholder="Selecione o aluno" /></SelectTrigger>
                    <SelectContent>{alunosFiltrados.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <QrCode className="w-5 h-5 text-primary" />
                Leitura de QR Code (mobile)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Escaneie o QR da prova para preencher avaliação e aluno automaticamente.
              </p>
              <QrCodeScanner onDecoded={handleQrDecoded} />
              {qrFeedback && (
                <p className={`text-sm ${qrFeedback.type === "success" ? "text-success" : "text-destructive"}`}>
                  {qrFeedback.message}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Marcação de respostas */}
          {questoesAvaliacao.length > 0 && selectedAluno && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ScanLine className="w-5 h-5 text-primary" />
                    Marque as Respostas do Aluno
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {questoesAvaliacao.map((q, idx) => (
                    <div key={q.id} className="p-4 border rounded-xl">
                      <p className="text-sm font-medium text-foreground mb-3">
                        <span className="text-primary font-semibold">Q{idx + 1}.</span> {q.enunciado?.slice(0, 120)}{q.enunciado?.length > 120 ? "..." : ""}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {q.alternativas?.map(a => (
                          <button
                            key={a.letra}
                            onClick={() => setRespostas({ ...respostas, [q.id]: a.letra })}
                            className={`
                              w-10 h-10 rounded-full text-sm font-semibold transition-all duration-200
                              ${respostas[q.id] === a.letra 
                                ? 'bg-primary text-primary-foreground shadow-md scale-110' 
                                : 'bg-muted text-muted-foreground hover:bg-accent'}
                            `}
                          >
                            {a.letra}
                          </button>
                        ))}
                        {respostas[q.id] && (
                          <button onClick={() => { const r = { ...respostas }; delete r[q.id]; setRespostas(r); }} className="text-xs text-muted-foreground hover:text-destructive ml-2">
                            Limpar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Button 
                onClick={handleCorrigir} 
                disabled={correcting || Object.keys(respostas).length === 0}
                className="w-full bg-primary hover:bg-primary/90 h-12 text-base"
              >
                {correcting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                {correcting ? "Corrigindo..." : "Corrigir Avaliação"}
              </Button>
            </>
          )}
        </div>
      ) : (
        /* Resultado */
        <Card>
          <CardContent className="p-8 text-center space-y-6">
            <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${result.percentual_acerto >= 60 ? 'bg-success/10' : 'bg-destructive/10'}`}>
              {result.percentual_acerto >= 60 
                ? <CheckCircle2 className="w-10 h-10 text-success" />
                : <XCircle className="w-10 h-10 text-destructive" />
              }
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Correção Concluída</h2>
              <p className="text-muted-foreground mt-1">
                {alunos.find(a => a.id === selectedAluno)?.nome} — {avaliacao?.titulo}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-md mx-auto">
              <div className="p-4 rounded-xl bg-primary/10">
                <p className="text-2xl font-bold text-primary">{result.nota}</p>
                <p className="text-xs text-muted-foreground">Nota</p>
              </div>
              <div className="p-4 rounded-xl bg-success/10">
                <p className="text-2xl font-bold text-success">{result.total_acertos}/{result.total_questoes}</p>
                <p className="text-xs text-muted-foreground">Acertos</p>
              </div>
              <div className="p-4 rounded-xl bg-warning/10">
                <p className="text-2xl font-bold text-warning">{result.percentual_acerto}%</p>
                <p className="text-xs text-muted-foreground">Aproveitamento</p>
              </div>
            </div>
            <Progress value={result.percentual_acerto} className="max-w-md mx-auto" />

            <div className="text-left max-w-md mx-auto space-y-2">
              {result.respostas?.map((r, idx) => (
                <div key={idx} className={`flex items-center justify-between p-3 rounded-lg ${r.correta ? 'bg-success/5' : 'bg-destructive/5'}`}>
                  <span className="text-sm font-medium">Questão {idx + 1}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Resp: {r.resposta || "—"}</span>
                    {r.correta ? <CheckCircle2 className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-destructive" />}
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={resetCorrecao} className="mt-4">Corrigir Outra Prova</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
