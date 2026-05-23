const PROFANITY_LIST = [
  "porra","caralho","buceta","puta","putaria","viado","viadinho","cuzao","xereca",
  "xota","xoxota","piroca","punheta","foda","fodase","foda se","fodendo","foder",
  "fuder","desgraca","desgraçado","merda","merdoso","cagar","cagado","cagao",
  "vagabunda","vagabundo","safada","safado","arregacar","arrombado","arrombada",
  "filho da puta","filha da puta","fdp","vsf","vtnc","vtmnc","tnc",
  "pornografia","porno","nude","nudes","stripper","striptease","orgasmo",
  "ejaculacao","masturbacao","masturbar","pornhub","xvideos","xnxx",
  "redtube","brazzers","incesto","pedofilia","estupro","puteiro","bordel",
  "prostituta","prostituto","miche",
];

const ADULT_KEYWORDS = [
  "pornografia","porno","pornô","nude","nudes","stripper","striptease",
  "orgasmo","ejaculação","masturbação","pornhub","xvideos","xnxx",
  "redtube","brazzers","incesto","pedofilia","estupro","conteudo adulto",
  "xxx","adult content","explicit",
];

const normalize = (text) =>
  String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const containsProfanity = (text) => {
  const normalized = normalize(text);
  return PROFANITY_LIST.some((word) => {
    const normWord = normalize(word);
    // Usa limites de palavra: nao pode ter letra/numero antes ou depois
    const regex = new RegExp(`(?<![a-z0-9])${normWord}(?![a-z0-9])`, "i");
    return regex.test(normalized);
  });
};

export const containsAdultContent = (text) => {
  const normalized = normalize(text);
  return ADULT_KEYWORDS.some((word) => {
    const normWord = normalize(word);
    const regex = new RegExp(`(?<![a-z0-9])${normWord}(?![a-z0-9])`, "i");
    return regex.test(normalized);
  });
};

export const checkContent = (text) => {
  if (containsProfanity(text)) return { ok: false, reason: "profanity" };
  if (containsAdultContent(text)) return { ok: false, reason: "adult" };
  return { ok: true };
};
