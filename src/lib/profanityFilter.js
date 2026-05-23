// Palavras ofensivas em português brasileiro e termos de conteúdo adulto
const PROFANITY_LIST = [
  "porra","caralho","buceta","puta","putaria","viado","viadinho","cuzão","cú",
  "cu","xereca","xota","xoxota","piroca","rola","pau","punheta","foda","fodase",
  "foda-se","fodendo","foder","fuder","fuderoso","desgraça","desgraçado","merda",
  "merdoso","pinto","pica","cagar","cagado","cagão","vagabunda","vagabundo",
  "safada","safado","vaca","egua","égua","arregaçar","arrombado","arrombada",
  "filho da puta","filha da puta","fdp","vsf","vtnc","vtmnc","tnc","kkk","kk",
  "sexo","porno","pornô","pornografia","nude","nudes","pelada","pelado","seio",
  "pênis","vagina","anal","oral","sexo oral","sexo anal","puteiro","bordel",
  "prostituta","prostituto","michê","programa","programar","stripper","striptease",
  "orgasmo","ejaculação","masturbação","masturbar","pornhub","xvideos","xnxx",
  "redtube","brazzers","incesto","pedofilia","estupro","abuso","violação",
];

const ADULT_KEYWORDS = [
  "pornografia","porno","pornô","nude","nudes","pelada","pelado","stripper",
  "striptease","orgasmo","ejaculação","masturbação","pornhub","xvideos","xnxx",
  "redtube","brazzers","incesto","pedofilia","estupro","conteúdo adulto",
  "conteudo adulto","xxx","18+","content adulto","adult content","explicit",
];

const normalize = (text) =>
  String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");

export const containsProfanity = (text) => {
  const normalized = normalize(text);
  return PROFANITY_LIST.some((word) => {
    const normWord = normalize(word);
    const regex = new RegExp(`(?:^|\\s|[^a-z])${normWord}(?:$|\\s|[^a-z])`, "i");
    return regex.test(normalized) || normalized.includes(normWord);
  });
};

export const containsAdultContent = (text) => {
  const normalized = normalize(text);
  return ADULT_KEYWORDS.some((word) => normalized.includes(normalize(word)));
};

export const checkContent = (text) => {
  if (containsProfanity(text)) return { ok: false, reason: "profanity" };
  if (containsAdultContent(text)) return { ok: false, reason: "adult" };
  return { ok: true };
};
